# Forum-Image-Upload Application

A full-featured forum platform built with Go and SQLite, featuring real-time interactions, secure authentication, and media handling capabilities.

## Features
- Post Creation and Management
- Comment System with Nested Replies
- Image Upload & Processing
- Real-time Vote System
- CSRF Protection
- Rate Limiting
- Content Security Policy (CSP)
- Responsive Design

## Security Features

- CSRF Token Validation
- XSS Protection through Input Sanitization and CSP
- DOS Protection with Rate Limiting
- Secure Session Management
- SQL Injection Prevention
- Secure Password Hashing
- OAuth 2.0 Secure Authentication Flow

## Prerequisites

- Go 1.21 or higher
- SQLite3
- Docker (optional)
- Google OAuth 2.0 Client Credentials
- GitHub OAuth Application Credentials

## Project Structure

```bash
├── BackEnd/
│ ├── controllers/ # Business logic
│ ├── database/ # Database operations
│ ├── handlers/ # HTTP request handlers
│ ├── middleware/ # HTTP middleware
│ ├── models/ # Data structures
│ └── routes/ # Route definitions
├── FrontEnd/
│ ├── static/ # Static assets (JS, CSS)
│ └── templates/ # HTML templates
└── uploads/ # User uploaded content
```

## Installation

```bash
git clone https://learn.zone01kisumu.ke/git/vinomondi/forum-image-upload.git
cd forum-image-upload
chmod +x run.sh
./run.sh
```


## Running the Application

```bash
go run main.go
```

## Testing the Application

```bash
go test ./... -v
```


