package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/Vincent-Omondi/real-time-forum/BackEnd/controllers"
	"github.com/Vincent-Omondi/real-time-forum/BackEnd/logger"
)

func GetConversationsHandler(mc *controllers.MessageController) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Set content type header first
		w.Header().Set("Content-Type", "application/json")

		// Get userID from context (set by auth middleware)
		userID, ok := r.Context().Value("userID").(int64)
		if !ok {
			// Log the context values for debugging
			logger.Error("Context values: %+v", r.Context())
			logger.Error("Failed to get userID from context")
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"error":         "Authentication required",
				"status":        "error",
				"conversations": []interface{}{},
			})
			return
		}

		// Log the request
		logger.Info("Getting conversations for user: %d", userID)

		// Get conversations for the user
		conversations, err := mc.GetConversations(userID)
		if err != nil {
			logger.Error("Failed to get conversations: %v", err)
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"error":         "Failed to get conversations",
				"status":        "error",
				"conversations": []interface{}{},
			})
			return
		}

		// Ensure we always return an array, even if empty
		if conversations == nil {
			conversations = []controllers.Conversation{}
		}

		// Send successful response
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status":        "success",
			"conversations": conversations,
		})
	}
}

func GetMessagesHandler(mc *controllers.MessageController) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, ok := r.Context().Value("userID").(int64)
		if !ok {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		// Extract otherUserID from URL path
		parts := strings.Split(r.URL.Path, "/")
		if len(parts) < 4 {
			http.Error(w, "Invalid request", http.StatusBadRequest)
			return
		}
		otherUserID, err := strconv.ParseInt(parts[3], 10, 64)
		if err != nil {
			http.Error(w, "Invalid user ID", http.StatusBadRequest)
			return
		}

		// Get page number from query params
		page := 1
		if pageStr := r.URL.Query().Get("page"); pageStr != "" {
			if p, err := strconv.Atoi(pageStr); err == nil && p > 0 {
				page = p
			}
		}

		messages, err := mc.GetMessages(userID, otherUserID, page)
		if err != nil {
			logger.Error("Failed to get messages: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(messages)
	}
}
