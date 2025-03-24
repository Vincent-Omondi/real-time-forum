package controllers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/Vincent-Omondi/real-time-forum/BackEnd/logger"
)

type Message struct {
	ID         int64     `json:"id"`
	SenderID   int64     `json:"sender_id"`
	ReceiverID int64     `json:"receiver_id"`
	Content    string    `json:"content"`
	CreatedAt  time.Time `json:"created_at"`
}

type Conversation struct {
	OtherUserID     int64     `json:"other_user_id"`
	Username        string    `json:"username"`
	IsOnline        bool      `json:"is_online"`
	LastSeen        time.Time `json:"last_seen"`
	LastMessage     string    `json:"last_message"`
	LastMessageTime time.Time `json:"last_message_time"`
}

type MessageController struct {
	db *sql.DB
}

// Session represents a user session

type Session struct {
    UserID int64
    Token  string
}

func NewMessageController(db *sql.DB) *MessageController {
	return &MessageController{db: db}
}

func (mc *MessageController) GetMessages(userID, otherUserID int64, page int) ([]Message, error) {
	offset := (page - 1) * 10
	rows, err := mc.db.Query(`
        SELECT id, sender_id, receiver_id, content, created_at 
        FROM messages 
        WHERE (sender_id = ? AND receiver_id = ?) 
           OR (sender_id = ? AND receiver_id = ?)
        ORDER BY created_at DESC
        LIMIT 10 OFFSET ?
    `, userID, otherUserID, otherUserID, userID, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var messages []Message
	for rows.Next() {
		var msg Message
		err := rows.Scan(&msg.ID, &msg.SenderID, &msg.ReceiverID, &msg.Content, &msg.CreatedAt)
		if err != nil {
			return nil, err
		}
		messages = append(messages, msg)
	}
	return messages, nil
}

func (mc *MessageController) GetConversations(userID int64) ([]Conversation, error) {
	query := `
        SELECT DISTINCT 
            u.id as user_id,
            u.nickname as username,
            COALESCE(us.is_online, false) as is_online,
            COALESCE(strftime('%Y-%m-%d %H:%M:%f', us.last_seen), CURRENT_TIMESTAMP) as last_seen,
            (
                SELECT content 
                FROM messages m2 
                WHERE (m2.sender_id = ? AND m2.receiver_id = u.id) 
                   OR (m2.sender_id = u.id AND m2.receiver_id = ?)
                ORDER BY m2.created_at DESC 
                LIMIT 1
            ) as last_message,
            (
                SELECT created_at 
                FROM messages m3 
                WHERE (m3.sender_id = ? AND m3.receiver_id = u.id) 
                   OR (m3.sender_id = u.id AND m3.receiver_id = ?)
                ORDER BY m3.created_at DESC 
                LIMIT 1
            ) as last_message_time
        FROM messages m
        JOIN users u ON (
            CASE 
                WHEN m.sender_id = ? THEN m.receiver_id
                ELSE m.sender_id 
            END = u.id
        )
        LEFT JOIN user_status us ON us.user_id = u.id
        WHERE m.sender_id = ? OR m.receiver_id = ?
        GROUP BY u.id
        ORDER BY last_message_time DESC NULLS LAST
	`

	rows, err := mc.db.Query(query, userID, userID, userID, userID, userID, userID, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to query conversations: %v", err)
	}
	defer rows.Close()

	var conversations []Conversation
	for rows.Next() {
		var conv Conversation
		var lastMessage sql.NullString
		var lastMessageTime sql.NullTime
		var lastSeenStr string  // temporary variable to capture the string value

		err := rows.Scan(
			&conv.OtherUserID,
			&conv.Username,
			&conv.IsOnline,
			&lastSeenStr, // scan into string instead of time.Time
			&lastMessage,
			&lastMessageTime,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan conversation: %v", err)
		}

		// Parse the last_seen string into a time.Time value.
		parsedTime, err := time.Parse("2006-01-02 15:04:05.000000", lastSeenStr)
		if err != nil {
			// If the layout doesn't match, try a simpler layout or default to time.Now()
			parsedTime, err = time.Parse("2006-01-02 15:04:05", lastSeenStr)
			if err != nil {
				parsedTime = time.Now()
			}
		}
		conv.LastSeen = parsedTime

		if lastMessage.Valid {
			conv.LastMessage = lastMessage.String
		}
		if lastMessageTime.Valid {
			conv.LastMessageTime = lastMessageTime.Time
		} else {
			conv.LastMessageTime = time.Now()
		}

		conversations = append(conversations, conv)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating conversations: %v", err)
	}

	return conversations, nil
}

// GetUsersHandler returns a list of registered users.
// It queries the users table and returns each user's id and nickname.
func GetUsers(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Set response type to JSON
		w.Header().Set("Content-Type", "application/json")

		// Query the database for users (adjust the query/columns as needed)
		rows, err := db.Query("SELECT id, nickname FROM users")
		if err != nil {
			logger.Error("Failed to query users: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		// Build the list of users
		users := []map[string]any{}
		for rows.Next() {
			var id int
			var nickname string
			if err := rows.Scan(&id, &nickname); err != nil {
				logger.Error("Failed to scan user: %v", err)
				continue
			}
			users = append(users, map[string]any{
				"id":       id,
				"nickname": nickname,
			})
		}

		// Return the list of users as JSON
		json.NewEncoder(w).Encode(map[string]any{
			"users": users,
		})
	}
}

func GetUserById(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		path := r.URL.Path
		parts := strings.Split(path, "/")
		if len(parts) < 4 {
			http.Error(w, "Invalid URL", http.StatusBadRequest)
			return
		}
		userId := parts[len(parts)-1]

		id, err := strconv.ParseInt(userId, 10, 64)
		if err != nil {
			http.Error(w, "Invalid user ID", http.StatusBadRequest)
			return
		}

		var user struct {
			ID       int64  `json:"id"`
			Nickname string `json:"nickname"`
			IsOnline bool   `json:"is_online"`
			LastSeen string `json:"last_seen"`
		}

		err = db.QueryRow(`
			SELECT u.id, u.nickname, 
				   COALESCE(us.is_online, false) as is_online,
				   CASE 
					   WHEN us.is_online = true THEN datetime('now')
					   ELSE COALESCE(datetime(us.last_seen), datetime('now'))
				   END as last_seen
			FROM users u
			LEFT JOIN user_status us ON us.user_id = u.id
			WHERE u.id = ?`, id).Scan(&user.ID, &user.Nickname, &user.IsOnline, &user.LastSeen)

		if err != nil {
			if err == sql.ErrNoRows {
				http.Error(w, "User not found", http.StatusNotFound)
				return
			}
			logger.Error("Failed to fetch user: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		if err := json.NewEncoder(w).Encode(user); err != nil {
			logger.Error("Failed to encode response: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}
	}
}

// MarkMessagesAsRead marks all messages from a specific sender as read for the current user
func (mc *MessageController) MarkMessagesAsRead(userID, senderID int64) error {
	_, err := mc.db.Exec(`
		UPDATE messages
		SET read_at = CURRENT_TIMESTAMP
		WHERE receiver_id = ? AND sender_id = ? AND read_at IS NULL
	`, userID, senderID)
	
	if err != nil {
		return fmt.Errorf("failed to mark messages as read: %v", err)
	}
	
	return nil
}

// MarkMessagesAsReadHandler is an HTTP handler for marking messages as read
func MarkMessagesAsReadHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Only allow POST requests
		if r.Method != "POST" {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		// Set content type
		w.Header().Set("Content-Type", "application/json")

		// Get the current user ID from the session
		session, err := GetUserSession(r, db)
		if err != nil {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		// Parse the conversation partner's ID from the URL
		path := r.URL.Path
		parts := strings.Split(path, "/")
		if len(parts) < 4 {
			http.Error(w, "Invalid URL", http.StatusBadRequest)
			return
		}

		// The URL format is expected to be /api/messages/{userId}/read
		userIDStr := parts[len(parts)-2]
		userID, err := strconv.ParseInt(userIDStr, 10, 64)
		if err != nil {
			http.Error(w, "Invalid user ID", http.StatusBadRequest)
			return
		}

		// Mark messages as read
		mc := NewMessageController(db)
		err = mc.MarkMessagesAsRead(session.UserID, userID)
		if err != nil {
			logger.Error("Failed to mark messages as read: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		// Return success
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]bool{"success": true})
	}
}

// GetUnreadMessageCountHandler gets the count of unread messages for the current user
func GetUnreadMessageCountHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Set content type
		w.Header().Set("Content-Type", "application/json")

		// Get the current user ID from the session
		session, err := GetUserSession(r, db)
		if err != nil {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		// Count unread messages
		var totalUnread int
		err = db.QueryRow(`
			SELECT COUNT(*) 
			FROM messages 
			WHERE receiver_id = ? AND read_at IS NULL
		`, session.UserID).Scan(&totalUnread)

		if err != nil {
			logger.Error("Failed to count unread messages: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		// Get unread counts by sender
		rows, err := db.Query(`
			SELECT sender_id, COUNT(*) as count
			FROM messages
			WHERE receiver_id = ? AND read_at IS NULL
			GROUP BY sender_id
		`, session.UserID)
		
		if err != nil {
			logger.Error("Failed to group unread messages: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		unreadBySender := make(map[string]int)
		for rows.Next() {
			var senderID int64
			var count int
			err := rows.Scan(&senderID, &count)
			if err != nil {
				logger.Error("Failed to scan unread message count: %v", err)
				continue
			}
			unreadBySender[strconv.FormatInt(senderID, 10)] = count
		}

		// Return counts
		json.NewEncoder(w).Encode(map[string]interface{}{
			"total": totalUnread,
			"by_sender": unreadBySender,
		})
	}
}


// GetUserSession retrieves the user session from the request and database
func GetUserSession(r *http.Request, db *sql.DB) (*Session, error) {
    // Example implementation: Replace with your actual session management logic
    cookie, err := r.Cookie("session_token")
    if err != nil {
        return nil, fmt.Errorf("session token not found")
    }

    var session Session
    err = db.QueryRow(`
        SELECT user_id, session_token 
        FROM sessions 
        WHERE session_token = ?
    `, cookie.Value).Scan(&session.UserID, &session.Token)
    if err != nil {
        return nil, fmt.Errorf("invalid session token")
    }
    return &session, nil
}
