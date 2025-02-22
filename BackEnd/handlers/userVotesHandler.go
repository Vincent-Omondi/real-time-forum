package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/Vincent-Omondi/real-time-forum/BackEnd/controllers"
	"github.com/Vincent-Omondi/real-time-forum/BackEnd/logger"
	"github.com/Vincent-Omondi/real-time-forum/BackEnd/models"
)

// VoteRequest defines the structure for vote requests
type VoteRequest struct {
	PostID int    `json:"post_id"`
	Vote   string `json:"vote"`
}

func CreateUserVoteHandler(lc *controllers.LikesController) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Set JSON content type for all responses
		w.Header().Set("Content-Type", "application/json")

		// Check if the user is logged in
		loggedIn, userID := isLoggedIn(lc.DB, r)
		if !loggedIn {
			logger.Warning("Unauthorized attempt to create like - remote_addr: %s, method: %s, path: %s, user_id: %d",
				r.RemoteAddr,
				r.Method,
				r.URL.Path,
				userID,
			)
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(map[string]string{
				"message": "Must be logged in to like a post",
			})
			return
		}

		// Parse JSON request body
		var voteReq VoteRequest
		if err := json.NewDecoder(r.Body).Decode(&voteReq); err != nil {
			logger.Error("Failed to parse JSON request: %v", err)
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{
				"error": "Invalid JSON format",
			})
			return
		}

		logger.Warning("Received vote request - post_id: %d, vote: %s", voteReq.PostID, voteReq.Vote)

		// Validate the vote value
		if voteReq.Vote != "like" && voteReq.Vote != "dislike" {
			logger.Warning("Invalid vote value: %s - remote_addr: %s, method: %s, path: %s",
				voteReq.Vote,
				r.RemoteAddr,
				r.Method,
				r.URL.Path,
			)
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{
				"message": "Vote must be either 'like' or 'dislike'",
			})
			return
		}

		// Handle the vote
		err := lc.HandleVote(voteReq.PostID, userID, voteReq.Vote)
		if err != nil {
			logger.Error("Failed to handle vote: %v", err)
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{
				"error": err.Error(),
			})
			return
		}

		// After updating the post votes, fetch the updated likes count
		likesCount, dislikesCount, err := lc.GetPostVotes(voteReq.PostID)
		if err != nil {
			logger.Error("Failed to fetch updated votes for post %d: %v", voteReq.PostID, err)
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{
				"error": "Failed to fetch updated votes",
			})
			return
		}

		// Return the updated likes and dislikes count
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]int{
			"likes":    likesCount,
			"dislikes": dislikesCount,
		})
	}
}

func GetUserVotesHandler(lc *controllers.LikesController) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		// Check if the user is logged in
		loggedIn, userID := isLoggedIn(lc.DB, r)
		if !loggedIn {
			logger.Warning("Unauthorized attempt to GetUserVotesHandler - remote_addr: %s, method: %s, path: %s, user_id: %d",
				r.RemoteAddr,
				r.Method,
				r.URL.Path,
				userID,
			)
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(map[string]string{
				"message": "Must be logged in to GetUserVotes",
			})
			return
		}

		userVote, err := lc.GetUserVotes(userID)
		if err != nil {
			logger.Error("Failed to get user votes: %v", err)
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{
				"error": "Failed to get user votes",
			})
			return
		}

		json.NewEncoder(w).Encode(userVote)
	}
}

func GetUserPostLikesHandler(lc *controllers.LikesController) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		// Check if user is logged in
		loggedIn, userID := isLoggedIn(lc.DB, r)
		var csrfToken string
		if loggedIn {
			sessionToken, err := controllers.GetSessionToken(r)
			if err != nil {
				logger.Error("Error getting session token: %v", err)
				w.WriteHeader(http.StatusInternalServerError)
				return
			}
			// Generate CSRF token for the session
			csrfToken, err = controllers.GenerateCSRFToken(lc.DB, sessionToken)
			if err != nil {
				logger.Error("Error generating CSRF token: %v", err)
				w.WriteHeader(http.StatusInternalServerError)
				return
			}
		}

		// Fetch posts liked by the logged-in user
		userPosts, err := lc.GetUserLikesPosts(userID)
		if err != nil {
			logger.Error("Failed to fetch liked posts: %v", err)
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{"error": "Failed to fetch liked posts"})
			return
		}

		// Add IsAuthor field and fetch comment count for each post
		commentController := controllers.NewCommentController(lc.DB)
		for i := range userPosts {
			userPosts[i].IsAuthor = loggedIn && userPosts[i].UserID == userID

			commentCount, err := commentController.GetCommentCountByPostID(userPosts[i].ID)
			if err != nil {
				logger.Error("Failed to fetch comment count for post %d: %v", userPosts[i].ID, err)
				w.WriteHeader(http.StatusInternalServerError)
				json.NewEncoder(w).Encode(map[string]string{"error": "Failed to fetch comment count"})
				return
			}
			userPosts[i].Comments = []models.Comment{}
			userPosts[i].CommentCount = commentCount
		}

		// Prepare JSON response payload
		response := struct {
			IsAuthenticated bool          `json:"isAuthenticated"`
			CSRFToken       string        `json:"csrfToken"`
			Posts           []models.Post `json:"posts"`
			UserID          int           `json:"userId"`
		}{
			IsAuthenticated: loggedIn,
			CSRFToken:       csrfToken,
			Posts:           userPosts,
			UserID:          userID,
		}

		json.NewEncoder(w).Encode(response)
	}
}