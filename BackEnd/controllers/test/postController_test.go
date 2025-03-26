// controllers/test/postController_test.go
package test

import (
	"database/sql"
	"strconv"
	"testing"
	"time"

	"github.com/Vincent-Omondi/real-time-forum/BackEnd/controllers"
	"github.com/Vincent-Omondi/real-time-forum/BackEnd/models"
)

// Global variable for postController
var postController *controllers.PostController

// TestInsertPost tests the InsertPost function
func TestInsertPost(t *testing.T) {
	clearTables()

	// Register a test user
	user := registerTestUser(t)

	// Initialize post controller
	postController = controllers.NewPostController(testDB)

	// Create a test post
	post := models.Post{
		UserID:    user.ID,
		Title:     "Test Post Title",
		Content:   "This is the content of the test post",
		Category:  "General",
		Timestamp: time.Now(),
	}

	// Test inserting the post
	postID, err := postController.InsertPost(post)
	if err != nil {
		t.Fatalf("Failed to insert post: %v", err)
	}

	// Verify post was inserted
	if postID <= 0 {
		t.Errorf("Expected post ID to be > 0, got %d", postID)
	}

	// Test inserting a post with an empty title (should fail)
	invalidPost := models.Post{
		UserID:    user.ID,
		Title:     "", // Empty title should cause an error
		Content:   "Content for invalid post",
		Category:  "Test",
		Timestamp: time.Now(),
	}

	_, err = postController.InsertPost(invalidPost)
	if err == nil {
		t.Error("Expected error when inserting post with empty title, but got nil")
	}

	// Test inserting a post with an invalid user ID (should fail)
	invalidUserPost := models.Post{
		UserID:    9999, // Non-existent user ID
		Title:     "Post with Invalid User",
		Content:   "This post should fail due to invalid user ID",
		Category:  "Test",
		Timestamp: time.Now(),
	}

	_, err = postController.InsertPost(invalidUserPost)
	if err == nil {
		t.Error("Expected error when inserting post with invalid user ID, but got nil")
	}
}

// TestGetAllPosts tests the GetAllPosts function
func TestGetAllPosts(t *testing.T) {
	clearTables()

	// Register a test user
	user := registerTestUser(t)

	// Initialize post controller
	postController = controllers.NewPostController(testDB)

	// Create multiple test posts
	numPosts := 5
	postIDs := make([]int, numPosts)

	for i := 0; i < numPosts; i++ {
		post := models.Post{
			UserID:    user.ID,
			Title:     "Test Post " + strconv.Itoa(i+1),
			Content:   "Content for test post " + strconv.Itoa(i+1),
			Category:  "General",
			Timestamp: time.Now().Add(-time.Hour * time.Duration(i)), // Oldest post first
		}

		postID, err := postController.InsertPost(post)
		if err != nil {
			t.Fatalf("Failed to insert test post %d: %v", i+1, err)
		}

		postIDs[i] = postID
	}

	// Get all posts
	posts, err := postController.GetAllPosts()
	if err != nil {
		t.Fatalf("Failed to get all posts: %v", err)
	}

	// Verify number of posts
	if len(posts) < numPosts {
		t.Errorf("Expected at least %d posts, got %d", numPosts, len(posts))
	}

	// Verify posts are sorted by timestamp (newest first)
	if len(posts) >= 2 {
		if posts[0].Timestamp.Before(posts[1].Timestamp) {
			t.Errorf("Posts not sorted correctly: expected newest first")
		}
	}

	// Verify each post has correct author
	for _, post := range posts {
		if post.UserID == user.ID && post.Author != user.Nickname {
			t.Errorf("Post author mismatch: expected %s, got %s", user.Nickname, post.Author)
		}
	}
}

