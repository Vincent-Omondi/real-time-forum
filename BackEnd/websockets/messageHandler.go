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
    LastSeen time.Time
}

type Message struct {
    Type       string    `json:"type"`
    Content    string    `json:"content,omitempty"`
    SenderID   int64     `json:"sender_id,omitempty"`
    ReceiverID int64     `json:"receiver_id,omitempty"`
    Timestamp  time.Time `json:"timestamp"`
    TempID     string    `json:"temp_id,omitempty"`
}

// Add a new message type for status updates
type StatusUpdateMessage struct {
    Type     string    `json:"type"`
    UserID   int64     `json:"user_id"`
    IsOnline bool      `json:"is_online"`
    LastSeen time.Time `json:"last_seen"`
}

// Add a new type for heartbeat messages
type HeartbeatMessage struct {
    Type      string    `json:"type"`
    Timestamp time.Time `json:"timestamp"`
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
    
    // Start a ticker to periodically check for inactive users
    statusCheckTicker := time.NewTicker(60 * time.Second)
    
    go func() {
        for range statusCheckTicker.C {
            h.checkInactiveUsers()
        }
    }()
    
    for {
        select {
        case client := <-h.Register:
            logger.Info("Registering new WebSocket client: %d", client.UserID)
            client.LastSeen = time.Now().UTC()
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

// Check for inactive clients and mark them offline
func (h *MessageHub) checkInactiveUsers() {
    threshold := time.Now().Add(-2 * time.Minute)
    
    for client := range h.Clients {
        if client.LastSeen.Before(threshold) {
            logger.Info("Client %d inactive, marking as offline", client.UserID)
            h.updateUserStatus(client.UserID, false)
        }
    }
}

func (h *MessageHub) handleMessage(message *Message) {
    // Handle heartbeat messages
    if message.Type == "heartbeat" {
        // Update the last seen time for the client
        for client := range h.Clients {
            if client.UserID == message.SenderID {
                client.LastSeen = time.Now().UTC()
                h.updateUserStatus(client.UserID, true)
                break
            }
        }
        return
    }
    
    // For regular messages, store in database
    if message.Type == "message" {
        if err := h.storeMessage(message); err != nil {
            logger.Error("Failed to store message: %v", err)
            return
        }

        // Find receiver's client connection
        for client := range h.Clients {
            if client.UserID == message.ReceiverID || client.UserID == message.SenderID {
                select {
                case client.Send <- message.serialize():
                default:
                    close(client.Send)
                    delete(h.Clients, client)
                }
            }
        }
    }
}

func (h *MessageHub) updateUserStatus(userID int64, isOnline bool) error {
    currentTime := time.Now().UTC()
    
    // First try to update existing record
    result, err := h.Db.Exec(`
        UPDATE user_status 
        SET is_online = ?,
            last_seen = CASE 
                WHEN is_online = 0 OR is_online <> ? THEN ?
                ELSE last_seen 
            END
        WHERE user_id = ?
    `, isOnline, isOnline, currentTime, userID)
    
    if err != nil {
        logger.Error("Failed to update user status: %v", err)
        return err
    }
    
    // Check if any rows were affected
    rowsAffected, _ := result.RowsAffected()
    if rowsAffected == 0 {
        // No existing record, insert a new one
        _, err = h.Db.Exec(`
            INSERT INTO user_status (user_id, is_online, last_seen)
            VALUES (?, ?, ?)
        `, userID, isOnline, currentTime)
        
        if err != nil {
            logger.Error("Failed to insert user status: %v", err)
            return err
        }
    }
    
    // Always broadcast status updates
    h.broadcastStatusUpdate(userID, isOnline)

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
    ticker := time.NewTicker(45 * time.Second)
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
        c.LastSeen = time.Now().UTC()
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
        if message.Timestamp.IsZero() {
            message.Timestamp = time.Now()
        }
        
        // Update the client's last seen time
        c.LastSeen = time.Now().UTC()

        c.Hub.Broadcast <- &message
    }
}

// Add this method to MessageHub
func (h *MessageHub) broadcastStatusUpdate(userID int64, isOnline bool) {
    // Get the current time for last_seen
    currentTime := time.Now().UTC()
    
    // Fetch the actual last seen time from the database for accuracy
    var lastSeen time.Time
    err := h.Db.QueryRow("SELECT last_seen FROM user_status WHERE user_id = ?", userID).Scan(&lastSeen)
    if err != nil {
        logger.Error("Failed to get last seen time: %v", err)
        lastSeen = currentTime // Fallback
    }
    
    // Create status update message
    statusMsg := &StatusUpdateMessage{
        Type:     "status_update",
        UserID:   userID,
        IsOnline: isOnline,
        LastSeen: lastSeen,
    }
    
    // Serialize the status message
    msgData, err := json.Marshal(statusMsg)
    if err != nil {
        logger.Error("Failed to serialize status update: %v", err)
        return
    }
    
    // Send to all connected clients
    for client := range h.Clients {
        select {
        case client.Send <- msgData:
        default:
            close(client.Send)
            delete(h.Clients, client)
        }
    }
}