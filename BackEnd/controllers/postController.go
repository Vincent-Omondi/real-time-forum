package controllers

import (
	"database/sql"
	"errors"
	"fmt"

	"github.com/Vincent-Omondi/real-time-forum/BackEnd/logger"
	"github.com/Vincent-Omondi/real-time-forum/BackEnd/models"
)

type PostController struct {
	DB *sql.DB
}

func NewPostController(db *sql.DB) *PostController {
	return &PostController{DB: db}
}

func (pc *PostController) InsertPost(post models.Post) (int, error) {
	if post.Title == "" {
		return 0, errors.New("post title is required")
	}

	// Get user details for the post author
	var user models.User
	err := pc.DB.QueryRow(`
		SELECT nickname 
		FROM users 
		WHERE id = ?`, post.UserID).Scan(&user.Nickname)
	if err != nil {
		return 0, fmt.Errorf("failed to fetch user details: %w", err)
	}

	// Set author name using user's nickname
	post.Author = user.Nickname

	// Insert the post with the UserID
	result, err := pc.DB.Exec(`
		INSERT INTO posts (title, user_id, author, category, likes, dislikes, user_vote, content, timestamp, image_url)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
	`, post.Title, post.UserID, post.Author, post.Category, post.Likes, post.Dislikes, post.UserVote, post.Content, post.Timestamp, post.ImageUrl)
	if err != nil {
		return 0, fmt.Errorf("failed to insert post: %w", err)
	}

	// Get the ID of the newly inserted post
	postID, err := result.LastInsertId()
	if err != nil {
		return 0, fmt.Errorf("failed to get last insert ID: %w", err)
	}

	return int(postID), nil
}

func (pc *PostController) GetAllPosts() ([]models.Post, error) {
	rows, err := pc.DB.Query(`
		SELECT p.id, p.title, p.user_id, p.author, p.category, p.likes, p.dislikes, 
			   p.user_vote, p.content, p.timestamp, p.image_url,
			   u.nickname
		FROM posts p
		JOIN users u ON p.user_id = u.id
		ORDER BY p.timestamp DESC
	`)
	if err != nil {
		logger.Error("Database query failed in GetAllPosts: %v", err)
		return nil, fmt.Errorf("failed to fetch posts: %w", err)
	}
	defer rows.Close()

	var posts []models.Post
	for rows.Next() {
		var post models.Post
		var nickname string
		err := rows.Scan(
			&post.ID, &post.Title, &post.UserID, &post.Author,
			&post.Category, &post.Likes, &post.Dislikes,
			&post.UserVote, &post.Content, &post.Timestamp, &post.ImageUrl,
			&nickname,
		)
		if err != nil {
			logger.Error("Row scan failed in GetAllPosts: %v", err)
			return nil, fmt.Errorf("failed to scan post: %w", err)
		}
		// Update author with current nickname
		post.Author = nickname
		posts = append(posts, post)
	}

	return posts, nil
}

func (pc *PostController) GetPostByID(postID string) (models.Post, error) {
	var post models.Post
	logger.Info("Attempting to fetch post with ID: %s", postID)

	// Validate postID is a valid integer
	if postID == "" {
		return post, fmt.Errorf("post ID cannot be empty")
	}

	err := pc.DB.QueryRow(`
        SELECT p.id, p.title, p.user_id, p.author, p.category, p.likes, p.dislikes, 
               p.user_vote, p.content, p.timestamp, p.image_url,
               u.nickname
        FROM posts p
        JOIN users u ON p.user_id = u.id
        WHERE p.id = ?
    `, postID).Scan(
		&post.ID, &post.Title, &post.UserID, &post.Author,
		&post.Category, &post.Likes, &post.Dislikes,
		&post.UserVote, &post.Content, &post.Timestamp, &post.ImageUrl,
		&post.Author, // Update author with current nickname
	)

	if err != nil {
		if err == sql.ErrNoRows {
			logger.Error("No post found with ID %s", postID)
			return post, sql.ErrNoRows
		}
		logger.Error("Database error while fetching post %s: %v", postID, err)
		return post, fmt.Errorf("failed to fetch post: %w", err)
	}

	logger.Info("Successfully fetched post with ID %s: %+v", postID, post)
	return post, nil
}

