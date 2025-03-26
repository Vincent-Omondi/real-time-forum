// controllers/test/messageController_test.go
package test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/Vincent-Omondi/real-time-forum/BackEnd/controllers"
)

// Global variable for messageController
var messageController *controllers.MessageController

// TestGetMessages tests the GetMessages function
func TestGetMessages(t *testing.T) {
	clearTables()
	ensureMessagesTableExists(t)

	// Create test users
	user1 := registerTestUser(t)
	user2 := registerTestUser(t)

	// Initialize message controller
	messageController = controllers.NewMessageController(testDB)

	// Insert test messages directly into the database
	_, err := testDB.Exec(`
		INSERT INTO messages (sender_id, receiver_id, content, created_at)
		VALUES (?, ?, ?, datetime('now'))`,
		user1.ID, user2.ID, "Hello from user1 to user2")
	if err != nil {
		t.Fatalf("Failed to insert test message: %v", err)
	}

	_, err = testDB.Exec(`
		INSERT INTO messages (sender_id, receiver_id, content, created_at)
		VALUES (?, ?, ?, datetime('now', '-1 minute'))`,
		user2.ID, user1.ID, "Hello from user2 to user1")
	if err != nil {
		t.Fatalf("Failed to insert test message: %v", err)
	}

	// Get messages
	messages, err := messageController.GetMessages(int64(user1.ID), int64(user2.ID), 1)
	if err != nil {
		t.Fatalf("Failed to get messages: %v", err)
	}

	// Should have two messages
	if len(messages) != 2 {
		t.Errorf("Expected 2 messages, got %d", len(messages))
	}

	// Verify message details
	foundMessage1 := false
	foundMessage2 := false

	for _, msg := range messages {
		if msg.SenderID == int64(user1.ID) && msg.ReceiverID == int64(user2.ID) {
			foundMessage1 = true
			if msg.Content != "Hello from user1 to user2" {
				t.Errorf("Expected message content 'Hello from user1 to user2', got '%s'", msg.Content)
			}
		} else if msg.SenderID == int64(user2.ID) && msg.ReceiverID == int64(user1.ID) {
			foundMessage2 = true
			if msg.Content != "Hello from user2 to user1" {
				t.Errorf("Expected message content 'Hello from user2 to user1', got '%s'", msg.Content)
			}
		}
	}

	if !foundMessage1 {
		t.Errorf("Message from user1 to user2 not found")
	}
	if !foundMessage2 {
		t.Errorf("Message from user2 to user1 not found")
	}

	// Test pagination by adding more messages
	for i := 0; i < 15; i++ {
		_, err := testDB.Exec(`
			INSERT INTO messages (sender_id, receiver_id, content, created_at)
			VALUES (?, ?, ?, datetime('now', ?))`,
			user1.ID, user2.ID, "Message "+strconv.Itoa(i), "-"+strconv.Itoa(i+2)+" minutes")
		if err != nil {
			t.Fatalf("Failed to insert additional message: %v", err)
		}
	}

	// Get first page (should be 10 messages)
	page1Messages, err := messageController.GetMessages(int64(user1.ID), int64(user2.ID), 1)
	if err != nil {
		t.Fatalf("Failed to get page 1 messages: %v", err)
	}

	if len(page1Messages) != 10 {
		t.Errorf("Expected 10 messages on page 1, got %d", len(page1Messages))
	}

	// Get second page (should be remaining messages)
	page2Messages, err := messageController.GetMessages(int64(user1.ID), int64(user2.ID), 2)
	if err != nil {
		t.Fatalf("Failed to get page 2 messages: %v", err)
	}

	if len(page2Messages) != 7 { // 2 original + 15 new = 17, so page 2 should have 7
		t.Errorf("Expected 7 messages on page 2, got %d", len(page2Messages))
	}
}

