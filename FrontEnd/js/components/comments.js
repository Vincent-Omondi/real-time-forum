import { checkAuth } from './auth.js';

export async function initComments(postId) {
    const container = document.querySelector('.comments-container');
    const user = checkAuth();

    // Add comment form if user is logged in
    if (user) {
        container.insertAdjacentHTML('beforebegin', `
            <form id="create-comment-form">
                <textarea name="content" placeholder="Write a comment..." required></textarea>
                <button type="submit">Post Comment</button>
            </form>
        `);

        const commentForm = document.getElementById('create-comment-form');
        commentForm.addEventListener('submit', (e) => handleCreateComment(e, postId));
    }

    // Load and display comments
    await loadComments(postId);
}

async function loadComments(postId) {
    const container = document.querySelector('.comments-container');
    try {
        const response = await fetch(`/api/posts/${postId}/comments`);
        if (response.ok) {
            const comments = await response.json();
            container.innerHTML = comments.map(comment => createCommentHTML(comment)).join('');
            
            // Add event listeners to comment actions
            attachCommentEventListeners();
        } else {
            container.innerHTML = '<p>Error loading comments</p>';
        }
    } catch (error) {
        console.error('Error loading comments:', error);
        container.innerHTML = '<p>Error loading comments</p>';
    }
}

function createCommentHTML(comment) {
    const user = checkAuth();
    const isAuthor = user && user.id === comment.author_id;
    
    return `
        <div class="comment" data-comment-id="${comment.id}">
            <p class="comment-content">${comment.content}</p>
            <div class="comment-meta">
                <span>By ${comment.author}</span>
                <span>${new Date(comment.created_at).toLocaleDateString()}</span>
            </div>
            ${isAuthor ? `
                <div class="comment-actions">
                    <button class="edit-comment" data-comment-id="${comment.id}">Edit</button>
                    <button class="delete-comment" data-comment-id="${comment.id}">Delete</button>
                </div>
            ` : ''}
        </div>
    `;
}

async function handleCreateComment(e, postId) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);

    try {
        const response = await fetch(`/api/posts/${postId}/comments`, {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            form.reset();
            await loadComments(postId);
        } else {
            const error = await response.json();
            alert(error.message);
        }
    } catch (error) {
        console.error('Error creating comment:', error);
        alert('An error occurred while creating the comment');
    }
}

function attachCommentEventListeners() {
    // Edit comment
    document.querySelectorAll('.edit-comment').forEach(button => {
        button.addEventListener('click', (e) => {
            const commentId = e.target.dataset.commentId;
            editComment(commentId);
        });
    });

    // Delete comment
    document.querySelectorAll('.delete-comment').forEach(button => {
        button.addEventListener('click', async (e) => {
            const commentId = e.target.dataset.commentId;
            if (confirm('Are you sure you want to delete this comment?')) {
                await deleteComment(commentId);
            }
        });
    });
}

function editComment(commentId) {
    const commentElement = document.querySelector(`[data-comment-id="${commentId}"]`);
    const content = commentElement.querySelector('.comment-content').textContent;
    
    commentElement.innerHTML = `
        <form class="edit-comment-form" data-comment-id="${commentId}">
            <textarea name="content" required>${content}</textarea>
            <button type="submit">Save</button>
            <button type="button" class="cancel-edit">Cancel</button>
        </form>
    `;

    const editForm = commentElement.querySelector('.edit-comment-form');
    const cancelButton = commentElement.querySelector('.cancel-edit');

    editForm.addEventListener('submit', handleEditComment);
    cancelButton.addEventListener('click', () => loadComments(postId));
}

async function handleEditComment(e) {
    e.preventDefault();
    const form = e.target;
    const commentId = form.dataset.commentId;
    const formData = new FormData(form);

    try {
        const response = await fetch(`/api/comments/${commentId}`, {
            method: 'PUT',
            body: formData
        });

        if (response.ok) {
            await loadComments(postId);
        } else {
            const error = await response.json();
            alert(error.message);
        }
    } catch (error) {
        console.error('Error updating comment:', error);
        alert('An error occurred while updating the comment');
    }
}

async function deleteComment(commentId) {
    try {
        const response = await fetch(`/api/comments/${commentId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            await loadComments(postId);
        } else {
            const error = await response.json();
            alert(error.message);
        }
    } catch (error) {
        console.error('Error deleting comment:', error);
        alert('An error occurred while deleting the comment');
    }
} 