// controllers/test/likesController_test.go
package test

import (
	"strconv"
	"testing"
	"time"

	"github.com/Vincent-Omondi/real-time-forum/BackEnd/controllers"
	"github.com/Vincent-Omondi/real-time-forum/BackEnd/models"
)

// Global variable for likesController
var likesController *controllers.LikesController

// TestInsertLikes tests the InsertLikes function
func TestInsertLikes(t *testing.T) {
	clearTables()

	// Register a test user
	user := registerTestUser(t)

	// Create a post controller and add a test post
	postController := controllers.NewPostController(testDB)
	post := models.Post{
		UserID:    user.ID,
		Author:    user.Nickname,
		Title:     "Test Post for Likes",
		Content:   "This is a test post for adding likes",
		Category:  "General",
		Timestamp: time.Now(),
	}

	postID, err := postController.InsertPost(post)
	if err != nil {
		t.Fatalf("Failed to create test post: %v", err)
	}

	// Initialize likes controller
	likesController = controllers.NewLikesController(testDB)

	// Create a like
	like := models.Likes{
		PostId:   postID,
		UserId:   user.ID,
		UserVote: "like",
	}

	// Test inserting a like
	err = likesController.InsertLikes(like)
	if err != nil {
		t.Fatalf("Failed to insert like: %v", err)
	}

	// Verify like was added
	userVote, err := likesController.CheckUserVote(postID, user.ID)
	if err != nil {
		t.Fatalf("Failed to check user vote: %v", err)
	}
	if userVote != "like" {
		t.Errorf("Expected user vote to be 'like', got '%s'", userVote)
	}

	// Test replacing a like with a dislike
	like.UserVote = "dislike"
	err = likesController.InsertLikes(like)
	if err != nil {
		t.Fatalf("Failed to replace like with dislike: %v", err)
	}

	// Verify like was replaced
	userVote, err = likesController.CheckUserVote(postID, user.ID)
	if err != nil {
		t.Fatalf("Failed to check user vote after replacement: %v", err)
	}
	if userVote != "dislike" {
		t.Errorf("Expected user vote to be 'dislike' after replacement, got '%s'", userVote)
	}
}

// TestUpdatePostVotes tests the UpdatePostVotes function
func TestUpdatePostVotes(t *testing.T) {
	clearTables()

	// Register two test users
	user1 := registerTestUser(t)
	user2 := registerTestUser(t)

	// Create a post controller and add a test post
	postController := controllers.NewPostController(testDB)
	post := models.Post{
		UserID:    user1.ID,
		Author:    user1.Nickname,
		Title:     "Test Post for Vote Updates",
		Content:   "This is a test post for updating votes",
		Category:  "General",
		Timestamp: time.Now(),
	}

	postID, err := postController.InsertPost(post)
	if err != nil {
		t.Fatalf("Failed to create test post: %v", err)
	}

	// Initialize likes controller
	likesController = controllers.NewLikesController(testDB)

	// Get initial votes (should be 0)
	likes, dislikes, err := likesController.GetPostVotes(postID)
	if err != nil {
		t.Fatalf("Failed to get post votes: %v", err)
	}
	if likes != 0 || dislikes != 0 {
		t.Errorf("Expected initial likes and dislikes to be 0, got likes=%d, dislikes=%d", likes, dislikes)
	}

	// Add a like from user1
	err = likesController.AddUserVote(postID, user1.ID, "like")
	if err != nil {
		t.Fatalf("Failed to add user1 like: %v", err)
	}

	// Add a dislike from user2
	err = likesController.AddUserVote(postID, user2.ID, "dislike")
	if err != nil {
		t.Fatalf("Failed to add user2 dislike: %v", err)
	}

	// Update post votes
	err = likesController.UpdatePostVotes(postID)
	if err != nil {
		t.Fatalf("Failed to update post votes: %v", err)
	}

	// Check post votes (should be 1 like, 1 dislike)
	likes, dislikes, err = likesController.GetPostVotes(postID)
	if err != nil {
		t.Fatalf("Failed to get post votes after update: %v", err)
	}
	if likes != 1 || dislikes != 1 {
		t.Errorf("Expected 1 like and 1 dislike after update, got likes=%d, dislikes=%d", likes, dislikes)
	}

	// User2 changes vote from dislike to like
	err = likesController.RemoveUserVote(postID, user2.ID)
	if err != nil {
		t.Fatalf("Failed to remove user2 dislike: %v", err)
	}
	err = likesController.AddUserVote(postID, user2.ID, "like")
	if err != nil {
		t.Fatalf("Failed to add user2 like: %v", err)
	}

	// Update post votes
	err = likesController.UpdatePostVotes(postID)
	if err != nil {
		t.Fatalf("Failed to update post votes after vote change: %v", err)
	}

	// Check post votes (should be 2 likes, 0 dislikes)
	likes, dislikes, err = likesController.GetPostVotes(postID)
	if err != nil {
		t.Fatalf("Failed to get post votes after vote change: %v", err)
	}
	if likes != 2 || dislikes != 0 {
		t.Errorf("Expected 2 likes and 0 dislikes after vote change, got likes=%d, dislikes=%d", likes, dislikes)
	}
}

