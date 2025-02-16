package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/Vincent-Omondi/real-time-forum/BackEnd/controllers"
	"github.com/Vincent-Omondi/real-time-forum/BackEnd/logger"
)

type ViewPostHandler struct {
	db *sql.DB
}

func NewViewPostHandler(db *sql.DB) http.HandlerFunc {
	return (&ViewPostHandler{db: db}).ServeHTTP
}

func (h *ViewPostHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	// Extract post ID from URL path
	path := r.URL.Path
	postID := path[len("/api/posts/"):]
	logger.Info("Attempting to fetch post with ID: %s", postID)

	if postID == "" {
		logger.Error("Post ID is empty")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status": "error",
			"error":  "Post ID is required",
		})
		return
	}

	// Check if user is logged in
	loggedIn, userID := isLoggedIn(h.db, r)
	logger.Info("User login status - loggedIn: %v, userID: %v", loggedIn, userID)

	// Generate CSRF token if user is logged in
	var csrfToken string
	if loggedIn {
		sessionToken, err := controllers.GetSessionToken(r)
		if err != nil {
			logger.Error("Error getting session token: %s", err)
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"status": "error",
				"error":  "Internal server error",
			})
			return
		}
		csrfToken, _ = controllers.GenerateCSRFToken(h.db, sessionToken)
	}

	// Create a PostController instance
	postController := controllers.NewPostController(h.db)

	// Fetch the post from the database
	logger.Info("Fetching post from database with ID: %s", postID)
	post, err := postController.GetPostByID(postID)
	if err != nil {
		logger.Error("Failed to fetch post: %v", err)
		if err == sql.ErrNoRows {
			w.WriteHeader(http.StatusNotFound)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"status": "error",
				"error":  "Post not found",
			})
		} else {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"status": "error",
				"error":  fmt.Sprintf("Failed to fetch post: %v", err),
			})
		}
		return
	}
	logger.Info("Successfully fetched post: %+v", post)

	// Determine if the logged-in user is the post author
	isAuthor := loggedIn && userID == post.UserID

	// Create CommentController and fetch comments
	commentController := controllers.NewCommentController(h.db)
	comments, err := commentController.GetCommentsByPostID(postID)
	if err != nil {
		logger.Error("Failed to fetch comments: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status": "error",
			"error":  "Failed to fetch comments",
		})
		return
	}

	// Get total comment count
	commentCount, err := commentController.GetCommentCountByPostID(post.ID)
	if err != nil {
		logger.Error("Failed to fetch comment count: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status": "error",
			"error":  "Failed to fetch comment count",
		})
		return
	}
	post.CommentCount = commentCount

	response := map[string]interface{}{
		"status": "success",
		"data": map[string]interface{}{
			"isAuthenticated": loggedIn,
			"isAuthor":        isAuthor,
			"csrfToken":       csrfToken,
			"post":            post,
			"comments":        comments,
			"userId":          userID,
			"maxDepth":        3,
		},
	}

	if err := json.NewEncoder(w).Encode(response); err != nil {
		logger.Error("Failed to encode response: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status": "error",
			"error":  "Failed to encode response",
		})
		return
	}
}
