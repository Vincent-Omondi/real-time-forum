package routes

import (
	"database/sql"
	"net/http"
	"time"

	"github.com/Vincent-Omondi/real-time-forum/BackEnd/controllers"
	"github.com/Vincent-Omondi/real-time-forum/BackEnd/handlers"
	"github.com/Vincent-Omondi/real-time-forum/BackEnd/logger"
	"github.com/Vincent-Omondi/real-time-forum/BackEnd/middleware"
	"github.com/gorilla/websocket"
)

// Add WebSocket handler type
type WebSocketHandler struct {
	db *sql.DB
}

func (h *WebSocketHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// Upgrade HTTP connection to WebSocket
	upgrader := websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin: func(r *http.Request) bool {
			return true // Allow all origins in development
		},
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		logger.Error("Failed to upgrade to WebSocket: %v", err)
		return
	}
	defer conn.Close()

	// Handle WebSocket connection
	for {
		messageType, p, err := conn.ReadMessage()
		if err != nil {
			logger.Error("WebSocket read error: %v", err)
			return
		}

		// Echo the message back for now
		if err := conn.WriteMessage(messageType, p); err != nil {
			logger.Error("WebSocket write error: %v", err)
			return
		}
	}
}

// APIRoutes sets up all API routes under the /api prefix
func APIRoutes(db *sql.DB) {
	// Controllers
	authController := controllers.NewAuthController(db)
	postController := controllers.NewPostController(db)
	commentController := controllers.NewCommentController(db)
	likesController := controllers.NewLikesController(db)
	commentVotesController := controllers.NewCommentVotesController(db)

	// Rate limiters
	authLimiter := middleware.NewRateLimiter(5, time.Minute)     // 5 attempts per minute
	postLimiter := middleware.NewRateLimiter(10, time.Minute)    // 10 posts per minute
	commentLimiter := middleware.NewRateLimiter(10, time.Minute) // 10 comments per minute
	likesLimiter := middleware.NewRateLimiter(30, time.Minute)   // 30 likes per minute
	viewLimiter := middleware.NewRateLimiter(60, time.Minute)    // 60 views per minute
	pageLimiter := middleware.NewRateLimiter(30, time.Minute)    // 30 requests per minute

	// Auth routes
	http.Handle("/api/login", middleware.ApplyMiddleware(
		handlers.LoginHandler(authController),
		middleware.SetCSPHeaders,
		middleware.CORSMiddleware,
		authLimiter.RateLimit,
		middleware.ErrorHandler(handlers.ServeErrorPage),
		middleware.ValidatePathAndMethod("/api/login", http.MethodPost),
	))

	http.Handle("/api/register", middleware.ApplyMiddleware(
		handlers.RegisterHandler(authController),
		middleware.SetCSPHeaders,
		middleware.CORSMiddleware,
		authLimiter.RateLimit,
		middleware.ErrorHandler(handlers.ServeErrorPage),
		middleware.ValidatePathAndMethod("/api/register", http.MethodPost),
	))

	http.Handle("/api/checkLoginStatus", middleware.ApplyMiddleware(
		http.HandlerFunc(handlers.CheckLoginHandler),
		middleware.SetCSPHeaders,
		middleware.CORSMiddleware,
		pageLimiter.RateLimit,
		middleware.ErrorHandler(handlers.ServeErrorPage),
		middleware.ValidatePathAndMethod("/api/checkLoginStatus", http.MethodGet),
	))

	http.Handle("/api/logout", middleware.ApplyMiddleware(
		http.HandlerFunc(handlers.LogoutHandler),
		middleware.SetCSPHeaders,
		middleware.CORSMiddleware,
		pageLimiter.RateLimit,
		middleware.ErrorHandler(handlers.ServeErrorPage),
		middleware.VerifyCSRFMiddleware(db),
		middleware.ValidatePathAndMethod("/api/logout", http.MethodPost),
	))

	// Posts routes
	http.Handle("/api/posts", middleware.ApplyMiddleware(
		handlers.NewHomePageHandler(db),
		middleware.SetCSPHeaders,
		middleware.CORSMiddleware,
		viewLimiter.RateLimit,
		middleware.ErrorHandler(handlers.ServeErrorPage),
		middleware.ValidatePathAndMethod("/api/posts", http.MethodGet),
	))

	http.Handle("/api/posts/create", middleware.ApplyMiddleware(
		handlers.CreatePostHandler(postController),
		middleware.SetCSPHeaders,
		middleware.AuthMiddleware,
		middleware.CORSMiddleware,
		postLimiter.RateLimit,
		middleware.ErrorHandler(handlers.ServeErrorPage),
		middleware.VerifyCSRFMiddleware(db),
		middleware.ValidatePathAndMethod("/api/posts/create", http.MethodPost),
	))

	http.Handle("/api/posts/", middleware.ApplyMiddleware(
		handlers.NewViewPostHandler(db),
		middleware.SetCSPHeaders,
		middleware.CORSMiddleware,
		viewLimiter.RateLimit,
		middleware.ErrorHandler(handlers.ServeErrorPage),
	))

	// Comments routes
	http.Handle("/api/posts/{postId}/comments", middleware.ApplyMiddleware(
		handlers.CommentHandler(commentController),
		middleware.SetCSPHeaders,
		middleware.AuthMiddleware,
		middleware.CORSMiddleware,
		commentLimiter.RateLimit,
		middleware.ErrorHandler(handlers.ServeErrorPage),
		middleware.VerifyCSRFMiddleware(db),
	))

	// Votes routes
	http.Handle("/api/posts/vote", middleware.ApplyMiddleware(
		handlers.CreateUserVoteHandler(likesController),
		middleware.SetCSPHeaders,
		middleware.AuthMiddleware,
		middleware.CORSMiddleware,
		likesLimiter.RateLimit,
		middleware.ErrorHandler(handlers.ServeErrorPage),
		middleware.VerifyCSRFMiddleware(db),
		middleware.ValidatePathAndMethod("/api/posts/vote", http.MethodPost),
	))

	http.Handle("/api/comments/vote", middleware.ApplyMiddleware(
		handlers.CreateCommentVoteHandler(commentVotesController),
		middleware.AuthMiddleware,
		middleware.ErrorHandler(handlers.ServeErrorPage),
		middleware.VerifyCSRFMiddleware(db),
		middleware.ValidatePathAndMethod("/api/comments/vote", http.MethodPost),
	))

	// User data routes
	http.Handle("/api/users/votes", middleware.ApplyMiddleware(
		handlers.GetUserVotesHandler(likesController),
		middleware.SetCSPHeaders,
		middleware.AuthMiddleware,
		middleware.CORSMiddleware,
		middleware.ErrorHandler(handlers.ServeErrorPage),
		middleware.VerifyCSRFMiddleware(db),
		middleware.ValidatePathAndMethod("/api/users/votes", http.MethodGet),
	))

	http.Handle("/api/users/comment-votes", middleware.ApplyMiddleware(
		handlers.GetUserCommentVotesHandler(commentVotesController),
		middleware.AuthMiddleware,
		middleware.ErrorHandler(handlers.ServeErrorPage),
		middleware.ValidatePathAndMethod("/api/users/comment-votes", http.MethodGet),
	))

	// WebSocket route
	http.Handle("/ws", middleware.ApplyMiddleware(
		&WebSocketHandler{db: db},
		middleware.SetCSPHeaders,
		middleware.CORSMiddleware,
	))
}
