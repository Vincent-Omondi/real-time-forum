package middleware

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/Vincent-Omondi/real-time-forum/BackEnd/controllers"
	"github.com/Vincent-Omondi/real-time-forum/BackEnd/database"
	"github.com/Vincent-Omondi/real-time-forum/BackEnd/logger"
)

// PublicPaths contains routes that don't require authentication
var PublicPaths = map[string]bool{
	"/login":          true,
	"/register":       true,
	"/api/login":      true,
	"/api/register":   true,
	"/api/check-auth": true,
	"/api/logout":     true,
	"/static/":        true,
	"/assets/":        true,
	"/favicon.ico":    true,
}

// AuthMiddleware checks if the user is authenticated
func AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		logger.Info("AuthMiddleware: Checking authentication")

		// Check if path is public
		path := r.URL.Path
		if isPublicPath(path) {
			next.ServeHTTP(w, r)
			return
		}

		// Get session token from cookie
		cookie, err := r.Cookie("session_token")
		if err != nil {
			logger.Error("No session token cookie found: %v", err)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"error":   "Unauthorized",
				"status":  "error",
				"message": "No session token found. Please log in.",
			})
			return
		}

		// Validate session and get userID
		userID, exists := controllers.IsValidSession(database.GloabalDB, cookie.Value)
		if !exists {
			logger.Error("Invalid session token")
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"error":   "Unauthorized",
				"status":  "error",
				"message": "Invalid or expired session. Please log in again.",
			})
			return
		}

		// Add userID to context
		ctx := context.WithValue(r.Context(), "userID", userID)
		logger.Info("AuthMiddleware: Added userID %d to context", userID)

		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// isPublicPath checks if the given path is public
func isPublicPath(path string) bool {
	// Check exact matches
	if PublicPaths[path] {
		return true
	}

	// Check path prefixes
	for publicPath := range PublicPaths {
		if strings.HasSuffix(publicPath, "/") && strings.HasPrefix(path, publicPath) {
			return true
		}
	}

	return false
}

// LogoutMiddleware handles user logout
func LogoutMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/logout" {
			// Delete the session cookie
			cookie := &http.Cookie{
				Name:     "session_token",
				Value:    "",
				Path:     "/",
				Expires:  time.Now().Add(-1 * time.Hour), // Set to expired
				HttpOnly: true,
				Secure:   true,
				SameSite: http.SameSiteStrictMode,
			}
			http.SetCookie(w, cookie)

			// Redirect to login page
			http.Redirect(w, r, "/login", http.StatusSeeOther)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// validateSessionToken checks if the session token is valid and returns the associated user ID
func validateSessionToken(token string) (int, error) {
	// Query the database to validate the session token and get the user ID
	var userID int
	query := `SELECT user_id FROM sessions 
             WHERE session_token = ? AND expires_at > datetime('now')`

	err := database.GloabalDB.QueryRow(query, token).Scan(&userID)
	if err != nil {
		return 0, err
	}

	return userID, nil
}

// Middleware chain to apply multiple middleware functions
func ApplyMiddleware(handler http.Handler, middlewares ...func(http.Handler) http.Handler) http.Handler {
	for _, middleware := range middlewares {
		handler = middleware(handler)
	}
	return handler
}
