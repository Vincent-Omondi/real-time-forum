import { getUserVotes } from '../utils/voteUtils.js';

const { userCommentVotes } = getUserVotes();

export default class CommentManager {
    constructor(user, postId, comments = [], showToastCallback) {
        this.user = user;
        this.postId = postId;
        this.comments = comments;
        this.showToast = showToastCallback;
    }

    renderComments(comments, parentId = null, depth = 0) {
        const filteredComments = comments.filter(comment => {
            if (parentId === null) {
                return !comment.ParentID || !comment.ParentID.Valid;
            } else {
                return comment.ParentID && 
                       comment.ParentID.Valid && 
                       parseInt(comment.ParentID.Int64) === parseInt(parentId);
            }
        });

        if (filteredComments.length === 0) return '';

        return filteredComments.map(comment => {
            const isAuthor = this.user && this.user.id === comment.UserID;
            
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
                                <button class="button button-primary" data-comment-id="${comment.ID}" data-post-id="${this.postId}">Submit</button>
                                <button class="button button-secondary" data-comment-id="${comment.ID}">Cancel</button>
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    }

    attachEventListeners() {
        if (this.user) {
            // Comment submission event
            const commentButton = document.querySelector('.comment-button');
            const commentTextarea = document.getElementById('commentText');
            
            if (commentButton && commentTextarea) {
                this.setupCommentInput(commentButton, commentTextarea);
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

            // Comment voting
            document.querySelectorAll('.comment-vote').forEach(button => {
                button.addEventListener('click', async (e) => {
                    e.preventDefault();
                    const commentId = button.dataset.commentId;
                    const voteType = button.dataset.vote === 'up' ? 'like' : 'dislike';
                    await this.handleCommentVote(commentId, voteType);
                });
            });
        }

        // Options menu toggle for comments
        document.querySelectorAll('.comment-options .options-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const menu = e.target.closest('.comment-options').querySelector('.options-menu');
                menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
                e.stopPropagation();
            });
        });

        // Close options menus when clicking outside
        document.addEventListener('click', () => {
            document.querySelectorAll('.comment-options .options-menu').forEach(menu => {
                menu.style.display = 'none';
            });
        });
    }

    setupCommentInput(commentButton, commentTextarea) {
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
                this.submitComment(postId);
            }
        });

        // Handle Enter key (Ctrl/Cmd + Enter to submit)
        commentTextarea.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && commentTextarea.value.trim()) {
                e.preventDefault();
                const postId = commentButton.getAttribute('data-post-id');
                this.submitComment(postId);
            }
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

            if (result.status === 'success') {
                textarea.value = '';
                await this.refreshComments(postId);
                this.showToast('Comment posted successfully');
            } else {
                throw new Error(result.error || 'Failed to submit comment');
            }
        } catch (error) {
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
            const payload = {
                content: content,
                parentID: parseInt(commentId)
            };

            const response = await fetch(`/api/posts/${postId}/comments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || result.message || 'Failed to submit reply');
            }

            if (result.status === 'success') {
                textarea.value = '';
                document.getElementById(`reply-form-${commentId}`).style.display = 'none';
                await this.refreshComments(postId);
                this.showToast('Reply posted successfully');
            } else {
                throw new Error(result.error || 'Failed to submit reply');
            }
        } catch (error) {
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
                this.updateCommentVoteUI(commentId, type, data.data);
                this.showToast('Vote recorded successfully');
            } else {
                throw new Error(data.error || 'Failed to process vote');
            }
        } catch (error) {
            this.showToast(error.message || 'Failed to vote on comment');
        }
    }

    updateCommentVoteUI(commentId, type, data) {
        const likesElement = document.getElementById(`comment-likes-${commentId}`);
        const dislikesElement = document.getElementById(`comment-dislikes-${commentId}`);
        
        if (likesElement) {
            likesElement.textContent = data.likes;
        }
        if (dislikesElement) {
            dislikesElement.textContent = data.dislikes;
        }

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
    }

    showEditCommentForm(commentId) {
        const contentElement = document.getElementById(`comment-content-${commentId}`);
        const currentContent = contentElement.textContent.trim();

        contentElement.innerHTML = `
            <textarea class="edit-comment-input" id="edit-comment-${commentId}">${currentContent}</textarea>
            <div class="edit-actions">
                <button class="submit-edit-btn primary-button" onclick="document.querySelector('.comments-container').__vue__.submitCommentEdit('${commentId}')">Save</button>
                <button class="cancel-edit-btn secondary-button" onclick="document.querySelector('.comments-container').__vue__.cancelCommentEdit('${commentId}', '${currentContent}')">Cancel</button>
            </div>
        `;

        // Focus the textarea
        const textarea = document.getElementById(`edit-comment-${commentId}`);
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    }

    async submitCommentEdit(commentId) {
        const textarea = document.getElementById(`edit-comment-${commentId}`);
        const content = textarea.value.trim();

        if (!content) {
            this.showToast('Comment cannot be empty');
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

            await this.refreshComments(this.postId);
        } catch (error) {
            this.showToast('Failed to edit comment');
        }
    }

    cancelCommentEdit(commentId, originalContent) {
        const contentElement = document.getElementById(`comment-content-${commentId}`);
        contentElement.textContent = originalContent;
    }

    async confirmDeleteComment(commentId) {
        if (confirm('Are you sure you want to delete this comment?')) {
            try {
                const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
                const response = await fetch(`/api/comments?id=${commentId}`, {
                    method: 'DELETE',
                    headers: {
                        'X-CSRF-Token': csrfToken
                    }
                });

                if (!response.ok) {
                    throw new Error('Failed to delete comment');
                }

                await this.refreshComments(this.postId);
            } catch (error) {
                this.showToast('Failed to delete comment');
            }
        }
    }

    async refreshComments(postId) {
        try {
            const commentsResponse = await fetch(`/api/posts/${postId}`);
            if (!commentsResponse.ok) {
                throw new Error('Failed to fetch updated comments');
            }

            const data = await commentsResponse.json();
            if (data.status === 'success' && data.data.comments) {
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
            }
        } catch (error) {
            this.showToast('Failed to refresh comments');
        }
    }
}
