// controllers/test/authController_test.go
package test

import (
	"database/sql"
	"os"
	"strings"
	"testing"

	"github.com/Vincent-Omondi/real-time-forum/BackEnd/controllers"
	"github.com/Vincent-Omondi/real-time-forum/BackEnd/database"
	"github.com/Vincent-Omondi/real-time-forum/BackEnd/logger"
	"github.com/Vincent-Omondi/real-time-forum/BackEnd/models"
	_ "github.com/mattn/go-sqlite3"
)

var testDB *sql.DB
var authController *controllers.AuthController

// TestMain is the entry point for the tests
func TestMain(m *testing.M) {
	// Set up test environment
	if err := setUp(); err != nil {
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

	// Create auth controller
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
	tables := []string{"users", "sessions"}
	for _, table := range tables {
		testDB.Exec("DELETE FROM " + table)
	}
}

// Helper function to register a test user
func registerTestUser(t *testing.T) *models.User {
	registerReq := &models.RegisterRequest{
		Nickname:  "testuser",
		Age:       25,
		Gender:    "male",
		FirstName: "Test",
		LastName:  "User",
		Email:     "test@example.com",
		Password:  "Test@123",
	}

	user, err := authController.Register(registerReq)
	if err != nil {
		t.Fatalf("Failed to register test user: %v", err)
	}

	return user
}

// TestRegister tests the Register function
func TestRegister(t *testing.T) {
	clearTables()

	// Valid registration
	registerReq := &models.RegisterRequest{
		Nickname:  "testuser",
		Age:       25,
		Gender:    "male",
		FirstName: "Test",
		LastName:  "User",
		Email:     "test@example.com",
		Password:  "Test@123",
	}

	user, err := authController.Register(registerReq)
	if err != nil {
		t.Fatalf("Failed to register valid user: %v", err)
	}

	if user.ID <= 0 {
		t.Error("User ID should be greater than 0")
	}

	if user.Nickname != registerReq.Nickname {
		t.Errorf("User nickname: got %s, want %s", user.Nickname, registerReq.Nickname)
	}

	if user.Password != "" {
		t.Error("User password should be cleared before returning")
	}

	// Duplicate email registration
	duplicateEmailReq := &models.RegisterRequest{
		Nickname:  "testuser2",
		Age:       25,
		Gender:    "male",
		FirstName: "Test",
		LastName:  "User",
		Email:     "test@example.com", // Same email
		Password:  "Test@123",
	}

	_, err = authController.Register(duplicateEmailReq)
	if err == nil {
		t.Error("Should get error when registering with duplicate email")
	}

	// Duplicate nickname registration
	duplicateNicknameReq := &models.RegisterRequest{
		Nickname:  "testuser", // Same nickname
		Age:       25,
		Gender:    "male",
		FirstName: "Test",
		LastName:  "User",
		Email:     "test2@example.com",
		Password:  "Test@123",
	}

	_, err = authController.Register(duplicateNicknameReq)
	if err == nil {
		t.Error("Should get error when registering with duplicate nickname")
	}

	// Invalid age
	invalidAgeReq := &models.RegisterRequest{
		Nickname:  "younguser",
		Age:       10, // Under 13
		Gender:    "male",
		FirstName: "Young",
		LastName:  "User",
		Email:     "young@example.com",
		Password:  "Test@123",
	}

	_, err = authController.Register(invalidAgeReq)
	if err == nil {
		t.Error("Should get error when registering with age under 13")
	}
}

// TestLogin tests the Login function
func TestLogin(t *testing.T) {
	clearTables()

	// Register a test user first
	user := registerTestUser(t)

	// Valid login with email
	loginWithEmailReq := &models.LoginRequest{
		Identifier: "test@example.com",
		Password:   "Test@123",
	}

	loggedInUser, err := authController.Login(loginWithEmailReq)
	if err != nil {
		t.Errorf("Failed to login with email: %v", err)
	}

	if loggedInUser.ID != user.ID {
		t.Errorf("User ID: got %d, want %d", loggedInUser.ID, user.ID)
	}

	// Valid login with nickname
	loginWithNicknameReq := &models.LoginRequest{
		Identifier: "testuser",
		Password:   "Test@123",
	}

	loggedInUser, err = authController.Login(loginWithNicknameReq)
	if err != nil {
		t.Errorf("Failed to login with nickname: %v", err)
	}

	if loggedInUser.ID != user.ID {
		t.Errorf("User ID: got %d, want %d", loggedInUser.ID, user.ID)
	}

	// Invalid login - wrong password
	wrongPasswordReq := &models.LoginRequest{
		Identifier: "testuser",
		Password:   "WrongPassword@123",
	}

	_, err = authController.Login(wrongPasswordReq)
	if err == nil {
		t.Error("Should get error when logging in with wrong password")
	}

	// Invalid login - non-existent user
	nonExistentUserReq := &models.LoginRequest{
		Identifier: "nonexistentuser",
		Password:   "Test@123",
	}

	_, err = authController.Login(nonExistentUserReq)
	if err == nil {
		t.Error("Should get error when logging in with non-existent user")
	}
}

// TestValidationFunctions tests the validation helper functions
func TestValidationFunctions(t *testing.T) {
	// Test email validation
	validEmails := []string{"test@example.com", "user.name@domain.co.uk", "first.last@company.org"}
	invalidEmails := []string{"invalid"}

	for _, email := range validEmails {
		if !authController.IsValidEmail(email) {
			t.Errorf("Email %s should be valid", email)
		}
	}

	for _, email := range invalidEmails {
		if authController.IsValidEmail(email) {
			t.Errorf("Email %s should be invalid", email)
		}
	}

	// Test nickname validation
	validNicknames := []string{"user123", "test_user", "validusername"}
	invalidNicknames := []string{"us", "very_long_nickname_that_exceeds_thirty_characters", "invalid@user", "space user"}

	for _, nickname := range validNicknames {
		if !authController.IsValidNickname(nickname) {
			t.Errorf("Nickname %s should be valid", nickname)
		}
	}

	for _, nickname := range invalidNicknames {
		if authController.IsValidNickname(nickname) {
			t.Errorf("Nickname %s should be invalid", nickname)
		}
	}

	// Test password validation
	validPasswords := []string{"Test@123", "Complex!Password1", "P@ssw0rd"}
	invalidPasswords := []string{"short", "NOLOWERCASE123!", "nouppercase123!", "NoNumbers!", "NoSpecial123"}

	for _, password := range validPasswords {
		if !authController.IsValidPassword(password) {
			t.Errorf("Password %s should be valid", password)
		}
	}

	for _, password := range invalidPasswords {
		if authController.IsValidPassword(password) {
			t.Errorf("Password %s should be invalid", password)
		}
	}
}

// TestSanitizeInput tests the input sanitization function
func TestSanitizeInput(t *testing.T) {
	tests := []struct {
		name  string
		input string
	}{
		{
			name:  "Sanitize script tag",
			input: "<script>alert('XSS')</script>",
		},
		{
			name:  "Normal text",
			input: "Normal text",
		},
		{
			name:  "Text with tags and special characters",
			input: "Text with <tags> & \"quotes\"",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			result := authController.SanitizeInput(test.input)

			// Verify the output doesn't contain any unescaped special characters
			if strings.Contains(result, "<") || strings.Contains(result, ">") {
				t.Errorf("SanitizeInput(%s) failed to escape angle brackets", test.input)
			}

			if strings.Contains(result, "\"") {
				t.Errorf("SanitizeInput(%s) failed to escape double quotes", test.input)
			}

			if test.input == "Normal text" && result != "Normal text" {
				t.Errorf("SanitizeInput(%s) changed normal text", test.input)
			}

			// Test that the original input was properly sanitized
			if test.input == "<script>alert('XSS')</script>" {
				if !strings.Contains(result, "script") {
					t.Errorf("SanitizeInput(%s) removed the content that should be kept", test.input)
				}
			}
		})
	}
}

// TestGetUsernameByID tests the GetUsernameByID function
func TestGetUsernameByID(t *testing.T) {
	clearTables()

	// Register a test user
	user := registerTestUser(t)

	// Get username with valid ID
	username := controllers.GetUsernameByID(testDB, user.ID)
	if username != user.Nickname {
		t.Errorf("GetUsernameByID(%d): got %s, want %s", user.ID, username, user.Nickname)
	}

	// Get username with invalid ID
	username = controllers.GetUsernameByID(testDB, -1)
	if username != "" {
		t.Errorf("GetUsernameByID(-1): got %s, want empty string", username)
	}
}
