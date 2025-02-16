import { checkAuth } from './auth.js';

export function initMessages() {
    const user = checkAuth();
    if (!user) {
        window.location.href = '/login';
        return;
    }

    const container = document.getElementById('app-container');
    container.innerHTML = `
        <div class="messages-page">
            <div class="chat-list">
                <h3>Conversations</h3>
                <div class="chat-list-container"></div>
            </div>
            <div class="chat-window">
                <div class="chat-header"></div>
                <div class="chat-messages"></div>
                <form id="message-form" class="chat-input" style="display: none;">
                    <textarea name="content" placeholder="Type a message..." required></textarea>
                    <button type="submit">Send</button>
                </form>
            </div>
        </div>
    `;

    loadChatList();
    setupWebSocket();
}

async function loadChatList() {
    const container = document.querySelector('.chat-list-container');
    try {
        const response = await fetch('/api/messages/conversations');
        if (response.ok) {
            const conversations = await response.json();
            container.innerHTML = conversations.map(conv => createChatListItemHTML(conv)).join('');
            attachChatListEventListeners();
        } else {
            container.innerHTML = '<p>Error loading conversations</p>';
        }
    } catch (error) {
        console.error('Error loading chat list:', error);
        container.innerHTML = '<p>Error loading conversations</p>';
    }
}

function createChatListItemHTML(conversation) {
    const lastMessage = conversation.last_message || 'No messages yet';
    const lastMessageTime = conversation.last_message_time ? 
        new Date(conversation.last_message_time).toLocaleTimeString() : '';
    
    return `
        <div class="chat-list-item" data-user-id="${conversation.user_id}">
            <div class="chat-user">${conversation.username}</div>
            <div class="chat-preview">
                <span class="last-message">${lastMessage}</span>
                <span class="last-time">${lastMessageTime}</span>
            </div>
        </div>
    `;
}

function attachChatListEventListeners() {
    document.querySelectorAll('.chat-list-item').forEach(item => {
        item.addEventListener('click', () => {
            const userId = item.dataset.userId;
            loadChat(userId);
        });
    });
}

async function loadChat(userId) {
    const messageForm = document.getElementById('message-form');
    const chatHeader = document.querySelector('.chat-header');
    const chatMessages = document.querySelector('.chat-messages');

    try {
        // Load user info
        const userResponse = await fetch(`/api/users/${userId}`);
        if (userResponse.ok) {
            const user = await userResponse.json();
            chatHeader.innerHTML = `<h3>Chat with ${user.username}</h3>`;
            messageForm.style.display = 'flex';
            messageForm.dataset.recipientId = userId;
        }

        // Load messages
        const messagesResponse = await fetch(`/api/messages/${userId}`);
        if (messagesResponse.ok) {
            const messages = await messagesResponse.json();
            chatMessages.innerHTML = messages.map(msg => createMessageHTML(msg)).join('');
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    } catch (error) {
        console.error('Error loading chat:', error);
        chatMessages.innerHTML = '<p>Error loading messages</p>';
    }

    // Attach message form handler
    messageForm.onsubmit = handleSendMessage;
}

function createMessageHTML(message) {
    const user = checkAuth();
    const isOwn = message.sender_id === user.id;
    const messageClass = isOwn ? 'own-message' : 'other-message';
    
    return `
        <div class="message ${messageClass}">
            <div class="message-content">${message.content}</div>
            <div class="message-time">${new Date(message.created_at).toLocaleTimeString()}</div>
        </div>
    `;
}

async function handleSendMessage(e) {
    e.preventDefault();
    const form = e.target;
    const recipientId = form.dataset.recipientId;
    const formData = new FormData(form);

    try {
        const response = await fetch(`/api/messages/${recipientId}`, {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            form.reset();
            await loadChat(recipientId);
        } else {
            const error = await response.json();
            alert(error.message);
        }
    } catch (error) {
        console.error('Error sending message:', error);
        alert('An error occurred while sending the message');
    }
}

function setupWebSocket() {
    const ws = window.forumWS;
    
    ws.addEventListener('message', (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'message') {
            const activeChat = document.getElementById('message-form').dataset.recipientId;
            if (activeChat === data.sender_id.toString()) {
                loadChat(activeChat);
            }
            loadChatList(); // Refresh chat list to update last messages
        }
    });
} 