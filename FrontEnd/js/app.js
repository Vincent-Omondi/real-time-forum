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
  '/login': () => initAuth('login'),
  '/register': () => initAuth('register'),
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
      window.location.href = '/login';
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
        window.location.href = '/login';
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
  const profile = new Profile();
  await profile.handleLogout();
}

/**
 * Component render functions.
 * Each key corresponds to a route. Protected components (e.g., home, createPost) are wrapped via requireAuth.
 */
const components = {
  home: async () => {
    const container = document.getElementById('app-container');
    if (!container) {
      console.error('App container not found');
      return;
    }
    // Ensure a posts container is present
    if (!container.querySelector('.posts-container')) {
      container.innerHTML = `<div class="posts-container"></div>`;
    }

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
      // Load posts
      await initPosts();

      // Verify the profile section exists; if not, try refreshing it.
      const userSection = document.getElementById('userSection');
      if (!userSection || !userSection.querySelector('.profile-section')) {
        const retryResponse = await fetch('/api/user/profile', {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });
        if (retryResponse.ok) {
          const userData = await retryResponse.json();
          const profile = new Profile();
          profile.updateHeaderProfileUI(userData);
        }
      }
    } catch (error) {
      console.error('Error in home component:', error);
      container.innerHTML = '<div class="error-message">Error loading content</div>';
    }
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
  createPost: async () => {
    const container = document.getElementById('app-container');
    const createPost = new CreatePost();
    await createPost.render(container);
  },
  posts: async () => {
    const container = document.getElementById('app-container');
    container.innerHTML = `<div class="posts-container"></div>`;
    await initPosts();
  }
};

// Router implementation: handles navigation events, popstate, and link clicks.
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
      // For protected routes, if auth is not yet initialized, show a loading indicator and check auth
      if (!authInitialized && !isPublicPath(path)) {
        document.getElementById('app-container').innerHTML = '<div class="loading">Loading...</div>';
        await checkLoginStatus();
      }

      let componentFunction = this.routes[path];
      if (!componentFunction) {
        // If no exact match, try matching a route prefix.
        for (const [route, handler] of Object.entries(this.routes)) {
          if (path.startsWith(route)) {
            componentFunction = handler;
            break;
          }
        }
      }

      if (componentFunction) {
        document.getElementById('app-container').innerHTML = '<div class="loading">Loading...</div>';
        await componentFunction();
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
  
  root.appendChild(header.render());
  container.appendChild(sidebar.render());
  container.appendChild(mainContent.render());
  root.appendChild(container);
  
  // Check authentication
  const isAuthenticated = await checkLoginStatus();
  authInitialized = true;
  
  // Start the router, WebSocket, and theme initialization if the current path is public or user is authenticated.
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

/**
 * Utility function to check if the current path is public (login or register).
 * @param {string} path - The current URL path.
 * @returns {boolean} True if the path is public.
 */
function isPublicPath(path) {
  return ['/login', '/register'].includes(path);
}
