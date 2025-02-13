import { checkAuth } from './auth.js';
import { formatTimestamp } from '../utils/time.js';

// Vote management
let userVotes = {};
let userCommentVotes = {};

export default class ViewPost {
    constructor() {
        this.postId = null;
        this.post = null;
        this.comments = [];
        this.user = checkAuth();
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
                            <button class="back-button" onclick="history.back()">
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

        return `
            <div class="view-post-container">
                <button class="back-button" onclick="history.back()">
                    <i class="fa-solid fa-arrow-left"></i> Back
                </button>

                <div class="post-details">
                    <div class="post-header">
                        <div class="post-meta">
                            <div class="author-info">
                                <div class="author-initial">${this.post.Author.charAt(0)}</div>
                                <span class="author-name">${this.post.Author}</span>
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
                        <h1 class="post-title">${this.post.Title}</h1>
                    </div>

                    <div class="post-content">
                        ${this.post.Content}
                    </div>

                    ${this.post.ImageUrl && this.post.ImageUrl.Valid ? `
                        <div class="post-image">
                            <img src="${this.post.ImageUrl.String}" alt="Post image" loading="lazy">
                        </div>
                    ` : ''}

                    <div class="post-footer">
                        <div class="vote-buttons">
                            <button class="vote-button" id="post-like-${this.post.ID}" data-post-id="${this.post.ID}">
                                <i class="fa-regular fa-thumbs-up"></i>
                            </button>
                            <span class="counter" id="post-likes-${this.post.ID}">${this.post.Likes || 0}</span>
                            <button class="vote-button" id="post-dislike-${this.post.ID}" data-post-id="${this.post.ID}">
                                <i class="fa-regular fa-thumbs-down"></i>
                            </button>
                            <span class="counter" id="post-dislikes-${this.post.ID}">${this.post.Dislikes || 0}</span>
                        </div>
                    </div>
                </div>

                <div class="comments-section">
                    <h3>Comments (${this.comments.length})</h3>
                    ${this.user ? `
                        <div class="comment-input-container">
                            <textarea id="commentText" placeholder="Write a comment..."></textarea>
                            <div class="comment-actions">
                                <button id="submitComment" class="primary-button">Comment</button>
                            </div>
                        </div>
                    ` : `
                        <div class="login-prompt">
                            <p>Please <a href="/login" data-link>login</a> to comment</p>
                        </div>
                    `}
                    <div class="comments-list">
                        ${this.renderComments(this.comments)}
                    </div>
                </div>
            </div>
        `;
    }

    renderComments(comments, parentId = null, depth = 0) {
        const filteredComments = comments.filter(comment => 
            parentId === null ? !comment.ParentID : comment.ParentID === parentId
        );

        if (filteredComments.length === 0) return '';

        return filteredComments.map(comment => `
            <div class="comment depth-${depth}" id="comment-${comment.ID}">
                <div class="comment-header">
                    <div class="comment-meta">
                        <div class="author-info">
                            <div class="author-initial">${comment.Author.charAt(0)}</div>
                            <span class="author-name">${comment.Author}</span>
                        </div>
                        <span class="timestamp" data-timestamp="${comment.Timestamp}"></span>
                    </div>
                    ${this.user && this.user.id === comment.UserID ? `
                        <div class="comment-options">
                            <button class="options-btn">
                                <i class="fa-solid fa-ellipsis"></i>
                            </button>
                            <div class="options-menu">
                                <button class="edit-comment-btn" data-comment-id="${comment.ID}">
                                    <i class="fa-solid fa-edit"></i> Edit
                                </button>
                                <button class="delete-comment-btn" data-comment-id="${comment.ID}">
                                    <i class="fa-solid fa-trash"></i> Delete
                                </button>
                            </div>
                        </div>
                    ` : ''}
                </div>
                <div class="comment-content" id="comment-content-${comment.ID}">
                    ${comment.Content}
                </div>
                <div class="comment-footer">
                    <div class="vote-buttons">
                        <button class="vote-button" id="comment-like-${comment.ID}" data-comment-id="${comment.ID}">
                            <i class="fa-regular fa-thumbs-up"></i>
                        </button>
                        <span class="counter" id="comment-likes-${comment.ID}">${comment.Likes || 0}</span>
                        <button class="vote-button" id="comment-dislike-${comment.ID}" data-comment-id="${comment.ID}">
                            <i class="fa-regular fa-thumbs-down"></i>
                        </button>
                        <span class="counter" id="comment-dislikes-${comment.ID}">${comment.Dislikes || 0}</span>
                    </div>
                    ${this.user && depth < 5 ? `
                        <button class="reply-btn" data-comment-id="${comment.ID}">Reply</button>
                    ` : ''}
                </div>
                <div class="reply-container" id="reply-container-${comment.ID}" style="display: none;">
                    <textarea class="reply-input" id="reply-input-${comment.ID}" placeholder="Write a reply..."></textarea>
                    <div class="reply-actions">
                        <button class="submit-reply-btn primary-button" data-comment-id="${comment.ID}">Reply</button>
                        <button class="cancel-reply-btn secondary-button" data-comment-id="${comment.ID}">Cancel</button>
                    </div>
                </div>
                <div class="nested-comments">
                    ${this.renderComments(comments, comment.ID, depth + 1)}
                </div>
            </div>
        `).join('');
    }

