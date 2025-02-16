package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/Vincent-Omondi/real-time-forum/BackEnd/database"
)

func LoginPageHandler(w http.ResponseWriter, r *http.Request) {
	loggedIn, _ := isLoggedIn(database.GloabalDB, r)
	if loggedIn {
		http.Redirect(w, r, "/", http.StatusSeeOther)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "success",
		"data": map[string]interface{}{
			"isAuthenticated": false,
		},
	})
}
