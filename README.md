# Real-Time Forum

![Forum Logo](FrontEnd/assets/icons/favicon.ico)

## Overview

**Real-Time Forum** is a dynamic and interactive online discussion platform built using **Go**, **JavaScript**, **SQLite**, and **WebSockets**. The project is designed to provide users with a seamless experience for **creating posts, commenting, and engaging in private messaging**—all in real time. 

This is an improved version of a previous forum project, with new features such as **WebSocket-powered messaging**, a **single-page application (SPA) architecture**, and an improved **authentication system**.

## Features

### Core Functionality
- **User Authentication**
  - Registration with **nickname, age, gender, name, email, and password**.
  - Login using **nickname/email and password**.
  - Secure **session handling** and **logout** functionality.

- **Forum Posts & Comments**
  - Users can **create posts** with categories.
  - Users can **comment on posts**.
  - Posts are displayed in a **feed format**.
  - Comments are visible only when a user opens a post.

- **Private Messaging**
  - Real-time private chat using **WebSockets**.
  - Displays **online/offline users**.
  - Messages are sorted by **recent activity** (like Discord).
  - **Chat history with pagination** (load older messages on scroll).
  - Messages include **timestamps and sender details**.

### Tech Stack
- **Backend**: Go (Golang) 🦫
  - WebSocket-based **real-time messaging**.
  - Secure **session handling** and **authentication**.
  - Database management using **SQLite**.
  
- **Frontend**: JavaScript 🎨
  - **Single-page application (SPA)** using pure JS.
  - Handles **WebSockets** for live interactions.
  - UI components for **posts, messages, and profile management**.

- **Database**: SQLite 🗄️
  - Stores **users, posts, comments, and messages**.
  - Securely stores **passwords using bcrypt**.

## Project Structure

```plaintext
real-time-forum/
│── BackEnd/
│   ├── auth/                # Authentication & session management
│   ├── controllers/         # Handles business logic (posts, messages, comments)
│   ├── database/            # SQLite database & queries
│   ├── handlers/            # API request handlers
│   ├── middleware/          # Middleware (auth, rate limit, CSRF, CORS)
│   ├── models/              # Database models
│   ├── routes/              # API endpoints
│   ├── websockets/          # WebSocket logic for real-time messaging
│── FrontEnd/
│   ├── assets/              # Static images, icons, etc.
│   ├── js/                  # Frontend JavaScript
│   ├── styles/              # CSS styles
│   ├── index.html           # Single HTML file (SPA architecture)
│── main.go                  # Entry point for the backend
│── README.md                # Project documentation
│── go.mod, go.sum           # Go module dependencies
```

## Installation & Setup

### Prerequisites
- **Go** (>=1.18) 🦫
- **SQLite** 📦
- **Node.js** (optional, for frontend development)

### Backend Setup
```sh
# Clone the repository
git clone https://learn.zone01kisumu.ke/git/vinomondi/real-time-forum
cd real-time-forum

# Install dependencies
go mod tidy

# Run the server
go run main.go
```

### Frontend Setup
The forum runs as a **Single Page Application (SPA)** with a single `index.html` file. Just open the file in a browser.

## Usage

### Running the Forum
1. Start the **Go server** (`go run main.go`).
2. Open `http://localhost:8080/` in a browser.
3. Register an account and start **posting, commenting, and messaging**.

## API Endpoints

| Method | Endpoint              | Description                         |
|--------|-----------------------|-------------------------------------|
| POST   | `/register`           | Register a new user                |
| POST   | `/login`              | Authenticate user                   |
| POST   | `/logout`             | Logout user                         |
| GET    | `/posts`              | Retrieve all posts                  |
| POST   | `/posts`              | Create a new post                   |
| GET    | `/posts/:id/comments` | Get comments for a post             |
| POST   | `/messages`           | Send a private message              |
| GET    | `/messages/:id`       | Get chat history with a user        |

## WebSockets Implementation

- **Backend WebSocket handling**: `BackEnd/websockets/messageHandler.go`
- **Frontend WebSocket management**: `FrontEnd/js/store/websocketManager.js`
- Real-time updates for **messages, posts, and user activity**.

## Security Features

 **User Authentication** (bcrypt, sessions)  
 **CSRF Protection** (`CSRFMiddleware.go`)  
 **Rate Limiting** (`rateLimit.go`)  
 **CORS Middleware** (`CORSMiddleware.go`) **Error Handling** (`errorPageMiddleware.go`)  

## Contributing

1. **Fork** the repo.
2. Create a **feature branch**:  
   ```sh
   git checkout -b feature-new
   ```
3. Commit changes:  
   ```sh
   git commit -m "Added new feature"
   ```
4. **Push** to GitHub and **open a pull request**.

## Authors

👤 **Vincent Odhiambo** ([vinomondi](https://github.com/Vincent-Omondi))  
👤 **Stella Oiro** ([steoiro](https://github.com/stella-Achar-Oiro))

## License

This project is licensed under the **MIT License**.

## Issues & Feedback

Found a bug? Have a feature request?  
Open an **issue**: [GitHub Issues](https://github.com/Vincent-Omondi/real-time-forum/issues)  
