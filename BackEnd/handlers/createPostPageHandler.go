package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/Vincent-Omondi/real-time-forum/BackEnd/controllers"
	"github.com/Vincent-Omondi/real-time-forum/BackEnd/database"
	"github.com/Vincent-Omondi/real-time-forum/BackEnd/logger"
)

func CreatePostPageHandler(w http.ResponseWriter, r *http.Request) {
	// Check if user is logged in
	loggedIn, UserID := isLoggedIn(database.GloabalDB, r)
	if !loggedIn {
		http.Redirect(w, r, "/login_Page", http.StatusSeeOther)
		return
	}

	sessioToken, err := controllers.GetSessionToken(r)
	if err != nil {
		logger.Error("Error getting session token: %s", err)
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	// Generate CSRF token
	csrfToken, err := controllers.GenerateCSRFToken(database.GloabalDB, sessioToken)
	if err != nil {
		logger.Error("Error generating CSRF token: %s", err)
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "success",
		"data": map[string]interface{}{
			"isAuthenticated": loggedIn,
			"csrfToken":      csrfToken,
			"userId":         UserID,
		},
	})
}
