// controllers/test/commentController_test.go
package test

import (
	"database/sql"
	"fmt"
	"strconv"
	"testing"
	"time"

	"github.com/Vincent-Omondi/real-time-forum/BackEnd/controllers"
	"github.com/Vincent-Omondi/real-time-forum/BackEnd/models"
)

var commentController *controllers.CommentController

// TestInsertComment tests the InsertComment function
func TestInsertComment(t *testing.T) {
	clearTables()

	// Register a test user
	user := registerTestUser(t)

	// Create a post first
	postController := controllers.NewPostController(testDB)
	post := models.Post{
		UserID:    user.ID,
		Author:    user.Nickname,
		Title:     "Test Post",
		Content:   "This is a test post content",
		Timestamp: time.Now(),
	}

	postID, err := postController.InsertPost(post)
	if err != nil {
		t.Fatalf("Failed to create test post: %v", err)
	}

	// Initialize comment controller
	commentController = controllers.NewCommentController(testDB)

	// Test valid comment
	comment := models.Comment{
		PostID:    postID,
		UserID:    user.ID,
		Author:    user.Nickname,
		Content:   "This is a test comment",
		Likes:     0,
		Dislikes:  0,
		UserVote:  sql.NullString{},
		Timestamp: time.Now(),
	}

	commentID, err := commentController.InsertComment(comment)
	if err != nil {
		t.Fatalf("Failed to insert valid comment: %v", err)
	}

	if commentID <= 0 {
		t.Error("Comment ID should be greater than 0")
	}

	// Test empty content
	emptyComment := models.Comment{
		PostID:    postID,
		UserID:    user.ID,
		Author:    user.Nickname,
		Content:   "", // Empty content
		Timestamp: time.Now(),
	}

	_, err = commentController.InsertComment(emptyComment)
	if err == nil {
		t.Error("Should get error when inserting comment with empty content")
	}

	// Test content too long
	longContent := ""
	for i := 0; i < 3001; i++ {
		longContent += "a"
	}

	longComment := models.Comment{
		PostID:    postID,
		UserID:    user.ID,
		Author:    user.Nickname,
		Content:   longContent, // Content too long
		Timestamp: time.Now(),
	}

	_, err = commentController.InsertComment(longComment)
	if err == nil {
		t.Error("Should get error when inserting comment with content too long")
	}

	// Test nested comments
	// Create a chain of nested comments until we hit an error
	var prevCommentID int
	var depth int
	maxDepth := 20 // Reasonable upper limit to prevent infinite loop

	for depth = 0; depth < maxDepth; depth++ {
		nestedComment := models.Comment{
			PostID:    postID,
			UserID:    user.ID,
			Author:    user.Nickname,
			Content:   fmt.Sprintf("Nested comment level %d", depth+1),
			Timestamp: time.Now(),
		}

		if depth > 0 {
			nestedComment.ParentID = sql.NullInt64{Int64: int64(prevCommentID), Valid: true}
		}

		var err error
		prevCommentID, err = commentController.InsertComment(nestedComment)
		if err != nil {
			// We hit the depth limit or another error occurred
			t.Logf("Hit maximum nesting depth at level %d: %v", depth+1, err)
			break
		}
	}

	// Verify we hit a reasonable depth limit (greater than 1 but less than maxDepth)
	if depth < 1 {
		t.Error("Failed to create even a single level of comments")
	} else if depth >= maxDepth {
		t.Error("No maximum nesting depth was enforced")
	} else {
		t.Logf("Maximum nesting depth is %d levels", depth)
	}
}

