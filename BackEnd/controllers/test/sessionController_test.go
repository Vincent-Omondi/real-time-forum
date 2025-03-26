// controllers/test/sessionController_test.go
package test

import (
	"context"
	"database/sql"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/Vincent-Omondi/real-time-forum/BackEnd/controllers"
)

// Global variables for tests
var (
	testSessionToken = "test-session-token"
	testExpiresAt    = time.Now().Add(24 * time.Hour)
)

// TestAddSession tests the AddSession function
func TestAddSession(t *testing.T) {
	clearTables()

	// Register a test user
	user := registerTestUser(t)

	// Add a session
	err := controllers.AddSession(testDB, testSessionToken, user.ID, testExpiresAt)
	if err != nil {
		t.Fatalf("Failed to add session: %v", err)
	}

	// Verify the session was added
	var count int
	err = testDB.QueryRow("SELECT COUNT(*) FROM sessions WHERE session_token = ? AND user_id = ?",
		testSessionToken, user.ID).Scan(&count)
	if err != nil {
		t.Fatalf("Failed to query session: %v", err)
	}

	if count != 1 {
		t.Errorf("Expected 1 session record, got %d", count)
	}
}

// TestGetSession tests the GetSession function
func TestGetSession(t *testing.T) {
	clearTables()

	// Register a test user
	user := registerTestUser(t)

	// Add a session
	err := controllers.AddSession(testDB, testSessionToken, user.ID, testExpiresAt)
	if err != nil {
		t.Fatalf("Failed to add session: %v", err)
	}

	// Get the session
	userID, expiresAt, err := controllers.GetSession(testDB, testSessionToken)
	if err != nil {
		t.Fatalf("Failed to get session: %v", err)
	}

	// Verify the session details
	if userID != user.ID {
		t.Errorf("Expected user ID %d, got %d", user.ID, userID)
	}

	// Check if the expires_at time is within a reasonable margin (1 second)
	timeDiff := expiresAt.Sub(testExpiresAt)
	if timeDiff < -time.Second || timeDiff > time.Second {
		t.Errorf("Expected expires_at time close to %v, got %v (diff: %v)",
			testExpiresAt, expiresAt, timeDiff)
	}

	// Test getting a non-existent session
	_, _, err = controllers.GetSession(testDB, "non-existent-token")
	if err != sql.ErrNoRows {
		t.Errorf("Expected sql.ErrNoRows for non-existent session, got %v", err)
	}
}

// TestIsValidSession tests the IsValidSession function
func TestIsValidSession(t *testing.T) {
	clearTables()

	// Register a test user
	user := registerTestUser(t)

	// Test cases
	testCases := []struct {
		name          string
		sessionToken  string
		expiresAt     time.Time
		expectedValid bool
	}{
		{
			name:          "Valid session",
			sessionToken:  "valid-token",
			expiresAt:     time.Now().Add(24 * time.Hour),
			expectedValid: true,
		},
		{
			name:          "Expired session",
			sessionToken:  "expired-token",
			expiresAt:     time.Now().Add(-1 * time.Hour),
			expectedValid: false,
		},
		{
			name:          "Non-existent session",
			sessionToken:  "non-existent-token",
			expiresAt:     time.Time{}, // Not used
			expectedValid: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Add session if it's not the non-existent case
			if tc.name != "Non-existent session" {
				err := controllers.AddSession(testDB, tc.sessionToken, user.ID, tc.expiresAt)
				if err != nil {
					t.Fatalf("Failed to add session: %v", err)
				}
			}

			// Check if the session is valid
			userID, isValid := controllers.IsValidSession(testDB, tc.sessionToken)

			// Verify the result
			if isValid != tc.expectedValid {
				t.Errorf("Expected validity %v, got %v", tc.expectedValid, isValid)
			}

			// If the session should be valid, verify the user ID
			if tc.expectedValid {
				if userID != user.ID {
					t.Errorf("Expected user ID %d, got %d", user.ID, userID)
				}
			}

			// For expired sessions, verify that the session was deleted
			if tc.name == "Expired session" {
				var count int
				err := testDB.QueryRow("SELECT COUNT(*) FROM sessions WHERE session_token = ?",
					tc.sessionToken).Scan(&count)
				if err != nil {
					t.Fatalf("Failed to query session: %v", err)
				}

				if count != 0 {
					t.Errorf("Expected expired session to be deleted, but found %d records", count)
				}
			}
		})
	}
}

