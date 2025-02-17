Security Handled so far
  CSRF - Implemented CSRF token validation
  XSS - Implementing  Sanitization of Input and CSP
  DOS - Implementing request rate limit and timeouts
duf udud ibd u ggdgd g
Performance Optimizations TODO:

1. Caching System
   - Implement in-memory caching for frequently accessed data
   - Cache post data, user sessions, and CSRF tokens
   - Use LRU (Least Recently Used) cache eviction policy
   - Consider Redis/Memcached for distributed caching

2. Pagination with Cursor-based Implementation
   - Replace offset-based pagination with cursor-based
   - More efficient for large datasets
   - Better performance with indexed queries
   - Implement infinite scroll on frontend

3. Search Optimization with Inverted Index
   - Build inverted index for post content
   - Implement TF-IDF scoring for search relevance
   - Enable fast full-text search capabilities
   - Consider Elasticsearch for larger scale

4. Database Connection Pool
   - Optimize connection pool settings
   - Configure max connections
   - Set appropriate timeouts
   - Implement connection monitoring

5. CDN Integration
   - Set up CDN for static assets
   - Configure asset caching
   - Optimize image delivery
   - Enable compression

6. Counter Sharding for Votes
   - Implement distributed counter system
   - Reduce contention on vote counts
   - Better concurrent vote handling
   - Periodic counter consolidation

7. Memory-Efficient Comment Trees
   - Implement efficient comment tree structure
   - Use object pooling for comments
   - Lazy loading of comment threads
   - Optimize comment pagination

8. Enhanced Rate Limiting
   - Implement token bucket algorithm
   - Configure per-endpoint limits
   - Add IP-based rate limiting
   - Set up graduated rate limiting

9. Background Job Processing
   - Implement job queue system
   - Handle heavy tasks asynchronously
   - Process notifications in background
   - Implement retry mechanisms

10. Database Query Optimization
    - Add necessary indexes
    - Optimize JOIN operations
    - Implement query caching
    - Monitor query performance

11. Content Compression
    - Enable GZIP compression
    - Optimize static assets
    - Minify CSS/JavaScript
    - Implement image optimization

12. Load Balancing
    - Set up load balancer
    - Configure health checks
    - Implement session affinity
    - Monitor server loads

13. Monitoring and Analytics
    - Implement performance monitoring
    - Track key metrics
    - Set up alerting system
    - Monitor error rates

14. API Response Optimization
    - Implement JSON streaming
    - Optimize payload size
    - Use appropriate HTTP methods
    - Enable partial responses

15. Memory Management
    - Implement garbage collection tuning
    - Monitor memory usage
    - Handle memory leaks
    - Optimize object allocation

Priority Order:
1. Database Connection Pool
2. Caching System
3. Pagination
4. Rate Limiting
5. CDN Integration

Caching: Reduces database load and improves response times
Pagination: Enables efficient handling of large datasets
Search: Provides fast and relevant search results
Connection Pool: Optimizes database connections
CDN: Improves content delivery speed
Counter Sharding: Handles concurrent voting efficiently
Comment Trees: Optimizes memory usage for nested comments
Rate Limiting: Prevents abuse and ensures fair resource usage
Background Jobs: Improves responsiveness for heavy operations

## Authentication
The reload of the page whenever a user loggs in with either Google or Github.
The buttons of the Google and Github sign in to also function the same way as the one in the login form.
Readme update. 


## File system
```
real-time-forum/
├── README.md
├── go.mod
├── go.sum
├── main.go                   # Entry point: initializes config, DB, routes & WebSocket hubs
├── .gitignore
├── Dockerfile                # Container definition for easy deployment
├── run.sh                    # Startup script (or integration with docker-compose if needed)
├── BackEnd/
│   ├── config/               # App configuration (env variables, database settings, etc.)
│   │   └── config.go
│   ├── controllers/          # HTTP handlers for REST endpoints (Auth, Posts, Comments, Messaging, Notifications)
│   │   ├── authController.go
│   │   ├── postController.go
│   │   ├── commentController.go
│   │   ├── messageController.go
│   │   └── notificationController.go
│   ├── middleware/           # Authentication, session, logging, and other cross‑cutting concerns
│   │   ├── authMiddleware.go
│   │   └── loggingMiddleware.go
│   ├── models/               # Database models and related methods
│   │   ├── user.go           # User model (registration, login, password hashing using bcrypt)
│   │   ├── post.go
│   │   ├── comment.go
│   │   ├── message.go         # Private messages with fields like sender, receiver, date, content
│   │   └── category.go
│   ├── database/             # SQLite integration and migrations
│   │   ├── sqlite.go         # DB connection & query helpers
│   │   └── migrations/
│   │       └── initial.sql   # Schema definitions (users, posts, comments, messages, etc.)
│   ├── routes/               # Route definitions mapping endpoints to controllers
│   │   └── routes.go
│   ├── services/             # Business logic layer for each domain
│   │   ├── authService.go
│   │   ├── postService.go
│   │   ├── commentService.go
│   │   ├── messageService.go
│   │   └── notificationService.go
│   ├── websockets/           # Real‑time communication for private messages & notifications using Gorilla WebSocket
│   │   └── ws.go
│   └── logger/               # Structured logging (errors, API requests, etc.)
│       └── logger.go
├── FrontEnd/
│   ├── index.html            # Single page; all content is dynamically rendered
│   ├── css/
│   │   └── styles.css        # Global styling (with responsive design for dynamic elements)
│   ├── js/
│   │   ├── app.js            # Main entry point; initializes routing, event listeners, WebSocket connections
│   │   ├── components/       # Reusable UI components for SPA views
│   │   │   ├── auth.js       # Handles registration, login, logout, session management
│   │   │   ├── posts.js      # Manages post creation, feed display, filtering by category/user
│   │   │   ├── comments.js   # Loads and displays comments on demand (with dynamic fetching)
│   │   │   ├── messages.js   # Private messaging UI with lazy loading (throttled scroll event)
│   │   │   └── notifications.js  # Real‑time notifications (new messages, post interactions)
│   │   ├── services/         # Modules that abstract API calls and WebSocket communication
│   │   │   ├── api.js        # AJAX calls to the Golang backend (registration, posts, etc.)
│   │   │   └── wsClient.js   # Manages WebSocket connections (receiving messages & notifications)
│   │   └── utils/            # Utility functions (e.g., debounce/throttle for lazy loading)
│   │       ├── debounce.js
│   │       └── helper.js
│   └── assets/               # Additional front‑end assets (images, icons, etc.)
│       └── images/
├── uploads/                  # For user-uploaded files (profile pictures, attachments)
│   └── user_uploads/
└── logs/                     # Log files for monitoring errors and API usage
    └── app.log
```

State Management ⚠️
The current state management is scattered across components. Consider implementing a centralized state management system:

Component Event Handling ⚠️
The onclick handler is inline. Better to use proper event delegation:

Authentication Flow ⚠️
The authentication check should be more centralized and consistent. Consider creating an AuthService:

Error Handling ⚠️
Add a global error boundary:
