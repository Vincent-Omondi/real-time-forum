package controllers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
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
            COALESCE(us.last_seen, CURRENT_TIMESTAMP) as last_seen,
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

		err := rows.Scan(
			&conv.OtherUserID,
			&conv.Username,
			&conv.IsOnline,
			&conv.LastSeen,
			&lastMessage,
			&lastMessageTime,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan conversation: %v", err)
		}

		// Handle null values
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

