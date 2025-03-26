// auth/session.go
package auth

import (
	"database/sql"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/Vincent-Omondi/real-time-forum/BackEnd/database"
	"github.com/Vincent-Omondi/real-time-forum/BackEnd/logger"
)

// TestMain is the test entry point
func TestMain(m *testing.M) {
	// Initialize logger
	if err := logger.Init(); err != nil {
		fmt.Printf("Error initializing logger: %v\n", err)
		os.Exit(1)
	}

	// Create logs directory if it doesn't exist
	os.MkdirAll("logs", 0755)

	// Create necessary directories for the database
	os.MkdirAll("./BackEnd/database/storage", 0755)

	// Run the tests
	code := m.Run()

	// Clean up after all tests
	cleanupTestResources()

	os.Exit(code)
}

// Add cleanup helper function
func cleanupTestResources() {
	// Clean up log files
	os.RemoveAll("logs")
	// Clean up uploads directory if it exists
	os.RemoveAll("uploads")
	// Clean up entire storage directory with correct path, ensuring recursive removal
	storageDir := "./BackEnd/database/storage"
	if err := os.RemoveAll(storageDir); err != nil {
		// Log the error but don't fail the test
		fmt.Printf("Warning: Failed to remove storage directory: %v\n", err)
	}
}

// Add this new function after cleanupTestResources
func clearDatabaseTables(db *sql.DB) error {
	// List of tables to clear
	tables := []string{"users", "posts", "comments", "likes", "sessions"}

	for _, table := range tables {
		_, err := db.Exec(fmt.Sprintf("DELETE FROM %s", table))
		if err != nil {
			return fmt.Errorf("failed to clear table %s: %v", table, err)
		}
	}
	return nil
}

func TestCreateSession(t *testing.T) {
	// Create a test database
	db, err := database.Init("Test")
	if err != nil {
		t.Fatalf("Failed to create test database: %v", err)
	}
	defer db.Close()

	// Clear all tables before running tests
	if err := clearDatabaseTables(db); err != nil {
		t.Fatalf("Failed to clear database tables: %v", err)
	}

	// Create a separate database connection for the error test
	errorDB, err := database.Init("Test")
	if err != nil {
		t.Fatalf("Failed to create error test database: %v", err)
	}
	// Close it immediately to simulate database error
	errorDB.Close()

	type args struct {
		db     *sql.DB
		w      http.ResponseWriter
		userID int
	}
	tests := []struct {
		name    string
		args    args
		wantErr bool
	}{
		{
			name: "Valid Session Creation",
			args: args{
				db:     db,
				w:      httptest.NewRecorder(),
				userID: 1,
			},
			wantErr: false,
		},
		{
			name: "Invalid User ID",
			args: args{
				db:     db,
				w:      httptest.NewRecorder(),
				userID: -1,
			},
			wantErr: true,
		},
		{
			name: "Invalid User ID Zero",
			args: args{
				db:     db,
				w:      httptest.NewRecorder(),
				userID: 0,
			},
			wantErr: true,
		},
		{
			name: "Database Error",
			args: args{
				db:     errorDB, // Use the closed database connection
				w:      httptest.NewRecorder(),
				userID: 1,
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if err := CreateSession(tt.args.db, tt.args.w, tt.args.userID); (err != nil) != tt.wantErr {
				t.Errorf("CreateSession() error = %v, wantErr %v", err, tt.wantErr)
			}

			if !tt.wantErr {
				// Verify cookie was set
				recorder := tt.args.w.(*httptest.ResponseRecorder)
				cookies := recorder.Result().Cookies()
				found := false
				for _, cookie := range cookies {
					if cookie.Name == "session_token" {
						found = true
						break
					}
				}
				if !found {
					t.Error("CreateSession() did not set session cookie")
				}
			}
		})
	}
}

