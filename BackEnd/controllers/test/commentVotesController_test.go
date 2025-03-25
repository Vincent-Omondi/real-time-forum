// controllers/test/commentVotesController_test.go
package test

import (
	"fmt"
	"testing"
	"time"

	"github.com/Vincent-Omondi/real-time-forum/BackEnd/controllers"
	"github.com/Vincent-Omondi/real-time-forum/BackEnd/models"
)

var commentVotesController *controllers.CommentVotesController

// TestHandleCommentVote tests the HandleCommentVote function
func TestHandleCommentVote(t *testing.T) {
	clearTables()

	// Register a test user
	user := registerTestUser(t)

	// Create a post
	postController := controllers.NewPostController(testDB)
	post := models.Post{
		UserID:    user.ID,
		Author:    user.Nickname,
		Title:     "Test Post for Comment Votes",
		Content:   "This is a test post content for testing comment votes",
		Timestamp: time.Now(),
	}

	postID, err := postController.InsertPost(post)
	if err != nil {
		t.Fatalf("Failed to create test post: %v", err)
	}

	// Create a comment
	commentController := controllers.NewCommentController(testDB)
	comment := models.Comment{
		PostID:    postID,
		UserID:    user.ID,
		Author:    user.Nickname,
		Content:   "This is a test comment for voting",
		Timestamp: time.Now(),
	}

	commentID, err := commentController.InsertComment(comment)
	if err != nil {
		t.Fatalf("Failed to create test comment: %v", err)
	}

	// Initialize comment votes controller
	commentVotesController = controllers.NewCommentVotesController(testDB)

	// Test cases for HandleCommentVote
	testCases := []struct {
		name             string
		commentID        int
		userID           int
		voteType         string
		expectedLikes    int
		expectedDislikes int
		expectError      bool
	}{
		{
			name:             "Add like vote",
			commentID:        commentID,
			userID:           user.ID,
			voteType:         "like",
			expectedLikes:    1,
			expectedDislikes: 0,
			expectError:      false,
		},
		{
			name:             "Remove like vote by clicking again",
			commentID:        commentID,
			userID:           user.ID,
			voteType:         "like",
			expectedLikes:    0,
			expectedDislikes: 0,
			expectError:      false,
		},
		{
			name:             "Add dislike vote",
			commentID:        commentID,
			userID:           user.ID,
			voteType:         "dislike",
			expectedLikes:    0,
			expectedDislikes: 1,
			expectError:      false,
		},
		{
			name:             "Change from dislike to like",
			commentID:        commentID,
			userID:           user.ID,
			voteType:         "like",
			expectedLikes:    1,
			expectedDislikes: 0,
			expectError:      false,
		},
		{
			name:             "Invalid comment ID",
			commentID:        999,
			userID:           user.ID,
			voteType:         "like",
			expectedLikes:    0,
			expectedDislikes: 0,
			expectError:      true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			err := commentVotesController.HandleCommentVote(tc.commentID, tc.userID, tc.voteType)

			if tc.expectError {
				if err == nil {
					t.Errorf("Expected an error but got none")
				}
				return
			}

			if err != nil {
				t.Fatalf("Unexpected error: %v", err)
			}

			// Verify vote counts
			likes, dislikes, err := commentVotesController.GetCommentVotes(tc.commentID)
			if err != nil {
				t.Fatalf("Failed to get comment votes: %v", err)
			}

			if likes != tc.expectedLikes {
				t.Errorf("Expected %d likes, got %d", tc.expectedLikes, likes)
			}

			if dislikes != tc.expectedDislikes {
				t.Errorf("Expected %d dislikes, got %d", tc.expectedDislikes, dislikes)
			}
		})
	}
}

// TestUpdateCommentVotes tests the UpdateCommentVotes function
func TestUpdateCommentVotes(t *testing.T) {
	clearTables()

	// Register two test users
	user1 := registerTestUser(t)

	// Register second user
	registerReq := &models.RegisterRequest{
		Nickname:  "testvoteuser",
		Age:       25,
		Gender:    "female",
		FirstName: "Vote",
		LastName:  "User",
		Email:     "vote@example.com",
		Password:  "Test@123",
	}

	user2, err := authController.Register(registerReq)
	if err != nil {
		t.Fatalf("Failed to register second test user: %v", err)
	}

	// Create a post
	postController := controllers.NewPostController(testDB)
	post := models.Post{
		UserID:    user1.ID,
		Author:    user1.Nickname,
		Title:     "Test Post for Update Comment Votes",
		Content:   "This is a test post for updating comment votes",
		Timestamp: time.Now(),
	}

	postID, err := postController.InsertPost(post)
	if err != nil {
		t.Fatalf("Failed to create test post: %v", err)
	}

	// Create a comment
	commentController := controllers.NewCommentController(testDB)
	comment := models.Comment{
		PostID:    postID,
		UserID:    user1.ID,
		Author:    user1.Nickname,
		Content:   "This is a test comment for vote updating",
		Timestamp: time.Now(),
	}

	commentID, err := commentController.InsertComment(comment)
	if err != nil {
		t.Fatalf("Failed to create test comment: %v", err)
	}

	// Initialize comment votes controller
	commentVotesController = controllers.NewCommentVotesController(testDB)

	// Add votes from both users
	err = commentVotesController.HandleCommentVote(commentID, user1.ID, "like")
	if err != nil {
		t.Fatalf("Failed to add vote from user 1: %v", err)
	}

	err = commentVotesController.HandleCommentVote(commentID, user2.ID, "dislike")
	if err != nil {
		t.Fatalf("Failed to add vote from user 2: %v", err)
	}

	// Now test UpdateCommentVotes
	err = commentVotesController.UpdateCommentVotes(commentID)
	if err != nil {
		t.Fatalf("Failed to update comment votes: %v", err)
	}

	// Verify vote counts
	likes, dislikes, err := commentVotesController.GetCommentVotes(commentID)
	if err != nil {
		t.Fatalf("Failed to get comment votes: %v", err)
	}

	if likes != 1 {
		t.Errorf("Expected 1 like, got %d", likes)
	}

	if dislikes != 1 {
		t.Errorf("Expected 1 dislike, got %d", dislikes)
	}

	// Test with invalid comment ID
	err = commentVotesController.UpdateCommentVotes(999)
	if err == nil {
		t.Error("Expected error when updating non-existent comment, got nil")
	}
}

