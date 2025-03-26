// controllers/test/csrfController_test.go
package test

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/Vincent-Omondi/real-time-forum/BackEnd/controllers"
)

// Helper function to create a session token
func createSessionToken(t *testing.T, userID int) string {
	// Generate a random session token
	b := make([]byte, 32)
	_, err := rand.Read(b)
	if err != nil {
		t.Fatalf("Failed to generate random bytes for session token: %v", err)
	}
	sessionToken := base64.URLEncoding.EncodeToString(b)

	// Set expiration time (e.g., 24 hours from now)
	expiresAt := time.Now().Add(24 * time.Hour)

	// Store the session in the database
	err = controllers.AddSession(testDB, sessionToken, userID, expiresAt)
	if err != nil {
		t.Fatalf("Failed to store session in database: %v", err)
	}

	return sessionToken
}

// TestGenerateCSRFToken tests the GenerateCSRFToken function
func TestGenerateCSRFToken(t *testing.T) {
	clearTables()

	// Ensure the CSRF tokens table exists
	ensureCsrfTableExists(t)

	// Register a test user
	user := registerTestUser(t)

	// Create a session for the user
	sessionToken := createSessionToken(t, user.ID)

	// Test generating a CSRF token
	token, err := controllers.GenerateCSRFToken(testDB, sessionToken)
	if err != nil {
		t.Fatalf("Failed to generate CSRF token: %v", err)
	}

	if token == "" {
		t.Errorf("Expected non-empty CSRF token")
	}

	// Test that getting the token again returns the same token
	tokenAgain, err := controllers.GenerateCSRFToken(testDB, sessionToken)
	if err != nil {
		t.Fatalf("Failed to get CSRF token again: %v", err)
	}

	if token != tokenAgain {
		t.Errorf("Expected same token when generating again within expiry time, got different tokens")
	}

	// Test with empty session token
	_, err = controllers.GenerateCSRFToken(testDB, "")
	if err == nil {
		t.Errorf("Expected error when generating token with empty session token")
	}
}

// TestVerifyCSRFToken tests the VerifyCSRFToken function
func TestVerifyCSRFToken(t *testing.T) {
	clearTables()

	// Ensure the CSRF tokens table exists
	ensureCsrfTableExists(t)

	// Register a test user
	user := registerTestUser(t)

	// Create a session for the user
	sessionToken := createSessionToken(t, user.ID)

	// Generate a CSRF token
	token, err := controllers.GenerateCSRFToken(testDB, sessionToken)
	if err != nil {
		t.Fatalf("Failed to generate CSRF token: %v", err)
	}

	// Create test cases
	testCases := []struct {
		name           string
		setupRequest   func() *http.Request
		expectedResult bool
	}{
		{
			name: "Valid token in header",
			setupRequest: func() *http.Request {
				req := httptest.NewRequest("POST", "/api/test", nil)
				req.Header.Set("X-CSRF-Token", token)
				cookie := &http.Cookie{
					Name:  "session_token",
					Value: sessionToken,
				}
				req.AddCookie(cookie)
				return req
			},
			expectedResult: true,
		},
		{
			name: "Valid token in form",
			setupRequest: func() *http.Request {
				req := httptest.NewRequest("POST", "/api/test?csrf_token="+token, nil)
				cookie := &http.Cookie{
					Name:  "session_token",
					Value: sessionToken,
				}
				req.AddCookie(cookie)
				return req
			},
			expectedResult: true,
		},
		{
			name: "Missing token",
			setupRequest: func() *http.Request {
				req := httptest.NewRequest("POST", "/api/test", nil)
				cookie := &http.Cookie{
					Name:  "session_token",
					Value: sessionToken,
				}
				req.AddCookie(cookie)
				return req
			},
			expectedResult: false,
		},
		{
			name: "Invalid token",
			setupRequest: func() *http.Request {
				req := httptest.NewRequest("POST", "/api/test", nil)
				req.Header.Set("X-CSRF-Token", "invalid-token")
				cookie := &http.Cookie{
					Name:  "session_token",
					Value: sessionToken,
				}
				req.AddCookie(cookie)
				return req
			},
			expectedResult: false,
		},
		{
			name: "Missing session token cookie",
			setupRequest: func() *http.Request {
				req := httptest.NewRequest("POST", "/api/test", nil)
				req.Header.Set("X-CSRF-Token", token)
				return req
			},
			expectedResult: false,
		},
		{
			name: "Invalid session token",
			setupRequest: func() *http.Request {
				req := httptest.NewRequest("POST", "/api/test", nil)
				req.Header.Set("X-CSRF-Token", token)
				cookie := &http.Cookie{
					Name:  "session_token",
					Value: "invalid-session-token",
				}
				req.AddCookie(cookie)
				return req
			},
			expectedResult: false,
		},
	}

	// Run tests
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			req := tc.setupRequest()
			result := controllers.VerifyCSRFToken(testDB, req)

			if result != tc.expectedResult {
				t.Errorf("Expected %v but got %v", tc.expectedResult, result)
			}
		})
	}
}