func (pc *PostController) UpdatePost(post models.Post) error {
	// Get user details for the post author
	var user models.User
	err := pc.DB.QueryRow(`
		SELECT nickname 
		FROM users 
		WHERE id = ?`, post.UserID).Scan(&user.Nickname)
	if err != nil {
		return fmt.Errorf("failed to fetch user details: %w", err)
	}

	// Update author name using user's current nickname
	post.Author = user.Nickname

	// Prepare the SQL statement for updating the post
	query := `
	UPDATE posts
	SET title = ?, author = ?, category = ?, likes = ?, dislikes = ?, user_vote = ?, content = ?, image_url = ?, timestamp = ?
	WHERE id = ? AND user_id = ?;
	`

	// Execute the SQL statement with the post data
	result, err := pc.DB.Exec(query,
		post.Title,
		post.Author,
		post.Category,
		post.Likes,
		post.Dislikes,
		post.UserVote,
		post.Content,
		post.ImageUrl,
		post.Timestamp,
		post.ID,
		post.UserID,
	)
	if err != nil {
		return fmt.Errorf("failed to update post: %w", err)
	}

	// Check if any rows were affected
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to check rows affected: %w", err)
	}
	if rowsAffected == 0 {
		return fmt.Errorf("no post found with ID %d or unauthorized", post.ID)
	}

	return nil
}

// DeletePost deletes a post from the database by its ID, along with its comments and associated images
func (pc *PostController) DeletePost(postID, userID int) error {
	// Ensure the database connection is not nil
	if pc.DB == nil {
		return errors.New("database connection is nil")
	}

	// Begin a transaction to ensure atomicity
	tx, err := pc.DB.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback() // Rollback in case of error

	// Step 1: Delete all comments associated with the post
	_, err = tx.Exec(`
		DELETE FROM comments 
		WHERE post_id = ?;
	`, postID)
	if err != nil {
		return fmt.Errorf("failed to delete comments: %w", err)
	}

	// Step 2: Fetch image paths associated with the post before deleting the post
	var imagePaths []string
	rows, err := tx.Query(`
		SELECT image_url FROM posts 
		WHERE id = ? AND user_id = ?;
	`, postID, userID)
	if err != nil {
		return fmt.Errorf("failed to fetch image paths: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var imagePath sql.NullString // Use sql.NullString to handle NULL values
		if err := rows.Scan(&imagePath); err != nil {
			return fmt.Errorf("failed to scan image path: %w", err)
		}
		if imagePath.Valid && imagePath.String != "" { // Only append non-empty paths
			imagePaths = append(imagePaths, imagePath.String)
		}
	}

	// Step 3: Delete the post
	result, err := tx.Exec(`
		DELETE FROM posts 
		WHERE id = ? AND user_id = ?;
	`, postID, userID)
	if err != nil {
		return fmt.Errorf("failed to delete post: %w", err)
	}

	// Check if the post was actually deleted
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to check rows affected: %w", err)
	}
	if rowsAffected == 0 {
		return errors.New("no post found with the given ID or user ID")
	}

	// Step 4: Delete the image files from the upload folder
	err = RemoveImages(imagePaths)
	if err != nil {
		return fmt.Errorf("failed to delete image files: %w", err)
	}

	// Commit the transaction
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

func (pc *PostController) IsPostAuthor(postID, userID int) (bool, error) {
	var authorID int

	err := pc.DB.QueryRow(`
		SELECT user_id 
		FROM posts 
		WHERE id = ?
	`, postID).Scan(&authorID)
	if err != nil {
		if err == sql.ErrNoRows {
			return false, nil
		}

		return false, fmt.Errorf("failed to fetch post author: %w", err)
	}

	// Compare the post's author ID with the provided userID
	return authorID == userID, nil
}
