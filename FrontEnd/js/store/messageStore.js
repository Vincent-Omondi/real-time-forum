import userStore from './userStore.js';
import { sendMessage } from './websocketManager.js';

class MessageStore {
    constructor() {
        this.messages = new Map(); // conversationId -> messages[]
        this.conversations = [];
        this.currentConversation = null;
        this.subscribers = new Set();
        this.unreadCounts = new Map(); // conversationId -> count
    }

    setMessages(conversationId, messages) {
        // Filter out messages that are already read
        const unreadCount = messages.filter(msg => 
            msg.sender_id !== userStore.getCurrentUser()?.id && !msg.read_at
        ).length;
        
        this.messages.set(conversationId, messages);
        this.unreadCounts.set(conversationId, unreadCount);
        this.notifySubscribers();
    }

    addMessage(conversationId, message) {
        const messages = this.messages.get(conversationId) || [];
        messages.push(message);
        this.messages.set(conversationId, messages);
        
        // Update unread count if message is from other user
        if (message.sender_id !== userStore.getCurrentUser()?.id && 
            this.currentConversation !== conversationId) {
            const currentCount = this.unreadCounts.get(conversationId) || 0;
            this.unreadCounts.set(conversationId, currentCount + 1);
        }
        
        this.notifySubscribers();
    }

    setConversations(conversations) {
        this.conversations = conversations;
        this.notifySubscribers();
    }

    subscribe(callback) {
        this.subscribers.add(callback);
        return () => this.subscribers.delete(callback);
    }

    notifySubscribers() {
        this.subscribers.forEach(callback => callback());
    }

    markMessagesAsRead(conversationId) {
        // Update local state
        this.unreadCounts.set(conversationId, 0);
        
        // Update read_at for messages in the conversation
        const messages = this.messages.get(conversationId) || [];
        const currentTime = new Date();
        
        messages.forEach(msg => {
            if (msg.sender_id !== userStore.getCurrentUser()?.id && !msg.read_at) {
                msg.read_at = currentTime;
            }
        });

        // Send WebSocket message
        sendMessage({
            type: 'read',
            receiver_id: userStore.getCurrentUser()?.id,
            sender_id: parseInt(conversationId),
            timestamp: currentTime
        });

        // Call REST API as fallback
        fetch(`/api/messages/read/${conversationId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.content
            }
        }).catch(error => console.error('Failed to mark messages as read:', error));

        this.notifySubscribers();
    }

    handleReadEvent(data) {
        const { sender_id, receiver_id, timestamp } = data;
        const conversationId = sender_id.toString();
        
        const messages = this.messages.get(conversationId) || [];
        messages.forEach(msg => {
            if (msg.sender_id === sender_id && !msg.read_at) {
                msg.read_at = new Date(timestamp);
            }
        });
        
        this.unreadCounts.set(conversationId, 0);
        this.notifySubscribers();
    }

    getTotalUnreadCount() {
        return Array.from(this.unreadCounts.values())
            .reduce((sum, count) => sum + count, 0);
    }
}

const messageStore = new MessageStore();
export default messageStore; 