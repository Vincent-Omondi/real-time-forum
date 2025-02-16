package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"

	"github.com/Vincent-Omondi/real-time-forum/BackEnd/controllers"
	"github.com/Vincent-Omondi/real-time-forum/BackEnd/logger"
	"github.com/Vincent-Omondi/real-time-forum/BackEnd/models"
)

type HomePageHandler struct {
	db *sql.DB
}

func NewHomePageHandler(db *sql.DB) http.HandlerFunc {
	return (&HomePageHandler{db: db}).ServeHTTP
}

func (h *HomePageHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	// Check if user is logged in
	loggedIn, userID := isLoggedIn(h.db, r)
	var csrfToken string
	if loggedIn {
		sessionToken, err := controllers.GetSessionToken(r)
		if err != nil {
			logger.Error("Error getting session token: %s", err)
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"error": "Failed to get session token",
			})
			return
		}
		// Generate CSRF token for the session
		csrfToken, err = controllers.GenerateCSRFToken(h.db, sessionToken)
		if err != nil {
			logger.Error("Error generating CSRF token: %V", err)
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"error": "Failed to generate CSRF token",
			})
			return
		}
	}

	// Create a PostController instance using the handler's db
	postController := controllers.NewPostController(h.db)
	// Fetch posts from the database using the controller
	posts, err := postController.GetAllPosts()
	if err != nil {
		logger.Error("Failed to fetch Posts %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"error": "Failed to fetch posts",
		})
		return
	}

	// Add IsAuthor field to each post and fetch comment count
	commentController := controllers.NewCommentController(h.db)
	for i := range posts {
		posts[i].IsAuthor = loggedIn && posts[i].UserID == userID

		// Fetch total comment count including replies
		commentCount, err := commentController.GetCommentCountByPostID(posts[i].ID)
		if err != nil {
			logger.Error("Failed to fetch comment count for post %d: %v", posts[i].ID, err)
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"error": "Failed to fetch comment count",
			})
			return
		}
		posts[i].Comments = make([]models.Comment, 0)
		posts[i].CommentCount = commentCount
	}

	response := map[string]interface{}{
		"status": "success",
		"data": map[string]interface{}{
			"isAuthenticated": loggedIn,
			"csrfToken":       csrfToken,
			"posts":           posts,
			"userId":          userID,
		},
	}

	if err := json.NewEncoder(w).Encode(response); err != nil {
		logger.Error("Failed to encode response: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"error": "Failed to encode response",
		})
		return
	}
}
