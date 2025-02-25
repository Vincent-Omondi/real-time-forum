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
	Clients    map[*Client]bool
	Broadcast  chan *Message
	Register   chan *Client
	Unregister chan *Client
	Mu         sync.RWMutex
	Db         *sql.DB
}

type Client struct {
	Hub      *MessageHub
	Conn     *websocket.Conn
	Send     chan []byte
	UserID   int64
	IsOnline bool
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
		Clients:    make(map[*Client]bool),
		Broadcast:  make(chan *Message),
		Register:   make(chan *Client),
		Unregister: make(chan *Client),
		Db:         db,
	}
}

func (h *MessageHub) Run() {
	logger.Info("WebSocket MessageHub is running...")
	for {
		select {
		case client := <-h.Register:
			logger.Info("Registering new WebSocket client: %d", client.UserID)
			h.Clients[client] = true
			// Update user status to online
			h.updateUserStatus(client.UserID, true)

		case client := <-h.Unregister:
			logger.Info("Unregistering WebSocket client: %d", client.UserID)
			if _, ok := h.Clients[client]; ok {
				delete(h.Clients, client)
				close(client.Send)
				// Update user status to offline
				h.updateUserStatus(client.UserID, false)
			}

		case message := <-h.Broadcast:
			logger.Info("Broadcasting WebSocket message: %+v", message)
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
	for client := range h.Clients {
		if client.UserID == message.ReceiverID {
			select {
			case client.Send <- message.serialize():
			default:
				close(client.Send)
				delete(h.Clients, client)
			}
		}
	}
}

func (h *MessageHub) updateUserStatus(userID int64, isOnline bool) error {
	currentTime := time.Now().UTC()

	// Single query to update or insert
	_, err := h.Db.Exec(`
		INSERT INTO user_status (user_id, is_online, last_seen)
		VALUES (?, ?, ?)
		ON CONFLICT(user_id) DO UPDATE SET
		is_online = ?,
		last_seen = CASE 
			WHEN is_online = false OR is_online <> ? THEN ?
			ELSE last_seen 
		END
	`, userID, isOnline, currentTime, isOnline, isOnline, currentTime)

	if err != nil {
		logger.Error("Failed to update user status: %v", err)
		return err
	}
	return nil
}

func (h *MessageHub) storeMessage(message *Message) error {
	_, err := h.Db.Exec(`
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

// WritePump pumps messages from the Send channel to the WebSocket connection.
func (c *Client) WritePump() {
	ticker := time.NewTicker(54 * time.Second)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			if !ok {
				// The channel was closed.
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.Conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// ReadPump pumps messages from the WebSocket connection to the hub's Broadcast channel.
func (c *Client) ReadPump() {
	defer func() {
		// Unregister the client and close the connection.
		c.Hub.Unregister <- c
		c.Conn.Close()
	}()

	c.Conn.SetReadLimit(512 * 1024) // 512KB max message size
	c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		// Update last activity time on successful pong
		c.Hub.updateUserStatus(c.UserID, true)
		return nil
	})

	for {
		_, data, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				logger.Error("WebSocket read error: %v", err)
			}
			break
		}

		var message Message
		if err := json.Unmarshal(data, &message); err != nil {
			logger.Error("Failed to unmarshal message: %v", err)
			continue
		}

		// Set sender information and timestamp.
		message.SenderID = c.UserID
		message.Timestamp = time.Now()

		c.Hub.Broadcast <- &message
	}
}
