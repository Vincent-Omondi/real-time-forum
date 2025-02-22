import userStore from '../store/userStore.js';
import { initComments } from './comments.js';
import { postsAPI } from '../utils/api.js';
import { 
    initializeVoteStates, 
    handleVote, 
    getUserVotes,
    updateVoteCounts,
    toggleVoteButtonStates 
} from '../utils/voteUtils.js';

// Get vote states from the utility
const { userVotes, userCommentVotes } = getUserVotes();

export async function initPosts() {
    // Get container from the mainContent component
    const container = window.mainContent.getContainer();
    if (!container) {
        console.error('Posts container not found');
        return;
    }
    await initializeVoteStates();
    await loadPosts();
}

function debugCSRF(message, data) {
    console.log(`[CSRF Debug] ${message}`, data);
}

function getCsrfToken() {
    const token = localStorage.getItem('csrfToken') || 
                 document.querySelector('meta[name="csrf-token"]')?.content;
    debugCSRF('Retrieved CSRF token:', token);
    return token;
}

async function loadPosts() {
    // Get container from the mainContent component
    const container = window.mainContent.getContainer();
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
                        <a href="/viewPost?id=${post.ID}" data-link>${post.Title || 'Untitled'}</a>
                    </h3>
                </div>
            </div>
            <div class="post-content">
                ${post.Content ? 
                    (post.Content.length > 300 
                        ? `${post.Content.slice(0, 300)}...
                           <a href="/viewPost?id=${post.ID}" data-link class="read-more">Read more</a>`
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
                        <a href="/viewPost?id=${post.ID}#commentText" data-link>
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
            window.router.navigateTo(`/editPost?id=${postId}`);
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
            const postId = button.dataset.postId;
            const voteType = button.id.toLowerCase();
            await handleVote(postId, voteType, userStore, showToast);
        });
    });
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
