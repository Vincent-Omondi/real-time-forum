// controllers/test/helpers_test.go
package test

import (
	"database/sql"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/Vincent-Omondi/real-time-forum/BackEnd/controllers"
	"github.com/Vincent-Omondi/real-time-forum/BackEnd/database"
	"github.com/Vincent-Omondi/real-time-forum/BackEnd/logger"
	"github.com/Vincent-Omondi/real-time-forum/BackEnd/models"
	_ "github.com/mattn/go-sqlite3"
)

// Shared database connection for all tests
var testDB *sql.DB

// Controllers that can be reused across tests
var authController *controllers.AuthController

// TestMain is the entry point for all tests
func TestMain(m *testing.M) {
	// Set up test environment
	if err := setUp(); err != nil {
		fmt.Printf("Error setting up tests: %v\n", err)
		os.Exit(1)
	}

	// Run tests
	code := m.Run()

	// Clean up
	tearDown()

	os.Exit(code)
}

// setUp initializes the test environment
func setUp() error {
	// Initialize logger
	if err := logger.Init(); err != nil {
		return err
	}

	// Create directories
	os.MkdirAll("logs", 0755)
	os.MkdirAll("./BackEnd/database/storage", 0755)

	// Initialize test database
	var err error
	testDB, err = database.Init("Test")
	if err != nil {
		return err
	}

	// Create controllers
	authController = controllers.NewAuthController(testDB)

	// Clear database tables
	clearTables()

	return nil
}

// tearDown cleans up after tests
func tearDown() {
	if testDB != nil {
		testDB.Close()
	}

	// Cleanup files
	os.RemoveAll("logs")
	os.RemoveAll("./BackEnd/database/storage")
}

// clearTables removes all data from the database tables
func clearTables() {
	tables := []string{
		"comments",
		"likes",
		"posts",
		"sessions",
		"users",
		"messages",
		"user_status",
	}

	for _, table := range tables {
		_, err := testDB.Exec(fmt.Sprintf("DELETE FROM %s", table))
		if err != nil {
			// Don't fail if a table doesn't exist - just continue
			fmt.Printf("Warning: could not clear table %s: %v\n", table, err)
		}
	}
}

// Helper function to register a test user
func registerTestUser(t *testing.T) *models.User {
	// Add a timestamp to make each user unique
	timestamp := time.Now().UnixNano()
	nickname := fmt.Sprintf("testuser%d", timestamp)
	email := fmt.Sprintf("test%d@example.com", timestamp)

	registerReq := &models.RegisterRequest{
		Nickname:  nickname,
		Age:       25,
		Gender:    "male",
		FirstName: "Test",
		LastName:  "User",
		Email:     email,
		Password:  "Test@123",
	}

	user, err := authController.Register(registerReq)
	if err != nil {
		t.Fatalf("Failed to register test user: %v", err)
	}

	return user
}