// TestGetConversations tests the GetConversations function
func TestGetConversations(t *testing.T) {
	clearTables()
	ensureMessagesTableExists(t)

	// Create test users
	user1 := registerTestUser(t)
	user2 := registerTestUser(t)
	user3 := registerTestUser(t)

	// Initialize message controller
	messageController = controllers.NewMessageController(testDB)

	// Set up user status
	_, err := testDB.Exec(`
		INSERT INTO user_status (user_id, is_online, last_seen)
		VALUES (?, ?, datetime('now'))`,
		user2.ID, true)
	if err != nil {
		t.Fatalf("Failed to insert user status: %v", err)
	}

	_, err = testDB.Exec(`
		INSERT INTO user_status (user_id, is_online, last_seen)
		VALUES (?, ?, datetime('now', '-2 hours'))`,
		user3.ID, false)
	if err != nil {
		t.Fatalf("Failed to insert user status: %v", err)
	}

	// Insert test messages
	// User1 and User2 conversation
	_, err = testDB.Exec(`
		INSERT INTO messages (sender_id, receiver_id, content, created_at)
		VALUES (?, ?, ?, datetime('now', '-1 hour'))`,
		user1.ID, user2.ID, "Hello User2")
	if err != nil {
		t.Fatalf("Failed to insert message: %v", err)
	}

	_, err = testDB.Exec(`
		INSERT INTO messages (sender_id, receiver_id, content, created_at)
		VALUES (?, ?, ?, datetime('now', '-30 minutes'))`,
		user2.ID, user1.ID, "Hi User1")
	if err != nil {
		t.Fatalf("Failed to insert message: %v", err)
	}

	// User1 and User3 conversation
	_, err = testDB.Exec(`
		INSERT INTO messages (sender_id, receiver_id, content, created_at)
		VALUES (?, ?, ?, datetime('now', '-2 hours'))`,
		user1.ID, user3.ID, "Hello User3")
	if err != nil {
		t.Fatalf("Failed to insert message: %v", err)
	}

	// Get conversations for User1
	conversations, err := messageController.GetConversations(int64(user1.ID))
	if err != nil {
		t.Fatalf("Failed to get conversations: %v", err)
	}

	// Should have two conversations
	if len(conversations) != 2 {
		t.Errorf("Expected 2 conversations, got %d", len(conversations))
	}

	// Verify conversations are ordered by last message time (most recent first)
	if len(conversations) >= 2 {
		if conversations[0].OtherUserID != int64(user2.ID) {
			t.Errorf("Expected first conversation to be with User2 (ID: %d), got User ID: %d",
				user2.ID, conversations[0].OtherUserID)
		}
		if conversations[1].OtherUserID != int64(user3.ID) {
			t.Errorf("Expected second conversation to be with User3 (ID: %d), got User ID: %d",
				user3.ID, conversations[1].OtherUserID)
		}
	}

	// Verify conversation details for User2
	for _, conv := range conversations {
		if conv.OtherUserID == int64(user2.ID) {
			if !conv.IsOnline {
				t.Errorf("Expected User2 to be online, but got offline")
			}
			if conv.LastMessage != "Hi User1" {
				t.Errorf("Expected last message 'Hi User1', got '%s'", conv.LastMessage)
			}
		} else if conv.OtherUserID == int64(user3.ID) {
			if conv.IsOnline {
				t.Errorf("Expected User3 to be offline, but got online")
			}
			if conv.LastMessage != "Hello User3" {
				t.Errorf("Expected last message 'Hello User3', got '%s'", conv.LastMessage)
			}
		}
	}
}

// TestGetUsers tests the GetUsers HTTP handler
func TestGetUsers(t *testing.T) {
	clearTables()

	// Create test users
	user1 := registerTestUser(t)
	user2 := registerTestUser(t)

	// Create request to test handler
	req, err := http.NewRequest("GET", "/api/users", nil)
	if err != nil {
		t.Fatalf("Failed to create request: %v", err)
	}

	// Create response recorder
	rr := httptest.NewRecorder()

	// Get the handler function
	handler := controllers.GetUsers(testDB)

	// Serve the request
	handler.ServeHTTP(rr, req)

	// Check status code
	if status := rr.Code; status != http.StatusOK {
		t.Errorf("Handler returned wrong status code: got %v want %v", status, http.StatusOK)
	}

	// Check content type
	if contentType := rr.Header().Get("Content-Type"); contentType != "application/json" {
		t.Errorf("Handler returned wrong content type: got %v want application/json", contentType)
	}

	// Parse response body
	var response struct {
		Users []struct {
			ID       int    `json:"id"`
			Nickname string `json:"nickname"`
		} `json:"users"`
	}

	if err := json.Unmarshal(rr.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to parse response JSON: %v", err)
	}

	// Should have at least 2 users
	if len(response.Users) < 2 {
		t.Errorf("Expected at least 2 users, got %d", len(response.Users))
	}

	// Verify both test users are in the response
	foundUser1 := false
	foundUser2 := false

	for _, user := range response.Users {
		if user.ID == user1.ID {
			foundUser1 = true
			if user.Nickname != user1.Nickname {
				t.Errorf("Wrong nickname for user1: expected %s, got %s", user1.Nickname, user.Nickname)
			}
		} else if user.ID == user2.ID {
			foundUser2 = true
			if user.Nickname != user2.Nickname {
				t.Errorf("Wrong nickname for user2: expected %s, got %s", user2.Nickname, user.Nickname)
			}
		}
	}

	if !foundUser1 {
		t.Errorf("User1 not found in response")
	}
	if !foundUser2 {
		t.Errorf("User2 not found in response")
	}
}

// TestGetUserById tests the GetUserById HTTP handler
func TestGetUserById(t *testing.T) {
	clearTables()
	ensureMessagesTableExists(t)

	// Create a test user
	user := registerTestUser(t)

	// Set the user's status
	_, err := testDB.Exec(`
		INSERT INTO user_status (user_id, is_online, last_seen)
		VALUES (?, ?, datetime('now', '-30 minutes'))`,
		user.ID, true)
	if err != nil {
		t.Fatalf("Failed to insert user status: %v", err)
	}

	// Create request to test handler
	req, err := http.NewRequest("GET", "/api/users/"+strconv.Itoa(user.ID), nil)
	if err != nil {
		t.Fatalf("Failed to create request: %v", err)
	}

	// Create response recorder
	rr := httptest.NewRecorder()

	// Get the handler function
	handler := controllers.GetUserById(testDB)

	// Serve the request
	handler.ServeHTTP(rr, req)

	// Check status code
	if status := rr.Code; status != http.StatusOK {
		t.Errorf("Handler returned wrong status code: got %v want %v", status, http.StatusOK)
	}

	// Check content type
	if contentType := rr.Header().Get("Content-Type"); contentType != "application/json" {
		t.Errorf("Handler returned wrong content type: got %v want application/json", contentType)
	}

	// Parse response body
	var response struct {
		ID       int64  `json:"id"`
		Nickname string `json:"nickname"`
		IsOnline bool   `json:"is_online"`
		LastSeen string `json:"last_seen"`
	}

	if err := json.Unmarshal(rr.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to parse response JSON: %v", err)
	}

	// Verify the user details are correct
	if response.ID != int64(user.ID) {
		t.Errorf("Wrong user ID: expected %d, got %d", user.ID, response.ID)
	}
	if response.Nickname != user.Nickname {
		t.Errorf("Wrong nickname: expected %s, got %s", user.Nickname, response.Nickname)
	}
	if !response.IsOnline {
		t.Errorf("Expected user to be online, but got offline")
	}

	// Test non-existent user
	req, err = http.NewRequest("GET", "/api/users/999999", nil)
	if err != nil {
		t.Fatalf("Failed to create request for non-existent user: %v", err)
	}

	rr = httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	// Should return 404 for non-existent user
	if status := rr.Code; status != http.StatusNotFound {
		t.Errorf("Handler returned wrong status code for non-existent user: got %v want %v",
			status, http.StatusNotFound)
	}
}

// Helper function to ensure the messages table exists
func ensureMessagesTableExists(t *testing.T) {
	_, err := testDB.Exec(`
		CREATE TABLE IF NOT EXISTS messages (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			sender_id INTEGER NOT NULL,
			receiver_id INTEGER NOT NULL,
			content TEXT NOT NULL,
			created_at DATETIME NOT NULL,
			FOREIGN KEY (sender_id) REFERENCES users(id),
			FOREIGN KEY (receiver_id) REFERENCES users(id)
		)
	`)
	if err != nil {
		t.Fatalf("Failed to create messages table: %v", err)
	}

	_, err = testDB.Exec(`
		CREATE TABLE IF NOT EXISTS user_status (
			user_id INTEGER PRIMARY KEY,
			is_online BOOLEAN DEFAULT FALSE,
			last_seen DATETIME,
			FOREIGN KEY (user_id) REFERENCES users(id)
		)
	`)
	if err != nil {
		t.Fatalf("Failed to create user_status table: %v", err)
	}
}