    async afterRender() {
        // Update timestamps
        document.querySelectorAll('.timestamp').forEach(element => {
            const timestamp = element.dataset.timestamp;
            element.textContent = formatTimestamp(timestamp);
        });

        // Attach event listeners
        this.attachEventListeners();
    }

    attachEventListeners() {
        if (this.user) {
            // Comment submission
            const submitBtn = document.getElementById('submitComment');
            if (submitBtn) {
                submitBtn.addEventListener('click', () => this.submitComment());
            }

            // Reply buttons
            document.querySelectorAll('.reply-btn').forEach(button => {
                button.addEventListener('click', (e) => {
                    const commentId = e.target.dataset.commentId;
                    this.showReplyForm(commentId);
                });
            });

            // Submit reply buttons
            document.querySelectorAll('.submit-reply-btn').forEach(button => {
                button.addEventListener('click', (e) => {
                    const commentId = e.target.dataset.commentId;
                    this.submitReply(commentId);
                });
            });

            // Cancel reply buttons
            document.querySelectorAll('.cancel-reply-btn').forEach(button => {
                button.addEventListener('click', (e) => {
                    const commentId = e.target.dataset.commentId;
                    this.cancelReply(commentId);
                });
            });

            // Edit comment buttons
            document.querySelectorAll('.edit-comment-btn').forEach(button => {
                button.addEventListener('click', (e) => {
                    const commentId = e.target.closest('[data-comment-id]').dataset.commentId;
                    this.showEditCommentForm(commentId);
                });
            });

            // Delete comment buttons
            document.querySelectorAll('.delete-comment-btn').forEach(button => {
                button.addEventListener('click', (e) => {
                    const commentId = e.target.closest('[data-comment-id]').dataset.commentId;
                    this.confirmDeleteComment(commentId);
                });
            });
        }

        // Vote buttons for post
        document.querySelectorAll('[id^="post-like-"], [id^="post-dislike-"]').forEach(button => {
            button.addEventListener('click', (e) => {
                const type = e.target.id.includes('like') ? 'like' : 'dislike';
                this.handlePostVote(type);
            });
        });

        // Vote buttons for comments
        document.querySelectorAll('[id^="comment-like-"], [id^="comment-dislike-"]').forEach(button => {
            button.addEventListener('click', (e) => {
                const commentId = e.target.closest('[data-comment-id]').dataset.commentId;
                const type = e.target.id.includes('like') ? 'like' : 'dislike';
                this.handleCommentVote(commentId, type);
            });
        });

        // Options menu toggle
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

    async submitComment() {
        const textarea = document.getElementById('commentText');
        const content = textarea.value.trim();

        if (!content) {
            alert('Please enter a comment');
            return;
        }

        try {
            const response = await fetch(`/api/posts/${this.postId}/comments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ content })
            });

            if (!response.ok) {
                throw new Error('Failed to submit comment');
            }

            // Refresh the post view
            window.location.reload();
        } catch (error) {
            console.error('Error submitting comment:', error);
            alert('Failed to submit comment');
        }
    }

    showReplyForm(commentId) {
        const container = document.getElementById(`reply-container-${commentId}`);
        if (container) {
            container.style.display = 'block';
        }
    }

    cancelReply(commentId) {
        const container = document.getElementById(`reply-container-${commentId}`);
        const input = document.getElementById(`reply-input-${commentId}`);
        if (container && input) {
            container.style.display = 'none';
            input.value = '';
        }
    }

    async submitReply(parentId) {
        const textarea = document.getElementById(`reply-input-${parentId}`);
        const content = textarea.value.trim();

        if (!content) {
            alert('Please enter a reply');
            return;
        }

        try {
            const response = await fetch(`/api/posts/${this.postId}/comments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    content,
                    parent_id: parentId
                })
            });

