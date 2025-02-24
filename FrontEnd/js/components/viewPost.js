import userStore from '../store/userStore.js';
import { formatTimestamp } from '../utils/time.js';
import { 
    initializeVoteStates, 
    handleVote, 
    getUserVotes,
    updateVoteCounts,
    toggleVoteButtonStates 
} from '../utils/voteUtils.js';
import CommentManager from './comments.js';

// Get vote states from the utility
const { userVotes, userCommentVotes } = getUserVotes();

export default class ViewPost {
  constructor() {
    this.postId = null;
    this.post = null;
    this.comments = [];
    // Retrieve current user from centralized state
    this.user = userStore.getCurrentUser();
    this.commentManager = null;
  }

  async getHtml() {
    const urlParams = new URLSearchParams(window.location.search);
    this.postId = urlParams.get('id');

    if (!this.postId) {
      return '<div class="error">Post not found</div>';
    }

    try {
      const response = await fetch(`/api/posts/${this.postId}`);

      if (!response.ok) {
        const errorText = await response.text();

        if (response.status === 404) {
          return `
            <div class="error-container">
              <h2>Post Not Found</h2>
              <p>The post you're looking for doesn't exist or has been removed.</p>
              <button class="back-button" onclick="history.back()">
                <i class="fa-solid fa-arrow-left"></i> Go Back
              </button>
            </div>
          `;
        }
        throw new Error(`Failed to fetch post: ${response.status} ${errorText}`);
      }

      const data = await response.json();

      if (data.status !== 'success' || !data.data || !data.data.post) {
        throw new Error('Invalid response format');
      }

      this.post = data.data.post;
      this.comments = data.data.comments || [];
      this.user = {
        ...this.user,
        isAuthenticated: data.data.isAuthenticated,
        isAuthor: data.data.isAuthor
      };

      return this.renderPost();
    } catch (error) {
      return `
        <div class="error-container">
          <h2>Error Loading Post</h2>
          <p>Sorry, we couldn't load the post. Please try again later.</p>
          <button class="back-button" onclick="history.back()">
            <i class="fa-solid fa-arrow-left"></i> Go Back
          </button>
        </div>
      `;
    }
  }

  renderPost() {
    if (!this.post) return '<div class="error">Post not found</div>';

    const isAuthor = this.user && this.user.id === this.post.UserID;
    this.commentManager = new CommentManager(
        this.user, 
        this.postId, 
        this.comments,
        this.showToast.bind(this)
    );

    return `
      <div class="posts-container">
        <div class="back-button-container">
          <button onclick="history.back()" class="back-button">
            <i class="fa-solid fa-arrow-left"></i> Back
          </button>
        </div>
        <div class="post" data-category="${this.post.Category}" data-post-id="${this.post.ID}" data-post-user-id="${this.post.UserID}">
          <div class="post-header">
            <div class="post-info">
              <div class="post-meta">
                <div class="post-author-info">
                  <div class="author-initial">${this.post.Author.charAt(0)}</div>
                  <span class="post-author">${this.post.Author}</span>
                </div>
                <span class="timestamp" data-timestamp="${this.post.Timestamp}"></span>
                <ul class="post-tags horizontal">
                  ${this.post.Category.split(',').map(tag => `
                    <li class="tag">${tag.trim()}</li>
                  `).join('')}
                </ul>
                ${isAuthor ? `
                  <div class="post-options">
                    <button class="options-btn">
                      <i class="fa-solid fa-ellipsis"></i>
                    </button>
                    <div class="options-menu">
                      <button class="option-item edit-post-btn" data-post-id="${this.post.ID}">
                        <i class="fa-solid fa-edit"></i> Edit
                      </button>
                      <button class="option-item delete-post-btn" data-post-id="${this.post.ID}">
                        <i class="fa-solid fa-trash"></i> Delete
                      </button>
                    </div>
                  </div>
                ` : ''}
              </div>
              <h3 class="post-title">${this.post.Title}</h3>
            </div>
          </div>
          <div class="post-content">${this.post.Content}</div>
          ${this.post.ImageUrl && this.post.ImageUrl.Valid ? `
            <div class="post-image">
              <img src="${this.post.ImageUrl.String}" alt="Post image" loading="lazy">
            </div>
          ` : ''}
          <div class="post-footer">
            <div class="footer-icons">
              <div class="vote-buttons">
                <button class="vote-button ${userVotes[this.post.ID] === 'like' ? 'active' : ''}" id="Like" data-postId="${this.post.ID}">
                  <i class="fa-regular fa-thumbs-up"></i>
                </button>
                <div class="counter" id="likes-container-${this.post.ID}">${this.post.Likes || 0}</div>
                <button class="vote-button ${userVotes[this.post.ID] === 'dislike' ? 'dactive' : ''}" id="DisLike" data-postId="${this.post.ID}">
                  <i class="fa-regular fa-thumbs-down"></i>
                </button>
                <div class="counter" id="dislikes-container-${this.post.ID}">${this.post.Dislikes || 0}</div>
              </div>
              <div class="comments-count">
                <a href="#commentText">
                  <i class="fa-regular fa-comment"></i>
                  <span class="counter" id="comments-count-${this.post.ID}">${this.comments.length}</span>
                </a>
              </div>
            </div>

            <div class="comments-section">
              ${this.user ? `
                <div class="comment-input-container">
                  <div class="textarea-container">
                    <textarea class="main-comment-input" placeholder="Write a comment..." id="commentText"></textarea>
                    <button class="comment-button" data-post-id="${this.post.ID}">Comment</button>
                  </div>
                </div>
              ` : `
                <p class="login-prompt">Please <a href="/login" data-link>login</a> to comment</p>
              `}

              <div class="comments-container" data-max-depth="5">
                ${this.commentManager.renderComments(this.comments)}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div id="toast" class="toast">
        <div id="toastMessage" class="toast-message"></div>
      </div>
    `;
  }

