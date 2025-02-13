// handles/auth.go
package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"

	"github.com/Vincent-Omondi/real-time-forum/BackEnd/auth"
	"github.com/Vincent-Omondi/real-time-forum/BackEnd/controllers"
	"github.com/Vincent-Omondi/real-time-forum/BackEnd/database"
	"github.com/Vincent-Omondi/real-time-forum/BackEnd/logger"
	"github.com/Vincent-Omondi/real-time-forum/BackEnd/models"
)

// RegisterHandler registers a new user
func RegisterHandler(ac *controllers.AuthController) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req models.RegisterRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			logger.Error("Failed to decode registration request: %v", err)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{
				"error": "Invalid input",
			})
			return
		}

		logger.Debug("Registration attempt for email: %s, username: %s", req.Email, req.Username)

		// Validate email
		if !ac.IsValidEmail(req.Email) {
			logger.Warning("Invalid email format attempted: %s", req.Email)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{
				"error": "Invalid email format",
			})
			return
		}

		// Validate username
		if !ac.IsValidUsername(req.Username) {
			logger.Warning("Invalid username format attempted: %s", req.Username)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{
				"error": "Username must be between 3 and 20 characters and contain only letters, numbers, and underscores",
			})
			return
		}

		// Validate password
		if !ac.IsValidPassword(req.Password) {
			logger.Warning("Invalid password format for user: %s", req.Username)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{
				"error": "Password must be at least 8 characters long and include uppercase, lowercase, numbers, and special characters",
			})
			return
		}

		// Sanitize inputs
		sanitizedEmail := ac.SanitizeInput(req.Email)
		sanitizedUsername := ac.SanitizeInput(req.Username)

		userID, err := ac.RegisterUser(sanitizedEmail, sanitizedUsername, req.Password)
		if err != nil {
			logger.Error("Registration failed for user %s: %v", sanitizedUsername, err)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{
				"error": err.Error(),
			})
			return
		}

		auth.CreateSession(ac.DB, w, int(userID))
		logger.Info("Successfully registered user: %s (ID: %d)", sanitizedUsername, userID)

		w.WriteHeader(302)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"redirect": "/",
		})
	}
}

// LoginHandler authenticates and creates a session
func LoginHandler(ac *controllers.AuthController) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Username string `json:"username"`
			Password string `json:"password"`
		}

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			logger.Error("Failed to decode login request: %v", err)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{
				"error": "Invalid input",
			})
			return
		}

		// Check for missing fields
		if req.Username == "" || req.Password == "" {
			logger.Warning("Login attempt with missing fields")
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{
				"error": "Invalid input",
			})
			return
		}

		logger.Debug("Login attempt for username: %s", req.Username)

		user, err := ac.AuthenticateUser(req.Username, req.Password)
		if err != nil {
			logger.Warning("Failed login attempt for user %s: %v", req.Username, err)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(map[string]string{
				"error": "Invalid username or password",
			})
			return
		}

		auth.CreateSession(ac.DB, w, user.ID)
		logger.Info("Successful login for user: %s (ID: %d)", user.Username, user.ID)

		// Set headers first
		w.Header().Set("Content-Type", "application/json")
		// Then set status code
		w.WriteHeader(http.StatusFound) // 302 Found
		// Finally write the response body
		json.NewEncoder(w).Encode(map[string]string{
			"redirect": "/",
		})
	}
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

func LogoutHandler(w http.ResponseWriter, r *http.Request) {
	// Get the session cookie
	cookie, err := r.Cookie("session_token")
	if err != nil {
		logger.Debug("Logout attempted with no active session")
		w.WriteHeader(http.StatusUnauthorized)
		return
	}

	// Delete the session from the database
	sessionToken := cookie.Value
	err = controllers.DeleteSession(database.GloabalDB, sessionToken)
	if err != nil {
		logger.Error("Failed to delete session: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	// Clear the session cookie on the client
	http.SetCookie(w, &http.Cookie{
		Name:     "session_token",
		Value:    "",
		Path:     "/",
		MaxAge:   -1, // Expire the cookie immediately
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteStrictMode,
	})

	logger.Info("User successfully logged out")
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"message": "User is logged out succesfully",
	})
}
