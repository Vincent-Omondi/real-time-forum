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
} from '../store/websocketManager.js';

export class MessagesView {
    constructor() {
        this.currentPage = 1;
        this.isLoading = false;
        this.hasMoreMessages = true;
        this.loadMoreThrottled = throttle(this.loadMoreMessages.bind(this), 1000);
        this.messageStore = messageStore;
        this.messageHandler = this.handleIncomingMessage.bind(this);
        this.scrollPositionToMaintain = null;
        this.pendingConversation = null;
        
        // Make the selectConversation method accessible to other components
        // This is a workaround for component communication
        this._bindGlobalAccess();
        
        // Listen for the custom event for starting a new conversation
        document.addEventListener('startNewConversation', this._handleStartNewConversation.bind(this));
    }
    
    // Make the instance methods accessible for component communication
    _bindGlobalAccess() {
        // Store a reference to this instance in a globally accessible location
        if (!window._appComponentInstances) {
            window._appComponentInstances = {};
        }
        window._appComponentInstances.messagesView = this;
        
        // For backward compatibility, also expose the selectConversation method directly
        if (typeof window.selectConversation !== 'function') {
            window.selectConversation = this.selectConversation.bind(this);
        }
    }
    
    // Handler for the custom event
    _handleStartNewConversation(event) {
        if (event.detail && event.detail.userId) {
            this.selectConversation(event.detail.userId);
        }
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
                        <button class="new-conversation-btn">
                            <i class="fas fa-plus"></i>
                        </button>
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

        // Check if we need to open a specific conversation from sessionStorage
        this._checkPendingConversations();
    }
    
