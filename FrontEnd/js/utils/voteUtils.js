import voteStore from '../store/voteStore.js';

// Vote management state
let userVotes = {};
let userCommentVotes = {};

function getCsrfToken() {
    return localStorage.getItem('csrfToken') || 
           document.querySelector('meta[name="csrf-token"]')?.content;
}

export async function initializeVoteStates() {
    await voteStore.initialize();
}

export function updateVoteCounts(postId, likes, dislikes) {
    requestAnimationFrame(() => {
        const likesContainer = document.getElementById(`likes-container-${postId}`);
        const dislikesContainer = document.getElementById(`dislikes-container-${postId}`);
        
        if (likesContainer) likesContainer.textContent = likes;
        if (dislikesContainer) dislikesContainer.textContent = dislikes;
    });
}

export function toggleVoteButtonStates(postId, activeVoteType) {
    requestAnimationFrame(() => {
        const buttons = {
            like: document.querySelector(`[id="Like"][data-post-id="${postId}"]`),
            dislike: document.querySelector(`[id="DisLike"][data-post-id="${postId}"]`)
        };

        if (buttons.like && buttons.dislike) {
            const activeClass = 'active';
            buttons.like.classList.toggle(activeClass, activeVoteType === 'like');
            buttons.dislike.classList.toggle(activeClass, activeVoteType === 'dislike');
        }
    });
}

export async function handleVote(postId, voteType, userStore, showToast) {
    const user = userStore.getCurrentUser();
    if (!user) {
        showToast('Please log in to vote');
        return null;
    }

    // Ensure vote states are initialized
    if (!voteStore.initialized) {
        await voteStore.initialize();
    }

    const previousVote = voteStore.postVotes[postId];
    const currentLikes = parseInt(document.getElementById(`likes-container-${postId}`).textContent);
    const currentDislikes = parseInt(document.getElementById(`dislikes-container-${postId}`).textContent);

    try {
        const response = await fetch('/api/posts/vote', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': getCsrfToken()
            },
            credentials: 'include',
            body: JSON.stringify({
                post_id: +postId,
                vote: voteType
            })
        });

        if (!response.ok) {
            throw new Error('Failed to vote');
        }

        const data = await response.json();
        
        // Update store with server response
        voteStore.updatePostVote(postId, voteType);
        
        // Update UI with server-provided counts
        updateVoteCounts(postId, data.likes, data.dislikes);
        toggleVoteButtonStates(postId, voteType);

        return data;
    } catch (error) {
        console.error('Error:', error);
        showToast('An error occurred while voting');
        return null;
    }
}

export function getUserVotes() {
    return { userVotes, userCommentVotes };
}

// Add this to your auth-related code (e.g., logout handler)
export function clearVoteStates() {
    voteStore.clearVotes();
}