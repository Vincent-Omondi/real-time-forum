package controllers

import (
	"database/sql"
	"fmt"
)

type CommentVotesController struct {
	DB *sql.DB
}

func NewCommentVotesController(db *sql.DB) *CommentVotesController {
	return &CommentVotesController{DB: db}
}

func (cc *CommentVotesController) UpdateCommentVotes(commentID int) error {
	tx, err := cc.DB.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Check if comment exists
	var commentExists bool
	err = tx.QueryRow(`SELECT EXISTS(SELECT 1 FROM comments WHERE id = ?)`, commentID).Scan(&commentExists)
	if err != nil {
		return fmt.Errorf("failed to check if comment exists: %w", err)
	}
	if !commentExists {
		return fmt.Errorf("comment with ID %d does not exist", commentID)
	}

	// Get vote counts
	query := `
        SELECT 
            COALESCE(SUM(CASE WHEN vote_type = 'like' THEN 1 ELSE 0 END), 0) AS likes_count,
            COALESCE(SUM(CASE WHEN vote_type = 'dislike' THEN 1 ELSE 0 END), 0) AS dislikes_count
        FROM comment_votes
        WHERE comment_id = ?
    `

	var likesCount, dislikesCount int
	err = tx.QueryRow(query, commentID).Scan(&likesCount, &dislikesCount)
	if err != nil {
		return fmt.Errorf("failed to get vote counts: %w", err)
	}

	// Update comment
	_, err = tx.Exec(`
        UPDATE comments
        SET likes = ?, dislikes = ?
        WHERE id = ?
    `, likesCount, dislikesCount, commentID)
	if err != nil {
		return fmt.Errorf("failed to update comment votes: %w", err)
	}

	return tx.Commit()
}

func (cc *CommentVotesController) GetCommentVotes(commentID int) (int, int, error) {
	query := `SELECT likes, dislikes FROM comments WHERE id = ?`
	var likes, dislikes int
	err := cc.DB.QueryRow(query, commentID).Scan(&likes, &dislikes)
	if err != nil {
		return 0, 0, fmt.Errorf("failed to get comment votes: %w", err)
	}
	return likes, dislikes, nil
}

func (cc *CommentVotesController) HandleCommentVote(commentID, userID int, voteType string) error {
	// First check if comment exists
	var exists bool
	err := cc.DB.QueryRow("SELECT EXISTS(SELECT 1 FROM comments WHERE id = ?)", commentID).Scan(&exists)
	if err != nil {
		return fmt.Errorf("error checking comment existence: %w", err)
	}
	if !exists {
		return fmt.Errorf("comment with ID %d does not exist", commentID)
	}

	tx, err := cc.DB.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Check existing vote
	var existingVote string
	err = tx.QueryRow(`
        SELECT vote_type 
        FROM comment_votes 
        WHERE comment_id = ? AND user_id = ?
    `, commentID, userID).Scan(&existingVote)

	if err != nil && err != sql.ErrNoRows {
		return fmt.Errorf("failed to check existing vote: %w", err)
	}

	// Handle the vote based on existing vote
	if err == sql.ErrNoRows {
		// No existing vote, insert new vote
		_, err = tx.Exec(`
            INSERT INTO comment_votes (comment_id, user_id, vote_type)
            VALUES (?, ?, ?)
        `, commentID, userID, voteType)
	} else if existingVote == voteType {
		// Remove vote if clicking same button
		_, err = tx.Exec(`
            DELETE FROM comment_votes
            WHERE comment_id = ? AND user_id = ?
        `, commentID, userID)
	} else {
		// Update existing vote
		_, err = tx.Exec(`
            UPDATE comment_votes
            SET vote_type = ?
            WHERE comment_id = ? AND user_id = ?
        `, voteType, commentID, userID)
	}

	if err != nil {
		return fmt.Errorf("failed to update vote: %w", err)
	}

	// Update comment counts
	err = cc.updateCommentVotesInTx(tx, commentID)
	if err != nil {
		return fmt.Errorf("failed to update comment counts: %w", err)
	}

	if err = tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

func (cc *CommentVotesController) GetUserVotes(userID int) (map[string]string, error) {
	query := `
        SELECT comment_id, vote_type 
        FROM comment_votes 
        WHERE user_id = ?
    `
	rows, err := cc.DB.Query(query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch user votes: %w", err)
	}
	defer rows.Close()

	userVotes := make(map[string]string)
	for rows.Next() {
		var commentID int
		var voteType string
		if err := rows.Scan(&commentID, &voteType); err != nil {
			return nil, fmt.Errorf("failed to scan vote row: %w", err)
		}
		userVotes[fmt.Sprintf("%d", commentID)] = voteType
	}

	return userVotes, nil
}

func (cc *CommentVotesController) updateCommentVotesInTx(tx *sql.Tx, commentID int) error {
	// Get current vote counts
	var likes, dislikes int
	err := tx.QueryRow(`
        SELECT 
            COUNT(CASE WHEN vote_type = 'like' THEN 1 END) as likes,
            COUNT(CASE WHEN vote_type = 'dislike' THEN 1 END) as dislikes
        FROM comment_votes
        WHERE comment_id = ?
    `, commentID).Scan(&likes, &dislikes)

	if err != nil {
		return fmt.Errorf("failed to get vote counts: %w", err)
	}

	// Update the comment
	_, err = tx.Exec(`
        UPDATE comments
        SET likes = ?, dislikes = ?
        WHERE id = ?
    `, likes, dislikes, commentID)

	if err != nil {
		return fmt.Errorf("failed to update comment: %w", err)
	}

	return nil
}
