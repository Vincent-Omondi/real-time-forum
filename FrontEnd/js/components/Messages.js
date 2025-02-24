import messageStore from '../store/messageStore.js';
import { formatTimestamp } from '../utils/time.js';
import { throttle } from '../utils/throttle.js';

export class MessagesView {
    constructor() {
        this.currentPage = 1;
        this.isLoading = false;
        this.loadMoreThrottled = throttle(this.loadMoreMessages.bind(this), 1000);
        this.messageStore = messageStore;
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
            // Get CSRF token
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

            // Log response for debugging
            console.log('Response status:', response.status);
            const responseText = await response.text();
            console.log('Response text:', responseText);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Parse the response text
            const data = responseText ? JSON.parse(responseText) : { conversations: [] };
            
            if (data.error) {
                throw new Error(data.error);
            }

            const conversations = data.conversations || [];
            this.messageStore.setConversations(conversations);
            this.renderConversationList();
        } catch (error) {
            console.error('Error loading conversations:', error);
            // Check if we need to redirect to login
            if (error.message.includes('Unauthorized')) {
                window.location.href = '/login';
                return;
            }
            // Set empty conversations array on error
            this.messageStore.setConversations([]);
            this.renderConversationList();
        }
    }

    renderConversationList() {
        const contactsList = document.querySelector('.contacts-list');
        const conversations = this.messageStore.conversations;
        
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

        const message = {
            type: 'message',
            content,
            receiver_id: parseInt(this.messageStore.currentConversation),
            timestamp: new Date()
        };

        try {
            const ws = await this.getWebSocket();
            ws.send(JSON.stringify(message));
            input.value = '';
        } catch (error) {
            console.error('Error sending message:', error);
        }
    }

    setupWebSocket() {
        const ws = new WebSocket(`ws://${window.location.host}/ws`);
        
        ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            if (message.type === 'message') {
                this.messageStore.addMessage(message.sender_id, message);
                this.renderMessages(message.sender_id);
                this.loadConversations(); // Refresh conversation list
            }
        };

        this.ws = ws;
    }

    getWebSocket() {
        return new Promise((resolve, reject) => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                resolve(this.ws);
            } else {
                this.setupWebSocket();
                this.ws.onopen = () => resolve(this.ws);
                this.ws.onerror = (error) => reject(error);
            }
        });
    }

    selectConversation(userId) {
        const contacts = document.querySelectorAll('.contact-item');
        contacts.forEach(contact => {
            contact.classList.remove('active');
            if (contact.dataset.userId === userId) {
                contact.classList.add('active');
            }
        });

        this.messageStore.currentConversation = userId;
        this.loadMessages(userId);
    }
} 