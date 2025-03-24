// messageStore.js - Improved unread messages handling

class MessageStore {
    constructor() {
        this.messages = new Map(); // conversationId -> messages[]
        this.conversations = [];
        this.currentConversation = null;
        this.subscribers = new Set();
        // Add unread messages tracking
        this.unreadMessages = new Map(); // conversationId -> count
        this.unreadTotalSubscribers = new Set(); // For global unread count updates
    }

    setMessages(conversationId, messages) {
        this.messages.set(conversationId, messages);
        this.notifySubscribers();
    }

    addMessage(conversationId, message) {
        const messages = this.messages.get(conversationId) || [];
        messages.push(message);
        this.messages.set(conversationId, messages);
        
        // If it's an incoming message and not from the current user
        const currentUser = this._getCurrentUser();
        if (message.sender_id !== currentUser?.id) {
            // Mark as unread if not in the current conversation view
            if (this.currentConversation !== conversationId) {
                this.incrementUnreadCount(conversationId);
            }
        }
        
        this.notifySubscribers();
    }

    setConversations(conversations) {
        this.conversations = conversations;
        this.notifySubscribers();
    }

    // Get the total number of unread messages across all conversations
    getTotalUnreadCount() {
        let total = 0;
        this.unreadMessages.forEach(count => {
            total += count;
        });
        return total;
    }

    // Get unread count for a specific conversation
    getUnreadCount(conversationId) {
        return this.unreadMessages.get(conversationId) || 0;
    }

    // Increment unread count for a conversation
    incrementUnreadCount(conversationId) {
        const currentCount = this.unreadMessages.get(conversationId) || 0;
        this.unreadMessages.set(conversationId, currentCount + 1);
        this.notifyUnreadCountSubscribers();
    }

    // Mark all messages in a conversation as read
    markConversationAsRead(conversationId) {
        if (this.unreadMessages.has(conversationId)) {
            this.unreadMessages.set(conversationId, 0);
            this.notifyUnreadCountSubscribers();
            
            // Also update the conversation list to show read status
            this.notifySubscribers();
        }
    }

    // Reset all unread counts (useful during logout)
    resetUnreadCounts() {
        this.unreadMessages.clear();
        this.notifyUnreadCountSubscribers();
    }

    // Subscribe to general changes
    subscribe(callback) {
        this.subscribers.add(callback);
        return () => this.subscribers.delete(callback);
    }

    // Subscribe specifically to unread count changes
    subscribeToUnreadCount(callback) {
        this.unreadTotalSubscribers.add(callback);
        // Immediately call the callback with current count to initialize
        callback(this.getTotalUnreadCount());
        return () => this.unreadTotalSubscribers.delete(callback);
    }

    notifySubscribers() {
        this.subscribers.forEach(callback => callback());
    }

    notifyUnreadCountSubscribers() {
        const totalUnread = this.getTotalUnreadCount();
        this.unreadTotalSubscribers.forEach(callback => callback(totalUnread));
    }
    
    // Helper to get current user
    _getCurrentUser() {
        try {
            // Try to import and use userStore
            const userStore = window.userStore || this._getUserStore();
            return userStore?.getCurrentUser() || null;
        } catch (e) {
            console.error("Error getting current user:", e);
            return null;
        }
    }
    
    // Helper function to get userStore if import is not available
    _getUserStore() {
        // Check if userStore was imported through window
        if (window.userStore) {
            return window.userStore;
        }
        // Try to get from global scope if available
        return null;
    }
}

// Create a singleton instance
const messageStore = new MessageStore();

// Expose to window for debugging and global access
window.messageStore = messageStore;

export default messageStore;