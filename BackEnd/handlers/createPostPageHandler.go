package handlers

import (
	"net/http"
	"text/template"

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

	data := struct {
		IsAuthenticated bool
		CSRFToken       string
		UserID          int
	}{
		IsAuthenticated: loggedIn,
		CSRFToken:       csrfToken,
		UserID:          UserID,
	}

	tmpl, err := template.ParseFiles(
		"./FrontEnd/templates/layout.html",
		"./FrontEnd/templates/post.html",
	)
	if err != nil {
		logger.Error("An error Occurred While rendering Template %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	err = tmpl.Execute(w, data)
	if err != nil {
		logger.Error("An error Occurred While rendering Template %v", err)
		w.WriteHeader(http.StatusInternalServerError)
	}
}
