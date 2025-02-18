// Import components
import { initAuth, checkAuth } from './components/auth.js';
import { initPosts } from './components/posts.js';
import { CreatePost } from './components/createPost.js';
import { Profile } from './components/profile.js';
import { initNotifications } from './components/notifications.js';
import { initTheme } from './utils/theme.js';
import { Header } from './components/Header.js';
import { Sidebar } from './components/Sidebar.js';
import { MainContent } from './components/MainContent.js';

let authInitialized = false;

// Router configuration
const routes = {
    '/': requireAuth('home'),
    '/login': () => initAuth('login'),
    '/register': () => initAuth('register'),
    '/create': requireAuth('createPost'),
    '/posts': requireAuth('posts'),
    '/viewPost': requireAuth('viewPost'),
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
    },
    // Add missing component handlers
    createPost: async () => {
        const container = document.getElementById('app-container');
        const createPost = new CreatePost();
        createPost.render(container);
    },
    posts: async () => {
        const container = document.getElementById('app-container');
        container.innerHTML = `<div class="posts-container"></div>`;
        await initPosts();
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
        
        try {
            // Show loading for protected routes during auth check
            if (!authInitialized && !isPublicPath(path)) {
                document.getElementById('app-container').innerHTML = '<div class="loading">Loading...</div>';
                await checkLoginStatus();
            }
            
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
                // Show loading while component loads and renders
                document.getElementById('app-container').innerHTML = '<div class="loading">Loading...</div>';
                await componentName();
            } else {
                document.getElementById('app-container').innerHTML = '<h1>Page Not Found</h1>';
            }
        } catch (error) {
            console.error('Failed to load route:', error);
            document.getElementById('app-container').innerHTML = '<div class="error">Failed to load content</div>';
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
    const root = document.getElementById('root');
    
    // Create container
    const container = document.createElement('div');
    container.className = 'container';
    
    // Initialize components
    const header = new Header();
    const sidebar = new Sidebar();
    const mainContent = new MainContent();
    
    // Render components
    root.appendChild(header.render());
    container.appendChild(sidebar.render());
    container.appendChild(mainContent.render());
    root.appendChild(container);
    
    // Rest of your initialization code...
    const isAuthenticated = await checkLoginStatus();
    authInitialized = true;
    
    if (isAuthenticated || isPublicPath(window.location.pathname)) {
        const router = new Router(routes);
        const ws = initWebSocket();
        initTheme();
        window.forumWS = ws;
        await router.handleRoute();
    } else {
        window.location.href = '/login';
    }
});

function isPublicPath(path) {
    return ['/login', '/register'].includes(path);
}

// Remove this function as it's redundant with the components.createPost
// async function createPost() {
//     if (await requireAuth()) {
//         const createPost = new CreatePost();
//         createPost.render(document.getElementById('app-container'));
//     }
// }