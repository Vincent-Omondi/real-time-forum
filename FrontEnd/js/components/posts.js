import userStore from '../store/userStore.js';
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
    if (!container) {
        console.error('Posts container not found');
        return;
    }

    try {
        const response = await postsAPI.list();
        if (response.status === 'success' && response.data.posts) {
            // Create HTML for each post
            const postsHTML = response.data.posts.map(post => createPostHTML(post)).join('');
            container.innerHTML = postsHTML;
            attachPostEventListeners();
        } else {
            container.innerHTML = '<p class="no-posts-message">No posts available</p>';
        }
    } catch (error) {
        console.error('Error loading posts:', error);
        container.innerHTML = '<p class="error-message">Error loading posts</p>';
    }
}

function createPostHTML(post) {
    // Get the current user from centralized state management.
    const user = userStore.getCurrentUser();
    const isAuthor = user && user.id === post.UserID;
    
    // Format timestamp for display
    const timestamp = new Date(post.Timestamp).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    return `
        <div class="post" data-category="${post.Category}" data-post-id="${post.ID}" data-post-user-id="${post.UserID}">
            <div class="post-header">
                <div class="post-info">
                    <div class="post-meta">
                        <div class="post-author-info">
                            <div class="author-initial">${post.Author ? post.Author.charAt(0).toUpperCase() : '?'}</div>
                            <span class="post-author">${post.Author || 'Anonymous'}</span>
                        </div>
                        <span class="timestamp">${timestamp}</span>
                        <ul class="post-tags horizontal">
                            ${post.Category ? post.Category.split(',').map(tag => `
                                <li class="tag">${tag.trim()}</li>
                            `).join('') : ''}
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
                        <a href="/viewPost?id=${post.ID}">${post.Title || 'Untitled'}</a>
                    </h3>
                </div>
            </div>
            <div class="post-content">
                ${post.Content ? 
                    (post.Content.length > 300 
                        ? `${post.Content.slice(0, 300)}...
                           <a href="/viewPost?id=${post.ID}" class="read-more">Read more</a>`
                        : post.Content)
                    : 'No content'
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
                        <button class="vote-button ${userVotes[post.ID] === 'dislike' ? 'active' : ''}" id="DisLike" data-post-id="${post.ID}">
                            <i class="fa-regular fa-thumbs-down"></i>
                        </button>
                        <div class="counter" id="dislikes-container-${post.ID}">${post.Dislikes || 0}</div>
                    </div>
                    <div class="comments-count">
                        <a href="/viewPost?id=${post.ID}#commentText">
                            <i class="fa-regular fa-comment"></i>
                            <span class="counter" id="comments-count-${post.ID}">${post.CommentCount || 0}</span>
                        </a>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function attachPostEventListeners() {
    // Toggle options menu visibility
    document.querySelectorAll('.options-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const menu = button.nextElementSibling;
            menu.classList.toggle('show');
        });
    });

    // Close any open options menu when clicking outside
    document.addEventListener('click', () => {
        document.querySelectorAll('.options-menu.show').forEach(menu => {
            menu.classList.remove('show');
        });
    });

    // Edit post action
    document.querySelectorAll('.edit-post-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            e.stopPropagation();
            const postId = e.target.closest('.edit-post-btn').dataset.postId;
            window.location.href = `/editPost?id=${postId}`;
        });
    });

    // Delete post action
    document.querySelectorAll('.delete-post-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            e.stopPropagation();
            const postId = e.target.closest('.delete-post-btn').dataset.postId;
            if (confirm('Are you sure you want to delete this post?')) {
                try {
                    const response = await fetch(`/deletePost?id=${postId}`, {
                        method: 'DELETE',
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    });
                    if (response.ok) {
                        await loadPosts();
                        showToast('Post deleted successfully');
                    } else {
                        const error = await response.json();
                        showToast(error.message || 'Failed to delete post');
                    }
                } catch (error) {
                    console.error('Error deleting post:', error);
                    showToast('An error occurred while deleting the post');
                }
            }
        });
    });

    // Vote button actions
    document.querySelectorAll('[id="Like"], [id="DisLike"]').forEach(button => {
        button.addEventListener('click', async (e) => {
            e.preventDefault();
            const user = userStore.getCurrentUser();
            if (!user) {
                showToast('Please log in to vote');
                return;
            }

            const postId = button.dataset.postId;
            const voteType = button.id.toLowerCase();
            
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
                    const error = await response.json();
                    showToast(error.message || 'Failed to vote');
                }
            } catch (error) {
                console.error('Error:', error);
                showToast('An error occurred while voting');
            }
        });
    });
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