// TestAddGetDeleteCSRFToken tests the CSRF token database operations
func TestAddGetDeleteCSRFToken(t *testing.T) {
	clearTables()

	// Ensure the CSRF tokens table exists
	ensureCsrfTableExists(t)

	// Test adding a token
	sessionToken := "test-session-token"
	csrfToken := "test-csrf-token"
	expiresAt := time.Now().Add(1 * time.Hour)

	err := controllers.AddCSRFToken(testDB, sessionToken, csrfToken, expiresAt)
	if err != nil {
		t.Fatalf("Failed to add CSRF token: %v", err)
	}

	// Test getting the token
	retrievedToken, retrievedExpiresAt, err := controllers.GetCSRFToken(testDB, sessionToken)
	if err != nil {
		t.Fatalf("Failed to get CSRF token: %v", err)
	}

	if retrievedToken != csrfToken {
		t.Errorf("Expected token %s, got %s", csrfToken, retrievedToken)
	}

	// Compare timestamps with some tolerance
	// SQLite may not store timezone information, so we'll compare Unix timestamps
	if retrievedExpiresAt.Unix() != expiresAt.Unix() {
		t.Errorf("Expected expiry time Unix timestamp %v, got %v", expiresAt.Unix(), retrievedExpiresAt.Unix())
	}

	// Test getting with empty session token
	_, _, err = controllers.GetCSRFToken(testDB, "")
	if err == nil {
		t.Errorf("Expected error when getting token with empty session token")
	}

	// Test deleting the token
	err = controllers.DeleteCSRFToken(testDB, sessionToken)
	if err != nil {
		t.Fatalf("Failed to delete CSRF token: %v", err)
	}

	// Verify token is deleted
	_, _, err = controllers.GetCSRFToken(testDB, sessionToken)
	if err == nil {
		t.Errorf("Expected error after deleting token, got nil")
	}

	// Test adding with empty session token
	err = controllers.AddCSRFToken(testDB, "", csrfToken, expiresAt)
	if err == nil {
		t.Errorf("Expected error when adding token with empty session token")
	}
}

// TestCleanupExpiredCSRFTokens tests the token cleanup functionality
func TestCleanupExpiredCSRFTokens(t *testing.T) {
	clearTables()

	// Ensure the CSRF tokens table exists
	ensureCsrfTableExists(t)

	// Add a current token (not expired)
	activeSessionToken := "active-session-token"
	activeCSRFToken := "active-csrf-token"
	activeExpiresAt := time.Now().Add(1 * time.Hour)

	err := controllers.AddCSRFToken(testDB, activeSessionToken, activeCSRFToken, activeExpiresAt)
	if err != nil {
		t.Fatalf("Failed to add active CSRF token: %v", err)
	}

	// Add an expired token
	expiredSessionToken := "expired-session-token"
	expiredCSRFToken := "expired-csrf-token"
	expiredExpiresAt := time.Now().Add(-1 * time.Hour) // 1 hour in the past

	err = controllers.AddCSRFToken(testDB, expiredSessionToken, expiredCSRFToken, expiredExpiresAt)
	if err != nil {
		t.Fatalf("Failed to add expired CSRF token: %v", err)
	}

	// Create a context with cancel to run cleanup function
	ctx, cancel := context.WithCancel(context.Background())

	// Start cleanup in a goroutine
	go func() {
		// Run cleanup for a short time and then cancel
		time.Sleep(100 * time.Millisecond)
		cancel()
	}()

	// Run the cleanup function (it will exit when context is canceled)
	controllers.CleanupExpiredCSRFTokens(ctx, testDB)

	// Verify expired token is deleted
	_, _, err = controllers.GetCSRFToken(testDB, expiredSessionToken)
	if err == nil {
		t.Errorf("Expected error when getting expired token after cleanup, got nil")
	}

	// Verify active token is still there
	retrievedToken, _, err := controllers.GetCSRFToken(testDB, activeSessionToken)
	if err != nil {
		t.Fatalf("Failed to get active token after cleanup: %v", err)
	}

	if retrievedToken != activeCSRFToken {
		t.Errorf("Expected active token to remain after cleanup")
	}
}

// Helper function to ensure CSRF tokens table exists in test database
func ensureCsrfTableExists(t *testing.T) {
	_, err := testDB.Exec(`
		CREATE TABLE IF NOT EXISTS csrf_tokens (
			session_token TEXT PRIMARY KEY,
			csrf_token TEXT NOT NULL,
			expires_at DATETIME NOT NULL
		)
	`)
	if err != nil {
		t.Fatalf("Failed to create csrf_tokens table: %v", err)
	}
}
