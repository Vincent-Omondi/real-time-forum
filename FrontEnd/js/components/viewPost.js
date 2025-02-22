import userStore from '../store/userStore.js';
import { formatTimestamp } from '../utils/time.js';
import { 
    initializeVoteStates, 
    handleVote, 
    getUserVotes,
    updateVoteCounts,
    toggleVoteButtonStates 
} from '../utils/voteUtils.js';

// Get vote states from the utility
const { userVotes, userCommentVotes } = getUserVotes();

export default class ViewPost {
  constructor() {
    this.postId = null;
    this.post = null;
    this.comments = [];
    // Retrieve current user from centralized state
    this.user = userStore.getCurrentUser();
  }

  async getHtml() {
    const urlParams = new URLSearchParams(window.location.search);
    this.postId = urlParams.get('id');

    if (!this.postId) {
      return '<div class="error">Post not found</div>';
    }

    try {
      console.log('Fetching post with ID:', this.postId);
      const response = await fetch(`/api/posts/${this.postId}`);
      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Response error:', errorText);

        if (response.status === 404) {
          return `
            <div class="error-container">
              <h2>Post Not Found</h2>
              <p>The post you're looking for doesn't exist or has been removed.</p>
              <button class="back-button" data-link onclick="window.router.navigateTo('/')">
                <i class="fa-solid fa-arrow-left"></i> Go Back
              </button>
            </div>
          `;
        }
        throw new Error(`Failed to fetch post: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      console.log('Response data:', data);

      if (data.status !== 'success' || !data.data || !data.data.post) {
        console.error('Invalid response format:', data);
        throw new Error('Invalid response format');
      }

      this.post = data.data.post;
      this.comments = data.data.comments || [];
      // Merge additional auth info if provided by the API
      this.user = {
        ...this.user,
        isAuthenticated: data.data.isAuthenticated,
        isAuthor: data.data.isAuthor
      };

      return this.renderPost();
    } catch (error) {
      console.error('Error loading post:', error);
      return `
        <div class="error-container">
          <h2>Error Loading Post</h2>
          <p>Sorry, we couldn't load the post. Please try again later.</p>
          <button class="back-button" data-link onclick="window.router.navigateTo('/')">
            <i class="fa-solid fa-arrow-left"></i> Go Back
          </button>
        </div>
      `;
    }
  }

  renderPost() {
    if (!this.post) return '<div class="error">Post not found</div>';

    const isAuthor = this.user && this.user.id === this.post.UserID;

    return `
      <div class="posts-container">
        <div class="back-button-container">
          <button data-link onclick="window.router.navigateTo('/')" class="back-button">
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
                ${this.renderComments(this.comments)}
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

  renderComments(comments, parentId = null, depth = 0) {
    // Filter comments based on parentId
    const filteredComments = comments.filter(comment => {
        if (parentId === null) {
            // For top-level comments, ParentID should be null/undefined or ParentID.Valid should be false
            return !comment.ParentID || !comment.ParentID.Valid;
        } else {
            // For replies, ParentID.Valid should be true and ParentID.Int64 should match parent
            return comment.ParentID && 
                   comment.ParentID.Valid && 
                   parseInt(comment.ParentID.Int64) === parseInt(parentId);
        }
    });

    if (filteredComments.length === 0) return '';

    return filteredComments.map(comment => {
        const isAuthor = this.user && this.user.id === comment.UserID;
        
        // Find replies for this comment
        const replies = comments.filter(reply => 
            reply.ParentID && 
            reply.ParentID.Valid && 
            parseInt(reply.ParentID.Int64) === parseInt(comment.ID)
        );

        return `
            <div class="comment depth-${depth}" data-comment-id="${comment.ID}">
                <div class="comment-header">
                    <div class="post-author-info">
                        <div class="author-initial">${comment.Author.charAt(0)}</div>
                        <span class="comment-author">${comment.Author}</span>
                    </div>
                    <div class="comment-meta">
                        <span class="timestamp" data-timestamp="${comment.Timestamp}"></span>
                        ${isAuthor ? `
                            <div class="comment-options">
                                <button class="options-btn">
                                    <i class="fa-solid fa-ellipsis"></i>
                                </button>
                                <div class="options-menu">
                                    <button class="option-item" id="edit-comment-${comment.ID}">
                                        <i class="fa-solid fa-edit"></i> Edit
                                    </button>
                                    <button class="option-item" id="delete-comment-${comment.ID}">
                                        <i class="fa-solid fa-trash"></i> Delete
                                    </button>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
                <div class="comment-content" id="comment-content-${comment.ID}">
                    ${comment.Content}
                </div>
                <div class="comment-footer">
                    <div class="vote-buttons">
                        <button class="vote-button comment-vote ${userCommentVotes[comment.ID] === 'like' ? 'active' : ''}" data-vote="up" data-comment-id="${comment.ID}">
                            <i class="fa-regular fa-thumbs-up"></i>
                        </button>
                        <div class="counter" id="comment-likes-${comment.ID}">${comment.Likes || 0}</div>
                        <button class="vote-button comment-vote ${userCommentVotes[comment.ID] === 'dislike' ? 'dactive' : ''}" data-vote="down" data-comment-id="${comment.ID}">
                            <i class="fa-regular fa-thumbs-down"></i>
                        </button>
                        <div class="counter" id="comment-dislikes-${comment.ID}">${comment.Dislikes || 0}</div>
                    </div>
                    ${this.user && depth < 5 ? `
                        <div class="comment-actions">
                            <button class="reply-button" data-comment-id="${comment.ID}">Reply</button>
                        </div>
                    ` : ''}
                </div>

                ${replies.length > 0 ? `
                    <div class="nested-comments">
                        ${this.renderComments(comments, comment.ID, depth + 1)}
                    </div>
                ` : ''}

                ${this.user && depth < 5 ? `
                    <div class="reply-input-container" id="reply-form-${comment.ID}" style="display: none;">
                        <textarea class="reply-input" id="replyText-${comment.ID}" placeholder="Write a reply..."></textarea>
                        <div class="reply-buttons">
                            <button class="button button-primary" data-comment-id="${comment.ID}" data-post-id="${this.post.ID}">Submit</button>
                            <button class="button button-secondary" data-comment-id="${comment.ID}">Cancel</button>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
  }

  async afterRender() {
    // Update timestamps using the formatTimestamp utility.
    document.querySelectorAll('.timestamp').forEach(element => {
      const timestamp = element.dataset.timestamp;
      element.textContent = formatTimestamp(timestamp);
    });

    // Initialize vote states
    await initializeVoteStates();
    this.attachEventListeners();
  }

  attachEventListeners() {
    if (this.user) {
      // Comment submission event
      const commentButton = document.querySelector('.comment-button');
      const commentTextarea = document.getElementById('commentText');
      
      if (commentButton && commentTextarea) {
        // Enable/disable button based on textarea content
        const updateButtonState = () => {
          const hasContent = !!commentTextarea.value.trim();
          commentButton.disabled = !hasContent;
          commentButton.classList.toggle('active', hasContent);
        };

        // Initial button state
        updateButtonState();

        // Update button state when textarea content changes
        commentTextarea.addEventListener('input', updateButtonState);

        // Handle button click
        commentButton.addEventListener('click', (e) => {
          e.preventDefault();
          if (commentTextarea.value.trim()) {
            const postId = commentButton.getAttribute('data-post-id');
            console.log('Submitting comment for post:', postId); // Debug log
            this.submitComment(postId);
          }
        });

        // Handle Enter key (Ctrl/Cmd + Enter to submit)
        commentTextarea.addEventListener('keydown', (e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && commentTextarea.value.trim()) {
            e.preventDefault();
            const postId = document.querySelector('.comment-button').getAttribute('data-post-id');
            this.submitComment(postId);
          }
        });
      }

      // Reply button events
      document.querySelectorAll('.reply-button').forEach(button => {
        button.addEventListener('click', (e) => {
          const commentId = e.target.dataset.commentId;
          this.showReplyForm(commentId);
        });
      });

      // Submit reply events
      document.querySelectorAll('.button.button-primary[data-comment-id]').forEach(button => {
        button.addEventListener('click', (e) => {
          const commentId = e.target.dataset.commentId;
          const postId = e.target.dataset.postId;
          this.submitReply(commentId, postId);
        });
      });

      // Cancel reply events
      document.querySelectorAll('.button.button-secondary[data-comment-id]').forEach(button => {
        button.addEventListener('click', (e) => {
          const commentId = e.target.dataset.commentId;
          this.cancelReply(commentId);
        });
      });

      // Edit comment events
      document.querySelectorAll('[id^="edit-comment-"]').forEach(button => {
        button.addEventListener('click', (e) => {
          const commentId = e.target.id.replace('edit-comment-', '');
          this.showEditCommentForm(commentId);
        });
      });

      // Delete comment events
      document.querySelectorAll('[id^="delete-comment-"]').forEach(button => {
        button.addEventListener('click', (e) => {
          const commentId = e.target.id.replace('delete-comment-', '');
          this.confirmDeleteComment(commentId);
        });
      });
    }

    // Post voting
    document.querySelectorAll('[id="Like"], [id="DisLike"]').forEach(button => {
      button.addEventListener('click', async (e) => {
        e.preventDefault();
        const postId = button.dataset.postid;
        const voteType = button.id.toLowerCase();
        await handleVote(postId, voteType, userStore, this.showToast.bind(this));
      });
    });

    // Comment voting
    document.querySelectorAll('.comment-vote').forEach(button => {
      button.addEventListener('click', async (e) => {
        e.preventDefault();
        const commentId = button.dataset.commentId;
        const voteType = button.dataset.vote === 'up' ? 'like' : 'dislike';
        await this.handleCommentVote(commentId, voteType);
      });
    });

    // Options menu toggle for post and comments
    document.querySelectorAll('.options-btn').forEach(button => {
      button.addEventListener('click', (e) => {
        const menu = e.target.closest('.post-options, .comment-options').querySelector('.options-menu');
        menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
        e.stopPropagation();
      });
    });

    // Close options menus when clicking outside
    document.addEventListener('click', () => {
      document.querySelectorAll('.options-menu').forEach(menu => {
        menu.style.display = 'none';
      });
    });
  }

  async submitComment(postId) {
    const textarea = document.getElementById('commentText');
    const content = textarea.value.trim();

    if (!content) {
      this.showToast('Comment cannot be empty');
      return;
    }

    try {
      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
      console.log('Submitting comment with CSRF token:', csrfToken); // Debug log

      const response = await fetch(`/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({
          content: content
        })
      });

      if (!response.ok) {
        throw new Error('Failed to submit comment');
      }

      const result = await response.json();
      console.log('Comment submission response:', result); // Debug log

      if (result.status === 'success') {
        textarea.value = '';
        
        // Fetch updated comments
        const commentsResponse = await fetch(`/api/posts/${postId}`);
        if (!commentsResponse.ok) {
          throw new Error('Failed to fetch updated comments');
        }

        const data = await commentsResponse.json();
        if (data.status === 'success' && data.data.comments) {
          // Update comments in the current instance
          this.comments = data.data.comments;
          
          // Update the comments container
          const commentsContainer = document.querySelector('.comments-container');
          commentsContainer.innerHTML = this.renderComments(this.comments);
          
          // Update comment count
          const commentCount = document.querySelector(`#comments-count-${postId}`);
          if (commentCount) {
            commentCount.textContent = this.comments.length;
          }

          // Reattach event listeners
          this.attachEventListeners();
          
          // Show success message
          this.showToast('Comment posted successfully');
        }
      } else {
        throw new Error(result.error || 'Failed to submit comment');
      }
    } catch (error) {
      console.error('Error submitting comment:', error);
      this.showToast('Failed to submit comment');
    }
  }

  showReplyForm(commentId) {
    const container = document.getElementById(`reply-form-${commentId}`);
    if (container) {
      container.style.display = 'block';
    }
  }

  cancelReply(commentId) {
    const container = document.getElementById(`reply-form-${commentId}`);
    const input = document.getElementById(`replyText-${commentId}`);
    if (container && input) {
      container.style.display = 'none';
      input.value = '';
    }
  }

  async submitReply(commentId, postId) {
    const textarea = document.getElementById(`replyText-${commentId}`);
    const content = textarea.value.trim();

    if (!content) {
        this.showToast('Reply cannot be empty');
        return;
    }

    try {
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
        console.log('Submitting reply with CSRF token:', csrfToken);

        // Log the request payload for debugging
        const payload = {
            content: content,
            parentID: parseInt(commentId)  // Changed from parentId to parentID to match backend
        };
        console.log('Submitting reply payload:', payload);

        const response = await fetch(`/api/posts/${postId}/comments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        console.log('Reply submission response:', result);

        if (!response.ok) {
            throw new Error(result.error || result.message || 'Failed to submit reply');
        }

        if (result.status === 'success') {
            textarea.value = '';
            // Hide the reply form
            document.getElementById(`reply-form-${commentId}`).style.display = 'none';
            
            // Fetch updated comments
            const commentsResponse = await fetch(`/api/posts/${postId}`);
            if (!commentsResponse.ok) {
                throw new Error('Failed to fetch updated comments');
            }

            const data = await commentsResponse.json();
            if (data.status === 'success' && data.data.comments) {
                // Update comments in the current instance
                this.comments = data.data.comments;
                
                // Update the comments container
                const commentsContainer = document.querySelector('.comments-container');
                commentsContainer.innerHTML = this.renderComments(this.comments);
                
                // Update comment count
                const commentCount = document.querySelector(`#comments-count-${postId}`);
                if (commentCount) {
                    commentCount.textContent = this.comments.length;
                }

                // Reattach event listeners
                this.attachEventListeners();
                
                // Show success message
                this.showToast('Reply posted successfully');
            }
        } else {
            throw new Error(result.error || 'Failed to submit reply');
        }
    } catch (error) {
        console.error('Error submitting reply:', error);
        this.showToast(error.message || 'Failed to submit reply');
    }
  }

  async handleCommentVote(commentId, type) {
    if (!this.user) {
        this.showToast('Please log in to vote');
        return;
    }

    try {
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
        console.log('Sending vote request:', {
            commentId: parseInt(commentId),
            voteType: type
        });

        const response = await fetch('/api/comments/vote', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({
                commentId: parseInt(commentId),
                voteType: type
            })
        });

        const responseText = await response.text();
        console.log('Raw response:', responseText);

        if (!response.ok) {
            throw new Error(`Server responded with ${response.status}: ${responseText}`);
        }

        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            throw new Error(`Invalid JSON response: ${responseText}`);
        }

        if (data.status === 'success' && data.data) {
            // Update vote counts
            const likesElement = document.getElementById(`comment-likes-${commentId}`);
            const dislikesElement = document.getElementById(`comment-dislikes-${commentId}`);
            
            if (likesElement) {
                likesElement.textContent = data.data.likes;
            }
            if (dislikesElement) {
                dislikesElement.textContent = data.data.dislikes;
            }

            // Update button states
            const likeButton = document.querySelector(`.comment-vote[data-vote="up"][data-comment-id="${commentId}"]`);
            const dislikeButton = document.querySelector(`.comment-vote[data-vote="down"][data-comment-id="${commentId}"]`);

            if (likeButton && dislikeButton) {
                if (type === 'like') {
                    likeButton.classList.toggle('active');
                    dislikeButton.classList.remove('dactive');
                } else {
                    dislikeButton.classList.toggle('dactive');
                    likeButton.classList.remove('active');
                }
            }

            this.showToast('Vote recorded successfully');
        } else {
            throw new Error(data.error || 'Failed to process vote');
        }
    } catch (error) {
        console.error('Error voting on comment:', error);
        this.showToast(error.message || 'Failed to vote on comment');
    }
  }

