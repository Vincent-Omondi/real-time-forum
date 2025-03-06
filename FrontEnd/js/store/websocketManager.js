// websocketManager.js

import userStore from './userStore.js';

// Single WebSocket instance
let websocket = null;
let reconnectTimeout = null;
let messageHandlers = [];
let notificationHandlers = [];
let heartbeatInterval = null;

/**
 * Get the existing WebSocket or create a new one if needed
 * @returns {WebSocket} The WebSocket instance
 */
export function getWebSocket() {
    if (!websocket || websocket.readyState !== WebSocket.OPEN) {
        websocket = createWebSocket();
    }
    return websocket;
}

/**
 * Create a new WebSocket with authentication
 * @returns {WebSocket} A new WebSocket instance
 */
function createWebSocket() {
    // Clear any pending reconnect
    if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
    }

    // Clear any existing heartbeat
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }

    // Get authentication token
    const token = localStorage.getItem('csrfToken') || 
                 document.querySelector('meta[name="csrf-token"]')?.content || '';
    
    // Create WebSocket with auth token in URL
    const ws = new WebSocket(`ws://${window.location.host}/ws?token=${encodeURIComponent(token)}`);
    
    ws.onopen = () => {
        console.log("WebSocket connected");
        
        // Set up regular heartbeat to keep connection alive and status updated
        heartbeatInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
                // Send a status ping to the server
                ws.send(JSON.stringify({
                    type: 'heartbeat',
                    timestamp: new Date()
                }));
            }
        }, 30000); // Send heartbeat every 30 seconds
    };
    
    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            
            // Route messages to appropriate handlers
            switch (data.type) {
                case 'message':
                    messageHandlers.forEach(handler => handler(data));
                    break;
                case 'notification':
                    notificationHandlers.forEach(handler => handler(data));
                    break;
                case 'status_update':
                    // Forward status updates to message handlers as they handle UI updates
                    messageHandlers.forEach(handler => handler(data));
                    break;
                default:
                    console.log("Unhandled WebSocket message type:", data.type);
            }
        } catch (error) {
            console.error("Error handling WebSocket message:", error);
        }
    };
    
    ws.onerror = (error) => {
        console.error("WebSocket Error:", error);
    };
    
    ws.onclose = (event) => {
        console.warn("WebSocket closed:", event);
        websocket = null;
        
        // Clear heartbeat interval
        if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
            heartbeatInterval = null;
        }
        
        // Only attempt to reconnect if user is authenticated
        if (userStore.isAuthenticated()) {
            reconnectTimeout = setTimeout(() => {
                getWebSocket(); // This will create a new connection
            }, 5000);
        }
    };
    
    return ws;
}

/**
 * Close the current WebSocket connection
 */
export function closeWebSocket() {
    if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
    }
    
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }
    
    if (websocket) {
        // Remove reconnection handler
        websocket.onclose = () => {
            console.log("WebSocket closed without reconnection");
        };
        websocket.close();
        websocket = null;
    }
}

/**
 * Register a handler for message events
 * @param {Function} handler The handler function
 */
export function registerMessageHandler(handler) {
    if (typeof handler === 'function' && !messageHandlers.includes(handler)) {
        messageHandlers.push(handler);
    }
}

/**
 * Unregister a message handler
 * @param {Function} handler The handler to remove
 */
export function unregisterMessageHandler(handler) {
    const index = messageHandlers.indexOf(handler);
    if (index !== -1) {
        messageHandlers.splice(index, 1);
    }
}

/**
 * Register a handler for notification events
 * @param {Function} handler The handler function
 */
export function registerNotificationHandler(handler) {
    if (typeof handler === 'function' && !notificationHandlers.includes(handler)) {
        notificationHandlers.push(handler);
    }
}

/**
 * Unregister a notification handler
 * @param {Function} handler The handler to remove
 */
export function unregisterNotificationHandler(handler) {
    const index = notificationHandlers.indexOf(handler);
    if (index !== -1) {
        notificationHandlers.splice(index, 1);
    }
}

/**
 * Send a message through WebSocket
 * @param {Object} message The message to send
 * @returns {boolean} Whether the message was sent
 */
export function sendMessage(message) {
    const ws = getWebSocket();
    
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
        return true;
    }
    
    console.error("WebSocket not connected, cannot send message");
    return false;
}