// Import components
import { initAuth } from './components/auth.js';
import { initPosts } from './components/posts.js';
import { initComments } from './components/comments.js';
import { initMessages } from './components/messages.js';
import { initNotifications } from './components/notifications.js';
import { initTheme } from './utils/theme.js';

// Router configuration
const routes = {
    '/': requireAuth('home'),
    '/login': () => initAuth('login'),
    '/register': () => initAuth('register'),
    '/posts': requireAuth('posts'),
    '/viewPost': requireAuth('viewPost'),
    '/messages': requireAuth('messages'),
    '/profile': requireAuth('profile'),
    '/logout': logoutUser
};

// Ensure authentication before allowing access to routes
function requireAuth(component) {
    return async () => {
        const isLoggedIn = await checkLoginStatus();
        if (!isLoggedIn) {
            window.location.href = '/login';
            return;
        }
        return components[component]();
    };
}

// Authentication functions
async function checkLoginStatus() {
    try {
        const response = await fetch('/api/check-auth', { credentials: 'include' });
        const data = await response.json();
        updateUserUI(data.loggedIn);
        return data.loggedIn;
    } catch (error) {
        console.error("Error checking login status:", error);
        return false;
    }
}

function updateUserUI(isLoggedIn) {
    const userSection = document.getElementById("userSection");
    if (isLoggedIn) {
        userSection.innerHTML = `
            <div class="user-profile">
                <button id="logoutBtn">Logout</button>
            </div>
        `;
        document.getElementById("logoutBtn").addEventListener("click", logoutUser);
    } else {
        userSection.innerHTML = `
            <a href="/login" class="button">Login</a>
            <a href="/register" class="button">Register</a>
        `;
    }
}

async function logoutUser() {
    try {
        await fetch("/logout", { method: "POST", credentials: "include" });
        window.location.href = "/login";
    } catch (error) {
        console.error("Logout failed:", error);
    }
}

// Component render functions
const components = {
    home: async () => {
        const container = document.getElementById('app-container');
        container.innerHTML = `<div class="posts-container"></div>`;
        await initPosts();
    },
    viewPost: async () => {
        const container = document.getElementById('app-container');
        const urlParams = new URLSearchParams(window.location.search);
        const postId = urlParams.get('id');

        if (!postId) {
            container.innerHTML = '<div class="error">Post not found</div>';
            return;
        }

        const ViewPost = (await import('./components/viewPost.js')).default;
        const viewPostComponent = new ViewPost();
        container.innerHTML = await viewPostComponent.getHtml();
        await viewPostComponent.afterRender();
    }
};

// Router implementation
class Router {
    constructor(routes) {
        this.routes = routes;
        this.init();
    }

    init() {
        this.handleRoute();
        window.addEventListener('popstate', () => this.handleRoute());
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

        if (!componentName) {
            for (const [route, name] of Object.entries(this.routes)) {
                if (path.startsWith(route)) {
                    componentName = name;
                    break;
                }
            }
        }

        if (componentName) {
            await componentName();
        } else {
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
document.addEventListener('DOMContentLoaded', async () => {
    const router = new Router(routes);
    const ws = initWebSocket();
    
    await checkLoginStatus();
    initTheme();
    
    window.forumWS = ws;
});
