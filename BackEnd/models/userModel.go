// models/userModel.go:
package models

import (
	"errors"
	"strings"
	"time"
)

type User struct {
	ID        int       `json:"id"`
	Nickname  string    `json:"nickname"`
	Age       int       `json:"age"`
	Gender    string    `json:"gender"`
	FirstName string    `json:"firstName"`
	LastName  string    `json:"lastName"`
	Email     string    `json:"email"`
	Password  string    `json:"password"`
	CreatedAt time.Time `json:"createdAt"`
}

// LoginRequest represents the login request structure
type LoginRequest struct {
	Identifier string `json:"identifier"` // Can be either email or nickname
	Password   string `json:"password"`
}

// RegisterRequest represents the registration request structure
type RegisterRequest struct {
	Nickname  string `json:"nickname"`
	Age       int    `json:"age"`
	Gender    string `json:"gender"`
	FirstName string `json:"firstName"`
	LastName  string `json:"lastName"`
	Email     string `json:"email"`
	Password  string `json:"password"`
}

func (u *User) ValidateRegistration() error {
	// Check for required fields
	if u.Nickname == "" || u.Email == "" || u.Password == "" ||
		u.FirstName == "" || u.LastName == "" || u.Age == 0 || u.Gender == "" {
		return errors.New("all fields are required")
	}

	// Validate age
	if u.Age < 13 {
		return errors.New("user must be at least 13 years old")
	}

	// Validate email format
	if !strings.Contains(u.Email, "@") {
		return errors.New("invalid email format")
	}

	// Validate gender
	gender := strings.ToLower(u.Gender)
	if gender != "male" && gender != "female" && gender != "other" {
		return errors.New("invalid gender selection")
	}

	// Validate nickname length
	if len(u.Nickname) < 3 || len(u.Nickname) > 30 {
		return errors.New("nickname must be between 3 and 30 characters")
	}

	// Validate password strength
	if len(u.Password) < 8 {
		return errors.New("password must be at least 8 characters long")
	}

	return nil
}
