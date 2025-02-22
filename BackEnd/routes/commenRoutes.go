package routes

import (
	"database/sql"
	"net/http"
	"time"

	"github.com/Vincent-Omondi/real-time-forum/BackEnd/controllers"
	"github.com/Vincent-Omondi/real-time-forum/BackEnd/handlers"
	"github.com/Vincent-Omondi/real-time-forum/BackEnd/middleware"
)

func CommentRoute(db *sql.DB) {
	commentController := controllers.NewCommentController(db)

	// Rate limit for comments
	commentLimiter := middleware.NewRateLimiter(10, time.Minute) // 10 comments per minute

	// Handle POST /api/posts/{postId}/comments
	http.Handle("/api/posts/", middleware.ApplyMiddleware(
		handlers.CommentHandler(commentController),
		middleware.SetCSPHeaders,
		middleware.AuthMiddleware,
		middleware.CORSMiddleware,
		commentLimiter.RateLimit,
		middleware.ErrorHandler(handlers.ServeErrorPage),
		middleware.VerifyCSRFMiddleware(db),
	))

	// Handle DELETE /api/comments/{commentId}
	http.Handle("/api/comments/", middleware.ApplyMiddleware(
		handlers.DeleteCommentHandler(commentController),
		middleware.SetCSPHeaders,
		middleware.AuthMiddleware,
		middleware.CORSMiddleware,
		commentLimiter.RateLimit,
		middleware.ErrorHandler(handlers.ServeErrorPage),
		middleware.VerifyCSRFMiddleware(db),
	))

	// Handle PUT /api/comments/{commentId}
	http.Handle("/api/comments/", middleware.ApplyMiddleware(
		handlers.UpdateCommentHandler(commentController),
		middleware.SetCSPHeaders,
		middleware.AuthMiddleware,
		middleware.CORSMiddleware,
		commentLimiter.RateLimit,
		middleware.ErrorHandler(handlers.ServeErrorPage),
		middleware.VerifyCSRFMiddleware(db),
	))
}
