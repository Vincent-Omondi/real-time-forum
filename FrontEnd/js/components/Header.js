// Header.js - Improved message badge handling

import messageStore from '../store/messageStore.js';
import { getWebSocket } from '../store/websocketManager.js';

export class Header {
    constructor() {
        this.element = document.createElement('header');
        this.element.className = 'header';
        this.unreadCount = 0;
        this.unreadSubscription = null;
    }

    render() {
        this.element.innerHTML = `
            <a href="/" class="logo-link">
                <div class="logo">
                    <i class="fas fa-comments"></i>
                    <span>Forum</span>
                </div>
            </a>
            <div class="hamburger-menu">
                <i class="fas fa-bars"></i>
            </div>
            <div class="search-bar-container">
                <div class="search-bar">
                    <input type="text" class="search-input" placeholder="Search...">
                </div>
            </div>
            <div class="nav-actions">
                <a href="/create" data-link class="button-post">
                    <i class="fas fa-plus"></i>
                    <span class="button-text">New Post</span>
                </a>
            </div>
            <a href="/messages" class="nav-link message-link" data-link>
                <div class="message-icon-wrapper">
                    <i class="fas fa-envelope"></i>
                    <span class="message-badge hidden">0</span>
                </div>
            </a>
            <div id="userSection" class="profile-section">
                <!-- User section will be dynamically populated -->
            </div>
        `;
        
        // Add styles for the message badge
        this._addMessageBadgeStyles();
        
        // Initialize message badge counter
        this._initMessageBadge();
        
        return this.element;
    }
    
    _addMessageBadgeStyles() {
        const styleId = 'message-badge-styles';
        // Only add styles if they don't already exist
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
                .message-icon-wrapper {
                    position: relative;
                    display: inline-block;
                }
                
                .message-badge {
                    position: absolute;
                    top: -8px;
                    right: -8px;
                    background-color: #e74c3c;
                    color: white;
                    border-radius: 50%;
                    font-size: 12px;
                    width: 18px;
                    height: 18px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: bold;
                }
                
                .message-badge.hidden {
                    display: none;
                }
                
                .message-badge.bounce {
                    animation: badge-bounce 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                }
                
                @keyframes badge-bounce {
                    0%, 20%, 50%, 80%, 100% {
                        transform: translateY(0);
                    }
                    40% {
                        transform: translateY(-5px);
                    }
                    60% {
                        transform: translateY(-2px);
                    }
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    _initMessageBadge() {
        // Update badge with current count immediately
        this.updateMessageBadge(messageStore.getTotalUnreadCount());
        
        // Unsubscribe from any previous subscription to avoid duplicates
        if (this.unreadSubscription) {
            this.unreadSubscription();
            this.unreadSubscription = null;
        }
        
        // Subscribe to changes in unread count
        this.unreadSubscription = messageStore.subscribeToUnreadCount((count) => {
            this.updateMessageBadge(count);
        });
        
        // Fetch initial counts from server if user is authenticated
        this._fetchInitialUnreadCounts();
    }
    
    _fetchInitialUnreadCounts() {
        // Only fetch if user is authenticated
        const csrfToken = localStorage.getItem('csrfToken') || 
                         document.querySelector('meta[name="csrf-token"]')?.content || '';
        
        fetch('/api/messages/unread-count', {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            credentials: 'include'
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch unread counts');
            }
            return response.json();
        })
        .then(data => {
            // Update message store with initial counts
            if (data && data.by_sender) {
                for (const [senderId, count] of Object.entries(data.by_sender)) {
                    if (count > 0) {
                        messageStore.unreadMessages.set(senderId, count);
                    }
                }
                
                // Notify subscribers of updated counts
                messageStore.notifyUnreadCountSubscribers();
            }
        })
        .catch(error => {
            console.error('Error fetching unread message counts:', error);
        });
    }
    
    updateMessageBadge(count) {
        const badge = this.element.querySelector('.message-badge');
        if (!badge) return;
        
        const hadCount = this.unreadCount > 0;
        const hasNewCount = count > 0;
        this.unreadCount = count;
        
        if (count > 0) {
            badge.textContent = count > 99 ? '99+' : count;
            badge.classList.remove('hidden');
            
            // Add animation if count increased
            if (!hadCount || hasNewCount) {
                badge.classList.remove('bounce');
                // Force reflow to restart animation
                void badge.offsetWidth;
                badge.classList.add('bounce');
            }
        } else {
            badge.textContent = '0';
            badge.classList.add('hidden');
        }
    }
    
    // Cleanup method to remove subscriptions
    destroy() {
        if (this.unreadSubscription) {
            this.unreadSubscription();
            this.unreadSubscription = null;
        }
    }
}