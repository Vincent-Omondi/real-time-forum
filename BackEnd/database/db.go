// database/db.go
package database

import (
	"database/sql"
	"os"
	"strings"

	"github.com/Vincent-Omondi/real-time-forum/BackEnd/logger"
	_ "github.com/mattn/go-sqlite3"
)

var GloabalDB *sql.DB

func ensureStorageDirectory() error {
	storageDir := "./BackEnd/database/storage"
	if err := os.MkdirAll(storageDir, 0o755); err != nil {
		logger.Error("Failed to create storage directory: %v", err)
		return err
	}
	return nil
}

func Init(env string) (*sql.DB, error) {
	var DB *sql.DB
	var err error

	// Ensure storage directory exists
	if err := ensureStorageDirectory(); err != nil {
		return nil, err
	}

	if env == "Test" {
		dbPath := "./BackEnd/database/storage/test_forum.db"
		DB, err = sql.Open("sqlite3", dbPath)
		if err != nil {
			logger.Error("Failed to open Test database connection: %v", err)
			return nil, err
		}
	} else {
		dbPath := "./BackEnd/database/storage/forum.db"
		DB, err = sql.Open("sqlite3", dbPath)
		if err != nil {
			logger.Error("Failed to open database connection: %v", err)
			return nil, err
		}
	}

	GloabalDB = DB
	addMissingColumns(DB)

	// Create Users table
	_, err = DB.Exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nickname TEXT UNIQUE NOT NULL,
            age INTEGER NOT NULL CHECK(age >= 13),
            gender TEXT NOT NULL CHECK(gender IN ('male', 'female', 'other')),
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            bio TEXT DEFAULT '',
            avatar_url TEXT DEFAULT '',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `)
	if err != nil {
		logger.Error("Failed to create users table: %v", err)
		return nil, err
	}

	// Create Messages table
	_, err = DB.Exec(`
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender_id INTEGER NOT NULL,
            receiver_id INTEGER NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            read_at TIMESTAMP,
            FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_messages_users ON messages(sender_id, receiver_id);
        CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(created_at);
    `)
	if err != nil {
		logger.Error("Failed to create messages table: %v", err)
		return nil, err
	}

	// Create User Status table
	_, err = DB.Exec(`
        CREATE TABLE IF NOT EXISTS user_status (
            user_id INTEGER PRIMARY KEY,
            is_online BOOLEAN DEFAULT false,
            last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
    `)
	if err != nil {
		logger.Error("Failed to create user_status table: %v", err)
		return nil, err
	}

	// Initialize user status for all users
	if err := initializeUserStatus(DB); err != nil {
		logger.Error("Failed to initialize user status: %v", err)
		return nil, err
	}

	// Create Posts table
	_, err = DB.Exec(`
        CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            author TEXT NOT NULL,
            user_id INTEGER NOT NULL,
            category TEXT NOT NULL,
            likes INTEGER DEFAULT 0,
            dislikes INTEGER DEFAULT 0,
            user_vote TEXT,
            content TEXT NOT NULL,
            image_url TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        );
    `)
	if err != nil {
		logger.Error("Failed to create posts table: %v", err)
		return nil, err
	}

	// Create Comments table
	_, err = DB.Exec(`
        CREATE TABLE IF NOT EXISTS comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            post_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            parent_id INTEGER DEFAULT NULL,
            author TEXT NOT NULL,
            content TEXT NOT NULL,
            likes INTEGER DEFAULT 0,
            dislikes INTEGER DEFAULT 0,
            user_vote TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
            FOREIGN KEY (parent_id) REFERENCES comments (id) ON DELETE CASCADE
        );
    `)
	if err != nil {
		logger.Error("Failed to create comments table: %v", err)
		return nil, err
	}

	// Create Sessions table
	_, err = DB.Exec(`
        CREATE TABLE IF NOT EXISTS sessions (
            session_token TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            expires_at DATETIME NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        );
    `)
	if err != nil {
		logger.Error("Failed to create sessions table: %v", err)
		return nil, err
	}

	// Create CSRF Tokens table
	_, err = DB.Exec(`
        CREATE TABLE IF NOT EXISTS csrf_tokens (
            session_token TEXT NOT NULL,
            csrf_token TEXT NOT NULL,
            expires_at DATETIME NOT NULL,
            PRIMARY KEY (session_token),
            FOREIGN KEY (session_token) REFERENCES sessions (session_token) ON DELETE CASCADE
        );
    `)
	if err != nil {
		logger.Error("Failed to create csrf_tokens table: %v", err)
		return nil, err
	}

	// Create Likes table
	_, err = DB.Exec(`
        CREATE TABLE IF NOT EXISTS likes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            post_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            user_vote TEXT CHECK(user_vote IN ('like', 'dislike')),
            FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        );
    `)
	if err != nil {
		logger.Error("Failed to create likes table: %v", err)
		return nil, err
	}

	// Create Comment Votes table
	_, err = DB.Exec(`
        CREATE TABLE IF NOT EXISTS comment_votes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            comment_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            vote_type TEXT CHECK(vote_type IN ('like', 'dislike')),
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (comment_id) REFERENCES comments (id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
            UNIQUE(comment_id, user_id)
        );
    `)
	if err != nil {
		logger.Error("Failed to create comment_votes table: %v", err)
		return nil, err
	}

	return DB, nil
}

// Function to Add Missing Columns for Existing Messages and User Status Tables
func addMissingColumns(DB *sql.DB) {
	// Columns to add for messages table
	messageColumns := map[string]string{
		"read_at":    "TIMESTAMP DEFAULT NULL",
		"created_at": "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
		"updated_at": "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
		"is_deleted": "BOOLEAN DEFAULT false",
		"reply_to":   "INTEGER DEFAULT NULL",
		"media_url":  "TEXT DEFAULT NULL",
	}

	// Columns to add for user_status table
	userStatusColumns := map[string]string{
		"last_activity":            "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
		"status_message":           "TEXT DEFAULT NULL",
		"device_info":              "TEXT DEFAULT NULL",
		"notification_preferences": "TEXT DEFAULT 'all'",
		"typing_status":            "BOOLEAN DEFAULT false",
	}

	// Add columns to messages table
	for column, definition := range messageColumns {
		_, err := DB.Exec("ALTER TABLE messages ADD COLUMN " + column + " " + definition)
		if err != nil && !strings.Contains(err.Error(), "duplicate column") {
			logger.Warning("Messages table - Column '%s' already exists or failed to add: %v", column, err)
		} else {
			logger.Info("Messages table - Added column '%s' successfully", column)
		}
	}

	// Add columns to user_status table
	for column, definition := range userStatusColumns {
		_, err := DB.Exec("ALTER TABLE user_status ADD COLUMN " + column + " " + definition)
		if err != nil && !strings.Contains(err.Error(), "duplicate column") {
			logger.Warning("User status table - Column '%s' already exists or failed to add: %v", column, err)
		} else {
			logger.Info("User status table - Added column '%s' successfully", column)
		}
	}

	// Create any necessary indices for new columns
	indices := []string{
		"CREATE INDEX IF NOT EXISTS idx_messages_read_at ON messages(read_at)",
		"CREATE INDEX IF NOT EXISTS idx_messages_reply_to ON messages(reply_to)",
		"CREATE INDEX IF NOT EXISTS idx_user_status_last_activity ON user_status(last_activity)",
	}

	for _, index := range indices {
		_, err := DB.Exec(index)
		if err != nil {
			logger.Warning("Failed to create index: %v", err)
		} else {
			logger.Info("Created index successfully: %s", index)
		}
	}
}

func initializeUserStatus(db *sql.DB) error {
	// Insert status records for all users that don't have one
	_, err := db.Exec(`
        INSERT INTO user_status (user_id, is_online, last_seen)
        SELECT id, false, CURRENT_TIMESTAMP
        FROM users
        WHERE id NOT IN (SELECT user_id FROM user_status)
    `)
	if err != nil {
		logger.Error("Failed to initialize user_status: %v", err)
		return err
	}
	return nil
}
