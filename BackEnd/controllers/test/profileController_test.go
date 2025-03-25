// controllers/test/profileController_test.go
package test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"github.com/Vincent-Omondi/real-time-forum/BackEnd/controllers"
	"github.com/Vincent-Omondi/real-time-forum/BackEnd/models"
)

// Global variable for profileController
var profileController *controllers.ProfileController

// Define profile-related models if they're not already defined in the application
type ProfileResponse struct {
	Nickname  string `json:"nickname"`
	FirstName string `json:"firstName"`
	LastName  string `json:"lastName"`
	Email     string `json:"email"`
	CreatedAt string `json:"createdAt"`
}

type ProfileUpdateRequest struct {
	FirstName string `json:"firstName"`
	LastName  string `json:"lastName"`
}

type UserActivity struct {
	ID        int       `json:"id"`
	Title     string    `json:"title"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"createdAt"`
	Likes     int       `json:"likes"`
	IsLiked   bool      `json:"isLiked"`
}

// Helper function to ensure required tables exist
func ensureProfileTablesExist(t *testing.T) {
	// Make sure users table exists
	_, err := testDB.Exec(`
		CREATE TABLE IF NOT EXISTS users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			nickname TEXT UNIQUE NOT NULL,
			age INTEGER NOT NULL,
			gender TEXT NOT NULL,
			first_name TEXT NOT NULL,
			last_name TEXT NOT NULL,
			email TEXT UNIQUE NOT NULL,
			password TEXT NOT NULL,
			created_at DATETIME NOT NULL,
			updated_at DATETIME
		)
	`)
	if err != nil {
		t.Fatalf("Failed to create users table: %v", err)
	}

	// Create posts table if it doesn't exist
	_, err = testDB.Exec(`
		CREATE TABLE IF NOT EXISTS posts (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER NOT NULL,
			author TEXT NOT NULL,
			title TEXT NOT NULL,
			category TEXT,
			likes INTEGER DEFAULT 0,
			dislikes INTEGER DEFAULT 0,
			user_vote TEXT,
			content TEXT NOT NULL,
			timestamp DATETIME NOT NULL,
			image_url TEXT,
			FOREIGN KEY (user_id) REFERENCES users(id)
		)
	`)
	if err != nil {
		t.Fatalf("Failed to create posts table: %v", err)
	}

	// Create likes table if it doesn't exist
	_, err = testDB.Exec(`
		CREATE TABLE IF NOT EXISTS likes (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			post_id INTEGER NOT NULL,
			user_id INTEGER NOT NULL,
			user_vote TEXT NOT NULL,
			FOREIGN KEY (post_id) REFERENCES posts(id),
			FOREIGN KEY (user_id) REFERENCES users(id)
		)
	`)
	if err != nil {
		t.Fatalf("Failed to create likes table: %v", err)
	}
}

// TestGetUserProfile tests the GetUserProfile function
func TestGetUserProfile(t *testing.T) {
	clearTables()
	ensureProfileTablesExist(t)

	// Register a test user
	user := registerTestUser(t)

	// Initialize profile controller
	profileController = controllers.NewProfileController(testDB)

	// Create a request with the user ID in the context
	req := httptest.NewRequest("GET", "/api/profile", nil)
	ctx := context.WithValue(req.Context(), "userID", user.ID)
	req = req.WithContext(ctx)

	// Create a response recorder
	rr := httptest.NewRecorder()

	// Call the handler function
	profileController.GetUserProfile(rr, req)

	// Check the status code
	if status := rr.Code; status != http.StatusOK {
		t.Errorf("Handler returned wrong status code: got %v want %v", status, http.StatusOK)
	}

	// Check the content type
	contentType := rr.Header().Get("Content-Type")
	if contentType != "application/json" {
		t.Errorf("Handler returned wrong content type: got %v want application/json", contentType)
	}

	// Parse the response body
	var response ProfileResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to parse response: %v", err)
	}

	// Verify user details
	if response.Nickname != user.Nickname {
		t.Errorf("Nickname mismatch: got %v want %v", response.Nickname, user.Nickname)
	}
	if response.FirstName != user.FirstName {
		t.Errorf("FirstName mismatch: got %v want %v", response.FirstName, user.FirstName)
	}
	if response.LastName != user.LastName {
		t.Errorf("LastName mismatch: got %v want %v", response.LastName, user.LastName)
	}
	if response.Email != user.Email {
		t.Errorf("Email mismatch: got %v want %v", response.Email, user.Email)
	}

	// Test with invalid user ID in context
	req = httptest.NewRequest("GET", "/api/profile", nil)
	ctx = context.WithValue(req.Context(), "userID", 0) // Invalid/non-existent user ID
	req = req.WithContext(ctx)

	rr = httptest.NewRecorder()
	profileController.GetUserProfile(rr, req)

	// Should return an error code
	if status := rr.Code; status == http.StatusOK {
		t.Errorf("Handler should return error for invalid user but returned OK")
	}

	// Test with missing user ID in context
	req = httptest.NewRequest("GET", "/api/profile", nil)
	// Don't include userID in context
	rr = httptest.NewRecorder()
	profileController.GetUserProfile(rr, req)

	// Should return unauthorized
	if status := rr.Code; status != http.StatusUnauthorized {
		t.Errorf("Handler returned wrong status code for missing userID: got %v want %v",
			status, http.StatusUnauthorized)
	}
}

// TestUpdateUserProfile tests the UpdateUserProfile function
func TestUpdateUserProfile(t *testing.T) {
	clearTables()
	ensureProfileTablesExist(t)

	// Register a test user
	user := registerTestUser(t)

	// Initialize profile controller
	profileController = controllers.NewProfileController(testDB)

	// Create a profile update request
	updateReq := ProfileUpdateRequest{
		FirstName: "Updated",
		LastName:  "Name",
	}
	reqBody, err := json.Marshal(updateReq)
	if err != nil {
		t.Fatalf("Failed to marshal update request: %v", err)
	}

	// Create a request with the user ID in the context
	req := httptest.NewRequest("PUT", "/api/profile", bytes.NewBuffer(reqBody))
	ctx := context.WithValue(req.Context(), "userID", user.ID)
	req = req.WithContext(ctx)
	req.Header.Set("Content-Type", "application/json")

	// Create a response recorder
	rr := httptest.NewRecorder()

	// Call the handler function
	profileController.UpdateUserProfile(rr, req)

	// Check the status code
	if status := rr.Code; status != http.StatusOK {
		t.Errorf("Handler returned wrong status code: got %v want %v", status, http.StatusOK)
		t.Logf("Response body: %s", rr.Body.String())
	}

	// Verify the update by getting the user profile again
	req = httptest.NewRequest("GET", "/api/profile", nil)
	ctx = context.WithValue(req.Context(), "userID", user.ID)
	req = req.WithContext(ctx)

	rr = httptest.NewRecorder()
	profileController.GetUserProfile(rr, req)

	var response ProfileResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to parse response: %v", err)
	}

	// Verify updated user details
	if response.FirstName != updateReq.FirstName {
		t.Errorf("FirstName not updated: got %v want %v", response.FirstName, updateReq.FirstName)
	}
	if response.LastName != updateReq.LastName {
		t.Errorf("LastName not updated: got %v want %v", response.LastName, updateReq.LastName)
	}

	// Test with invalid request body
	req = httptest.NewRequest("PUT", "/api/profile", bytes.NewBuffer([]byte("invalid json")))
	ctx = context.WithValue(req.Context(), "userID", user.ID)
	req = req.WithContext(ctx)
	req.Header.Set("Content-Type", "application/json")

	rr = httptest.NewRecorder()
	profileController.UpdateUserProfile(rr, req)

	// Should return bad request
	if status := rr.Code; status != http.StatusBadRequest {
		t.Errorf("Handler returned wrong status code for invalid body: got %v want %v",
			status, http.StatusBadRequest)
	}

	// Test with missing user ID in context
	req = httptest.NewRequest("PUT", "/api/profile", bytes.NewBuffer(reqBody))
	// Don't include userID in context
	req.Header.Set("Content-Type", "application/json")
	rr = httptest.NewRecorder()
	profileController.UpdateUserProfile(rr, req)

	// Should return unauthorized
	if status := rr.Code; status != http.StatusUnauthorized {
		t.Errorf("Handler returned wrong status code for missing userID: got %v want %v",
			status, http.StatusUnauthorized)
	}
}

