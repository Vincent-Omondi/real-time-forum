package models

import (
	"time"
)

// Profile represents a user's profile information
type Profile struct {
	ID        int       `json:"id"`
	Nickname  string    `json:"nickname"`
	FirstName string    `json:"first_name"`
	LastName  string    `json:"last_name"`
	Email     string    `json:"email"`
	Bio       string    `json:"bio,omitempty"`
	AvatarURL string    `json:"avatar_url,omitempty"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// ProfileResponse represents the profile data sent to the client
type ProfileResponse struct {
	Nickname  string `json:"nickname"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	Email     string `json:"email"`
	CreatedAt string `json:"created_at"`
}

// ProfileUpdateRequest represents the data that can be updated in a profile
type ProfileUpdateRequest struct {
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
}

// ValidateProfileUpdate validates the profile update request
func (p *ProfileUpdateRequest) ValidateProfileUpdate() error {
	// TODO: Add validation logic here if needed
	// For example, validate name lengths, format, etc.
	return nil
}

// UserActivity represents a user's activity (posts or likes)
type UserActivity struct {
	ID        int       `json:"id"`
	Title     string    `json:"title"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"created_at"`
	Likes     int       `json:"likes"`
	IsLiked   bool      `json:"is_liked,omitempty"`
}

// ToResponse converts a Profile to a ProfileResponse
func (p *Profile) ToResponse() ProfileResponse {
	return ProfileResponse{
		Nickname:  p.Nickname,
		FirstName: p.FirstName,
		LastName:  p.LastName,
		Email:     p.Email,
		CreatedAt: p.CreatedAt.Format(time.RFC3339),
	}
}
