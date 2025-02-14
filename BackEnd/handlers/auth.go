// handles/auth.go
package handlers

import (
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/Vincent-Omondi/real-time-forum/BackEnd/controllers"
	"github.com/Vincent-Omondi/real-time-forum/BackEnd/database"
	"github.com/Vincent-Omondi/real-time-forum/BackEnd/logger"
	"github.com/Vincent-Omondi/real-time-forum/BackEnd/models"
)

// RegisterHandler handles new user registration
func RegisterHandler(ac *controllers.AuthController) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		fmt.Println("Register Hnadler called")
		var req models.RegisterRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			logger.Error("Failed to decode registration request: %v", err)
			http.Error(w, "Invalid request format", http.StatusBadRequest)
			return
		}

		// Create user from request
		user, err := ac.Register(&req)
		if err != nil {
			logger.Warning("Registration failed: %v", err)
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		// Create session token
		sessionToken, err := createSession(user.ID)
		if err != nil {
			logger.Error("Failed to create session: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		// Set session cookie
		http.SetCookie(w, &http.Cookie{
			Name:     "session_token",
			Value:    sessionToken,
			Path:     "/",
			Expires:  time.Now().Add(24 * time.Hour),
			HttpOnly: true,
			Secure:   true,
			SameSite: http.SameSiteStrictMode,
		})

		logger.Info("Successfully registered user: %s", req.Nickname)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"message": "Registration successful",
		})
	}
}

// LoginHandler handles user authentication
func LoginHandler(ac *controllers.AuthController) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		fmt.Println("LoginHandler called") 
		var req models.LoginRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			logger.Error("Failed to decode login request: %v", err)
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		// Authenticate user
		user, err := ac.Login(&req)
		if err != nil {
			logger.Warning("Login failed: %v", err)
			http.Error(w, "Invalid credentials", http.StatusUnauthorized)
			return
		}

		// Create session token
		sessionToken, err := createSession(user.ID)
		if err != nil {
			logger.Error("Failed to create session: %v", err)
			w.WriteHeader(http.StatusBadRequest)
			return
		}
 fmt.Println("sessionToken created")
		// Set session cookie
		http.SetCookie(w, &http.Cookie{
			Name:     "session_token",
			Value:    sessionToken,
			Path:     "/",
			Expires:  time.Now().Add(24 * time.Hour),
			HttpOnly: true,
			Secure:   true,
			SameSite: http.SameSiteStrictMode,
		})

		logger.Info("Successfully logged in user: %s", user.Nickname)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"message": "Login successful",
		})
	}
}

// LogoutHandler handles user logout
func LogoutHandler(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie("session_token")
	if err != nil {
		logger.Debug("Logout attempted with no session")
		http.Error(w, "Not logged in", http.StatusUnauthorized)
		return
	}

	// Delete session from database
	if err := deleteSession(cookie.Value); err != nil {
		logger.Error("Failed to delete session: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Clear the cookie
	http.SetCookie(w, &http.Cookie{
		Name:     "session_token",
		Value:    "",
		Path:     "/",
		Expires:  time.Now().Add(-1 * time.Hour),
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteStrictMode,
	})

	logger.Info("User logged out successfully")
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Logged out successfully",
	})
}

// Helper functions for session management
func createSession(userID int) (string, error) {
	sessionToken := generateSessionToken() // You'll need to implement this
	expiresAt := time.Now().Add(24 * time.Hour)

	query := `INSERT INTO sessions (session_token, user_id, expires_at) 
             VALUES (?, ?, ?)`

	_, err := database.GloabalDB.Exec(query, sessionToken, userID, expiresAt)
	if err != nil {
		return "", err
	}

	return sessionToken, nil
}

func deleteSession(token string) error {
	query := `DELETE FROM sessions WHERE session_token = ?`
	_, err := database.GloabalDB.Exec(query, token)
	return err
}

func generateSessionToken() string {
	// Generate a random string for session token
	// You can use crypto/rand to generate a secure random token
	b := make([]byte, 32)
	_, err := rand.Read(b)
	if err != nil {
		return ""
	}
	return base64.URLEncoding.EncodeToString(b)
}

func isLoggedIn(db *sql.DB, r *http.Request) (bool, int) {
	// Get the session_token cookie from the request
	cookie, err := r.Cookie("session_token")
	if err != nil {
		return false, 0 // No cookie found
	}

	// Check if the session_token exists in the Sessions map
	userID, exists := controllers.IsValidSession(db, cookie.Value)
	if !exists {
		return false, 0 // Invalid session_token
	}

	// User is logged in, return true and the user's ID
	return true, userID
}

func CheckLoginHandler(w http.ResponseWriter, r *http.Request) {
	loggedIn, userID := isLoggedIn(database.GloabalDB, r)

	logger.Debug("Verifying logged-in status for user ID: %d", userID)
	logger.Info("User %d loggin status: %v", userID, loggedIn)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]bool{
		"loggedIn": loggedIn,
	})
}
