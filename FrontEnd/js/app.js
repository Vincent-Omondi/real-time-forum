// Import components
import { initAuth, checkAuth } from './components/auth.js';
import { initPosts } from './components/posts.js';
import { CreatePost } from './components/createPost.js';
import { Profile } from './components/profile.js';
import { initNotifications } from './components/notifications.js';
import { initTheme } from './utils/theme.js';

// Router configuration
const routes = {
    '/': requireAuth('home'),
    '/login': () => initAuth('login'),
    '/register': () => initAuth('register'),
    '/create': createPost,
    '/posts': requireAuth('posts'),
    '/viewPost': requireAuth('viewPost'),
    // '/messages': requireAuth('messages'),
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
        console.log("Checking login status...");
        const response = await fetch(`${window.location.origin}/api/check-auth`, {
            method: "GET",
            credentials: "include",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json"
            }
        });

        console.log("Response status:", response.status);

        if (!response.ok) {
            console.error(`Error: Received status ${response.status}`);
            return false;
        }

        const data = await response.json();
        console.log("Response data:", data);
            
        if (data.loggedIn && data.userID) {
            const profile = new Profile();
            // Get user data from profile endpoint
            const userResponse = await fetch('/api/user/profile', {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
            
            if (userResponse.ok) {
                const userData = await userResponse.json();
                profile.updateHeaderProfileUI(userData);
            }
            return true;
        }
        return false;
    } catch (error) {
        console.error("Network error while checking login status:", error);
        return false;
    }
}

async function logoutUser() {
    const profile = new Profile();
    await profile.handleLogout();
}

// Component render functions
const components = {
    home: async () => {
        const container = document.getElementById('app-container');
        container.innerHTML = `<div class="posts-container"></div>`;
        await initPosts();
    },
    profile: async () => {
        const profile = new Profile();
        await profile.render();
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

async function createPost() {
    if (await requireAuth()) {
        const createPost = new CreatePost();
        createPost.render(document.getElementById('app-container'));
    }
}
