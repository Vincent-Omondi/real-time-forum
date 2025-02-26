// Import components and utilities
import { initAuth, checkAuth } from './components/auth.js';
import { initPosts } from './components/posts.js';
import { CreatePost } from './components/createPost.js';
import { Profile } from './components/profile.js';
import { initNotifications } from './components/notifications.js';
import { initTheme } from './utils/theme.js';
import { Header } from './components/Header.js';
import { Sidebar } from './components/Sidebar.js';
import { MainContent } from './components/MainContent.js';
import { Auth } from './components/auth.js';
import userStore from './store/userStore.js';
import { MessagesView } from './components/Messages.js';
import { authStateManager } from './store/authStateManager.js';

let authInitialized = false;

function updateUserSection() {
  console.log("Updating user section...");
  // Implement UI updates for user section
}

// Function to update UI based on authentication status
function updateUIBasedOnAuth(isLoggedIn) {
  console.log("Updating UI based on authentication status: ", isLoggedIn);
  // Implement UI updates for logged-in/logged-out state
}

// Declare routes object before using it
const routes = {};

// Function to check if a path is public
function isPublicPath(path) {
    return ['/login', '/register'].includes(path);
}

// Function to check login status
async function checkLoginStatus() {
    try {
        const authData = await authStateManager.checkAuth();
        return authData.loggedIn;
    } catch (error) {
        console.error('Failed to check login status:', error);
        return false;
    }
}

// Function to require authentication
function requireAuth(handler) {
    return async (container) => {
        try {
            const isLoggedIn = await checkLoginStatus();
            if (!isLoggedIn) {
                window.location.href = '/login';
                return;
            }
            await handler(container);
        } catch (error) {
            console.error('Error in route handler:', error);
            if (container.setContent) {
                container.setContent(`
                    <div class="error-message">
                        <h2>Something went wrong</h2>
                        <p>Please try refreshing the page.</p>
                    </div>
                `);
            }
        }
    };
}

// Initialize WebSocket function
function initWebSocket() {
    if (!userStore.isAuthenticated()) {
        console.log('Not initializing WebSocket - user not authenticated');
        return null;
    }

    if (window.mainContent?.messagesView) {
        return window.mainContent.messagesView.setupWebSocket();
    }
    return null;
}

// Define routes after helper functions
Object.assign(routes, {
    '/': requireAuth(async (container) => {
        // Home page route handler
        container.setContent(await initPosts());
    }),
    
    '/messages': requireAuth(async (container) => {
        try {
            const messagesView = new MessagesView();
            const element = await messagesView.render();
            
            if (window.mainContent) {
                window.mainContent.messagesView = messagesView;
            }
            
            if (container.setContent) {
                container.setContent(element);
            } else {
                container.innerHTML = '';
                container.appendChild(element);
            }
        } catch (error) {
            console.error('Error rendering messages view:', error);
            if (container.setContent) {
                container.setContent(`
                    <div class="error-message">
                        <h2>Error loading messages</h2>
                        <p>Please try refreshing the page.</p>
                    </div>
                `);
            }
        }
    }),
    
    '/profile': requireAuth(async (container) => {
        const profile = new Profile();
        container.setContent(await profile.render());
    }),
    
    '/create-post': requireAuth(async (container) => {
        const createPost = new CreatePost();
        container.setContent(await createPost.render());
    }),
    
    '/login': async (container) => {
        // Login page route handler
        const auth = new Auth();
        auth.renderLoginForm(container);
    },
    
    '/register': async (container) => {
        // Register page route handler
        const auth = new Auth();
        auth.renderRegisterForm(container);
    }
});

// Router class definition
class Router {
    constructor(routes, container) {
        this.routes = routes;
        this.container = container;
        this.init();
    }

    init() {
        // Handle initial route
        this.handleRoute();
        
        // Handle browser back/forward buttons
        window.addEventListener('popstate', () => this.handleRoute());
        
        // Handle link clicks
        document.addEventListener('click', (e) => {
            const link = e.target.closest('[data-link]');
            if (link) {
                e.preventDefault();
                this.navigateTo(link.href);
            }
        });

        // Handle direct navigation
        window.addEventListener('DOMContentLoaded', (e) => {
            e.preventDefault();
            this.handleRoute();
        });
    }

    async handleRoute() {
        const url = new URL(window.location.href);
        const path = url.pathname;
        
        try {
            // For protected routes, if auth is not yet initialized, check auth
            if (!authInitialized && !isPublicPath(path)) {
                await checkLoginStatus();
            }

            let componentFunction = this.routes[path];
            if (!componentFunction) {
                // If no exact match, try matching a route prefix
                for (const [route, handler] of Object.entries(this.routes)) {
                    if (path.startsWith(route) && route !== '/') {
                        componentFunction = handler;
                        break;
                    }
                }
            }

            if (componentFunction) {
                // Show loading state
                this.container.setContent('<div class="loading">Loading...</div>');

                try {
                    await componentFunction(this.container);
                    // Handle hash fragment after content is loaded
                    if (url.hash) {
                        const element = document.querySelector(url.hash);
                        if (element) {
                            element.scrollIntoView({ behavior: 'smooth' });
                        }
                    }
                } catch (error) {
                    console.error('Error rendering component:', error);
                    this.container.setContent('<div class="error">Error loading content</div>');
                }
            } else {
                this.container.setContent('<div class="error">Page not found</div>');
            }
        } catch (error) {
            console.error('Route handling failed:', error);
            this.container.setContent('<div class="error">Page failed to load</div>');
        }
    }

    navigateTo(url) {
        let newUrl;
        try {
            // If url is a relative path starting with '/', construct full URL
            if (url.startsWith('/')) {
                newUrl = new URL(url, window.location.origin);
            } else {
                newUrl = new URL(url);
            }
            
            // Only update history and handle route if it's a different path
            if (newUrl.pathname !== window.location.pathname) {
                history.pushState(null, '', newUrl.href);
                this.handleRoute();
            }
        } catch (error) {
            console.error('Navigation error:', error);
        }
    }
}

// Application initialization
document.addEventListener('DOMContentLoaded', async () => {
    const root = document.getElementById('root');
    
    const container = document.createElement('div');
    container.className = 'container';
    
    const header = new Header();
    const sidebar = new Sidebar();
    const mainContent = new MainContent();
    
    window.mainContent = mainContent;
    
    root.appendChild(header.render());
    container.appendChild(sidebar.render());
    container.appendChild(mainContent.render());
    root.appendChild(container);
    
    try {
        const authData = await authStateManager.checkAuth();
        authInitialized = true;
        
        window.router = new Router(routes, mainContent);
        
        if (isPublicPath(window.location.pathname)) {
            initTheme();
        } else if (authData.loggedIn) {
            initTheme();
            setTimeout(() => {
                const ws = initWebSocket();
                if (ws) window.forumWS = ws;
            }, 100);
        } else {
            window.location.href = '/login';
        }
    } catch (error) {
        console.error('Failed to initialize auth:', error);
        window.router = new Router(routes, mainContent);
        
        if (!isPublicPath(window.location.pathname)) {
            window.location.href = '/login';
        }
    }
});
