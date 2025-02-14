package middleware

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/Vincent-Omondi/real-time-forum/BackEnd/database"
	"github.com/Vincent-Omondi/real-time-forum/BackEnd/logger"
)

// PublicPaths contains routes that don't require authentication
var PublicPaths = map[string]bool{
    "/login":        true,
    "/register":     true,
    "/api/login":    true,
    "/api/register": true,
    "/api/check-auth": true,
    "/api/logout":   true,
    "/static/":      true,
    "/assets/":      true,
    "/favicon.ico":  true,
}

// AuthMiddleware checks if the user is authenticated
func AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Check if path is public
		path := r.URL.Path
		if isPublicPath(path) {
			next.ServeHTTP(w, r)
			return
		}

		// Get session cookie
		cookie, err := r.Cookie("session_token")
		if err != nil {
			if strings.HasPrefix(r.URL.Path, "/api/") {
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
				return
			}
			http.Redirect(w, r, "/login", http.StatusSeeOther)
			return
		}
		

		// Check if user is authenticated by validating the session token
		userID, err := validateSessionToken(cookie.Value)
		if err != nil {
			logger.Warning("Invalid session for path %s from %s: %v", path, r.RemoteAddr, err)
			http.Redirect(w, r, "/login", http.StatusSeeOther)
			return
		}

		// Add user ID to request context for later use
		ctx := r.Context()
		ctx = context.WithValue(ctx, "userID", userID)
		r = r.WithContext(ctx)

		next.ServeHTTP(w, r)
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
