import messageStore from '../store/messageStore.js';
import { formatTimestamp } from '../utils/time.js';
import { throttle } from '../utils/throttle.js';
import userStore from '../store/userStore.js';
import { initNotifications } from './notifications.js';
import { 
    getWebSocket, 
    closeWebSocket, 
    registerMessageHandler, 
    unregisterMessageHandler,
    sendMessage
} from '../store/ websocketManager.js';

export class MessagesView {
    constructor() {
        this.currentPage = 1;
        this.isLoading = false;
        this.hasMoreMessages = true;
        this.loadMoreThrottled = throttle(this.loadMoreMessages.bind(this), 1000);
        this.messageStore = messageStore;
        this.messageHandler = this.handleIncomingMessage.bind(this);
        this.scrollPositionToMaintain = null;
    }

    async loadMoreMessages(userId) {
        if (!userId || this.isLoading || !this.hasMoreMessages) return;
        
        const nextPage = this.currentPage + 1;
        const messagesList = document.querySelector('.messages-list');
        
        // Remember scroll height before adding new messages
        const prevScrollHeight = messagesList.scrollHeight;
        this.scrollPositionToMaintain = prevScrollHeight;
        
        await this.loadMessages(userId, nextPage);
    }

    async render() {
        const container = document.querySelector('.main-content');
        container.innerHTML = `
            <div class="messages-container">
                <div class="contacts-sidebar">
                    <div class="contacts-header">
                        <h2>Messages</h2>
                        <button class="new-conversation-btn">+</button>
                    </div>
                    <div class="contacts-list"></div>
                </div>
                <div class="chat-area">
                    <div class="chat-header"></div>
                    <div class="messages-list"></div>
                    <div class="message-input-container">
                        <form class="message-input-form">
                            <textarea 
                                class="message-input" 
                                placeholder="Type a message..."
                                rows="1"
                            ></textarea>
                            <button type="submit" class="send-button">Send</button>
                        </form>
                    </div>
                </div>
            </div>
        `;

        await this.loadConversations();
        this.setupEventListeners();
        // Register message handler instead of setting up WebSocket directly
        registerMessageHandler(this.messageHandler);
    }

