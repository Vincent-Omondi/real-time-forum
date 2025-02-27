import messageStore from '../store/messageStore.js';

export class Header {
    constructor() {
        this.element = document.createElement('header');
        this.element.className = 'header';
        this.messageStore = messageStore;
        this.unsubscribe = messageStore.subscribe(() => this.updateUnreadCount());
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
            <div class="messages-icon">
                <a href="/messages" data-link>
                    <i class="fas fa-envelope"></i>
                    <span class="message-count"></span>
                </a>
            </div>
            <div id="userSection" class="profile-section">
                <!-- User section will be dynamically populated -->
            </div>
        `;

        // Update count after the element is created
        this.updateUnreadCount();
        return this.element;
    }

    updateUnreadCount() {
        const badge = document.querySelector('.messages-badge');
        const count = messageStore.getTotalUnreadCount();
        
        if (count > 0) {
            if (!badge) {
                const newBadge = document.createElement('span');
                newBadge.className = 'messages-badge';
                newBadge.textContent = count;
                document.querySelector('.messages-icon').appendChild(newBadge);
            } else {
                badge.textContent = count;
            }
        } else if (badge) {
            badge.remove();
        }
    }

    destroy() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }
    }
} 