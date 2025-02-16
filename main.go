package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/Vincent-Omondi/real-time-forum/BackEnd/controllers"
	"github.com/Vincent-Omondi/real-time-forum/BackEnd/database"
	"github.com/Vincent-Omondi/real-time-forum/BackEnd/logger"
	"github.com/Vincent-Omondi/real-time-forum/BackEnd/routes"
)

func main() {
	// Initialize logger
	if err := logger.Init(); err != nil {
		log.Fatal(err)
	}

	logger.Info("Starting application...")

	db, err := database.Init("Development")
	if err != nil {
		fmt.Println("An error occurred while initializing Database")
		os.Exit(1)
	}
	log.Println("Database initialized successfully")

	// Create a context that cancels on interrupt signals (e.g., Ctrl+C)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Use a WaitGroup to wait for cleanup goroutines to finish
	var wg sync.WaitGroup

	// Start cleanup tasks in separate goroutines
	wg.Add(1)
	go func() {
		defer wg.Done()
		controllers.CleanupExpiredCSRFTokens(ctx, db)
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		controllers.CleanupExpiredSessions(ctx, db)
	}()

	// Determine the port to listen on
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080" // Default to port 8080 in development
	}

	// Update your server configuration
	server := &http.Server{
		Addr:              ":" + port,       // Listen on the determined port
		ReadTimeout:       15 * time.Second, // Max time to read the entire request
		WriteTimeout:      15 * time.Second, // Max time to write the response
		IdleTimeout:       60 * time.Second, // Max time to keep idle connections alive
		ReadHeaderTimeout: 5 * time.Second,  // Max time to read request headers
		MaxHeaderBytes:    1 << 20,          // Max size of request headers (1 MB)
	}

	// Register routes in the correct order
	// 1. First serve static files
	routes.ServeStaticFolder()

	// 2. Register API routes
	routes.APIRoutes(db)

	// 3. Register OAuth routes (these don't need /api prefix)
	routes.UserRegAndLogin(db)

	// Run the server in a goroutine
	go func() {
		log.Printf("Server running at http://localhost:%s\n", port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Printf("Server failed to start: %v\n", err)
		}
	}()

	// Wait for interrupt signal (e.g., Ctrl+C) to gracefully shut down the server
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop

	// Shutdown the server gracefully
	log.Println("Shutting down server...")
	if err := server.Shutdown(ctx); err != nil {
		log.Printf("Server shutdown error: %v\n", err)
	}

	// Cancel the context to signal cleanup tasks to stop
	cancel()

	// Wait for cleanup tasks to finish
	wg.Wait()

	log.Println("Application stopped gracefully")
}
