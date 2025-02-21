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

// Existing router and authentication logic here...

export { updateUserSection, updateUIBasedOnAuth };

/**
 * Router configuration.
 * For protected routes, we wrap the component in requireAuth() so that an
 * authentication check is performed before the component renders.
 */
const routes = {
  '/': requireAuth('home'),
  '/login': () => {
    // If already authenticated, redirect to home
    if (userStore.isAuthenticated()) {
      if (window.router) {
        window.router.navigateTo('/');
      } else {
        window.location.href = '/';
      }
      return;
    }
    return initAuth('login');
  },
  '/register': () => {
    // If already authenticated, redirect to home
    if (userStore.isAuthenticated()) {
      if (window.router) {
        window.router.navigateTo('/');
      } else {
        window.location.href = '/';
      }
      return;
    }
    return initAuth('register');
  },
  '/create': requireAuth('createPost'),
  '/posts': requireAuth('posts'),
  '/viewPost': requireAuth('viewPost'),
  '/profile': requireAuth('profile'),
  '/logout': logoutUser
};

/**
 * Wraps a component render function with an authentication check.
 * If the user is not authenticated, they are redirected to the login page.
 * @param {string} componentKey - Key to look up the component in our components object.
 */
function requireAuth(componentKey) {
  return async () => {
    const isLoggedIn = await checkLoginStatus();
    if (!isLoggedIn) {
      if (window.router) {
        window.router.navigateTo('/login');
      } else {
        window.location.href = '/login';
      }
      return;
    }

    // Update header profile UI after successful auth check
    const profile = new Profile();
    try {
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
    } catch (error) {
      console.error('Error loading user profile:', error);
    }

    return components[componentKey]();
  };
}

/**
 * Checks login status by calling the /api/check-auth endpoint.
 * If authenticated, the CSRF token is updated and the user's profile data is optionally refreshed.
 * @returns {Promise<boolean>} True if logged in; false otherwise.
 */
let authCheckPromise = null;

async function checkLoginStatus() {
  // Use an existing promise if a check is in progress
  if (authCheckPromise) return authCheckPromise;

  authCheckPromise = (async () => {
    try {
      console.log("Checking auth status...");
      const auth = new Auth();
      await auth.checkAuthStatus();
      
      // Use userStore to determine authentication status
      const isAuthenticated = userStore.isAuthenticated();
      console.log("Auth check complete - authenticated:", isAuthenticated);

      // If not logged in and not on a public page, redirect to login
      if (!isAuthenticated && !isPublicPath(window.location.pathname)) {
        if (window.router) {
          window.router.navigateTo('/login');
        } else {
          window.location.href = '/login';
        }
      } else if (isAuthenticated) {
        updateUserSection();
      }

      // Update any UI elements that rely on auth state
      updateUIBasedOnAuth(isAuthenticated);
      return isAuthenticated;
    } catch (error) {
      console.error('Auth check failed:', error);
      updateUIBasedOnAuth(false);
      return false;
    } finally {
      authCheckPromise = null;
    }
  })();

  return authCheckPromise;
}

/**
 * Calls the Profile component to handle logout (which, in turn, calls the logout logic in auth.js).
 */
async function logoutUser() {
  try {
    const auth = new Auth();
    await auth.logout();
  } catch (error) {
    console.error('Logout failed:', error);
    // If logout fails, try to redirect to login anyway
    if (window.router) {
      window.router.navigateTo('/login');
    } else {
      window.location.href = new URL('/login', window.location.origin).href;
    }
  }
}

/**
 * Component render functions.
 * Each key corresponds to a route. Protected components (e.g., home, createPost) are wrapped via requireAuth.
 */
const components = {
  home: async () => {
    // Create content with posts container
    const content = document.createElement('div');
    content.innerHTML = '<div class="posts-container"></div>';
    
    // Set the content first to ensure container is initialized
    window.mainContent.setContent(content);

    try {
      // Update header/profile info
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
        const profile = new Profile();
        profile.updateHeaderProfileUI(userData);
      }
      
      // Now that container is initialized, load posts
      await initPosts();
    } catch (error) {
      console.error('Error in home component:', error);
      window.mainContent.setContent('<div class="error-message">Error loading content</div>');
    }
  },
  profile: async () => {
    const profile = new Profile();
    const content = await profile.render();
    window.mainContent.setContent(content);
  },
  viewPost: async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const postId = urlParams.get('id');
    if (!postId) {
      window.mainContent.setContent('<div class="error">Post not found</div>');
      return;
    }
    const ViewPost = (await import('./components/viewPost.js')).default;
    const viewPostComponent = new ViewPost();
    const content = await viewPostComponent.getHtml();
    window.mainContent.setContent(content);
    await viewPostComponent.afterRender();
  },
  createPost: async () => {
    try {
      const createPost = new CreatePost();
      window.mainContent.setContent(''); // Clear existing content
      await createPost.render(window.mainContent.element); // Pass the main content element directly
    } catch (error) {
      console.error('Error rendering create post component:', error);
      window.mainContent.setContent('<div class="error">Failed to load create post form</div>');
    }
  },
  posts: async () => {
    const content = document.createElement('div');
    content.innerHTML = '<div class="posts-container"></div>';
    window.mainContent.setContent(content);
    await initPosts();
  }
};

// Router implementation: handles navigation events, popstate, and link clicks.
class Router {
  constructor(routes, mainContent) {
    this.routes = routes;
    this.mainContentComponent = mainContent;
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
        this.mainContentComponent.setContent('<div class="loading">Loading...</div>');

        try {
          await componentFunction();
          // Handle hash fragment after content is loaded
          if (url.hash) {
            const element = document.querySelector(url.hash);
            if (element) {
              element.scrollIntoView({ behavior: 'smooth' });
            }
          }
        } catch (error) {
          console.error('Error rendering component:', error);
          this.mainContentComponent.setContent('<div class="error">Error loading content</div>');
        }
      } else {
        this.mainContentComponent.setContent('<div class="error">Page not found</div>');
      }
    } catch (error) {
      console.error('Route handling failed:', error);
      this.mainContentComponent.setContent('<div class="error">Page failed to load</div>');
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

/**
 * Initializes a WebSocket connection to listen for notifications.
 * Dispatches incoming messages to the appropriate notifications handler.
 */
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

// Application initialization: renders global layout and starts router, WebSocket, and theme.
document.addEventListener('DOMContentLoaded', async () => {
  const root = document.getElementById('root');
  
  // Create a container for main layout
  const container = document.createElement('div');
  container.className = 'container';
  
  // Initialize and render header, sidebar, main content
  const header = new Header();
  const sidebar = new Sidebar();
  const mainContent = new MainContent();
  
  // Make mainContent globally accessible
  window.mainContent = mainContent;
  
  root.appendChild(header.render());
  container.appendChild(sidebar.render());
  container.appendChild(mainContent.render());
  root.appendChild(container);
  
  // Check authentication
  const isAuthenticated = await checkLoginStatus();
  authInitialized = true;
  
  // Start the router, WebSocket, and theme initialization if the current path is public or user is authenticated.
  if (isAuthenticated || isPublicPath(window.location.pathname)) {
    window.router = new Router(routes, mainContent); // Pass mainContent to Router
    const ws = initWebSocket();
    initTheme();
    window.forumWS = ws;
  } else {
    window.location.href = '/login';
  }
});

/**
 * Utility function to check if the current path is public (login or register).
 * @param {string} path - The current URL path.
 * @returns {boolean} True if the path is public.
 */
function isPublicPath(path) {
  return ['/login', '/register'].includes(path);
}