// TestGetCommentVotes tests the GetCommentVotes function
func TestGetCommentVotes(t *testing.T) {
	clearTables()

	// Register a test user
	user := registerTestUser(t)

	// Create a post
	postController := controllers.NewPostController(testDB)
	post := models.Post{
		UserID:    user.ID,
		Author:    user.Nickname,
		Title:     "Test Post for Get Comment Votes",
		Content:   "This is a test post for getting comment votes",
		Timestamp: time.Now(),
	}

	postID, err := postController.InsertPost(post)
	if err != nil {
		t.Fatalf("Failed to create test post: %v", err)
	}

	// Create a comment
	commentController := controllers.NewCommentController(testDB)
	comment := models.Comment{
		PostID:    postID,
		UserID:    user.ID,
		Author:    user.Nickname,
		Content:   "This is a test comment for getting votes",
		Timestamp: time.Now(),
	}

	commentID, err := commentController.InsertComment(comment)
	if err != nil {
		t.Fatalf("Failed to create test comment: %v", err)
	}

	// Initialize comment votes controller
	commentVotesController = controllers.NewCommentVotesController(testDB)

	// Test initial vote counts (should be 0)
	likes, dislikes, err := commentVotesController.GetCommentVotes(commentID)
	if err != nil {
		t.Fatalf("Failed to get comment votes: %v", err)
	}

	if likes != 0 {
		t.Errorf("Expected 0 likes for new comment, got %d", likes)
	}

	if dislikes != 0 {
		t.Errorf("Expected 0 dislikes for new comment, got %d", dislikes)
	}

	// Add a like
	err = commentVotesController.HandleCommentVote(commentID, user.ID, "like")
	if err != nil {
		t.Fatalf("Failed to add like: %v", err)
	}

	// Test after adding a like
	likes, dislikes, err = commentVotesController.GetCommentVotes(commentID)
	if err != nil {
		t.Fatalf("Failed to get comment votes: %v", err)
	}

	if likes != 1 {
		t.Errorf("Expected 1 like after adding like, got %d", likes)
	}

	if dislikes != 0 {
		t.Errorf("Expected 0 dislikes after adding like, got %d", dislikes)
	}

	// Test with invalid comment ID
	_, _, err = commentVotesController.GetCommentVotes(999)
	if err == nil {
		t.Error("Expected error when getting votes for non-existent comment, got nil")
	}
}

// TestGetUserVotes tests the GetUserVotes function
func TestGetUserVotes(t *testing.T) {
	clearTables()

	// Register a test user
	user := registerTestUser(t)

	// Create a post
	postController := controllers.NewPostController(testDB)
	post := models.Post{
		UserID:    user.ID,
		Author:    user.Nickname,
		Title:     "Test Post for User Votes",
		Content:   "This is a test post for user votes",
		Timestamp: time.Now(),
	}

	postID, err := postController.InsertPost(post)
	if err != nil {
		t.Fatalf("Failed to create test post: %v", err)
	}

	// Create multiple comments
	commentController := controllers.NewCommentController(testDB)
	commentIDs := make([]int, 3)

	for i := 0; i < 3; i++ {
		comment := models.Comment{
			PostID:    postID,
			UserID:    user.ID,
			Author:    user.Nickname,
			Content:   fmt.Sprintf("Test comment %d", i+1),
			Timestamp: time.Now(),
		}

		commentID, err := commentController.InsertComment(comment)
		if err != nil {
			t.Fatalf("Failed to create test comment %d: %v", i+1, err)
		}

		commentIDs[i] = commentID
	}

	// Initialize comment votes controller
	commentVotesController = controllers.NewCommentVotesController(testDB)

	// Initial user votes should be empty
	userVotes, err := commentVotesController.GetUserVotes(user.ID)
	if err != nil {
		t.Fatalf("Failed to get user votes: %v", err)
	}

	if len(userVotes) != 0 {
		t.Errorf("Expected 0 votes initially, got %d", len(userVotes))
	}

	// Add votes to comments
	voteTypes := []string{"like", "dislike", "like"}
	for i, commentID := range commentIDs {
		err = commentVotesController.HandleCommentVote(commentID, user.ID, voteTypes[i])
		if err != nil {
			t.Fatalf("Failed to add vote for comment %d: %v", i+1, err)
		}
	}

	// Get user votes after adding votes
	userVotes, err = commentVotesController.GetUserVotes(user.ID)
	if err != nil {
		t.Fatalf("Failed to get user votes: %v", err)
	}

	if len(userVotes) != 3 {
		t.Errorf("Expected 3 votes after adding votes, got %d", len(userVotes))
	}

	// Verify vote types for each comment
	for i, commentID := range commentIDs {
		commentIDStr := fmt.Sprintf("%d", commentID)
		voteType, exists := userVotes[commentIDStr]

		if !exists {
			t.Errorf("Expected vote for comment ID %d to exist in user votes", commentID)
			continue
		}

		if voteType != voteTypes[i] {
			t.Errorf("Expected vote type %s for comment ID %d, got %s", voteTypes[i], commentID, voteType)
		}
	}
}
