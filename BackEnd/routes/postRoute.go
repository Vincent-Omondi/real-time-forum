package routes

import (
	"database/sql"
	"net/http"
	"time"

	"github.com/Vincent-Omondi/real-time-forum/BackEnd/controllers"
	"github.com/Vincent-Omondi/real-time-forum/BackEnd/handlers"
	"github.com/Vincent-Omondi/real-time-forum/BackEnd/middleware"
)

func PostRoutes(db *sql.DB) {
	PostController := controllers.NewPostController(db)

	// Rate limit for post creation
	postLimiter := middleware.NewRateLimiter(10, time.Minute) // 10 posts per minute

	// Less strict limit for viewing
	viewLimiter := middleware.NewRateLimiter(60, time.Minute) // 60 views per minute

	http.Handle("/viewPost", middleware.ApplyMiddleware(
		handlers.NewViewPostHandler(db),
		middleware.SetCSPHeaders,
		middleware.CORSMiddleware,
		viewLimiter.RateLimit,
		middleware.ErrorHandler(handlers.ServeErrorPage),
		middleware.ValidatePathAndMethod("/viewPost", http.MethodGet),
	))

	http.Handle("/create-post", middleware.ApplyMiddleware(
		http.HandlerFunc(handlers.CreatePostPageHandler),
		middleware.SetCSPHeaders,
		middleware.AuthMiddleware,
		middleware.CORSMiddleware,
		postLimiter.RateLimit,
		middleware.ErrorHandler(handlers.ServeErrorPage),
		middleware.ValidatePathAndMethod("/create-post", http.MethodGet),
	))

	http.Handle("/createPost", middleware.ApplyMiddleware(
		handlers.CreatePostHandler(PostController),
		middleware.SetCSPHeaders,
		middleware.AuthMiddleware,
		middleware.CORSMiddleware,
		postLimiter.RateLimit,
		middleware.ErrorHandler(handlers.ServeErrorPage),
		middleware.VerifyCSRFMiddleware(db),
		middleware.ValidatePathAndMethod("/createPost", http.MethodPost),
	))

	http.Handle("/updatePost", middleware.ApplyMiddleware(
		handlers.UpdatePostHandler(PostController),
		middleware.SetCSPHeaders,
		middleware.AuthMiddleware,
		middleware.CORSMiddleware,
		postLimiter.RateLimit,
		middleware.ErrorHandler(handlers.ServeErrorPage),
		middleware.VerifyCSRFMiddleware(db),
		middleware.ValidatePathAndMethod("/updatePost", http.MethodPut),
	))

	http.Handle("/deletePost", middleware.ApplyMiddleware(
		handlers.DeletePostHandler(PostController),
		middleware.SetCSPHeaders,
		middleware.AuthMiddleware,
		middleware.CORSMiddleware,
		postLimiter.RateLimit,
		middleware.ErrorHandler(handlers.ServeErrorPage),
		middleware.VerifyCSRFMiddleware(db),
		middleware.ValidatePathAndMethod("/deletePost", http.MethodDelete),
	))

	http.Handle("/editPost", middleware.ApplyMiddleware(
		handlers.EditPostHandler(PostController),
		middleware.SetCSPHeaders,
		middleware.AuthMiddleware,
		middleware.CORSMiddleware,
		postLimiter.RateLimit,
		middleware.ErrorHandler(handlers.ServeErrorPage),
		middleware.VerifyCSRFMiddleware(db),
		middleware.ValidatePathAndMethod("/editPost", http.MethodGet),
	))
}