            if (!response.ok) {
                throw new Error('Failed to submit reply');
            }

            // Refresh the post view
            window.location.reload();
        } catch (error) {
            console.error('Error submitting reply:', error);
            alert('Failed to submit reply');
        }
    }

    async handleCommentVote(commentId, type) {
        try {
            const response = await fetch('/api/comments/vote', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    comment_id: commentId,
                    vote_type: type
                })
            });

            if (!response.ok) {
                throw new Error('Failed to vote');
            }

            const data = await response.json();
            this.updateCommentVoteCounts(commentId, data.likes, data.dislikes);
            this.toggleCommentVoteButtonStates(commentId, type);
        } catch (error) {
            console.error('Error voting on comment:', error);
            alert('Failed to vote on comment');
        }
    }

    updateCommentVoteCounts(commentId, likes, dislikes) {
        const likesElement = document.getElementById(`comment-likes-${commentId}`);
        const dislikesElement = document.getElementById(`comment-dislikes-${commentId}`);

        if (likesElement) likesElement.textContent = likes;
        if (dislikesElement) dislikesElement.textContent = dislikes;
    }

    toggleCommentVoteButtonStates(commentId, activeType) {
        const likeButton = document.getElementById(`comment-like-${commentId}`);
        const dislikeButton = document.getElementById(`comment-dislike-${commentId}`);

        if (likeButton && dislikeButton) {
            likeButton.classList.toggle('active', activeType === 'like');
            dislikeButton.classList.toggle('active', activeType === 'dislike');
        }
    }

    async handlePostVote(type) {
        try {
            const response = await fetch('/api/posts/vote', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    post_id: this.postId,
                    vote_type: type
                })
            });

            if (!response.ok) {
                throw new Error('Failed to vote');
            }

            const data = await response.json();
            this.updatePostVoteCounts(data.likes, data.dislikes);
            this.togglePostVoteButtonStates(type);
        } catch (error) {
            console.error('Error voting on post:', error);
            alert('Failed to vote on post');
        }
    }

    updatePostVoteCounts(likes, dislikes) {
        const likesElement = document.getElementById(`post-likes-${this.postId}`);
        const dislikesElement = document.getElementById(`post-dislikes-${this.postId}`);

        if (likesElement) likesElement.textContent = likes;
        if (dislikesElement) dislikesElement.textContent = dislikes;
    }

    togglePostVoteButtonStates(activeType) {
        const likeButton = document.getElementById(`post-like-${this.postId}`);
        const dislikeButton = document.getElementById(`post-dislike-${this.postId}`);

        if (likeButton && dislikeButton) {
            likeButton.classList.toggle('active', activeType === 'like');
            dislikeButton.classList.toggle('active', activeType === 'dislike');
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
            const response = await fetch(`/api/comments/${commentId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ content })
            });

            if (!response.ok) {
                throw new Error('Failed to edit comment');
            }

            // Update the comment content
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

                // Remove the comment from the DOM
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
}
