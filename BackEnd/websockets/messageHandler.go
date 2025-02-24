package websockets

import (
	"database/sql"
	"encoding/json"
	"sync"
	"time"

	"github.com/Vincent-Omondi/real-time-forum/BackEnd/logger"
	"github.com/gorilla/websocket"
)

type MessageHub struct {
	clients    map[*Client]bool
	broadcast  chan *Message
	register   chan *Client
	unregister chan *Client
	mu         sync.RWMutex
	db         *sql.DB
}

type Client struct {
	hub      *MessageHub
	conn     *websocket.Conn
	send     chan []byte
	userID   int64
	isOnline bool
}

type Message struct {
	Type       string    `json:"type"`
	Content    string    `json:"content"`
	SenderID   int64     `json:"sender_id"`
	ReceiverID int64     `json:"receiver_id"`
	Timestamp  time.Time `json:"timestamp"`
}

func NewMessageHub(db *sql.DB) *MessageHub {
	return &MessageHub{
		clients:    make(map[*Client]bool),
		broadcast:  make(chan *Message),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		db:         db,
	}
}

func (h *MessageHub) Run() {
	for {
		select {
		case client := <-h.register:
			h.clients[client] = true
			// Update user status to online
			h.updateUserStatus(client.userID, true)

		case client := <-h.unregister:
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
				// Update user status to offline
				h.updateUserStatus(client.userID, false)
			}

		case message := <-h.broadcast:
			h.handleMessage(message)
		}
	}
}

func (h *MessageHub) handleMessage(message *Message) {
	// Store message in database
	if err := h.storeMessage(message); err != nil {
		logger.Error("Failed to store message: %v", err)
		return
	}

	// Find receiver's client connection
	for client := range h.clients {
		if client.userID == message.ReceiverID {
			select {
			case client.send <- message.serialize():
			default:
				close(client.send)
				delete(h.clients, client)
			}
		}
	}
}

func (h *MessageHub) updateUserStatus(userID int64, isOnline bool) error {
	_, err := h.db.Exec(`
		INSERT INTO user_status (user_id, is_online, last_seen)
		VALUES (?, ?, CURRENT_TIMESTAMP)
		ON CONFLICT(user_id) DO UPDATE SET
		is_online = ?,
		last_seen = CURRENT_TIMESTAMP
	`, userID, isOnline, isOnline)
	return err
}

func (h *MessageHub) storeMessage(message *Message) error {
	_, err := h.db.Exec(`
		INSERT INTO messages (sender_id, receiver_id, content, created_at)
		VALUES (?, ?, ?, ?)
	`, message.SenderID, message.ReceiverID, message.Content, message.Timestamp)
	return err
}

func (m *Message) serialize() []byte {
	data, err := json.Marshal(m)
	if err != nil {
		logger.Error("Failed to serialize message: %v", err)
		return nil
	}
	return data
}