func TestDeleteSession(t *testing.T) {
	// Create a test database
	db, err := database.Init("Test")
	if err != nil {
		t.Fatalf("Failed to create test database: %v", err)
	}
	defer db.Close()

	// Clear all tables before running tests
	if err := clearDatabaseTables(db); err != nil {
		t.Fatalf("Failed to clear database tables: %v", err)
	}

	// Create a separate database connection for the error test
	errorDB, err := database.Init("Test")
	if err != nil {
		t.Fatalf("Failed to create error test database: %v", err)
	}
	// Close it immediately to simulate database error
	errorDB.Close()

	// Create a test session first
	w := httptest.NewRecorder()
	if err := CreateSession(db, w, 1); err != nil {
		t.Fatalf("Failed to create test session: %v", err)
	}

	// Get the session cookie
	cookies := w.Result().Cookies()
	var sessionCookie *http.Cookie
	for _, cookie := range cookies {
		if cookie.Name == "session_token" {
			sessionCookie = cookie
			break
		}
	}

	if sessionCookie == nil {
		t.Fatal("Failed to create session cookie for test")
	}

	type args struct {
		db     *sql.DB
		w      http.ResponseWriter
		cookie *http.Cookie
	}
	tests := []struct {
		name string
		args args
	}{
		{
			name: "Valid Session Deletion",
			args: args{
				db:     db,
				w:      httptest.NewRecorder(),
				cookie: sessionCookie,
			},
		},
		{
			name: "Nil Cookie",
			args: args{
				db:     db,
				w:      httptest.NewRecorder(),
				cookie: nil,
			},
		},
		{
			name: "Nil Database",
			args: args{
				db:     nil,
				w:      httptest.NewRecorder(),
				cookie: sessionCookie,
			},
		},
		{
			name: "Invalid Session Token",
			args: args{
				db:     db,
				w:      httptest.NewRecorder(),
				cookie: &http.Cookie{Name: "session_token", Value: "invalid_token"},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// DeleteSession doesn't return an error, so we can't check for one
			DeleteSession(tt.args.db, tt.args.w, tt.args.cookie)

			// For valid case, verify cookie was invalidated
			if tt.name == "Valid Session Deletion" {
				recorder := tt.args.w.(*httptest.ResponseRecorder)
				cookies := recorder.Result().Cookies()
				found := false
				for _, cookie := range cookies {
					if cookie.Name == "session_token" && cookie.MaxAge < 0 {
						found = true
						break
					}
				}
				if !found {
					t.Error("DeleteSession() did not properly invalidate session cookie")
				}
			}

			// For nil cases, ensure no panic occurred
			if tt.name == "Nil Cookie" || tt.name == "Nil Database" {
				// If we got here without a panic, the test passes
			}
		})
	}
}

func TestGetSessionByToken(t *testing.T) {
	// Create a test database
	db, err := database.Init("Test")
	if err != nil {
		t.Fatalf("Failed to create test database: %v", err)
	}
	defer db.Close()

	// Clear all tables before running tests
	if err := clearDatabaseTables(db); err != nil {
		t.Fatalf("Failed to clear database tables: %v", err)
	}

	// Create a test session first
	w := httptest.NewRecorder()
	if err := CreateSession(db, w, 1); err != nil {
		t.Fatalf("Failed to create test session: %v", err)
	}

	// Get the session cookie
	cookies := w.Result().Cookies()
	var sessionCookie *http.Cookie
	for _, cookie := range cookies {
		if cookie.Name == "session_token" {
			sessionCookie = cookie
			break
		}
	}

	if sessionCookie == nil {
		t.Fatal("Failed to create session cookie for test")
	}

	// Test GetSessionByToken
	userID, isValid, err := GetSessionByToken(db, sessionCookie.Value)
	if err != nil {
		t.Errorf("GetSessionByToken() error = %v", err)
	}
	if !isValid {
		t.Error("GetSessionByToken() returned session not valid")
	}
	if userID != 1 {
		t.Errorf("GetSessionByToken() userID = %v, want %v", userID, 1)
	}

	// Test with invalid token
	userID, isValid, err = GetSessionByToken(db, "invalid_token")
	if err == nil {
		t.Error("GetSessionByToken() with invalid token should return error")
	}
	if isValid {
		t.Error("GetSessionByToken() with invalid token should return not valid")
	}

	// Test with nil database
	userID, isValid, err = GetSessionByToken(nil, sessionCookie.Value)
	if err == nil {
		t.Error("GetSessionByToken() with nil database should return error")
	}
	if isValid {
		t.Error("GetSessionByToken() with nil database should return not valid")
	}
}