// TestGetPostByID tests the GetPostByID function
func TestGetPostByID(t *testing.T) {
	clearTables()

	// Register a test user
	user := registerTestUser(t)

	// Initialize post controller
	postController = controllers.NewPostController(testDB)

	// Create a test post
	post := models.Post{
		UserID:    user.ID,
		Title:     "Test Post for GetPostByID",
		Content:   "This is the content of the test post for GetPostByID",
		Category:  "General",
		Timestamp: time.Now(),
	}

	postID, err := postController.InsertPost(post)
	if err != nil {
		t.Fatalf("Failed to insert test post: %v", err)
	}

	// Get the post by ID
	retrievedPost, err := postController.GetPostByID(strconv.Itoa(postID))
	if err != nil {
		t.Fatalf("Failed to get post by ID: %v", err)
	}

	// Verify post details
	if retrievedPost.ID != postID {
		t.Errorf("Post ID mismatch: expected %d, got %d", postID, retrievedPost.ID)
	}
	if retrievedPost.Title != post.Title {
		t.Errorf("Post title mismatch: expected %s, got %s", post.Title, retrievedPost.Title)
	}
	if retrievedPost.Content != post.Content {
		t.Errorf("Post content mismatch: expected %s, got %s", post.Content, retrievedPost.Content)
	}
	if retrievedPost.Author != user.Nickname {
		t.Errorf("Post author mismatch: expected %s, got %s", user.Nickname, retrievedPost.Author)
	}

	// Test getting non-existent post
	_, err = postController.GetPostByID("99999")
	if err != sql.ErrNoRows {
		t.Errorf("Expected sql.ErrNoRows when getting non-existent post, got %v", err)
	}

	// Test with empty ID
	_, err = postController.GetPostByID("")
	if err == nil {
		t.Error("Expected error when getting post with empty ID, but got nil")
	}
}

// TestUpdatePost tests the UpdatePost function
func TestUpdatePost(t *testing.T) {
	clearTables()

	// Register a test user
	user := registerTestUser(t)

	// Initialize post controller
	postController = controllers.NewPostController(testDB)

	// Create a test post
	post := models.Post{
		UserID:    user.ID,
		Title:     "Original Post Title",
		Content:   "Original content",
		Category:  "General",
		Timestamp: time.Now(),
	}

	postID, err := postController.InsertPost(post)
	if err != nil {
		t.Fatalf("Failed to insert test post: %v", err)
	}

	// Update the post
	updatedPost := models.Post{
		ID:        postID,
		UserID:    user.ID,
		Title:     "Updated Post Title",
		Content:   "Updated content",
		Category:  "Updated Category",
		Timestamp: time.Now(),
	}

	err = postController.UpdatePost(updatedPost)
	if err != nil {
		t.Fatalf("Failed to update post: %v", err)
	}

	// Verify the post was updated
	retrievedPost, err := postController.GetPostByID(strconv.Itoa(postID))
	if err != nil {
		t.Fatalf("Failed to get updated post: %v", err)
	}

	if retrievedPost.Title != updatedPost.Title {
		t.Errorf("Post title not updated: expected %s, got %s", updatedPost.Title, retrievedPost.Title)
	}
	if retrievedPost.Content != updatedPost.Content {
		t.Errorf("Post content not updated: expected %s, got %s", updatedPost.Content, retrievedPost.Content)
	}
	if retrievedPost.Category != updatedPost.Category {
		t.Errorf("Post category not updated: expected %s, got %s", updatedPost.Category, retrievedPost.Category)
	}

	// Test updating post with a non-existent post ID
	nonExistentPost := models.Post{
		ID:        9999, // Non-existent post ID
		UserID:    user.ID,
		Title:     "Non-existent Post",
		Content:   "This update should fail",
		Category:  "Test",
		Timestamp: time.Now(),
	}

	err = postController.UpdatePost(nonExistentPost)
	if err == nil {
		t.Error("Expected error when updating non-existent post, but got nil")
	}

	// Test updating post with a different user ID (should fail)
	unauthorizedPost := models.Post{
		ID:        postID,
		UserID:    9999, // Different user ID than the post owner
		Title:     "Unauthorized Update",
		Content:   "This update should fail due to different user ID",
		Category:  "Test",
		Timestamp: time.Now(),
	}

	err = postController.UpdatePost(unauthorizedPost)
	if err == nil {
		t.Error("Expected error when unauthorized user updates post, but got nil")
	}
}

