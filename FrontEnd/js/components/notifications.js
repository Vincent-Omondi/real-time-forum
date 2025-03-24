let notificationInstance = null;

export function initNotifications() {
    if (notificationInstance) {
        return notificationInstance;
    }

    notificationInstance = {
        container: createNotificationContainer(),
        notifications: [],
        
        newMessage(data) {
            const message = `New message from ${data.sender}${data.preview ? ': ' + data.preview : ''}`;
            this.show(message, 'message', data.userId);
        },
        
        newNotification(data) {
            this.show(data.message, 'general');
        },
        
        show(message, type = 'general', userId = null) {
            const notification = createNotification(message, type, userId);
            this.container.appendChild(notification);
            this.notifications.push(notification);
            
            // Auto remove after 5 seconds
            setTimeout(() => {
                this.remove(notification);
            }, 5000);
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

function createNotification(message, type, userId) {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.dataset.type = type;
    
    if (userId) {
        notification.dataset.userId = userId;
    }
    
    // Add a pointer cursor for clickable notifications
    const cursor = type === 'message' ? 'pointer' : 'default';
    
    notification.style.cssText = `
        background-color: #333;
        color: white;
        padding: 15px 20px;
        margin-bottom: 10px;
        border-radius: 4px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        animation: slideIn 0.3s ease-out;
        cursor: ${cursor};
    `;
    
    notification.innerHTML = `
        <div class="notification-content">
            ${message}
        </div>
        <button class="notification-close">&times;</button>
    `;
    
    // Add close button functionality
    const closeButton = notification.querySelector('.notification-close');
    closeButton.style.cssText = `
        background: none;
        border: none;
        color: white;
        float: right;
        cursor: pointer;
        font-size: 20px;
        margin-left: 10px;
    `;
    
    closeButton.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent notification click
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
        transition: transform 0.3s ease-out;
    }
    
    .notification:hover {
        transform: translateX(-5px);
    }
    
    .notification-message {
        background-color: #2b5797;
    }
`;
document.head.appendChild(style);