// TestHandleVote tests the HandleVote function
func TestHandleVote(t *testing.T) {
	clearTables()

	// Register a test user
	user := registerTestUser(t)

	// Create a post controller and add a test post
	postController := controllers.NewPostController(testDB)
	post := models.Post{
		UserID:    user.ID,
		Author:    user.Nickname,
		Title:     "Test Post for Vote Handling",
		Content:   "This is a test post for handling votes",
		Category:  "General",
		Timestamp: time.Now(),
	}

	postID, err := postController.InsertPost(post)
	if err != nil {
		t.Fatalf("Failed to create test post: %v", err)
	}

	// Initialize likes controller
	likesController = controllers.NewLikesController(testDB)

	// Test cases
	testCases := []struct {
		name             string
		vote             string
		expectedVote     string
		expectedLikes    int
		expectedDislikes int
	}{
		{
			name:             "Add like vote",
			vote:             "like",
			expectedVote:     "like",
			expectedLikes:    1,
			expectedDislikes: 0,
		},
		{
			name:             "Remove like by voting like again",
			vote:             "like",
			expectedVote:     "",
			expectedLikes:    0,
			expectedDislikes: 0,
		},
		{
			name:             "Add dislike vote",
			vote:             "dislike",
			expectedVote:     "dislike",
			expectedLikes:    0,
			expectedDislikes: 1,
		},
		{
			name:             "Change from dislike to like",
			vote:             "like",
			expectedVote:     "like",
			expectedLikes:    1,
			expectedDislikes: 0,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Handle the vote
			err := likesController.HandleVote(postID, user.ID, tc.vote)
			if err != nil {
				t.Fatalf("Failed to handle vote: %v", err)
			}

			// Check user's vote
			userVote, err := likesController.CheckUserVote(postID, user.ID)
			if err != nil {
				t.Fatalf("Failed to check user vote: %v", err)
			}
			if userVote != tc.expectedVote {
				t.Errorf("Expected user vote to be '%s', got '%s'", tc.expectedVote, userVote)
			}

			// Check post vote counts
			likes, dislikes, err := likesController.GetPostVotes(postID)
			if err != nil {
				t.Fatalf("Failed to get post votes: %v", err)
			}
			if likes != tc.expectedLikes || dislikes != tc.expectedDislikes {
				t.Errorf("Expected %d likes and %d dislikes, got %d likes and %d dislikes",
					tc.expectedLikes, tc.expectedDislikes, likes, dislikes)
			}
		})
	}
}

