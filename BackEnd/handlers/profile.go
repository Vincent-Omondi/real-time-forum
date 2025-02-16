package handlers

import (
	"database/sql"
	"net/http"

	"github.com/Vincent-Omondi/real-time-forum/BackEnd/controllers"
)

// ProfileHandler wraps profile-related handlers
type ProfileHandler struct {
	controller *controllers.ProfileController
}

// NewProfileHandler creates a new profile handler
func NewProfileHandler(db *sql.DB) *ProfileHandler {
	return &ProfileHandler{
		controller: controllers.NewProfileController(db),
	}
}

// GetProfileHandler handles fetching user profile data
func (h *ProfileHandler) GetProfileHandler(w http.ResponseWriter, r *http.Request) {
	h.controller.GetUserProfile(w, r)
}

// UpdateProfileHandler handles updating user profile data
func (h *ProfileHandler) UpdateProfileHandler(w http.ResponseWriter, r *http.Request) {
	h.controller.UpdateUserProfile(w, r)
}

// GetUserPostsHandler handles fetching user's posts
func (h *ProfileHandler) GetUserPostsHandler(w http.ResponseWriter, r *http.Request) {
	h.controller.GetUserPosts(w, r)
}

// GetUserLikesHandler handles fetching posts liked by the user
func (h *ProfileHandler) GetUserLikesHandler(w http.ResponseWriter, r *http.Request) {
	h.controller.GetUserLikes(w, r)
}