// TestDeleteSession tests the DeleteSession function
func TestDeleteSession(t *testing.T) {
	clearTables()

	// Register a test user
	user := registerTestUser(t)

	// Add a session
	err := controllers.AddSession(testDB, testSessionToken, user.ID, testExpiresAt)
	if err != nil {
		t.Fatalf("Failed to add session: %v", err)
	}

	// Delete the session
	err = controllers.DeleteSession(testDB, testSessionToken)
	if err != nil {
		t.Fatalf("Failed to delete session: %v", err)
	}

	// Verify the session was deleted
	var count int
	err = testDB.QueryRow("SELECT COUNT(*) FROM sessions WHERE session_token = ?",
		testSessionToken).Scan(&count)
	if err != nil {
		t.Fatalf("Failed to query session: %v", err)
	}

	if count != 0 {
		t.Errorf("Expected 0 session records after deletion, got %d", count)
	}

	// Test deleting a non-existent session (should not error)
	err = controllers.DeleteSession(testDB, "non-existent-token")
	if err != nil {
		t.Errorf("Deleting non-existent session should not error, got: %v", err)
	}
}

// TestDeleteExpiredSessions tests the DeleteExpiredSessions function
func TestDeleteExpiredSessions(t *testing.T) {
	clearTables()

	// Register a test user
	user := registerTestUser(t)

	// Add sessions with different expiration times
	sessions := []struct {
		token     string
		expiresAt time.Time
	}{
		{"valid-token-1", time.Now().Add(24 * time.Hour)},
		{"valid-token-2", time.Now().Add(12 * time.Hour)},
		{"expired-token-1", time.Now().Add(-1 * time.Hour)},
		{"expired-token-2", time.Now().Add(-2 * time.Hour)},
	}

	for _, session := range sessions {
		err := controllers.AddSession(testDB, session.token, user.ID, session.expiresAt)
		if err != nil {
			t.Fatalf("Failed to add session %s: %v", session.token, err)
		}
	}

	// Delete expired sessions
	err := controllers.DeleteExpiredSessions(testDB)
	if err != nil {
		t.Fatalf("Failed to delete expired sessions: %v", err)
	}

	// Count remaining sessions
	var count int
	err = testDB.QueryRow("SELECT COUNT(*) FROM sessions").Scan(&count)
	if err != nil {
		t.Fatalf("Failed to count sessions: %v", err)
	}

	// Should have only the valid sessions left
	expectedCount := 2
	if count != expectedCount {
		t.Errorf("Expected %d sessions after deleting expired ones, got %d", expectedCount, count)
	}

	// Verify which sessions remain
	rows, err := testDB.Query("SELECT session_token FROM sessions")
	if err != nil {
		t.Fatalf("Failed to query sessions: %v", err)
	}
	defer rows.Close()

	var remainingTokens []string
	for rows.Next() {
		var token string
		if err := rows.Scan(&token); err != nil {
			t.Fatalf("Failed to scan session token: %v", err)
		}
		remainingTokens = append(remainingTokens, token)
	}

	// Check the remaining tokens are the valid ones
	expectedTokens := []string{"valid-token-1", "valid-token-2"}
	for _, expected := range expectedTokens {
		found := false
		for _, actual := range remainingTokens {
			if expected == actual {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("Expected valid token %s to remain, but it was not found", expected)
		}
	}
}

// TestDeleteUserSessions tests the DeleteUserSessions function
func TestDeleteUserSessions(t *testing.T) {
	clearTables()

	// Register two test users
	user1 := registerTestUser(t)
	user2 := registerTestUser(t)

	// Add multiple sessions for each user
	user1Sessions := []string{"user1-token-1", "user1-token-2"}
	user2Sessions := []string{"user2-token-1", "user2-token-2"}

	// Add sessions for user 1
	for _, token := range user1Sessions {
		err := controllers.AddSession(testDB, token, user1.ID, testExpiresAt)
		if err != nil {
			t.Fatalf("Failed to add session for user 1: %v", err)
		}
	}

	// Add sessions for user 2
	for _, token := range user2Sessions {
		err := controllers.AddSession(testDB, token, user2.ID, testExpiresAt)
		if err != nil {
			t.Fatalf("Failed to add session for user 2: %v", err)
		}
	}

	// Delete all sessions for user 1
	err := controllers.DeleteUserSessions(testDB, user1.ID)
	if err != nil {
		t.Fatalf("Failed to delete user sessions: %v", err)
	}

	// Verify user 1's sessions were deleted
	var count int
	err = testDB.QueryRow("SELECT COUNT(*) FROM sessions WHERE user_id = ?",
		user1.ID).Scan(&count)
	if err != nil {
		t.Fatalf("Failed to count user 1 sessions: %v", err)
	}

	if count != 0 {
		t.Errorf("Expected 0 sessions for user 1 after deletion, got %d", count)
	}

	// Verify user 2's sessions remain unchanged
	err = testDB.QueryRow("SELECT COUNT(*) FROM sessions WHERE user_id = ?",
		user2.ID).Scan(&count)
	if err != nil {
		t.Fatalf("Failed to count user 2 sessions: %v", err)
	}

	if count != len(user2Sessions) {
		t.Errorf("Expected %d sessions for user 2, got %d", len(user2Sessions), count)
	}
}

// TestGetSessionToken tests the GetSessionToken function
func TestGetSessionToken(t *testing.T) {
	// Create a request with a session cookie
	req := httptest.NewRequest("GET", "/", nil)
	req.AddCookie(&http.Cookie{
		Name:  "session_token",
		Value: testSessionToken,
	})

	// Get the session token
	token, err := controllers.GetSessionToken(req)
	if err != nil {
		t.Fatalf("Failed to get session token: %v", err)
	}

	// Verify the token value
	if token != testSessionToken {
		t.Errorf("Expected token %s, got %s", testSessionToken, token)
	}

	// Test with no cookie
	req = httptest.NewRequest("GET", "/", nil)
	_, err = controllers.GetSessionToken(req)
	if err == nil {
		t.Error("Expected error when no session cookie, got nil")
	}
}

// TestCleanupExpiredSessions tests the CleanupExpiredSessions function
func TestCleanupExpiredSessions(t *testing.T) {
	clearTables()

	// Register a test user
	user := registerTestUser(t)

	// Add an expired session
	expiredToken := "expired-cleanup-token"
	expiredTime := time.Now().Add(-1 * time.Hour)
	err := controllers.AddSession(testDB, expiredToken, user.ID, expiredTime)
	if err != nil {
		t.Fatalf("Failed to add expired session: %v", err)
	}

	// Add a valid session
	validToken := "valid-cleanup-token"
	validTime := time.Now().Add(1 * time.Hour)
	err = controllers.AddSession(testDB, validToken, user.ID, validTime)
	if err != nil {
		t.Fatalf("Failed to add valid session: %v", err)
	}

	// Create a context that will be cancelled after a short time
	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()

	// Run the cleanup in a goroutine so we can cancel it
	go controllers.CleanupExpiredSessions(ctx, testDB)

	// Wait for the context to be cancelled
	<-ctx.Done()

	// Verify the expired session was deleted
	var count int
	err = testDB.QueryRow("SELECT COUNT(*) FROM sessions WHERE session_token = ?",
		expiredToken).Scan(&count)
	if err != nil {
		t.Fatalf("Failed to count expired sessions: %v", err)
	}

	if count != 0 {
		t.Errorf("Expected expired session to be deleted, but found %d records", count)
	}

	// Verify the valid session remains
	err = testDB.QueryRow("SELECT COUNT(*) FROM sessions WHERE session_token = ?",
		validToken).Scan(&count)
	if err != nil {
		t.Fatalf("Failed to count valid sessions: %v", err)
	}

	if count != 1 {
		t.Errorf("Expected valid session to remain, but found %d records", count)
	}
}