// TestGetAllUserVotes tests the GetUserVotes function
func TestGetAllUserVotes(t *testing.T) {
	clearTables()

	// Register a test user
	user := registerTestUser(t)

	// Create a post controller
	postController := controllers.NewPostController(testDB)

	// Create multiple posts
	postIDs := make([]int, 3)
	for i := 0; i < 3; i++ {
		post := models.Post{
			UserID:    user.ID,
			Author:    user.Nickname,
			Title:     "Test Post " + strconv.Itoa(i+1),
			Content:   "This is test post " + strconv.Itoa(i+1),
			Category:  "General",
			Timestamp: time.Now(),
		}

		postID, err := postController.InsertPost(post)
		if err != nil {
			t.Fatalf("Failed to create test post %d: %v", i+1, err)
		}

		postIDs[i] = postID
	}

	// Initialize likes controller
	likesController = controllers.NewLikesController(testDB)

	// Initially, user has no votes
	userVotes, err := likesController.GetUserVotes(user.ID)
	if err != nil {
		t.Fatalf("Failed to get user votes: %v", err)
	}

	if len(userVotes) != 0 {
		t.Errorf("Expected 0 votes initially, got %d", len(userVotes))
	}

	// Add votes to posts
	voteTypes := []string{"like", "dislike", "like"}
	for i, postID := range postIDs {
		err = likesController.HandleVote(postID, user.ID, voteTypes[i])
		if err != nil {
			t.Fatalf("Failed to add vote for post %d: %v", i+1, err)
		}
	}

	// Get user votes after adding votes
	userVotes, err = likesController.GetUserVotes(user.ID)
	if err != nil {
		t.Fatalf("Failed to get user votes after adding votes: %v", err)
	}

	if len(userVotes) != 3 {
		t.Errorf("Expected 3 votes after adding votes, got %d", len(userVotes))
	}

	// Verify vote types for each post
	for i, postID := range postIDs {
		postIDStr := strconv.Itoa(postID)
		voteType, exists := userVotes[postIDStr]

		if !exists {
			t.Errorf("Expected vote for post ID %d to exist in user votes", postID)
			continue
		}

		if voteType != voteTypes[i] {
			t.Errorf("Expected vote type %s for post ID %d, got %s", voteTypes[i], postID, voteType)
		}
	}
}

// TestGetUserLikesPosts tests the GetUserLikesPosts function
func TestGetUserLikesPosts(t *testing.T) {
	clearTables()

	// Register a test user
	user := registerTestUser(t)

	// Create a post controller
	postController := controllers.NewPostController(testDB)

	// Create multiple posts
	postIDs := make([]int, 3)
	for i := 0; i < 3; i++ {
		post := models.Post{
			UserID:    user.ID,
			Author:    user.Nickname,
			Title:     "Test Post " + strconv.Itoa(i+1),
			Content:   "This is test post " + strconv.Itoa(i+1),
			Category:  "General",
			Timestamp: time.Now(),
		}

		postID, err := postController.InsertPost(post)
		if err != nil {
			t.Fatalf("Failed to create test post %d: %v", i+1, err)
		}

		postIDs[i] = postID
	}

	// Initialize likes controller
	likesController = controllers.NewLikesController(testDB)

	// Initially, user has no liked posts
	likedPosts, err := likesController.GetUserLikesPosts(user.ID)
	if err != nil {
		t.Fatalf("Failed to get user liked posts: %v", err)
	}

	if len(likedPosts) != 0 {
		t.Errorf("Expected 0 liked posts initially, got %d", len(likedPosts))
	}

	// Like only the first and third posts
	likeIndices := []int{0, 2}
	for _, i := range likeIndices {
		err = likesController.HandleVote(postIDs[i], user.ID, "like")
		if err != nil {
			t.Fatalf("Failed to like post %d: %v", i+1, err)
		}
	}

	// Dislike the second post
	err = likesController.HandleVote(postIDs[1], user.ID, "dislike")
	if err != nil {
		t.Fatalf("Failed to dislike post 2: %v", err)
	}

	// Get user liked posts
	likedPosts, err = likesController.GetUserLikesPosts(user.ID)
	if err != nil {
		t.Fatalf("Failed to get user liked posts after adding votes: %v", err)
	}

	// Should have 2 liked posts (first and third)
	if len(likedPosts) != 2 {
		t.Errorf("Expected 2 liked posts, got %d", len(likedPosts))
	}

	// Verify the liked post IDs match the expected ones
	likedPostIDs := make(map[int]bool)
	for _, post := range likedPosts {
		likedPostIDs[post.ID] = true
	}

	for _, i := range likeIndices {
		if !likedPostIDs[postIDs[i]] {
			t.Errorf("Expected post ID %d to be in liked posts, but it wasn't found", postIDs[i])
		}
	}

	// Ensure disliked post is not in liked posts
	if likedPostIDs[postIDs[1]] {
		t.Errorf("Disliked post ID %d should not be in liked posts", postIDs[1])
	}
}
