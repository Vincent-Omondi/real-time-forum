package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/Vincent-Omondi/real-time-forum/BackEnd/controllers"
	"github.com/Vincent-Omondi/real-time-forum/BackEnd/logger"
)

func GetConversationsHandler(mc *controllers.MessageController) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		logger.Info("=== Starting GetConversationsHandler ===")
		logger.Info("Request Method: %s, URL: %s", r.Method, r.URL.Path)

		w.Header().Set("Content-Type", "application/json")

		// Get userID from context and convert to int64
		userIDInterface := r.Context().Value("userID")
		if userIDInterface == nil {
			logger.Error("No userID found in context")
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(map[string]any{
				"error":         "Authentication required",
				"status":        "error",
				"conversations": []any{},
			})
			return
		}

		// Handle the type conversion explicitly
		var userID int64
		switch v := userIDInterface.(type) {
		case int:
			userID = int64(v)
		case int64:
			userID = v
		default:
			logger.Error("Invalid userID type in context: %T", userIDInterface)
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]any{
				"error":         "Internal server error",
				"status":        "error",
				"conversations": []any{},
			})
			return
		}

		logger.Info("Getting conversations for user: %d", userID)

		conversations, err := mc.GetConversations(userID)
		if err != nil {
			logger.Error("Failed to get conversations: %v", err)
			logger.Error("Stack trace: %+v", err)
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]any{
				"error":         fmt.Sprintf("Failed to get conversations: %v", err),
				"status":        "error",
				"conversations": []any{},
			})
			return
		}

		if conversations == nil {
			logger.Info("No conversations found, returning empty array")
			conversations = []controllers.Conversation{}
		}

		response := map[string]any{
			"status":        "success",
			"conversations": conversations,
		}

		if err := json.NewEncoder(w).Encode(response); err != nil {
			logger.Error("Failed to encode response: %v", err)
			return
		}

		logger.Info("=== Completed GetConversationsHandler successfully ===")
	}
}

func GetMessagesHandler(mc *controllers.MessageController) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		logger.Info("=== Starting GetMessagesHandler ===")
		logger.Info("Request Method: %s, URL: %s", r.Method, r.URL.Path)

		// Get userID from context and convert to int64 using the same pattern
		userIDInterface := r.Context().Value("userID")
		if userIDInterface == nil {
			logger.Error("No userID found in context")
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		var userID int64
		switch v := userIDInterface.(type) {
		case int:
			userID = int64(v)
		case int64:
			userID = v
		default:
			logger.Error("Invalid userID type in context: %T", userIDInterface)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		parts := strings.Split(r.URL.Path, "/")
		logger.Info("URL parts: %v", parts)

		if len(parts) < 4 {
			logger.Error("Invalid URL path length: %d, parts: %v", len(parts), parts)
			http.Error(w, "Invalid request", http.StatusBadRequest)
			return
		}

		otherUserID, err := strconv.ParseInt(parts[3], 10, 64)
		if err != nil {
			logger.Error("Failed to parse otherUserID: %v", err)
			http.Error(w, "Invalid user ID", http.StatusBadRequest)
			return
		}

		logger.Info("Retrieving messages between users %d and %d", userID, otherUserID)

		page := 1
		if pageStr := r.URL.Query().Get("page"); pageStr != "" {
			if p, err := strconv.Atoi(pageStr); err == nil && p > 0 {
				page = p
				logger.Info("Using page number: %d", page)
			} else {
				logger.Warning("Invalid page parameter: %s", pageStr)
			}
		}

		messages, err := mc.GetMessages(userID, otherUserID, page)
		if err != nil {
			logger.Error("Failed to get messages: %v", err)
			logger.Error("Stack trace: %+v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		logger.Info("Retrieved %d messages successfully", len(messages))

		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(messages); err != nil {
			logger.Error("Failed to encode messages: %v", err)
			return
		}

		logger.Info("=== Completed GetMessagesHandler successfully ===")
	}
}

func MarkMessagesAsReadHandler(mc *controllers.MessageController) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Get userID from context
		userIDInterface := r.Context().Value("userID")
		if userIDInterface == nil {
			logger.Error("No userID found in context")
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		var userID int64
		switch v := userIDInterface.(type) {
		case int:
			userID = int64(v)
		case int64:
			userID = v
		default:
			logger.Error("Invalid userID type in context: %T", userIDInterface)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		// Get otherUserID from URL path
		parts := strings.Split(r.URL.Path, "/")
		if len(parts) < 4 {
			logger.Error("Invalid URL path")
			http.Error(w, "Invalid request", http.StatusBadRequest)
			return
		}

		otherUserID, err := strconv.ParseInt(parts[len(parts)-1], 10, 64)
		if err != nil {
			logger.Error("Failed to parse otherUserID: %v", err)
			http.Error(w, "Invalid user ID", http.StatusBadRequest)
			return
		}

		err = mc.MarkMessagesAsRead(userID, otherUserID)
		if err != nil {
			logger.Error("Failed to mark messages as read: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{
			"status":  "success",
			"message": "Messages marked as read",
		})

	}
}
