let notificationInstance = null;

export function initNotifications() {
    if (notificationInstance) {
        return notificationInstance;
    }

    notificationInstance = {
        container: createNotificationContainer(),
        notifications: [],
        
        newMessage(data) {
            this.show(`New message from ${data.sender}`);
        },
        
        newNotification(data) {
            this.show(data.message);
        },
        
        show(message) {
            const notification = createNotification(message);
            this.container.appendChild(notification);
            this.notifications.push(notification);
            
            // Auto remove after 10 seconds
            setTimeout(() => {
                this.remove(notification);
            }, 10000);
        },
        
        remove(notification) {
            if (notification && notification.parentElement) {
                notification.remove();
                this.notifications = this.notifications.filter(n => n !== notification);
            }
        }
    };

    return notificationInstance;
}

function createNotificationContainer() {
    let container = document.getElementById('notification-container');
    
    if (!container) {
        container = document.createElement('div');
        container.id = 'notification-container';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 1000;
        `;
        document.body.appendChild(container);
    }
    
    return container;
}

function createNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.style.cssText = `
        background-color: var(--bg-secondary);
        color: var(--text-primary);
        padding: 15px 20px;
        margin-bottom: 12px;
        border-radius: 8px;
        box-shadow: 0 4px 10px rgba(0,0,0,0.3);
        animation: slideIn 0.4s ease-out;
        cursor: pointer;
        border-left: 4px solid var(--accent-color);
        max-width: 320px;
        min-width: 250px;
        display: flex;
        justify-content: space-between;
        align-items: center;
    `;
    
    notification.innerHTML = `
        <div class="notification-content">
            ${message}
        </div>
        <button class="notification-close">&times;</button>
    `;
    
    // Add click to navigate to messages if it's a message notification
    if (message.startsWith('New message from')) {
        notification.addEventListener('click', (e) => {
            // Don't navigate if clicking the close button
            if (!e.target.closest('.notification-close')) {
                notificationInstance.remove(notification);
                
                // Navigate to messages page
                if (window.router) {
                    window.router.navigateTo('/messages');
                } else {
                    window.location.href = '/messages';
                }
            }
        });
    }
    
    // Add close button functionality
    const closeButton = notification.querySelector('.notification-close');
    closeButton.style.cssText = `
        background: none;
        border: none;
        color: var(--text-primary);
        font-size: 22px;
        cursor: pointer;
        margin-left: 12px;
        transition: color 0.2s;
        font-weight: bold;
        line-height: 1;
        padding: 0 5px;
    `;
    
    closeButton.addEventListener('mouseover', () => {
        closeButton.style.color = 'var(--accent-color)';
    });
    
    closeButton.addEventListener('mouseout', () => {
        closeButton.style.color = 'var(--text-primary)';
    });
    
    closeButton.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent notification click handler from firing
        notificationInstance.remove(notification);
    });
    
    return notification;
}

// Add CSS animation
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    .notification {
        transition: all 0.3s ease-out;
    }
    
    .notification:hover {
        transform: translateX(-5px);
        box-shadow: 0 6px 14px rgba(0,0,0,0.4);
        border-left: 4px solid var(--upvote-color);
    }
`;
document.head.appendChild(style); 