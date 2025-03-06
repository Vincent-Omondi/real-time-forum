package controllers

import (
	"database/sql"
	"encoding/json"
	"log"
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

	var user models.User
	err := pc.db.QueryRow(`
		SELECT id, nickname, first_name, last_name, email, created_at
		FROM users 
		WHERE id = ?`, userID).Scan(
		&user.ID,
		&user.Nickname,
		&user.FirstName,
		&user.LastName,
		&user.Email,
		&user.CreatedAt,
	)

	if err == sql.ErrNoRows {
		logger.Error("No user found with ID: %d", userID)
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	if err != nil {
		logger.Error("Database error when fetching user: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	// Convert user data to profile response
	profileResponse := models.ProfileResponse{
		Nickname:  user.Nickname,
		FirstName: user.FirstName,
		LastName:  user.LastName,
		Email:     user.Email,
		CreatedAt: user.CreatedAt.Format("2006-01-02T15:04:05Z07:00"), // RFC3339 format
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(profileResponse)
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
		SET first_name = ?, last_name = ?, updated_at = ?
		WHERE id = ?`,
		updateReq.FirstName,
		updateReq.LastName,
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
        SELECT p.id, p.title, p.content, p.timestamp,
               COALESCE(COUNT(l.id), 0) as likes,
               COALESCE(EXISTS(SELECT 1 FROM likes l2 WHERE l2.post_id = p.id AND l2.user_id = ? AND l2.user_vote = 'like'), 0) as is_liked
        FROM posts p
        LEFT JOIN likes l ON p.id = l.post_id AND l.user_vote = 'like'
        WHERE p.user_id = ?
        GROUP BY p.id, p.title, p.content, p.timestamp
        ORDER BY p.timestamp DESC`, userID, userID)

    if err != nil {
        log.Printf("Database query error: %v", err)
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
            log.Printf("Scan error: %v", err)
            continue
        }
        
        activities = append(activities, activity)
    }

    if err := rows.Err(); err != nil {
        log.Printf("Rows iteration error: %v", err)
        http.Error(w, "Database error", http.StatusInternalServerError)
        return
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
        SELECT p.id, p.title, p.content, p.timestamp,
               COALESCE(COUNT(l.id), 0) as total_likes,
               TRUE as is_liked
        FROM posts p
        INNER JOIN likes l ON p.id = l.post_id
        WHERE l.user_id = ? AND l.user_vote = 'like'
        GROUP BY p.id, p.title, p.content, p.timestamp
        ORDER BY l.id DESC`, userID)

    if err != nil {
        log.Printf("Database query error: %v", err)
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
            log.Printf("Scan error: %v", err)
            continue
        }
        
        activities = append(activities, activity)
    }

    if err := rows.Err(); err != nil {
        log.Printf("Rows iteration error: %v", err)
        http.Error(w, "Database error", http.StatusInternalServerError)
        return
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(activities)
}