  showEditCommentForm(commentId) {
    const contentElement = document.getElementById(`comment-content-${commentId}`);
    const currentContent = contentElement.textContent.trim();

    contentElement.innerHTML = `
      <textarea class="edit-comment-input" id="edit-comment-${commentId}">${currentContent}</textarea>
      <div class="edit-actions">
        <button class="submit-edit-btn primary-button" onclick="submitCommentEdit('${commentId}')">Save</button>
        <button class="cancel-edit-btn secondary-button" onclick="cancelCommentEdit('${commentId}', '${currentContent}')">Cancel</button>
      </div>
    `;
  }

  async submitCommentEdit(commentId) {
    const textarea = document.getElementById(`edit-comment-${commentId}`);
    const content = textarea.value.trim();

    if (!content) {
      alert('Comment cannot be empty');
      return;
    }

    try {
      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
      const response = await fetch(`/api/comments/${commentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({ content })
      });

      if (!response.ok) {
        throw new Error('Failed to edit comment');
      }

      const contentElement = document.getElementById(`comment-content-${commentId}`);
      contentElement.textContent = content;
    } catch (error) {
      console.error('Error editing comment:', error);
      alert('Failed to edit comment');
    }
  }

  cancelCommentEdit(commentId, originalContent) {
    const contentElement = document.getElementById(`comment-content-${commentId}`);
    contentElement.textContent = originalContent;
  }

  async confirmDeleteComment(commentId) {
    if (confirm('Are you sure you want to delete this comment?')) {
      try {
        const response = await fetch(`/api/comments/${commentId}`, {
          method: 'DELETE'
        });

        if (!response.ok) {
          throw new Error('Failed to delete comment');
        }

        const commentElement = document.getElementById(`comment-${commentId}`);
        if (commentElement) {
          commentElement.remove();
        }
      } catch (error) {
        console.error('Error deleting comment:', error);
        alert('Failed to delete comment');
      }
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
