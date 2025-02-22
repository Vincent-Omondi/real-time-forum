package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/Vincent-Omondi/real-time-forum/BackEnd/controllers"
	"github.com/Vincent-Omondi/real-time-forum/BackEnd/logger"
)

type CommentVoteRequest struct {
	CommentId int    `json:"commentId"`
	VoteType  string `json:"voteType"`
}

func CreateCommentVoteHandler(cc *controllers.CommentVotesController) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		// Check if user is logged in
		loggedIn, userID := isLoggedIn(cc.DB, r)
		if !loggedIn {
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"status": "error",
				"error":  "Must be logged in to vote",
			})
			return
		}

		// Parse JSON request body
		var voteReq CommentVoteRequest
		if err := json.NewDecoder(r.Body).Decode(&voteReq); err != nil {
			logger.Error("Error parsing request body: %v", err)
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"status": "error",
				"error":  "Invalid request format",
			})
			return
		}

		// Log the received request
		logger.Info("Received vote request: commentId=%d, voteType=%s, userId=%d",
			voteReq.CommentId, voteReq.VoteType, userID)

		// Validate vote type
		if voteReq.VoteType != "like" && voteReq.VoteType != "dislike" {
			logger.Warning("Invalid vote type: %s", voteReq.VoteType)
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"status": "error",
				"error":  "Invalid vote type",
			})
			return
		}

		// Handle the vote
		err := cc.HandleCommentVote(voteReq.CommentId, userID, voteReq.VoteType)
		if err != nil {
			logger.Error("Failed to handle comment vote: %v", err)
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"status": "error",
				"error":  err.Error(),
			})
			return
		}

		// Get updated vote counts
		likes, dislikes, err := cc.GetCommentVotes(voteReq.CommentId)
		if err != nil {
			logger.Error("Failed to get updated vote counts: %v", err)
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"status": "error",
				"error":  "Failed to get updated vote counts",
			})
			return
		}

		// Log success
		logger.Info("Successfully processed vote: commentId=%d, new counts: likes=%d, dislikes=%d",
			voteReq.CommentId, likes, dislikes)

		// Return success response
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status": "success",
			"data": map[string]interface{}{
				"likes":    likes,
				"dislikes": dislikes,
			},
		})
	}
}

func GetUserCommentVotesHandler(cc *controllers.CommentVotesController) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		// Check if user is logged in
		loggedIn, userID := isLoggedIn(cc.DB, r)
		if !loggedIn {
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"status": "error",
				"error":  "Must be logged in to get votes",
			})
			return
		}

		// Get user's votes
		userVotes, err := cc.GetUserVotes(userID)
		if err != nil {
			logger.Error("Failed to fetch user comment votes: %v", err)
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"status": "error",
				"error":  "Failed to fetch user votes",
			})
			return
		}

		// Return success response
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status": "success",
			"data":   userVotes,
		})
	}
}
