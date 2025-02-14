// controllers/authController.go
package controllers

import (
	"database/sql"
	"errors"
	"net/mail"
	"regexp"
	"strings"

	"github.com/Vincent-Omondi/real-time-forum/BackEnd/logger"
	"github.com/Vincent-Omondi/real-time-forum/BackEnd/models"
	"golang.org/x/crypto/bcrypt"
)

type AuthController struct {
	DB *sql.DB
}

func NewAuthController(db *sql.DB) *AuthController {
	return &AuthController{DB: db}
}

func (ac *AuthController) Register(req *models.RegisterRequest) (*models.User, error) {
	// Create user from request
	user := &models.User{
		Nickname:  req.Nickname,
		Age:       req.Age,
		Gender:    req.Gender,
		FirstName: req.FirstName,
		LastName:  req.LastName,
		Email:     req.Email,
		Password:  req.Password,
	}

	// Validate user input
	if err := user.ValidateRegistration(); err != nil {
		logger.Warning("Registration validation failed: %v", err)
		return nil, err
	}

	// Hash password before storing
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(user.Password), bcrypt.DefaultCost)
	if err != nil {
		logger.Error("Failed to hash password: %v", err)
		return nil, errors.New("internal server error")
	}
	user.Password = string(hashedPassword)

	// Store user in database
	query := `INSERT INTO users (nickname, age, gender, first_name, last_name, email, password, created_at) 
              VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`

	result, err := ac.DB.Exec(query,
		user.Nickname,
		user.Age,
		user.Gender,
		user.FirstName,
		user.LastName,
		user.Email,
		user.Password,
	)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE constraint failed") {
			logger.Warning("Registration failed - duplicate email or nickname: %v", err)
			return nil, errors.New("email or nickname already taken")
		}
		logger.Error("Database error during registration: %v", err)
		return nil, errors.New("internal server error")
	}

	// Get the auto-generated user ID
	userID, err := result.LastInsertId()
	if err != nil {
		logger.Error("Failed to retrieve user ID after registration: %v", err)
		return nil, errors.New("failed to complete registration")
	}
	user.ID = int(userID)

	// Clear password before returning
	user.Password = ""
	return user, nil
}

func (ac *AuthController) Login(req *models.LoginRequest) (*models.User, error) {
	user := &models.User{}

	// Check if identifier is email or nickname
	query := `SELECT id, nickname, age, gender, first_name, last_name, email, password, created_at 
             FROM users WHERE email = ? OR nickname = ?`

	err := ac.DB.QueryRow(query, req.Identifier, req.Identifier).Scan(
		&user.ID,
		&user.Nickname,
		&user.Age,
		&user.Gender,
		&user.FirstName,
		&user.LastName,
		&user.Email,
		&user.Password,
		&user.CreatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			logger.Warning("Login failed - invalid identifier: %s", req.Identifier)
			return nil, errors.New("invalid credentials")
		}
		logger.Error("Database error during login: %v", err)
		return nil, errors.New("internal server error")
	}

	// Verify password
	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		logger.Warning("Login failed - invalid password for user: %s", req.Identifier)
		return nil, errors.New("invalid credentials")
	}

	// Clear password before returning
	user.Password = ""
	return user, nil
}

// Helper functions for input validation
func (ac *AuthController) IsValidEmail(email string) bool {
	_, err := mail.ParseAddress(email)
	if err != nil {
		logger.Debug("Invalid email format: %s", email)
		return false
	}
	return true
}

func (ac *AuthController) IsValidNickname(nickname string) bool {
	if len(nickname) < 3 || len(nickname) > 30 {
		logger.Debug("Invalid nickname length: %s", nickname)
		return false
	}
	// Only allow letters, numbers, and underscores
	regex := regexp.MustCompile(`^[a-zA-Z0-9_]+$`)
	if !regex.MatchString(nickname) {
		logger.Debug("Nickname contains invalid characters: %s", nickname)
		return false
	}
	return true
}

func (ac *AuthController) IsValidPassword(password string) bool {
	if len(password) < 8 {
		return false
	}
	// Check for at least one uppercase, one lowercase, one number, and one special character
	hasUpper := regexp.MustCompile(`[A-Z]`).MatchString(password)
	hasLower := regexp.MustCompile(`[a-z]`).MatchString(password)
	hasNumber := regexp.MustCompile(`[0-9]`).MatchString(password)
	hasSpecial := regexp.MustCompile(`[!@#$%^&*()_+{}|:"<>?~\-=[\]\\;',./]`).MatchString(password)

	if !hasUpper || !hasLower || !hasNumber || !hasSpecial {
		logger.Debug("Password does not meet complexity requirements")
		return false
	}
	return true
}

// sanitizeInput removes potentially dangerous characters to prevent XSS
func (ac *AuthController) SanitizeInput(input string) string {
	input = strings.ReplaceAll(input, "<", "&lt;")
	input = strings.ReplaceAll(input, ">", "&gt;")
	input = strings.ReplaceAll(input, "&", "&amp;")
	input = strings.ReplaceAll(input, "\"", "&quot;")
	input = strings.ReplaceAll(input, "'", "&#39;")
	return input
}

// Function to retrieve username based on user ID from SQLite database
func GetUsernameByID(db *sql.DB, userID int) string {
	var username string

	// Query to fetch the username for the given user ID
	query := `SELECT username FROM users WHERE id = ?`
	err := db.QueryRow(query, userID).Scan(&username)
	if err != nil {
		if err == sql.ErrNoRows {
			// No rows were found for the given user ID
			return ""
		}
		// Other database errors
		return ""
	}

	return username
}
