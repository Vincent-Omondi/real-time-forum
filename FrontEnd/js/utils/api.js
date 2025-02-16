// API endpoints configuration
const API_ENDPOINTS = {
    auth: {
        login: '/api/login',
        register: '/api/register',
        checkStatus: '/api/checkLoginStatus',
        logout: '/api/logout',
        googleLogin: '/auth/google/login',
        githubLogin: '/auth/github/login'
    },
    posts: {
        list: '/api/posts',
        create: '/api/posts/create',
        get: (id) => `/api/posts/${id}`,
        update: (id) => `/api/posts/${id}`,
        delete: (id) => `/api/posts/${id}`,
        vote: '/api/posts/vote'
    },
    comments: {
        list: (postId) => `/api/posts/${postId}/comments`,
        create: (postId) => `/api/posts/${postId}/comments`,
        update: (id) => `/api/comments/${id}`,
        delete: (id) => `/api/comments/${id}`,
        vote: '/api/comments/vote'
    },
    messages: {
        conversations: '/api/messages/conversations',
        list: (userId) => `/api/messages/${userId}`,
        send: (userId) => `/api/messages/${userId}`
    },
    users: {
        votes: '/api/users/votes',
        commentVotes: '/api/users/comment-votes',
        get: (id) => `/api/users/${id}`
    }
};

// Get CSRF token from meta tag
function getCSRFToken() {
    const tokenElement = document.querySelector('meta[name="csrf-token"]');
    return tokenElement ? tokenElement.content : '';
}

// API request helper with CSRF token and error handling
async function apiRequest(endpoint, options = {}) {
    try {
        const csrfToken = getCSRFToken();
        const response = await fetch(endpoint, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken,
                ...options.headers
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'API request failed');
        }

        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// Auth API
export const authAPI = {
    login: (formData) => apiRequest(API_ENDPOINTS.auth.login, {
        method: 'POST',
        body: formData
    }),
    
    register: (formData) => apiRequest(API_ENDPOINTS.auth.register, {
        method: 'POST',
        body: formData
    }),

    checkStatus: () => apiRequest(API_ENDPOINTS.auth.checkStatus),

    logout: () => apiRequest(API_ENDPOINTS.auth.logout, {
        method: 'POST'
    })
};

// Posts API
export const postsAPI = {
    list: () => apiRequest(API_ENDPOINTS.posts.list),
    
    create: (formData) => apiRequest(API_ENDPOINTS.posts.create, {
        method: 'POST',
        body: formData
    }),
    
    get: (id) => apiRequest(API_ENDPOINTS.posts.get(id)),
    
    update: (id, formData) => apiRequest(API_ENDPOINTS.posts.update(id), {
        method: 'PUT',
        body: formData
    }),
    
    delete: (id) => apiRequest(API_ENDPOINTS.posts.delete(id), {
        method: 'DELETE'
    }),
    
    vote: (postId, voteType) => apiRequest(API_ENDPOINTS.posts.vote, {
        method: 'POST',
        body: JSON.stringify({ post_id: postId, vote: voteType })
    })
};

// Comments API
export const commentsAPI = {
    list: (postId) => apiRequest(API_ENDPOINTS.comments.list(postId)),
    
    create: (postId, formData) => apiRequest(API_ENDPOINTS.comments.create(postId), {
        method: 'POST',
        body: formData
    }),
    
    update: (id, formData) => apiRequest(API_ENDPOINTS.comments.update(id), {
        method: 'PUT',
        body: formData
    }),
    
    delete: (id) => apiRequest(API_ENDPOINTS.comments.delete(id), {
        method: 'DELETE'
    }),

    vote: (commentId, voteType) => apiRequest(API_ENDPOINTS.comments.vote, {
        method: 'POST',
        body: JSON.stringify({ comment_id: commentId, vote: voteType })
    })
};

// Messages API
export const messagesAPI = {
    getConversations: () => apiRequest(API_ENDPOINTS.messages.conversations),
    
    list: (userId) => apiRequest(API_ENDPOINTS.messages.list(userId)),
    
    send: (userId, formData) => apiRequest(API_ENDPOINTS.messages.send(userId), {
        method: 'POST',
        body: formData
    })
};

// Users API
export const usersAPI = {
    getVotes: () => apiRequest(API_ENDPOINTS.users.votes),
    
    getCommentVotes: () => apiRequest(API_ENDPOINTS.users.commentVotes),
    
    get: (id) => apiRequest(API_ENDPOINTS.users.get(id))
}; 