// TestDeletePost tests the DeletePost function
func TestDeletePost(t *testing.T) {
	clearTables()

	// Register a test user
	user := registerTestUser(t)

	// Initialize post controller
	postController = controllers.NewPostController(testDB)

	// Create a test post
	post := models.Post{
		UserID:    user.ID,
		Title:     "Post to Delete",
		Content:   "This post will be deleted",
		Category:  "General",
		Timestamp: time.Now(),
	}

	postID, err := postController.InsertPost(post)
	if err != nil {
		t.Fatalf("Failed to insert test post: %v", err)
	}

	// Add a comment to the post to test cascade deletion
	commentController := controllers.NewCommentController(testDB)
	comment := models.Comment{
		PostID:    postID,
		UserID:    user.ID,
		Author:    user.Nickname,
		Content:   "Test comment on post to be deleted",
		Timestamp: time.Now(),
	}

	_, err = commentController.InsertComment(comment)
	if err != nil {
		t.Fatalf("Failed to insert test comment: %v", err)
	}

	// Delete the post
	err = postController.DeletePost(postID, user.ID)
	if err != nil {
		t.Fatalf("Failed to delete post: %v", err)
	}

	// Verify the post was deleted
	_, err = postController.GetPostByID(strconv.Itoa(postID))
	if err != sql.ErrNoRows {
		t.Errorf("Expected sql.ErrNoRows after deleting post, got %v", err)
	}

	// Test comments were also deleted
	comments, err := commentController.GetCommentsByPostID(strconv.Itoa(postID))
	if err != nil {
		t.Fatalf("Failed to get comments: %v", err)
	}
	if len(comments) > 0 {
		t.Errorf("Expected 0 comments after post deletion, got %d", len(comments))
	}

	// Test deleting a post with a non-existent post ID
	err = postController.DeletePost(9999, user.ID)
	if err == nil {
		t.Error("Expected error when deleting non-existent post, but got nil")
	}

	// Test deleting a post with a different user ID (should fail)
	// Create another post first
	anotherPost := models.Post{
		UserID:    user.ID,
		Title:     "Another Post to Test Unauthorized Deletion",
		Content:   "This post should not be deleted by unauthorized user",
		Category:  "General",
		Timestamp: time.Now(),
	}

	anotherPostID, err := postController.InsertPost(anotherPost)
	if err != nil {
		t.Fatalf("Failed to insert another test post: %v", err)
	}

	// Try to delete with a different user ID
	err = postController.DeletePost(anotherPostID, 9999)
	if err == nil {
		t.Error("Expected error when unauthorized user deletes post, but got nil")
	}

	// Verify the post was not deleted
	_, err = postController.GetPostByID(strconv.Itoa(anotherPostID))
	if err != nil {
		t.Errorf("Post was deleted when it shouldn't have been: %v", err)
	}
}

// TestIsPostAuthor tests the IsPostAuthor function
func TestIsPostAuthor(t *testing.T) {
	clearTables()

	// Register test users
	user1 := registerTestUser(t)
	user2 := registerTestUser(t)

	// Initialize post controller
	postController = controllers.NewPostController(testDB)

	// Create a test post for user1
	post := models.Post{
		UserID:    user1.ID,
		Title:     "Test Post for Author Check",
		Content:   "This post is used to test author verification",
		Category:  "General",
		Timestamp: time.Now(),
	}

	postID, err := postController.InsertPost(post)
	if err != nil {
		t.Fatalf("Failed to insert test post: %v", err)
	}

	// Test with the actual author
	isAuthor, err := postController.IsPostAuthor(postID, user1.ID)
	if err != nil {
		t.Fatalf("Error checking if user is post author: %v", err)
	}
	if !isAuthor {
		t.Errorf("Expected user1 to be the post author, but got false")
	}

	// Test with a different user
	isAuthor, err = postController.IsPostAuthor(postID, user2.ID)
	if err != nil {
		t.Fatalf("Error checking if user is post author: %v", err)
	}
	if isAuthor {
		t.Errorf("Expected user2 not to be the post author, but got true")
	}

	// Test with non-existent post ID
	isAuthor, err = postController.IsPostAuthor(9999, user1.ID)
	if err != nil {
		t.Fatalf("Error checking if user is author of non-existent post: %v", err)
	}
	if isAuthor {
		t.Errorf("Expected false for non-existent post, but got true")
	}
}