// TestGetUserPosts tests the GetUserPosts function
func TestGetUserPosts(t *testing.T) {
	clearTables()
	ensureProfileTablesExist(t)

	// Register a test user
	user := registerTestUser(t)

	// Initialize controllers
	profileController = controllers.NewProfileController(testDB)
	postController := controllers.NewPostController(testDB)

	// Create some test posts
	numPosts := 3
	for i := 0; i < numPosts; i++ {
		post := models.Post{
			UserID:    user.ID,
			Title:     "Test Post " + strconv.Itoa(i+1),
			Content:   "Test content " + strconv.Itoa(i+1),
			Category:  "General",
			Timestamp: time.Now(),
		}

		_, err := postController.InsertPost(post)
		if err != nil {
			t.Fatalf("Failed to insert test post: %v", err)
		}
	}

	// Create a request with the user ID in the context
	req := httptest.NewRequest("GET", "/api/profile/posts", nil)
	ctx := context.WithValue(req.Context(), "userID", user.ID)
	req = req.WithContext(ctx)

	// Create a response recorder
	rr := httptest.NewRecorder()

	// Call the handler function
	profileController.GetUserPosts(rr, req)

	// Check the status code
	if status := rr.Code; status != http.StatusOK {
		t.Errorf("Handler returned wrong status code: got %v want %v", status, http.StatusOK)
	}

	// Check the content type
	contentType := rr.Header().Get("Content-Type")
	if contentType != "application/json" {
		t.Errorf("Handler returned wrong content type: got %v want application/json", contentType)
	}

	// Parse the response body
	var activities []UserActivity
	if err := json.Unmarshal(rr.Body.Bytes(), &activities); err != nil {
		t.Fatalf("Failed to parse response: %v", err)
	}

	// Verify the number of posts
	if len(activities) != numPosts {
		t.Errorf("Expected %d posts, got %d", numPosts, len(activities))
	}

	// Test with missing user ID in context
	req = httptest.NewRequest("GET", "/api/profile/posts", nil)
	// Don't include userID in context
	rr = httptest.NewRecorder()
	profileController.GetUserPosts(rr, req)

	// Should return unauthorized
	if status := rr.Code; status != http.StatusUnauthorized {
		t.Errorf("Handler returned wrong status code for missing userID: got %v want %v",
			status, http.StatusUnauthorized)
	}
}

// TestGetUserLikes tests the GetUserLikes function
func TestGetUserLikes(t *testing.T) {
	clearTables()
	ensureProfileTablesExist(t)

	// Register a test user
	user := registerTestUser(t)

	// Initialize controllers
	profileController = controllers.NewProfileController(testDB)
	postController := controllers.NewPostController(testDB)
	likesController := controllers.NewLikesController(testDB)

	// Create some test posts and add likes
	numPosts := 3
	var likedPostIDs []int

	for i := 0; i < numPosts; i++ {
		post := models.Post{
			UserID:    user.ID,
			Title:     "Test Post " + strconv.Itoa(i+1),
			Content:   "Test content " + strconv.Itoa(i+1),
			Category:  "General",
			Timestamp: time.Now(),
		}

		postID, err := postController.InsertPost(post)
		if err != nil {
			t.Fatalf("Failed to insert test post: %v", err)
		}

		// Like only 2 of the 3 posts
		if i < 2 {
			like := models.Likes{
				PostId:   postID,
				UserId:   user.ID,
				UserVote: "like",
			}

			err = likesController.InsertLikes(like)
			if err != nil {
				t.Fatalf("Failed to add like to post: %v", err)
			}

			likedPostIDs = append(likedPostIDs, postID)
		}
	}

	// Create a request with the user ID in the context
	req := httptest.NewRequest("GET", "/api/profile/likes", nil)
	ctx := context.WithValue(req.Context(), "userID", user.ID)
	req = req.WithContext(ctx)

	// Create a response recorder
	rr := httptest.NewRecorder()

	// Call the handler function
	profileController.GetUserLikes(rr, req)

	// Check the status code
	if status := rr.Code; status != http.StatusOK {
		t.Errorf("Handler returned wrong status code: got %v want %v", status, http.StatusOK)
	}

	// Check the content type
	contentType := rr.Header().Get("Content-Type")
	if contentType != "application/json" {
		t.Errorf("Handler returned wrong content type: got %v want application/json", contentType)
	}

	// Parse the response body
	var activities []UserActivity
	if err := json.Unmarshal(rr.Body.Bytes(), &activities); err != nil {
		t.Fatalf("Failed to parse response: %v", err)
	}

	// Verify the number of liked posts
	if len(activities) != len(likedPostIDs) {
		t.Errorf("Expected %d liked posts, got %d", len(likedPostIDs), len(activities))
	}

	// Verify all posts are liked by the user
	for _, activity := range activities {
		if !activity.IsLiked {
			t.Errorf("Expected post %d to be liked, but it wasn't", activity.ID)
		}
	}

	// Test with missing user ID in context
	req = httptest.NewRequest("GET", "/api/profile/likes", nil)
	// Don't include userID in context
	rr = httptest.NewRecorder()
	profileController.GetUserLikes(rr, req)

	// Should return unauthorized
	if status := rr.Code; status != http.StatusUnauthorized {
		t.Errorf("Handler returned wrong status code for missing userID: got %v want %v",
			status, http.StatusUnauthorized)
	}
}
