package models

import (
	"time"
)

// Profile represents a user's profile information
type Profile struct {
	ID        int       `json:"id"`
	Nickname  string    `json:"nickname"`
	Email     string    `json:"email"`
	Bio       string    `json:"bio,omitempty"`
	AvatarURL string    `json:"avatar_url,omitempty"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// ProfileUpdateRequest represents the data that can be updated in a profile
type ProfileUpdateRequest struct {
	Bio       string `json:"bio"`
	AvatarURL string `json:"avatar_url"`
}

// ProfileResponse represents the profile data sent to the client
type ProfileResponse struct {
	Nickname  string `json:"nickname"`
	Email     string `json:"email"`
	Bio       string `json:"bio,omitempty"`
	AvatarURL string `json:"avatar_url,omitempty"`
	CreatedAt string `json:"created_at"`
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

// ValidateProfileUpdate validates the profile update request
func (p *ProfileUpdateRequest) ValidateProfileUpdate() error {
	// TODO: Add validation logic here if needed
	// For example, validate bio length, avatar URL format, etc.
	return nil
}

// ToResponse converts a Profile to a ProfileResponse
func (p *Profile) ToResponse() ProfileResponse {
	return ProfileResponse{
		Nickname:  p.Nickname,
		Email:     p.Email,
		Bio:       p.Bio,
		AvatarURL: p.AvatarURL,
		CreatedAt: p.CreatedAt.Format(time.RFC3339),
	}
}
