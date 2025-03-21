import userStore from '../store/userStore.js';
import messageStore from '../store/messageStore.js';
import { formatTimestamp } from '../utils/time.js';
import { 
    getWebSocket, 
    closeWebSocket, 
    registerMessageHandler, 
    unregisterMessageHandler,
    sendMessage
} from '../store/websocketManager.js';

export class RightSidebar {
    constructor() {
        this.element = document.createElement('div');
        this.element.className = 'right-sidebar';
        this.messageHandler = this.handleIncomingMessage.bind(this);
        this.currentUser = null;
        this.conversations = [];
        this.users = [];
    }

    async init() {
        // Register message handler for WebSocket updates
        registerMessageHandler(this.messageHandler);
        
        // Get current user info
        this.currentUser = userStore.getCurrentUser();
        
        // Fetch all users and conversations
        await this.fetchUsers();
        await this.fetchConversations();
        
        // Render the sidebar content
        this.render();
        
        // Setup event listeners
        this.setupEventListeners();
    }

    async fetchUsers() {
        try {
            const response = await fetch('/api/users', { 
                credentials: 'include',
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`Failed to fetch users: ${response.status}`);
            }
            
            const data = await response.json();
            // Filter out the current user
            this.users = data.users.filter(user => user.id !== this.currentUser.id);
            
            // Sort users alphabetically by default
            this.users.sort((a, b) => a.nickname.localeCompare(b.nickname));
            
        } catch (error) {
            console.error('Error fetching users:', error);
            this.users = [];
        }
    }

