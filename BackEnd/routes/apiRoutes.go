package routes

import (
	"database/sql"
	"net/http"
	"time"

	"github.com/Vincent-Omondi/real-time-forum/BackEnd/controllers"
	"github.com/Vincent-Omondi/real-time-forum/BackEnd/handlers"
	"github.com/Vincent-Omondi/real-time-forum/BackEnd/logger"
	"github.com/Vincent-Omondi/real-time-forum/BackEnd/middleware"
	"github.com/Vincent-Omondi/real-time-forum/BackEnd/websockets"
	"github.com/gorilla/websocket"
)

type WebSocketHandler struct {
	Db  *sql.DB
	Hub *websockets.MessageHub
}

func (h *WebSocketHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	logger.Info("Attempting WebSocket connection from %s", r.RemoteAddr)
	// Get userID from context using a type switch
	uid := r.Context().Value("userID")
	var userID int64
	switch v := uid.(type) {
	case int:
		userID = int64(v)
	case int64:
		userID = v
	default:
		logger.Error("Failed to get userID from context; invalid type: %T", uid)
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

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

	logger.Info("WebSocket connection established with userID: %d", userID)

	// Create new client using the properly typed userID
	client := &websockets.Client{
		Hub:      h.Hub,
		Conn:     conn,
		Send:     make(chan []byte, 256),
		UserID:   userID,
		IsOnline: true,
	}

	// Register client with hub
	h.Hub.Register <- client

	// Start client routines
	go client.WritePump()
	go client.ReadPump()
}

// APIRoutes sets up all API routes under the /api prefix
func APIRoutes(db *sql.DB, hub *websockets.MessageHub) {
	// Controllers and Handlers
	authController := controllers.NewAuthController(db)
	postController := controllers.NewPostController(db)
	commentController := controllers.NewCommentController(db)
	likesController := controllers.NewLikesController(db)
	commentVotesController := controllers.NewCommentVotesController(db)
	profileHandler := handlers.NewProfileHandler(db)
	messageController := controllers.NewMessageController(db)

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
		http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Extract post ID from URL path
			path := r.URL.Path
			logger.Info("Handling request for path: %s", path)

			if path == "/api/posts/" {
				logger.Info("Handling list posts request")
				handlers.NewHomePageHandler(db).ServeHTTP(w, r)
				return
			}

			// Extract post ID from the path
			postID := path[len("/api/posts/"):]
			logger.Info("Extracted post ID: %s", postID)
			if postID == "" {
				logger.Error("No post ID provided")
				w.WriteHeader(http.StatusBadRequest)
				return
			}

			// Handle single post view
			logger.Info("Handling single post view request")
			handlers.NewViewPostHandler(db).ServeHTTP(w, r)
		}),
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

	// Profile routes
	http.Handle("/api/user/profile", middleware.ApplyMiddleware(
		http.HandlerFunc(profileHandler.GetProfileHandler),
		middleware.SetCSPHeaders,
		middleware.AuthMiddleware,
		middleware.CORSMiddleware,
		middleware.ErrorHandler(handlers.ServeErrorPage),
		middleware.ValidatePathAndMethod("/api/user/profile", http.MethodGet),
	))

	http.Handle("/api/user/profile/update", middleware.ApplyMiddleware(
		http.HandlerFunc(profileHandler.UpdateProfileHandler),
		middleware.SetCSPHeaders,
		middleware.AuthMiddleware,
		middleware.CORSMiddleware,
		middleware.ErrorHandler(handlers.ServeErrorPage),
		middleware.ValidatePathAndMethod("/api/user/profile/update", http.MethodPut),
	))

	http.Handle("/api/user/posts", middleware.ApplyMiddleware(
		http.HandlerFunc(profileHandler.GetUserPostsHandler),
		middleware.SetCSPHeaders,
		middleware.AuthMiddleware,
		middleware.CORSMiddleware,
		middleware.ErrorHandler(handlers.ServeErrorPage),
		middleware.ValidatePathAndMethod("/api/user/posts", http.MethodGet),
	))

	http.Handle("/api/user/likes", middleware.ApplyMiddleware(
		http.HandlerFunc(profileHandler.GetUserLikesHandler),
		middleware.SetCSPHeaders,
		middleware.AuthMiddleware,
		middleware.CORSMiddleware,
		middleware.ErrorHandler(handlers.ServeErrorPage),
		middleware.ValidatePathAndMethod("/api/user/likes", http.MethodGet),
	))

	// Message routes
	http.Handle("/api/messages/conversations", middleware.ApplyMiddleware(
		handlers.GetConversationsHandler(messageController),
		middleware.AuthMiddleware,
		middleware.SetCSPHeaders,
		middleware.CORSMiddleware,
		middleware.ErrorHandler(handlers.ServeErrorPage),
	))

	http.Handle("/api/messages/{userId}", middleware.ApplyMiddleware(
		handlers.GetMessagesHandler(messageController),
		middleware.SetCSPHeaders,
		middleware.AuthMiddleware,
		middleware.CORSMiddleware,
		middleware.ErrorHandler(handlers.ServeErrorPage),
	))

	http.Handle("/api/messages/unread-count", middleware.ApplyMiddleware(
		controllers.GetUnreadMessageCountHandler(db),
		middleware.SetCSPHeaders,
		middleware.AuthMiddleware,
		middleware.CORSMiddleware,
		middleware.ErrorHandler(handlers.ServeErrorPage),
		middleware.ValidatePathAndMethod("/api/messages/unread-count", http.MethodGet),
	))

	// WebSocket route
	http.Handle("/ws", middleware.ApplyMiddleware(
		&WebSocketHandler{
			Db:  db,
			Hub: hub,
		},
		middleware.SetCSPHeaders,
		middleware.CORSMiddleware,
		middleware.AuthMiddleware,
	))
	// User list route (returns registered users)
	http.Handle("/api/users", middleware.ApplyMiddleware(
		controllers.GetUsers(db),
		middleware.SetCSPHeaders,
		middleware.CORSMiddleware,
		middleware.AuthMiddleware, // Protect the endpoint if needed
		middleware.ErrorHandler(handlers.ServeErrorPage),
		middleware.ValidatePathAndMethod("/api/users", http.MethodGet),
	))

	http.Handle("/api/users/", middleware.ApplyMiddleware(
		controllers.GetUserById(db),
		middleware.SetCSPHeaders,
		middleware.AuthMiddleware,
		middleware.CORSMiddleware,
		middleware.ErrorHandler(handlers.ServeErrorPage),
	))

}