    async loadConversations() {
        try {
            // Get CSRF token from meta tag
            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
            
            const response = await fetch('/api/messages/conversations', {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken || ''
                }
            });

            const responseText = await response.text();

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = responseText ? JSON.parse(responseText) : { conversations: [] };
            
            if (data.error) {
                throw new Error(data.error);
            }

            const conversations = data.conversations || [];
            this.messageStore.setConversations(conversations);
            this.renderConversationList();
        } catch (error) {
            console.error('Error loading conversations:', error);
            // Redirect to login if unauthorized
            if (error.message.includes('Unauthorized')) {
                window.location.href = '/login';
                return;
            }
            this.messageStore.setConversations([]);
            this.renderConversationList();
        }
    }

    renderConversationList() {
        const contactsList = document.querySelector('.contacts-list');
        const conversations = this.messageStore.conversations;
        
        if (conversations.length === 0) {
            // Show a placeholder with a "Start New Conversation" button
            contactsList.innerHTML = `
                <div class="no-conversations">
                    <p>No conversations yet.</p>
                    <button id="start-new-conversation">Start a New Conversation</button>
                </div>
            `;
            document.getElementById('start-new-conversation')
                .addEventListener('click', () => this.showUserSearchModal());
        } else {
            contactsList.innerHTML = conversations.map(conv => `
                <div class="contact-item" data-user-id="${conv.other_user_id}">
                    <div class="contact-avatar">
                        ${conv.username.charAt(0).toUpperCase()}
                    </div>
                    <div class="contact-info">
                        <div class="contact-name">${conv.username}</div>
                        <div class="contact-status ${conv.is_online ? 'online' : ''}">
                            ${conv.is_online ? 'Online' : 'Last seen ' + formatTimestamp(conv.last_seen)}
                        </div>
                        <div class="last-message">${conv.last_message || 'No messages yet'}</div>
                    </div>
                </div>
            `).join('');
        }
    }

    async showUserSearchModal() {
        try {
            // Fetch registered users from a new endpoint, e.g., /api/users
            const response = await fetch('/api/users', { credentials: 'include' });
            if (!response.ok) throw new Error("Failed to fetch users");
            const data = await response.json();
            const users = data.users;

            // Create a modal container
            const modal = document.createElement('div');
            modal.classList.add('user-search-modal');
            modal.innerHTML = `
                <div class="modal-overlay"></div>
                <div class="modal-content">
                    <h2>Select a user to chat with</h2>
                    <input type="text" id="user-search-input" placeholder="Search users..." />
                    <div id="user-search-results">
                        ${users.map(user => `
                            <div class="user-search-item" data-user-id="${user.id}">
                                ${user.nickname}
                            </div>
                        `).join('')}
                    </div>
                    <button id="close-user-search">Close</button>
                </div>
            `;
            document.body.appendChild(modal);

            // Close modal button
            modal.querySelector('#close-user-search').addEventListener('click', () => {
                this.closeUserSearchModal();
            });

            // Filter users as you type
            const searchInput = modal.querySelector('#user-search-input');
            searchInput.addEventListener('input', () => {
                const filter = searchInput.value.toLowerCase();
                const items = modal.querySelectorAll('.user-search-item');
                items.forEach(item => {
                    if (item.textContent.toLowerCase().includes(filter)) {
                        item.style.display = '';
                    } else {
                        item.style.display = 'none';
                    }
                });
            });

            // When a user is selected, start a conversation
            modal.querySelectorAll('.user-search-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    const userId = e.target.dataset.userId;
                    this.selectConversation(userId);
                    this.closeUserSearchModal();
                });
            });

        } catch (error) {
            console.error('Error fetching users:', error);
        }
    }

    closeUserSearchModal() {
        const modal = document.querySelector('.user-search-modal');
        if (modal) {
            modal.remove();
        }
    }

    async loadMessages(userId, page = 1) {
        if (this.isLoading) return;
        this.isLoading = true;

        try {
            const response = await fetch(`/api/messages/${userId}?page=${page}`);
            const newMessages = await response.json();
            
            // If we got fewer messages than expected, we've reached the end
            if (newMessages.length === 0) {
                this.hasMoreMessages = false;
            }
            
            let updatedMessages;
            if (page === 1) {
                // First page - just set the messages
                updatedMessages = newMessages;
            } else {
                // Additional pages - prepend to existing messages
                const existing = this.messageStore.messages.get(userId) || [];
                updatedMessages = [...newMessages, ...existing];
            }
            
            // Sort all messages by timestamp to ensure correct order
            updatedMessages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
            
            // Update the message store
            this.messageStore.setMessages(userId, updatedMessages);
            
            // Render the messages
            this.renderMessages(userId, page > 1);
            this.currentPage = page;
        } catch (error) {
            console.error('Error loading messages:', error);
        } finally {
            this.isLoading = false;
        }
    }

    renderMessages(userId, maintainScrollPosition = false) {
        const messagesList = document.querySelector('.messages-list');
        const messages = this.messageStore.messages.get(userId) || [];
        const currentUser = userStore.getCurrentUser();

        // Group messages by date for better visual separation
        const groupedMessages = this.groupMessagesByDate(messages);
        
        let messagesHtml = '';
        
        // Generate HTML for each date group
        Object.keys(groupedMessages).forEach(date => {
            messagesHtml += `<div class="message-date-separator">${date}</div>`;
            
            groupedMessages[date].forEach(msg => {
                // Check if this message is part of a sequence from the same sender
                const isContinuation = this.isMessageContinuation(msg, groupedMessages[date]);
                
                messagesHtml += `
                    <div class="message ${msg.sender_id === currentUser.id ? 'sent' : 'received'} ${isContinuation ? 'continuation' : ''}">
                        <div class="message-content">${msg.content}</div>
                        <div class="message-time">${formatTimestamp(msg.created_at, true)}</div>
                    </div>
                `;
            });
        });
        
        messagesList.innerHTML = messagesHtml;
        
        // Handle scroll position based on context
        if (maintainScrollPosition && this.scrollPositionToMaintain) {
            // When loading older messages, maintain scroll position
            const newScrollHeight = messagesList.scrollHeight;
            messagesList.scrollTop = newScrollHeight - this.scrollPositionToMaintain;
            this.scrollPositionToMaintain = null;
        } else {
            // For new messages or initial load, scroll to bottom
            messagesList.scrollTop = messagesList.scrollHeight;
        }
    }
    
    // Helper method to group messages by date
    groupMessagesByDate(messages) {
        const groups = {};
        
        messages.forEach(msg => {
            const date = new Date(msg.created_at).toLocaleDateString();
            if (!groups[date]) {
                groups[date] = [];
            }
            groups[date].push(msg);
        });
        
        return groups;
    }
    
    // Helper method to determine if a message is part of a sequence
    isMessageContinuation(message, messagesInGroup) {
        const messageIndex = messagesInGroup.findIndex(m => 
            m.id === message.id || m.temp_id === message.temp_id
        );
        
        if (messageIndex <= 0) return false;
        
        const previousMessage = messagesInGroup[messageIndex - 1];
        const timeDiff = new Date(message.created_at) - new Date(previousMessage.created_at);
        const isFromSameSender = message.sender_id === previousMessage.sender_id;
        
        // If less than 2 minutes between messages from same sender, consider it a continuation
        return isFromSameSender && timeDiff < 120000;
    }

    // Helper to find temporary message by ID
    findTempMessageIndex(conversationId, tempId) {
        if (!tempId) return -1;
        
        const messages = this.messageStore.messages.get(conversationId) || [];
        return messages.findIndex(msg => msg.temp_id === tempId);
    }

    setupEventListeners() {
        // Your existing method with a slight modification to the scroll handler
        const contactsList = document.querySelector('.contacts-list');
        const messageForm = document.querySelector('.message-input-form');
        const messagesList = document.querySelector('.messages-list');
        const messageInput = document.querySelector('.message-input');
        const newConversationBtn = document.querySelector('.new-conversation-btn');

        newConversationBtn.addEventListener('click', () => {
            this.showUserSearchModal();
        });

        // Auto-resize textarea
        messageInput.addEventListener('input', () => {
            messageInput.style.height = 'auto';
            messageInput.style.height = messageInput.scrollHeight + 'px';
        });

        // Handle enter key (send on Enter, new line on Shift+Enter)
        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        contactsList.addEventListener('click', (e) => {
            const contactItem = e.target.closest('.contact-item');
            if (contactItem) {
                const userId = contactItem.dataset.userId;
                this.selectConversation(userId);
            }
        });

        messageForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.sendMessage();
        });

        // Improved scroll handling - check if we're at the top
        messagesList.addEventListener('scroll', () => {
            // Consider "at top" when within 50px of the top
            if (messagesList.scrollTop <= 50 && 
                this.messageStore.currentConversation && 
                this.hasMoreMessages) {
                this.loadMoreThrottled(this.messageStore.currentConversation);
            }
        });
    }

    async sendMessage() {
        const input = document.querySelector('.message-input');
        const content = input.value.trim();
        if (!content || !this.messageStore.currentConversation) return;

        const receiverId = parseInt(this.messageStore.currentConversation);
        const currentUser = userStore.getCurrentUser();

        // Create a temporary ID for immediate feedback
        const tempId = 'temp-' + Date.now();
        
        const message = {
            type: 'message',
            content,
            receiver_id: receiverId,
            sender_id: currentUser.id,
            timestamp: new Date(),
            temp_id: tempId
        };

        try {
            // Use the WebSocket manager to send the message
            const sent = sendMessage(message);
            
            if (!sent) {
                alert('Could not connect to the messaging server. Please try again later.');
                return;
            }

            input.value = '';
            input.style.height = 'auto';

            // Add message to store immediately for instant feedback
            this.messageStore.addMessage(receiverId.toString(), {
                ...message,
                created_at: message.timestamp
            });
            this.renderMessages(receiverId.toString());

            // Update conversations list
            await this.loadConversations();
        } catch (error) {
            console.error('Error sending message:', error);
        }
    }

    // Handle incoming messages from the WebSocket
    async handleIncomingMessage(message) {
        if (message.type === 'message') {
            const conversationId = message.sender_id.toString();
            
            // Check if this is a confirmation of a message we sent (has a temp_id)
            const existingMessageIndex = this.findTempMessageIndex(conversationId, message.temp_id);
            
            if (existingMessageIndex >= 0) {
                // Update the temporary message with the confirmed one
                this.messageStore.updateMessage(conversationId, existingMessageIndex, {
                    ...message,
                    created_at: message.timestamp
                });
            } else {
                // This is a new message from someone else
                this.messageStore.addMessage(conversationId, {
                    ...message,
                    created_at: message.timestamp
                });
            }
            
            if (this.messageStore.currentConversation === conversationId) {
                this.renderMessages(conversationId);
            }
            
            // Refresh conversations list
            await this.loadConversations();
            
            // Show notification if not in current conversation
            if (this.messageStore.currentConversation !== conversationId) {
                initNotifications().newMessage({
                    sender: message.sender_name || 'Someone',
                    preview: message.content.substring(0, 50) + (message.content.length > 50 ? '...' : '')
                });
            }
        }
    }

    // Method to clean up when view is destroyed
    destroy() {
        // Unregister the message handler when the view is removed
        unregisterMessageHandler(this.messageHandler);
    }

    async selectConversation(userId) {
        // Get user info from API if not in conversations
        let selectedUser = this.messageStore.conversations.find(conv => conv.other_user_id.toString() === userId);
        
        if (!selectedUser) {
            try {
                const response = await fetch(`/api/users/${userId}`);
                const userData = await response.json();
                selectedUser = {
                    other_user_id: parseInt(userId),
                    username: userData.nickname,
                    is_online: userData.is_online || false,
                    last_seen: userData.last_seen || new Date()
                };
            } catch (error) {
                console.error('Error fetching user data:', error);
                return;
            }
        }

        // Update active contact
        const contacts = document.querySelectorAll('.contact-item');
        contacts.forEach(contact => {
            contact.classList.remove('active');
            if (contact.dataset.userId === userId) {
                contact.classList.add('active');
            }
        });

        // Update chat header
        const chatHeader = document.querySelector('.chat-header');
        chatHeader.innerHTML = `
            <div class="chat-user-info">
                <div class="chat-avatar">${selectedUser.username.charAt(0).toUpperCase()}</div>
                <div class="chat-user-details">
                    <div class="chat-username">${selectedUser.username}</div>
                    <div class="chat-status ${selectedUser.is_online ? 'online' : ''}">
                        ${selectedUser.is_online ? 'Online' : 'Last seen ' + formatTimestamp(selectedUser.last_seen)}
                    </div>
                </div>
            </div>
        `;

        // Show message input container
        const messageInputContainer = document.querySelector('.message-input-container');
        messageInputContainer.style.display = 'block';

        this.messageStore.currentConversation = userId;
        await this.loadMessages(userId);
    }
}