    async fetchConversations() {
        try {
            const response = await fetch('/api/messages/conversations', {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.content || ''
                }
            });
            
            if (!response.ok) {
                throw new Error(`Failed to fetch conversations: ${response.status}`);
            }
            
            const data = await response.json();
            this.conversations = data.conversations || [];
            
            // Update the messageStore with the conversations
            messageStore.setConversations(this.conversations);
            
        } catch (error) {
            console.error('Error fetching conversations:', error);
            this.conversations = [];
        }
    }

    render() {
        this.element.innerHTML = '';
        
        // Create main container with sidebar-section class
        const container = document.createElement('div');
        container.className = 'sidebar-section';
        
        // Header section
        const header = document.createElement('div');
        header.innerHTML = `
            <h3 class="sidebar-title">Users</h3>
            <div class="user-filter">
                <input type="text" placeholder="Search users..." class="sidebar-search">
                <div class="sidebar-filter-buttons">
                    <button class="sidebar-filter-btn active" data-filter="all">All</button>
                    <button class="sidebar-filter-btn" data-filter="online">Online</button>
                </div>
            </div>
        `;
        
        // User list
        const userList = document.createElement('ul');
        userList.className = 'sidebar-list';
        
        const combinedUsers = this.getCombinedUsersList();
        
        userList.innerHTML = combinedUsers.map(user => {
            const unreadCount = this.getUnreadMessageCount(user.id);
            const unreadBadge = unreadCount > 0 ? 
                `<span class="sidebar-unread-badge">${unreadCount}</span>` : '';
                
            return `
                <li class="sidebar-item" data-user-id="${user.id}">
                    <a href="#" class="sidebar-link">
                        <div class="sidebar-user-avatar">
                            ${user.nickname.charAt(0).toUpperCase()}
                            <span class="sidebar-status-indicator ${user.is_online ? 'online' : 'offline'}"></span>
                        </div>
                        <div class="sidebar-user-info">
                            <div class="sidebar-user-name">${user.nickname}</div>
                        </div>
                        ${unreadBadge}
                    </a>
                </li>
            `;
        }).join('');
        
        container.appendChild(header);
        container.appendChild(userList);
        this.element.appendChild(container);
        
        // Add responsive styles based on window width
        this.applyResponsiveStyles();
        
        return this.element;
    }
    
    getCombinedUsersList() {
        // Start with conversations (these have last messages and will be shown first)
        const usersWithConversations = this.conversations.map(conv => {
            // Find the corresponding user in our users list to get all user data
            const user = this.users.find(u => u.id === parseInt(conv.other_user_id)) || {};
            
            return {
                id: parseInt(conv.other_user_id),
                nickname: conv.username,
                is_online: conv.is_online,
                last_seen: conv.last_seen,
                last_message: conv.last_message,
                last_message_time: conv.last_message_time,
                has_messages: true // Add flag to indicate this user has messages
            };
        });
        
        // Get IDs of users we already have conversations with
        const conversationUserIds = usersWithConversations.map(u => u.id);
        
        // Add users without conversations (these will be shown in alphabetical order)
        const usersWithoutConversations = this.users
            .filter(user => !conversationUserIds.includes(user.id))
            .map(user => ({
                id: user.id,
                nickname: user.nickname,
                is_online: user.is_online || false,
                last_seen: user.last_seen || new Date(),
                last_message: null,
                last_message_time: null,
                has_messages: false // Add flag to indicate this user has no messages
            }));
        
        // Sort users with conversations by most recent message time
        usersWithConversations.sort((a, b) => {
            return new Date(b.last_message_time || 0) - new Date(a.last_message_time || 0);
        });
        
        // Sort users without conversations alphabetically
        usersWithoutConversations.sort((a, b) => {
            return a.nickname.localeCompare(b.nickname);
        });
        
        // First show all users with conversations, then users without conversations
        return [...usersWithConversations, ...usersWithoutConversations];
    }
    
    getUnreadMessageCount(userId) {
        // This function would need to be implemented if you have unread message tracking
        // For now, returning 0 (no unread messages)
        return 0;
    }
    
    setupEventListeners() {
        // User item click event
        this.element.addEventListener('click', (e) => {
            const listItem = e.target.closest('.sidebar-item');
            if (listItem) {
                e.preventDefault();
                const userId = listItem.dataset.userId;
                this.startConversation(userId);
            }
        });

        // Search functionality
        const searchInput = this.element.querySelector('.sidebar-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const searchTerm = e.target.value.toLowerCase();
                const items = this.element.querySelectorAll('.sidebar-item');
                
                items.forEach(item => {
                    const userName = item.querySelector('.sidebar-user-name').textContent.toLowerCase();
                    item.style.display = userName.includes(searchTerm) ? '' : 'none';
                });
            });
        }

        // Filter buttons
        const filterButtons = this.element.querySelectorAll('.sidebar-filter-btn');
        filterButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Update active state on buttons
                filterButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                const filter = btn.dataset.filter;
                const items = this.element.querySelectorAll('.sidebar-item');
                
                items.forEach(item => {
                    const isOnline = item.querySelector('.sidebar-status-indicator').classList.contains('online');
                    item.style.display = (filter === 'all' || (filter === 'online' && isOnline)) ? '' : 'none';
                });
            });
        });
        
        // Listen for window resize events to apply responsive styles
        window.addEventListener('resize', this.applyResponsiveStyles.bind(this));
    }
    
    applyResponsiveStyles() {
        const width = window.innerWidth;
        const headerHeight = document.querySelector('.header')?.offsetHeight || 60;
        
        // Set CSS variable for header height
        document.documentElement.style.setProperty('--header-height', `${headerHeight}px`);
        
        if (width <= 992) {
            // Mobile view
            this.element.style.position = 'static';
            this.element.style.width = '100%';
            this.element.style.height = 'auto';
            this.element.style.borderLeft = 'none';
            this.element.style.borderTop = '1px solid var(--border-color)';
            this.element.style.top = 'auto';
        } else if (width <= 1200) {
            // Tablet view
            this.element.style.position = 'fixed';
            this.element.style.width = '240px';
            this.element.style.height = `calc(100vh - ${headerHeight}px)`;
            this.element.style.top = `${headerHeight}px`;
            this.element.style.padding = '15px 10px';
            this.element.style.borderLeft = '1px solid var(--border-color)';
            this.element.style.borderTop = 'none';
        } else {
            // Desktop view
            this.element.style.position = 'fixed';
            this.element.style.width = '280px';
            this.element.style.height = `calc(100vh - ${headerHeight}px)`;
            this.element.style.top = `${headerHeight}px`;
            this.element.style.padding = '20px 15px';
            this.element.style.borderLeft = '1px solid var(--border-color)';
            this.element.style.borderTop = 'none';
        }
    }
    
    startConversation(userId) {
        // If we're on the messages page, handle conversation selection
        if (window.location.pathname === '/messages') {
            const messagesContainer = document.querySelector('.messages-container');
            if (messagesContainer) {
                // First approach: Find the contact item with this user ID and click it
                const contactItem = messagesContainer.querySelector(`.contact-item[data-user-id="${userId}"]`);
                if (contactItem) {
                    contactItem.click();
                    return;
                }
                
                // Second approach: Try to access the MessagesView instance directly
                const messagesView = this.findMessagesViewInstance();
                if (messagesView && typeof messagesView.selectConversation === 'function') {
                    messagesView.selectConversation(userId);
                    return;
                }
                
                // Third approach: If the new conversation button exists, click it and then select the user
                const newConversationBtn = messagesContainer.querySelector('.new-conversation-btn');
                if (newConversationBtn) {
                    // Click the button to open the user search modal
                    newConversationBtn.click();
                    
                    // Wait for modal to appear and then click on the user
                    setTimeout(() => {
                        const userSearchModal = document.querySelector('.user-search-modal');
                        if (userSearchModal) {
                            const userItem = userSearchModal.querySelector(`.user-search-item[data-user-id="${userId}"]`);
                            if (userItem) {
                                userItem.click();
                            } else {
                                // If user not found in the modal, close it and try another approach
                                const closeButton = userSearchModal.querySelector('#close-user-search');
                                if (closeButton) {
                                    closeButton.click();
                                }
                                this.triggerNewConversation(userId);
                            }
                        } else {
                            // If modal didn't appear, try custom event approach
                            this.triggerNewConversation(userId);
                        }
                    }, 100);
                    return;
                }
                
                // Fourth approach: As a last resort, try custom event
                this.triggerNewConversation(userId);
                return;
            }
        }
        
        // If not on messages page, navigate to it
        // Store the user ID in sessionStorage to use it after navigation
        sessionStorage.setItem('openConversationWith', userId);
        if (window.router) {
            window.router.navigateTo('/messages');
        } else {
            window.location.href = '/messages';
        }
    }
    
    // Helper method to find the MessagesView instance
    findMessagesViewInstance() {
        // Check if it's directly accessible in the window object
        for (const key in window) {
            if (window[key] && typeof window[key].selectConversation === 'function') {
                return window[key];
            }
        }
        
        // Try to find it through DOM searching
        const app = document.querySelector('#app');
        if (app && app.__vue__) {
            // If using Vue, try to find the component
            return this.findVueComponent(app.__vue__, 'MessagesView');
        }
        
        return null;
    }
    
    // Helper to find Vue component (if using Vue)
    findVueComponent(instance, name) {
        if (instance.$options && instance.$options.name === name) {
            return instance;
        }
        
        if (instance.$children) {
            for (const child of instance.$children) {
                const found = this.findVueComponent(child, name);
                if (found) return found;
            }
        }
        
        return null;
    }
    
    // Create a custom event to initiate a new conversation
    triggerNewConversation(userId) {
        // Create and dispatch a custom event for initiating a conversation
        const event = new CustomEvent('startNewConversation', {
            detail: { userId: userId },
            bubbles: true
        });
        document.dispatchEvent(event);
        
        // Also store in sessionStorage as a fallback mechanism
        sessionStorage.setItem('startConversationWithUser', userId);
    }
    
    handleIncomingMessage(message) {
        // Handle new messages and status updates
        if (message.type === 'message') {
            // Refresh conversations and re-render for new messages
            this.fetchConversations().then(() => {
                this.render();
            });
        } 
        else if (message.type === 'status_update') {
            const userId = message.user_id.toString();
            
            // Update user status in the users array
            this.users = this.users.map(user => {
                if (user.id.toString() === userId) {
                    return {
                        ...user,
                        is_online: message.is_online,
                        last_seen: message.last_seen
                    };
                }
                return user;
            });
            
            // Also update in conversations list if the user exists there
            this.conversations = this.conversations.map(conv => {
                if (conv.other_user_id.toString() === userId) {
                    return {
                        ...conv,
                        is_online: message.is_online,
                        last_seen: message.last_seen
                    };
                }
                return conv;
            });
            
            // Update the messageStore with the updated conversations
            messageStore.setConversations(this.conversations);
            
            // Re-render to reflect status changes
            this.render();
        }
    }
    
    destroy() {
        // Clean up event listeners
        window.removeEventListener('resize', this.applyResponsiveStyles.bind(this));
        
        // Unregister message handler when component is destroyed
        unregisterMessageHandler(this.messageHandler);
    }
}