    // Check for pending conversation requests from sessionStorage
    _checkPendingConversations() {
        // First check the openConversationWith (from navigation)
        const openConversationWith = sessionStorage.getItem('openConversationWith');
        if (openConversationWith) {
            // Clear the stored user ID
            sessionStorage.removeItem('openConversationWith');
            
            // Open the conversation
            this.selectConversation(openConversationWith);
            return;
        }
        
        // Also check the startConversationWithUser (from our custom approach)
        const startWithUser = sessionStorage.getItem('startConversationWithUser');
        if (startWithUser) {
            // Clear the stored value
            sessionStorage.removeItem('startConversationWithUser');
            
            // Open the conversation
            this.selectConversation(startWithUser);
        }
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
        
        // Sort conversations by the timestamp of the last message (most recent first)
        const sortedConversations = [...this.messageStore.conversations].sort((a, b) => {
            // If no last_message_time, use last_seen as fallback
            const timeA = a.last_message_time ? new Date(a.last_message_time) : new Date(a.last_seen);
            const timeB = b.last_message_time ? new Date(b.last_message_time) : new Date(b.last_seen);
            // Sort in descending order (most recent first)
            return timeB - timeA;
        });
        
        if (sortedConversations.length === 0) {
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
            contactsList.innerHTML = sortedConversations.map(conv => {
                // Format the timestamp for display
                const timestamp = conv.last_message_time 
                    ? formatTimestamp(conv.last_message_time, false) 
                    : formatTimestamp(conv.last_seen, false);
                
                return `
                    <div class="contact-item" data-user-id="${conv.other_user_id}">
                        <div class="sidebar-user-avatar">
                            ${conv.username.charAt(0).toUpperCase()}
                            <span class="sidebar-status-indicator ${conv.is_online ? 'online' : 'offline'}"></span>
                        </div>
                        <div class="sidebar-user-info">
                            <div class="sidebar-header-row">
                                <span class="sidebar-user-name">${conv.username}</span>
                                <span class="sidebar-last-time">${timestamp}</span>
                            </div>
                            <div class="sidebar-last-message">${conv.last_message || 'No messages yet'}</div>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }

    async showUserSearchModal() {
        try {
            // Fetch registered users from a new endpoint, e.g., /api/users
            const response = await fetch('/api/users', { credentials: 'include' });
            if (!response.ok) throw new Error("Failed to fetch users");
            const data = await response.json();

            const currentUser = userStore.getCurrentUser();

            const users = data.users.filter(user => user.id !== currentUser.id);

            // Create a modal container
            const modal = document.createElement('div');
            modal.classList.add('user-search-modal');
            modal.innerHTML = `
                <div class="modal-overlay"></div>
                <div class="modal-content">
                    <h2>Select a user to chat with</h2>
                    <input type="text" id="user-search-input" placeholder="Search users..." />
                    <div id="user-search-results">
                        ${users.length > 0 ? 
                            users.map(user => `
                                <div class="user-search-item" data-user-id="${user.id}">
                                    ${user.nickname}
                                </div>
                            `).join('') :
                            '<div class = "no-users">No other users found</div>'
                        }                   
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
            // First, ensure we have complete current user data
            const currentUser = userStore.getCurrentUser();
            if (currentUser && !currentUser.nickname) {
                try {
                    const profileResponse = await fetch('/api/user/profile', {
                        method: 'GET',
                        credentials: 'include',
                        headers: {
                            'Accept': 'application/json'
                        }
                    });

                    if (profileResponse.ok) {
                        const userData = await profileResponse.json();
                        if (userData && userData.nickname) {
                            // Update the user store with complete user data
                            userStore.updateUser(currentUser.id, userData);
                        }
                    }
                } catch (profileError) {
                    console.error('Error fetching user profile:', profileError);
                }
            }

            const response = await fetch(`/api/messages/${userId}?page=${page}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const responseText = await response.text();
            if (!responseText) {
                // Handle empty response
                return [];
            }

            let newMessages;
            try {
                newMessages = JSON.parse(responseText);
                // If the response is an object with a messages property, extract it
                if (newMessages && typeof newMessages === 'object' && newMessages.messages) {
                    newMessages = newMessages.messages;
                }
                // Ensure newMessages is an array
                if (!Array.isArray(newMessages)) {
                    newMessages = [];
                }
            } catch (parseError) {
                console.error('Error parsing messages:', parseError);
                newMessages = [];
            }
            
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
            this.hasMoreMessages = false; // Prevent further loading attempts on error
            this.messageStore.setMessages(userId, []); // Set empty messages to prevent undefined errors
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
                const isCurrentUser = msg.sender_id === currentUser?.id;
                
                // Get the username for the message
                let username;
                if (isCurrentUser && currentUser) {
                    // Try to get the username from multiple possible sources
                    username = currentUser.nickname || 
                             currentUser.username || 
                             currentUser.name ||
                             `User ${currentUser.id}`;
                } else {
                    // For other users, first try to get from the message if it has sender info
                    username = msg.sender_nickname || msg.sender_username;
                    
                    // If not found in message, try to get from conversations
                    if (!username) {
                        const conversation = this.messageStore.conversations.find(conv => 
                            conv.other_user_id === msg.sender_id
                        );
                        username = conversation?.username || `User ${msg.sender_id}`;
                    }
                }
                
                messagesHtml += `
                    <div class="message ${isCurrentUser ? 'sent' : 'received'} ${isContinuation ? 'continuation' : ''}">
                        ${!isContinuation ? `<div class="message-username">${username}</div>` : ''}
                        <div class="message-content">${msg.content}</div>
                        <div class="message-info">
                            <span class="message-time">${formatTimestamp(msg.created_at, true)}</span>
                        </div>
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
    
        if (receiverId === currentUser.id) {
            alert('You cannot send messages to yourself.');
            return;
        }
    
        // Create a temporary ID for immediate feedback
        const tempId = 'temp-' + Date.now();
        const timestamp = new Date();
        
        const message = {
            type: 'message',
            content,
            receiver_id: receiverId,
            sender_id: currentUser.id,
            timestamp,
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
    
            // Check if this is a pending conversation that needs to be added to the list
            if (this.pendingConversation && this.pendingConversation.other_user_id.toString() === receiverId.toString()) {
                // Add the pending conversation to the conversations list with the message
                const newConversation = {
                    ...this.pendingConversation,
                    last_message: content.substring(0, 30) + (content.length > 30 ? '...' : ''),
                    last_message_time: timestamp
                };
                
                // Add to existing conversations
                const updatedConversations = [...this.messageStore.conversations, newConversation];
                
                // Clear the pending conversation
                this.pendingConversation = null;
                
                // Sort and update
                updatedConversations.sort((a, b) => {
                    const timeA = a.last_message_time ? new Date(a.last_message_time) : new Date(a.last_seen);
                    const timeB = b.last_message_time ? new Date(b.last_message_time) : new Date(b.last_seen);
                    return timeB - timeA;
                });
                
                this.messageStore.setConversations(updatedConversations);
                this.renderConversationList();
            } else {
                // Update existing conversation
                const updatedConversations = this.messageStore.conversations.map(conv => {
                    if (conv.other_user_id.toString() === receiverId.toString()) {
                        return {
                            ...conv,
                            last_message: content.substring(0, 30) + (content.length > 30 ? '...' : ''),
                            last_message_time: timestamp
                        };
                    }
                    return conv;
                });
                
                // Sort conversations by timestamp (most recent first)
                updatedConversations.sort((a, b) => {
                    const timeA = a.last_message_time ? new Date(a.last_message_time) : new Date(a.last_seen);
                    const timeB = b.last_message_time ? new Date(b.last_message_time) : new Date(b.last_seen);
                    return timeB - timeA;
                });
                
                this.messageStore.setConversations(updatedConversations);
                this.renderConversationList();
            }
        } catch (error) {
            console.error('Error sending message:', error);
        }
    }
    // Handle incoming messages from the WebSocket
    async handleIncomingMessage(message) {
        // First, check the message type
        if (message.type === 'message') {
            // Handle regular chat messages
            const conversationId = message.sender_id.toString();
            
            // Check if this is a confirmation of a message we sent (has a temp_id)
            if (message.temp_id) {
                const existingMessageIndex = this.findTempMessageIndex(conversationId, message.temp_id);
                
                if (existingMessageIndex >= 0) {
                    // Update the temporary message with the confirmed one
                    const messages = this.messageStore.messages.get(conversationId) || [];
                    messages[existingMessageIndex] = {
                        ...message,
                        created_at: message.timestamp
                    };
                    this.messageStore.setMessages(conversationId, messages);
                } else {
                    // This is a new message
                    this.messageStore.addMessage(conversationId, {
                        ...message,
                        created_at: message.timestamp
                    });
                }
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
            
            // Update the conversation with the latest message
            const conversations = this.messageStore.conversations;
            const conversationExists = conversations.some(conv => 
                conv.other_user_id.toString() === (message.sender_id === userStore.getCurrentUser().id ? 
                    message.receiver_id.toString() : message.sender_id.toString())
            );
            
            if (conversationExists) {
                const updatedConversations = conversations.map(conv => {
                    // For messages we send, we need to check by receiver_id
                    // For messages we receive, we check by sender_id
                    const isTargetConversation = message.sender_id === userStore.getCurrentUser().id ?
                        conv.other_user_id.toString() === message.receiver_id.toString() :
                        conv.other_user_id.toString() === message.sender_id.toString();
                    
                    if (isTargetConversation) {
                        return {
                            ...conv,
                            last_message: message.content.substring(0, 30) + (message.content.length > 30 ? '...' : ''),
                            last_message_time: message.timestamp
                        };
                    }
                    return conv;
                });
                
                // Sort conversations by timestamp (most recent first)
                updatedConversations.sort((a, b) => {
                    const timeA = a.last_message_time ? new Date(a.last_message_time) : new Date(a.last_seen);
                    const timeB = b.last_message_time ? new Date(b.last_message_time) : new Date(b.last_seen);
                    return timeB - timeA;
                });
                
                this.messageStore.setConversations(updatedConversations);
                this.renderConversationList();
            } else {
                // If the conversation doesn't exist in our list, refresh the list from server
                await this.loadConversations();
            }
            
            const currentUser = userStore.getCurrentUser();
            // Only show notification if you're NOT the sender AND you're not currently viewing that conversation
            if (message.sender_id !== currentUser.id && this.messageStore.currentConversation !== conversationId) {
                // Notification handling is now done globally in app.js
                // No need to show notification here as it will be handled there
            }
        }
        else if (message.type === 'status_update') {
            // Handle status update
            const userId = message.user_id.toString();
            console.log("Received status update for user:", userId, "Online:", message.is_online);
            
            // Update conversations list to reflect the new status
            const conversations = this.messageStore.conversations;
            const conversationExists = conversations.some(conv => conv.other_user_id.toString() === userId);
            
            // Update existing conversations
            if (conversationExists) {
                const updatedConversations = conversations.map(conv => {
                    if (conv.other_user_id.toString() === userId) {
                        return {
                            ...conv,
                            is_online: message.is_online,
                            last_seen: message.last_seen
                        };
                    }
                    return conv;
                });
                
                this.messageStore.setConversations(updatedConversations);
                this.renderConversationList();
            }
            
            // If this user is currently in an active conversation, update the header
            if (this.messageStore.currentConversation === userId) {
                const chatHeader = document.querySelector('.chat-header');
                if (chatHeader) {
                    const statusElement = chatHeader.querySelector('.chat-status');
                    if (statusElement) {
                        statusElement.className = `chat-status ${message.is_online ? 'online' : ''}`;
                        statusElement.textContent = message.is_online ? 
                            'Online' : 
                            'Last seen ' + formatTimestamp(message.last_seen);
                    }
                }
            }
        }
        else if (message.type === 'heartbeat_ack') {
            // Just log it or use for connection monitoring
            console.log("Heartbeat acknowledged");
        }
    }

    // Method to clean up when view is destroyed
    destroy() {
        // Unregister the message handler when the view is removed
        unregisterMessageHandler(this.messageHandler);
    }

// Add this property to the MessagesView class constructor

    // Updated selectConversation method
    async selectConversation(userId) {
        const currentUser = userStore.getCurrentUser();

        if (userId === currentUser.id) {
            return;
        }
        
        // Get user info from API if not in conversations
        let selectedUser = this.messageStore.conversations.find(conv => conv.other_user_id.toString() === userId);
        
        if (!selectedUser) {
            try {
                const response = await fetch(`/api/users/${userId}`);
                const userData = await response.json();
                
                // Create the user object but DON'T add to conversations list yet
                selectedUser = {
                    other_user_id: parseInt(userId),
                    username: userData.nickname,
                    is_online: userData.is_online || false,
                    last_seen: userData.last_seen || new Date(),
                    last_message: 'No messages yet'
                };
                
                // Store as pending conversation instead of adding to contact list
                this.pendingConversation = selectedUser;
                
                // No need to update the conversations list or re-render
            } catch (error) {
                console.error('Error fetching user data:', error);
                return;
            }
        }

        // Update active contact - only for existing conversations
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