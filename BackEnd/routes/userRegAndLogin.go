package routes

import (
	"database/sql"
	"net/http"
	"time"

	"github.com/Vincent-Omondi/real-time-forum/BackEnd/handlers"
	"github.com/Vincent-Omondi/real-time-forum/BackEnd/middleware"
)

func UserRegAndLogin(db *sql.DB) {
	// AuthController := controllers.NewAuthController(db)

	// Strict rate limit for authentication attempts
	// authLimiter := middleware.NewRateLimiter(5, time.Minute) // 5 attempts per minute

	// Less strict rate limit for page views
	pageLimiter := middleware.NewRateLimiter(30, time.Minute) // 30 requests per minute

	// ❌ REMOVE `/api/login` (already in `apiRoutes.go`)
	// ❌ REMOVE `/api/register` (already in `apiRoutes.go`)
	// ❌ REMOVE `/api/logout` (already in `apiRoutes.go`)

	// ✅ Serve login page (GET)
	http.HandleFunc("/login", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
			return
		}
		http.ServeFile(w, r, "FrontEnd/index.html")
	})

	// ✅ Serve register page (GET)
	http.HandleFunc("/register", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
			return
		}
		http.ServeFile(w, r, "FrontEnd/index.html")
	})

	// ✅ Check login status (GET)
	http.Handle("/api/check-auth", middleware.ApplyMiddleware(
		http.HandlerFunc(handlers.CheckLoginHandler),
		middleware.SetCSPHeaders,
		middleware.CORSMiddleware,
		pageLimiter.RateLimit,
		middleware.ErrorHandler(handlers.ServeErrorPage),
		middleware.ValidatePathAndMethod("/api/check-auth", http.MethodGet),
	))

	// ✅ OAuth routes
	http.HandleFunc("/googleLogin", handlers.GoogleHandler)
	http.HandleFunc("/auth/google/callback", handlers.CallbackHandler)
	http.HandleFunc("/githubLogin", handlers.GitHubHandler)
	http.HandleFunc("/auth/github/callback", handlers.GitHubCallbackHandler)
}
