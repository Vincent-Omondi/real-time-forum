import { checkAuth } from './auth.js';
import { initComments } from './comments.js';
import { postsAPI } from '../utils/api.js';

// Vote management
let userVotes = {};
let userCommentVotes = {};

export async function initPosts() {
    const container = document.querySelector('.posts-container');
    await initializeVoteStates();
    await loadPosts();
}

async function loadPosts() {
    const container = document.querySelector('.posts-container');
    try {
        const response = await postsAPI.list();
        if (response.status === 'success' && response.data.posts) {
            container.innerHTML = response.data.posts.map(post => createPostHTML(post)).join('');
            
            // Add event listeners to post actions
            attachPostEventListeners();
        } else {
            container.innerHTML = '<p>No posts available</p>';
        }
    } catch (error) {
        console.error('Error loading posts:', error);
        container.innerHTML = '<p>Error loading posts</p>';
    }
}

function createPostHTML(post) {
    const user = checkAuth();
    const isAuthor = user && user.id === post.UserID;
    
    return `
        <div class="post" data-category="${post.Category}" data-post-id="${post.ID}" data-post-user-id="${post.UserID}">
            <div class="post-header">
                <div class="post-info">
                    <div class="post-meta">
                        <div class="post-author-info">
                            <div class="author-initial">${post.Author.charAt(0)}</div>
                            <span class="post-author">${post.Author}</span>
                        </div>
                        <span class="timestamp" data-timestamp="${post.Timestamp}"></span>
                        <ul class="post-tags horizontal">
                            ${post.Category.split(',').map(tag => `
                                <li class="tag">${tag.trim()}</li>
                            `).join('')}
                        </ul>
                        ${isAuthor ? `
                            <div class="post-options">
                                <button class="options-btn">
                                    <i class="fa-solid fa-ellipsis"></i>
                                </button>
                                <div class="options-menu">
                                    <button class="option-item edit-post-btn" data-post-id="${post.ID}">
                                        <i class="fa-solid fa-edit"></i> Edit
                                    </button>
                                    <button class="option-item delete-post-btn" data-post-id="${post.ID}">
                                        <i class="fa-solid fa-trash"></i> Delete
                                    </button>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                    <h3 class="post-title">
                        <a href="/viewPost?id=${post.ID}">${post.Title}</a>
                    </h3>
                </div>
            </div>
            <div class="post-content">
                ${post.Content.length > 300 
                    ? `${post.Content.slice(0, 300)}...
                       <a href="/viewPost?id=${post.ID}" class="read-more">Read more</a>`
                    : post.Content
                }
            </div>
            ${post.ImageUrl && post.ImageUrl.Valid ? `
                <div class="post-image">
                    <img src="${post.ImageUrl.String}" alt="Post image" loading="lazy">
                </div>
            ` : ''}
            <div class="post-footer">
                <div class="footer-icons">
                    <div class="vote-buttons">
                        <button class="vote-button ${userVotes[post.ID] === 'like' ? 'active' : ''}" id="Like" data-post-id="${post.ID}">
                            <i class="fa-regular fa-thumbs-up"></i>
                        </button>
                        <div class="counter" id="likes-container-${post.ID}">${post.Likes || 0}</div>
                        <button class="vote-button ${userVotes[post.ID] === 'dislike' ? 'dactive' : ''}" id="DisLike" data-post-id="${post.ID}">
                            <i class="fa-regular fa-thumbs-down"></i>
                        </button>
                        <div class="counter" id="dislikes-container-${post.ID}">${post.Dislikes || 0}</div>
                    </div>
                    <div class="comments-count">
                        <a href="/viewPost?id=${post.ID}#commentText">
                            <i class="fa-regular fa-comment"></i>
                            <span class="counter" id="comments-count-${post.ID}">${post.CommentCount}</span>
                        </a>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function attachPostEventListeners() {
    // View post details
    document.querySelectorAll('.view-post').forEach(button => {
        button.addEventListener('click', async (e) => {
            const postId = e.target.dataset.postId;
            await viewPost(postId);
        });
    });

    // Edit post
    document.querySelectorAll('.edit-post').forEach(button => {
        button.addEventListener('click', (e) => {
            const postId = e.target.dataset.postId;
            editPost(postId);
        });
    });

    // Delete post
    document.querySelectorAll('.delete-post').forEach(button => {
        button.addEventListener('click', async (e) => {
            const postId = e.target.dataset.postId;
            if (confirm('Are you sure you want to delete this post?')) {
                await deletePost(postId);
            }
        });
    });

    // New vote event listeners
    document.querySelectorAll('[id="Like"]').forEach(button => {
        button.addEventListener('click', handleVote('like'));
    });

    document.querySelectorAll('[id="DisLike"]').forEach(button => {
        button.addEventListener('click', handleVote('dislike'));
    });
}

async function viewPost(postId) {
    try {
        const response = await fetch(`/api/posts/${postId}`);
        if (response.ok) {
            const post = await response.json();
            const container = document.getElementById('app-container');
            
            container.innerHTML = `
                <div class="post-detail">
                    <h2>${post.title}</h2>
                    <p class="post-content">${post.content}</p>
                    <div class="post-meta">
                        <span>By ${post.author}</span>
                        <span>${new Date(post.created_at).toLocaleDateString()}</span>
                    </div>
                    <div class="comments-section">
                        <h3>Comments</h3>
                        <div class="comments-container"></div>
                    </div>
                </div>
            `;

            // Initialize comments for this post
            await initComments(postId);
        }
    } catch (error) {
        console.error('Error viewing post:', error);
        alert('Error loading post details');
    }
}

async function editPost(postId) {
    try {
        const response = await fetch(`/api/posts/${postId}`);
        if (response.ok) {
            const post = await response.json();
            const postElement = document.querySelector(`[data-post-id="${postId}"]`);
            
            postElement.innerHTML = `
                <form class="edit-post-form" data-post-id="${postId}">
                    <input type="text" name="title" value="${post.title}" required>
                    <textarea name="content" required>${post.content}</textarea>
                    <button type="submit">Save</button>
                    <button type="button" class="cancel-edit">Cancel</button>
                </form>
            `;

            const editForm = postElement.querySelector('.edit-post-form');
            const cancelButton = postElement.querySelector('.cancel-edit');

            editForm.addEventListener('submit', handleEditPost);
            cancelButton.addEventListener('click', () => loadPosts());
        }
    } catch (error) {
        console.error('Error editing post:', error);
        alert('Error loading post for editing');
    }
}

async function handleEditPost(e) {
    e.preventDefault();
    const form = e.target;
    const postId = form.dataset.postId;
    const formData = new FormData(form);

    try {
        const response = await fetch(`/api/posts/${postId}`, {
            method: 'PUT',
            body: formData
        });

        if (response.ok) {
            await loadPosts(); // Reload posts after edit
        } else {
            const error = await response.json();
            alert(error.message);
        }
    } catch (error) {
        console.error('Error updating post:', error);
        alert('An error occurred while updating the post');
    }
}

async function deletePost(postId) {
    try {
        const response = await fetch(`/api/posts/${postId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            await loadPosts(); // Reload posts after deletion
        } else {
            const error = await response.json();
            alert(error.message);
        }
    } catch (error) {
        console.error('Error deleting post:', error);
        alert('An error occurred while deleting the post');
    }
}

// Voting functionality
function handleVote(voteType) {
    return async function(event) {
        event.preventDefault();
        
        const user = checkAuth();
        if (!user) {
            showToast('Please log in to vote');
            return;
        }
        
        const button = event.currentTarget;
        const postId = button.getAttribute('data-post-id');
        
        try {
            const response = await fetch('/api/posts/vote', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    post_id: postId,
                    vote: voteType
                })
            });
        
            if (response.ok) {
                const data = await response.json();
                updateVoteCounts(postId, data.likes, data.dislikes);
                toggleVoteButtonStates(postId, voteType);
                userVotes[postId] = voteType;
            } else {
                showToast('Failed to vote');
            }
        } catch (error) {
            console.error('Error:', error);
            showToast('An error occurred while voting');
        }
    };
}

function updateVoteCounts(postId, likes, dislikes) {
    const likesContainer = document.getElementById(`likes-container-${postId}`);
    const dislikesContainer = document.getElementById(`dislikes-container-${postId}`);
    
    if (likesContainer) likesContainer.textContent = likes;
    if (dislikesContainer) dislikesContainer.textContent = dislikes;
}

function toggleVoteButtonStates(postId, activeVoteType) {
    const likeButton = document.querySelector(`[id="Like"][data-post-id="${postId}"]`);
    const dislikeButton = document.querySelector(`[id="DisLike"][data-post-id="${postId}"]`);

    if (likeButton && dislikeButton) {
        likeButton.classList.remove('active');
        dislikeButton.classList.remove('active');

        if (activeVoteType === 'like') {
            likeButton.classList.add('active');
        } else if (activeVoteType === 'dislike') {
            dislikeButton.classList.add('active');
        }
    }
}

async function initializeVoteStates() {
    try {
        const response = await fetch('/api/users/votes');
        if (response.ok) {
            const data = await response.json();
            userVotes = data.postVotes || {};
            userCommentVotes = data.commentVotes || {};
        }
    } catch (error) {
        console.error('Error initializing vote states:', error);
    }
}

function showToast(message) {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
} 