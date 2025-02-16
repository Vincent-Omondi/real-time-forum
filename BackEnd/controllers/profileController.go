package controllers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"time"

	"github.com/Vincent-Omondi/real-time-forum/BackEnd/logger"
	"github.com/Vincent-Omondi/real-time-forum/BackEnd/models"
)

type ProfileController struct {
	db *sql.DB
}

func NewProfileController(db *sql.DB) *ProfileController {
	return &ProfileController{db: db}
}

// GetUserProfile handles the retrieval of user profile information
func (pc *ProfileController) GetUserProfile(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(int)
	if !ok {
		logger.Error("Failed to get userID from context")
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var profile models.Profile
	err := pc.db.QueryRow(`
		SELECT id, nickname, email, created_at,
			   COALESCE(bio, '') as bio, 
			   COALESCE(avatar_url, '') as avatar_url
		FROM users 
		WHERE id = ?`, userID).Scan(
		&profile.ID,
		&profile.Nickname,
		&profile.Email,
		&profile.CreatedAt,
		&profile.Bio,
		&profile.AvatarURL,
	)

	if err == sql.ErrNoRows {
		logger.Error("No user found with ID: %d", userID)
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	if err != nil {
		logger.Error("Database error when fetching profile: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(profile.ToResponse())
}

// UpdateUserProfile handles the updating of user profile information
func (pc *ProfileController) UpdateUserProfile(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(int)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var updateReq models.ProfileUpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&updateReq); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if err := updateReq.ValidateProfileUpdate(); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	result, err := pc.db.Exec(`
		UPDATE users 
		SET bio = ?, avatar_url = ?, updated_at = ?
		WHERE id = ?`,
		updateReq.Bio,
		updateReq.AvatarURL,
		time.Now(),
		userID,
	)

	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil || rowsAffected == 0 {
		http.Error(w, "Failed to update profile", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Profile updated successfully",
	})
}

// GetUserPosts retrieves all posts created by the user
func (pc *ProfileController) GetUserPosts(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(int)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	rows, err := pc.db.Query(`
		SELECT p.id, p.title, p.content, p.created_at,
			   (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) as likes,
			   EXISTS(SELECT 1 FROM post_likes WHERE post_id = p.id AND user_id = ?) as is_liked
		FROM posts p
		WHERE p.user_id = ?
		ORDER BY p.created_at DESC`, userID, userID)

	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var activities []models.UserActivity
	for rows.Next() {
		var activity models.UserActivity
		if err := rows.Scan(
			&activity.ID,
			&activity.Title,
			&activity.Content,
			&activity.CreatedAt,
			&activity.Likes,
			&activity.IsLiked,
		); err != nil {
			continue
		}
		activities = append(activities, activity)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(activities)
}

// GetUserLikes retrieves all posts liked by the user
func (pc *ProfileController) GetUserLikes(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(int)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	rows, err := pc.db.Query(`
		SELECT p.id, p.title, p.content, p.created_at,
			   (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) as likes,
			   TRUE as is_liked
		FROM posts p
		INNER JOIN post_likes pl ON p.id = pl.post_id
		WHERE pl.user_id = ?
		ORDER BY pl.created_at DESC`, userID)

	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var activities []models.UserActivity
	for rows.Next() {
		var activity models.UserActivity
		if err := rows.Scan(
			&activity.ID,
			&activity.Title,
			&activity.Content,
			&activity.CreatedAt,
			&activity.Likes,
			&activity.IsLiked,
		); err != nil {
			continue
		}
		activities = append(activities, activity)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(activities)
}
