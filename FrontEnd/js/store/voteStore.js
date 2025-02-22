class VoteStore {
    constructor() {
        this.postVotes = {};
        this.commentVotes = {};
        this.subscribers = new Set();
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;

        try {
            const response = await fetch('/api/users/votes', {
                credentials: 'include',
                headers: {
                    'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.content
                }
            });

            if (!response.ok) throw new Error('Failed to fetch vote states');
            
            const data = await response.json();
            this.postVotes = data.postVotes || {};
            this.commentVotes = data.commentVotes || {};
            this.notify();
            this.initialized = true;
        } catch (error) {
            console.error('Error initializing vote states:', error);
        }
    }

    subscribe(callback) {
        this.subscribers.add(callback);
        return () => this.subscribers.delete(callback);
    }

    notify() {
        this.subscribers.forEach(callback => callback());
    }

    setVotes(postVotes, commentVotes) {
        this.postVotes = postVotes;
        this.commentVotes = commentVotes;
        this.notify();
    }

    updatePostVote(postId, voteType) {
        this.postVotes[postId] = voteType;
        this.notify();
    }

    updateCommentVote(commentId, voteType) {
        this.commentVotes[commentId] = voteType;
        this.notify();
    }

    getVotes() {
        return {
            postVotes: this.postVotes,
            commentVotes: this.commentVotes
        };
    }

    clearVotes() {
        this.postVotes = {};
        this.commentVotes = {};
        this.initialized = false;
        this.notify();
    }
}

export default new VoteStore(); 