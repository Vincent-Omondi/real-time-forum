// Import components
import { initAuth } from './components/auth.js';
import { initPosts } from './components/posts.js';
import { initComments } from './components/comments.js';
import { initMessages } from './components/messages.js';
import { initNotifications } from './components/notifications.js';

// Theme management
class ThemeManager {
    constructor() {
        this.theme = localStorage.getItem('theme') || 'light';
        this.initializeTheme();
        this.setupStorageListener();
    }

    initializeTheme() {
        document.documentElement.setAttribute('data-theme', this.theme);
        document.body.classList.remove('light-theme', 'dark-theme');
        document.body.classList.add(`${this.theme}-theme`);
    }

    toggleTheme() {
        this.theme = this.theme === 'light' ? 'dark' : 'light';
        localStorage.setItem('theme', this.theme);
        this.initializeTheme();
    }

    setupStorageListener() {
        window.addEventListener('storage', (event) => {
            if (event.key === 'theme') {
                this.theme = event.newValue;
                this.initializeTheme();
            }
        });
    }
}

// Router configuration
const routes = {
    '/': 'home',
    '/login': 'login',
    '/register': 'register',
    '/posts': 'posts',
    '/post/': 'viewPost',  // Will be followed by post ID
    '/messages': 'messages',
    '/profile': 'profile'
};

// Component render functions
const components = {
    home: async () => {
        const container = document.getElementById('app-container');
        container.innerHTML = `
            <div class="header-actions">
                <button id="theme-toggle" onclick="window.themeManager.toggleTheme()">
                    Toggle Theme
                </button>
            </div>
            <div class="posts-container"></div>
        `;
        await initPosts();
    },
    login: () => {
        const container = document.getElementById('app-container');
        container.innerHTML = `
            <div class="auth-container">
                <h2>Login</h2>
                <form id="login-form">
                    <input type="text" name="username" placeholder="Username" required>
                    <input type="password" name="password" placeholder="Password" required>
                    <button type="submit">Login</button>
                </form>
                <div class="oauth-buttons">
                    <button id="google-login">Login with Google</button>
                    <button id="github-login">Login with GitHub</button>
                </div>
            </div>
        `;
        initAuth();
    },
    // Add other component render functions here
};

// Router implementation
class Router {
    constructor(routes) {
        this.routes = routes;
        this.init();
    }

    init() {
        // Handle initial load
        this.handleRoute();

        // Handle browser navigation
        window.addEventListener('popstate', () => this.handleRoute());

        // Handle link clicks
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-link]')) {
                e.preventDefault();
                this.navigateTo(e.target.href);
            }
        });
    }

    async handleRoute() {
        const path = window.location.pathname;
        let componentName = this.routes[path];

        // Handle dynamic routes (e.g., /post/123)
        if (!componentName) {
            for (const [route, name] of Object.entries(this.routes)) {
                if (path.startsWith(route)) {
                    componentName = name;
                    break;
                }
            }
        }

        if (componentName && components[componentName]) {
            await components[componentName]();
        } else {
            // Handle 404
            document.getElementById('app-container').innerHTML = '<h1>Page Not Found</h1>';
        }
    }

    navigateTo(url) {
        window.history.pushState(null, null, url);
        this.handleRoute();
    }
}

// Initialize WebSocket connection
function initWebSocket() {
    const ws = new WebSocket('ws://' + window.location.host + '/ws');
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        // Handle different types of WebSocket messages
        switch (data.type) {
            case 'message':
                initNotifications().newMessage(data);
                break;
            case 'notification':
                initNotifications().newNotification(data);
                break;
        }
    };
    return ws;
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    const router = new Router(routes);
    const ws = initWebSocket();
    
    // Initialize theme manager
    window.themeManager = new ThemeManager();
    
    // Make WebSocket instance available globally
    window.forumWS = ws;
}); 