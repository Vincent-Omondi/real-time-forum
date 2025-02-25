class MessageStore {
    constructor() {
        this.messages = new Map(); // conversationId -> messages[]
        this.conversations = [];
        this.currentConversation = null;
        this.subscribers = new Set();
    }

    setMessages(conversationId, messages) {
        this.messages.set(conversationId, messages);
        this.notifySubscribers();
    }

    addMessage(conversationId, message) {
        const messages = this.messages.get(conversationId) || [];
        messages.push(message);
        this.messages.set(conversationId, messages);
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
}

export default new MessageStore(); 