// TestGetCommentsByPostID tests the GetCommentsByPostID function
func TestGetCommentsByPostID(t *testing.T) {
	clearTables()

	// Register a test user
	user := registerTestUser(t)

	// Create a post
	postController := controllers.NewPostController(testDB)
	post := models.Post{
		UserID:    user.ID,
		Author:    user.Nickname,
		Title:     "Test Post for Comments",
		Content:   "This is a test post content for comments",
		Timestamp: time.Now(),
	}

	postID, err := postController.InsertPost(post)
	if err != nil {
		t.Fatalf("Failed to create test post: %v", err)
	}

	commentController = controllers.NewCommentController(testDB)

	// Insert multiple comments
	commentCount := 5
	for i := 0; i < commentCount; i++ {
		comment := models.Comment{
			PostID:    postID,
			UserID:    user.ID,
			Author:    user.Nickname,
			Content:   fmt.Sprintf("Test comment %d", i+1),
			Timestamp: time.Now(),
		}

		_, err := commentController.InsertComment(comment)
		if err != nil {
			t.Fatalf("Failed to insert test comment %d: %v", i+1, err)
		}
	}

	// Get comments by post ID
	comments, err := commentController.GetCommentsByPostID(strconv.Itoa(postID))
	if err != nil {
		t.Fatalf("Failed to get comments by post ID: %v", err)
	}

	if len(comments) != commentCount {
		t.Errorf("Expected %d comments, got %d", commentCount, len(comments))
	}

	// Test with invalid post ID
	_, err = commentController.GetCommentsByPostID("invalid")
	if err == nil {
		t.Error("Should get error when getting comments with invalid post ID")
	}

	// Test with non-existent post ID
	comments, err = commentController.GetCommentsByPostID("999")
	if err != nil {
		t.Fatalf("Failed to get comments for non-existent post: %v", err)
	}

	if len(comments) != 0 {
		t.Errorf("Expected 0 comments for non-existent post, got %d", len(comments))
	}
}

// TestGetCommentCountByPostID tests the GetCommentCountByPostID function
func TestGetCommentCountByPostID(t *testing.T) {
	clearTables()

	// Register a test user
	user := registerTestUser(t)

	// Create a post
	postController := controllers.NewPostController(testDB)
	post := models.Post{
		UserID:    user.ID,
		Author:    user.Nickname,
		Title:     "Test Post for Comment Count",
		Content:   "This is a test post content for comment count",
		Timestamp: time.Now(),
	}

	postID, err := postController.InsertPost(post)
	if err != nil {
		t.Fatalf("Failed to create test post: %v", err)
	}

	commentController = controllers.NewCommentController(testDB)

	// Insert comments
	commentCount := 3
	for i := 0; i < commentCount; i++ {
		comment := models.Comment{
			PostID:    postID,
			UserID:    user.ID,
			Author:    user.Nickname,
			Content:   fmt.Sprintf("Test comment %d", i+1),
			Timestamp: time.Now(),
		}

		_, err := commentController.InsertComment(comment)
		if err != nil {
			t.Fatalf("Failed to insert test comment %d: %v", i+1, err)
		}
	}

	// Get comment count
	count, err := commentController.GetCommentCountByPostID(postID)
	if err != nil {
		t.Fatalf("Failed to get comment count: %v", err)
	}

	if count != commentCount {
		t.Errorf("Expected comment count %d, got %d", commentCount, count)
	}

	// Test with non-existent post ID
	count, err = commentController.GetCommentCountByPostID(999)
	if err != nil {
		t.Fatalf("Failed to get comment count for non-existent post: %v", err)
	}

	if count != 0 {
		t.Errorf("Expected 0 comments for non-existent post, got %d", count)
	}
}

// TestDeleteComment tests the DeleteComment function
func TestDeleteComment(t *testing.T) {
	clearTables()

	// Register a test user
	user := registerTestUser(t)

	// Create a post
	postController := controllers.NewPostController(testDB)
	post := models.Post{
		UserID:    user.ID,
		Author:    user.Nickname,
		Title:     "Test Post for Comment Deletion",
		Content:   "This is a test post content for comment deletion",
		Timestamp: time.Now(),
	}

	postID, err := postController.InsertPost(post)
	if err != nil {
		t.Fatalf("Failed to create test post: %v", err)
	}

	commentController = controllers.NewCommentController(testDB)

	// Insert a comment
	comment := models.Comment{
		PostID:    postID,
		UserID:    user.ID,
		Author:    user.Nickname,
		Content:   "Comment to be deleted",
		Timestamp: time.Now(),
	}

	commentID, err := commentController.InsertComment(comment)
	if err != nil {
		t.Fatalf("Failed to insert test comment: %v", err)
	}

	// Delete the comment
	err = commentController.DeleteComment(commentID)
	if err != nil {
		t.Fatalf("Failed to delete comment: %v", err)
	}

	// Try to delete the same comment again (should fail)
	err = commentController.DeleteComment(commentID)
	if err == nil {
		t.Error("Should get error when deleting a non-existent comment")
	}

	// Try to delete with invalid comment ID
	err = commentController.DeleteComment(-1)
	if err == nil {
		t.Error("Should get error when deleting with invalid comment ID")
	}
}

// TestIsCommentAuthor tests the IsCommentAuthor function
func TestIsCommentAuthor(t *testing.T) {
	clearTables()

	// Register test users
	user1 := registerTestUser(t)

	// Register second user
	registerReq := &models.RegisterRequest{
		Nickname:  "testuser2",
		Age:       25,
		Gender:    "female",
		FirstName: "Test",
		LastName:  "User2",
		Email:     "test2@example.com",
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
		Title:     "Test Post for Comment Author",
		Content:   "This is a test post content for checking comment author",
		Timestamp: time.Now(),
	}

	postID, err := postController.InsertPost(post)
	if err != nil {
		t.Fatalf("Failed to create test post: %v", err)
	}

	commentController = controllers.NewCommentController(testDB)

	// Insert a comment from user1
	comment := models.Comment{
		PostID:    postID,
		UserID:    user1.ID,
		Author:    user1.Nickname,
		Content:   "Comment from user1",
		Timestamp: time.Now(),
	}

	commentID, err := commentController.InsertComment(comment)
	if err != nil {
		t.Fatalf("Failed to insert test comment: %v", err)
	}

	// Check if user1 is the author (should be true)
	isAuthor, err := commentController.IsCommentAuthor(commentID, user1.ID)
	if err != nil {
		t.Fatalf("Failed to check if user is comment author: %v", err)
	}

	if !isAuthor {
		t.Error("User1 should be recognized as the comment author")
	}

	// Check if user2 is the author (should be false)
	isAuthor, err = commentController.IsCommentAuthor(commentID, user2.ID)
	if err != nil {
		t.Fatalf("Failed to check if user is comment author: %v", err)
	}

	if isAuthor {
		t.Error("User2 should not be recognized as the comment author")
	}

	// Check with non-existent comment ID
	isAuthor, err = commentController.IsCommentAuthor(999, user1.ID)
	if err != nil {
		t.Fatalf("Failed to check author for non-existent comment: %v", err)
	}

	if isAuthor {
		t.Error("No user should be recognized as author of a non-existent comment")
	}
}

// TestUpdateComment tests the UpdateComment function
func TestUpdateComment(t *testing.T) {
	clearTables()

	// Register a test user
	user := registerTestUser(t)

	// Create a post
	postController := controllers.NewPostController(testDB)
	post := models.Post{
		UserID:    user.ID,
		Author:    user.Nickname,
		Title:     "Test Post for Comment Update",
		Content:   "This is a test post content for comment update",
		Timestamp: time.Now(),
	}

	postID, err := postController.InsertPost(post)
	if err != nil {
		t.Fatalf("Failed to create test post: %v", err)
	}

	commentController = controllers.NewCommentController(testDB)

	// Insert a comment
	originalContent := "Original comment content"
	comment := models.Comment{
		PostID:    postID,
		UserID:    user.ID,
		Author:    user.Nickname,
		Content:   originalContent,
		Timestamp: time.Now(),
	}

	commentID, err := commentController.InsertComment(comment)
	if err != nil {
		t.Fatalf("Failed to insert test comment: %v", err)
	}

	// Update the comment
	updatedContent := "Updated comment content"
	err = commentController.UpdateComment(commentID, updatedContent)
	if err != nil {
		t.Fatalf("Failed to update comment: %v", err)
	}

	// Verify the comment was updated by retrieving all comments and checking
	comments, err := commentController.GetCommentsByPostID(strconv.Itoa(postID))
	if err != nil {
		t.Fatalf("Failed to get comments: %v", err)
	}

	found := false
	for _, c := range comments {
		if c.ID == commentID {
			found = true
			if c.Content != updatedContent {
				t.Errorf("Comment content not updated, got: %s, want: %s", c.Content, updatedContent)
			}
		}
	}

	if !found {
		t.Error("Updated comment not found in retrieved comments")
	}

	// Try to update a non-existent comment
	err = commentController.UpdateComment(999, "Non-existent comment update")
	if err == nil {
		t.Error("Should get error when updating non-existent comment")
	}
}