  async afterRender() {
    // Update timestamps using the formatTimestamp utility.
    document.querySelectorAll('.timestamp').forEach(element => {
      const timestamp = element.dataset.timestamp;
      element.textContent = formatTimestamp(timestamp);
    });

    // Initialize vote states
    await initializeVoteStates();
    
    // Attach event listeners for post-related functionality
    this.attachPostEventListeners();
    
    // Attach comment-related event listeners
    if (this.commentManager) {
        this.commentManager.attachEventListeners();
    }
  }

  attachPostEventListeners() {
    // Post voting
    document.querySelectorAll('[id="Like"], [id="DisLike"]').forEach(button => {
      button.addEventListener('click', async (e) => {
        e.preventDefault();
        const postId = button.dataset.postid;
        const voteType = button.id.toLowerCase();
        await handleVote(postId, voteType, userStore, this.showToast.bind(this));
      });
    });

    // Post options menu toggle
    const postOptionsBtn = document.querySelector('.post-options .options-btn');
    if (postOptionsBtn) {
      postOptionsBtn.addEventListener('click', (e) => {
        const menu = e.target.closest('.post-options').querySelector('.options-menu');
        menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
        e.stopPropagation();
      });
    }

    // Edit post button
    const editPostBtn = document.querySelector('.edit-post-btn');
    if (editPostBtn) {
      editPostBtn.addEventListener('click', (e) => {
        const postId = e.target.dataset.postId;
        this.handleEditPost(postId);
      });
    }

    // Delete post button
    const deletePostBtn = document.querySelector('.delete-post-btn');
    if (deletePostBtn) {
      deletePostBtn.addEventListener('click', (e) => {
        const postId = e.target.dataset.postId;
        this.handleDeletePost(postId);
      });
    }

    // Close options menu when clicking outside
    document.addEventListener('click', () => {
      const menus = document.querySelectorAll('.post-options .options-menu');
      menus.forEach(menu => {
        menu.style.display = 'none';
      });
    });
  }

  async handleEditPost(postId) {
    try {
      // Navigate to edit post page
      window.location.href = `/edit-post?id=${postId}`;
    } catch (error) {
      this.showToast('Failed to navigate to edit page');
    }
  }

  async handleDeletePost(postId) {
    if (!confirm('Are you sure you want to delete this post?')) {
      return;
    }

    try {
      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
      const response = await fetch(`/api/posts/${postId}`, {
        method: 'DELETE',
        headers: {
          'X-CSRF-Token': csrfToken
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete post');
      }

      const result = await response.json();

      if (result.status === 'success') {
        this.showToast('Post deleted successfully');
        // Navigate back to the main page after successful deletion
        setTimeout(() => {
          window.location.href = '/';
        }, 1000);
      } else {
        throw new Error(result.error || 'Failed to delete post');
      }
    } catch (error) {
      this.showToast(error.message || 'Failed to delete post');
    }
  }

  showToast(message) {
    const toast = document.getElementById('toast');
    if (toast) {
      const toastMessage = document.getElementById('toastMessage');
      toastMessage.textContent = message;
      toast.classList.add('show');
      setTimeout(() => {
        toast.classList.remove('show');
      }, 3000);
    }
  }
}
