import messageStore from '../store/messageStore.js';
import { formatTimestamp } from '../utils/time.js';
import { throttle } from '../utils/throttle.js';

export class MessagesView {
    constructor() {
        this.currentPage = 1;
        this.isLoading = false;
        this.loadMoreThrottled = throttle(this.loadMoreMessages.bind(this), 1000);
        this.messageStore = messageStore;
        this.ws = null;
    }

    async loadMoreMessages(userId) {
        if (!userId || this.isLoading) return;
        
        const nextPage = this.currentPage + 1;
        await this.loadMessages(userId, nextPage);
    }

    async render() {
        const container = document.querySelector('.main-content');
        container.innerHTML = `
            <div class="messages-container">
                <div class="contacts-sidebar">
                    <div class="contacts-header">
                        <h2>Messages</h2>
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
        this.setupWebSocket();
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

            console.log('Response status:', response.status);
            const responseText = await response.text();
            console.log('Response text:', responseText);

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
            const messages = await response.json();
            
            if (page === 1) {
                this.messageStore.setMessages(userId, messages);
            } else {
                const existing = this.messageStore.messages.get(userId) || [];
                this.messageStore.setMessages(userId, [...messages, ...existing]);
            }
            
            this.renderMessages(userId);
            this.currentPage = page;
        } catch (error) {
            console.error('Error loading messages:', error);
        } finally {
            this.isLoading = false;
        }
    }

    renderMessages(userId) {
        const messagesList = document.querySelector('.messages-list');
        const messages = this.messageStore.messages.get(userId) || [];
        const currentUser = JSON.parse(localStorage.getItem('user'));

        messagesList.innerHTML = messages.map(msg => `
            <div class="message ${msg.sender_id === currentUser.id ? 'sent' : 'received'}">
                <div class="message-content">${msg.content}</div>
                <div class="message-time">${formatTimestamp(msg.created_at)}</div>
            </div>
        `).join('');

        messagesList.scrollTop = messagesList.scrollHeight;
    }

    setupEventListeners() {
        const contactsList = document.querySelector('.contacts-list');
        const messageForm = document.querySelector('.message-input-form');
        const messagesList = document.querySelector('.messages-list');
        const messageInput = document.querySelector('.message-input');

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

        messagesList.addEventListener('scroll', () => {
            if (messagesList.scrollTop === 0 && this.messageStore.currentConversation) {
                this.loadMoreThrottled(this.messageStore.currentConversation);
            }
        });
    }

    async sendMessage() {
        const input = document.querySelector('.message-input');
        const content = input.value.trim();
        if (!content || !this.messageStore.currentConversation) return;

        const receiverId = parseInt(this.messageStore.currentConversation);
        const currentUser = JSON.parse(localStorage.getItem('user'));

        const message = {
            type: 'message',
            content,
            receiver_id: receiverId,
            sender_id: currentUser.id,
            timestamp: new Date()
        };

        try {
            const ws = await this.getWebSocket();
            ws.send(JSON.stringify(message));
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

    async getWebSocket() {
        // Don't try to connect if user is not logged in
        const user = JSON.parse(localStorage.getItem('user'));
        if (!user) {
            return null;
        }

        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            try {
                this.ws = await this.setupWebSocket();
            } catch (error) {
                console.error('WebSocket connection failed:', error);
                return null;
            }
        }
        return this.ws;
    }

    // Add method to close WebSocket
    closeWebSocket() {
        if (this.ws) {
            this.ws.onclose = null; // Prevent reconnection attempt
            this.ws.close();
            this.ws = null;
        }
    }

    setupWebSocket() {
        const ws = new WebSocket(`ws://${window.location.host}/ws`);
        
        ws.onmessage = async (event) => {
            const message = JSON.parse(event.data);
            if (message.type === 'message') {
                const conversationId = message.sender_id.toString();
                this.messageStore.addMessage(conversationId, {
                    ...message,
                    created_at: message.timestamp
                });
                
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
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            // Only attempt to reconnect if user is logged in
            const user = JSON.parse(localStorage.getItem('user'));
            if (user) {
                setTimeout(() => this.setupWebSocket(), 5000); // Retry after 5 seconds
            }
        };

        ws.onclose = () => {
            // Only attempt to reconnect if user is logged in
            const user = JSON.parse(localStorage.getItem('user'));
            if (user) {
                setTimeout(() => this.setupWebSocket(), 5000); // Retry after 5 seconds
            }
        };

        this.ws = ws;
        return ws;
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
