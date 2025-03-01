import userStore from '../store/userStore.js';
import { updateUIBasedOnAuth } from '../utils/uiUtils.js';
import { initializeVoteStates, clearVoteStates } from '../utils/voteUtils.js';
import voteStore from '../store/voteStore.js';

/**
 * Auth component for handling authentication.
 * This class now leverages the centralized userStore for managing authenticated user state.
 */
export class Auth {
  constructor() {
    // Instead of maintaining a local isAuthenticated flag,
    // we rely on userStore.isAuthenticated() for current auth status.
    this.checkAuthStatus();
  }
  // updateAuthCheckTimestamp
  /**
   * Checks the current authentication status by calling the backend API.
   * If the user is logged in, the returned user info is added/updated in userStore,
   * and the user is authenticated via userStore.
   * Also, CSRF token is stored for subsequent requests.
   * 
   * Now uses userStore's caching mechanism to avoid redundant API calls.
   */
  async checkAuthStatus() {
    try {
      // If auth was checked recently and cache is still valid, skip the API call
      if (!userStore.shouldCheckAuth()) {
        console.log('Using cached authentication state');
        const isAuthenticated = userStore.isAuthenticated();
        updateUIBasedOnAuth(isAuthenticated);
        
        if (!isAuthenticated && !this.isPublicPath()) {
          this.redirectToLogin();
        }
        
        return isAuthenticated;
      }
      
      console.log('Checking auth status with backend');
      const response = await fetch('/api/check-auth', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      let data;
      try {
        data = await response.json();
      } catch (error) {
        console.error("Failed to parse JSON response", error);
        data = null;
      }

      // If logged in and backend provides CSRF token
      if (data?.loggedIn && data?.csrfToken) {
        // Update CSRF token in localStorage and in a meta tag
        localStorage.setItem('csrfToken', data.csrfToken);
        let metaTag = document.querySelector('meta[name="csrf-token"]');
        if (!metaTag) {
          metaTag = document.createElement('meta');
          metaTag.setAttribute('name', 'csrf-token');
          document.head.appendChild(metaTag);
        }
        metaTag.setAttribute('content', data.csrfToken);

        // Create basic user object from userID if no full user object provided
        if (data.userID && !data.user) {
          data.user = { id: data.userID };
        }

        // Update userStore if user data is provided
        if (data.user) {
          if (!userStore.getUser(data.user.id)) {
            userStore.addUser(data.user);
          } else {
            userStore.updateUser(data.user.id, data.user);
          }
          userStore.authenticateUser(data.user.id);
        }
      } else {
        // User is not authenticated, but we've checked - update the timestamp
        userStore.updateAuthCheckTimestamp();
      }

      const isAuthenticated = userStore.isAuthenticated();
      if (!isAuthenticated && !this.isPublicPath()) {
        this.redirectToLogin();
      } else if (isAuthenticated) {
        this.updateUserSection();
      }

      updateUIBasedOnAuth(isAuthenticated);
      return isAuthenticated;

    } catch (error) {
      console.error('Auth check failed:', error);
      // Even on error, update the timestamp to prevent repeated failed calls
      userStore.updateAuthCheckTimestamp();
      updateUIBasedOnAuth(false);
      return false;
    }
  }

  /**
   * Redirects user to login page using router if available, or location redirect.
   */
  redirectToLogin() {
    if (window.router) {
      window.router.navigateTo('/login');
    } else {
      window.location.href = new URL('/login', window.location.origin).href;
    }
  }

  /**
   * Checks if the current URL path is considered public.
   * @returns {boolean} True if on a public path (e.g., /login or /register), else false.
   */
  isPublicPath() {
    const publicPaths = ['/login', '/register'];
    return publicPaths.includes(window.location.pathname);
  }

  /**
   * Updates the user section of the UI (e.g., rendering a logout button) if a user is authenticated.
   */
  updateUserSection() {
    const userSection = document.getElementById('userSection');
    if (userSection) {
      userSection.innerHTML = `
        <button id="logoutBtn" class="logout-btn">Logout</button>
      `;
      document.getElementById('logoutBtn').addEventListener('click', () => this.logout());
    }
  }

  /**
   * Renders the login form inside the provided container element.
   * @param {HTMLElement} container - The DOM element where the login form will be rendered.
   */
  renderLoginForm(container) {
    const loginHTML = `
      <div class="auth-container">
        <h2>Login</h2>
        <form id="loginForm" class="auth-form">
          <div class="form-group">
            <input type="text" name="identifier" placeholder="Email or Nickname" required>
          </div>
          <div class="form-group">
            <input type="password" name="password" placeholder="Password" required>
          </div>
          <button type="submit">Login</button>
          <p class="auth-switch">
            Don't have an account? <a href="/register" data-link>Register</a>
          </p>
        </form>
        <div id="loginError" class="auth-error"></div>
      </div>
    `;

    if (container.setContent) {
      container.setContent(loginHTML);
    } else {
      container.innerHTML = loginHTML;
    }
    
    // Wait for next tick to ensure DOM is updated
    setTimeout(() => {
      this.attachLoginHandler();
    }, 0);
  }

  /**
   * Renders the registration form inside the provided container element.
   * @param {HTMLElement} container - The DOM element where the registration form will be rendered.
   */
  renderRegisterForm(container) {
    const registerHTML = `
      <div class="auth-container">
        <h2>Register</h2>
        <form id="registerForm" class="auth-form">
          <div class="form-group">
            <input type="text" name="nickname" placeholder="Nickname" required>
          </div>
          <div class="form-group">
            <input type="number" name="age" placeholder="Age" min="13" required>
          </div>
          <div class="form-group">
            <select name="gender" required>
              <option value="">Select Gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div class="form-group">
            <input type="text" name="firstName" placeholder="First Name" required>
          </div>
          <div class="form-group">
            <input type="text" name="lastName" placeholder="Last Name" required>
          </div>
          <div class="form-group">
            <input type="email" name="email" placeholder="Email" required>
          </div>
          <div class="form-group">
            <input type="password" name="password" placeholder="Password" minlength="8" required>
          </div>
          <button type="submit">Register</button>
          <p class="auth-switch">
            Already have an account? <a href="/login" data-link>Login</a>
          </p>
        </form>
        <div id="registerError" class="auth-error"></div>
      </div>
    `;

    if (container.setContent) {
      container.setContent(registerHTML);
    } else {
      container.innerHTML = registerHTML;
    }
    
    // Wait for next tick to ensure DOM is updated
    setTimeout(() => {
      this.attachRegisterHandler();
    }, 0);
  }

  /**
   * Attaches the event handler for the login form submission.
   */
  attachLoginHandler() {
    const form = document.getElementById('loginForm');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());

      try {
        const response = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error('Login failed');
        }

        const result = await response.json();
        
        if (result.csrfToken) {
          localStorage.setItem('csrfToken', result.csrfToken);
          let metaTag = document.querySelector('meta[name="csrf-token"]');
          if (!metaTag) {
            metaTag = document.createElement('meta');
            metaTag.setAttribute('name', 'csrf-token');
            document.head.appendChild(metaTag);
          }
          metaTag.setAttribute('content', result.csrfToken);
        }
        
        if (result.user) {
          if (!userStore.getUser(result.user.id)) {
            userStore.addUser(result.user);
          } else {
            userStore.updateUser(result.user.id, result.user);
          }
          userStore.authenticateUser(result.user.id);
        }
        
        if (window.router) {
          window.router.navigateTo('/');
        } else {
          window.location.href = new URL('/', window.location.origin).href;
        }

        // Initialize vote states after successful login
        await initializeVoteStates();
      } catch (error) {
        document.getElementById('loginError').textContent = error.message;
      }
    });
  }

  /**
   * Attaches the event handler for the registration form submission.
   */
  attachRegisterHandler() {
    const form = document.getElementById('registerForm');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());
  
      // Convert age from string to integer
      data.age = parseInt(data.age, 10);

      try {
        const response = await fetch('/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error('Registration failed');
        }

        const result = await response.json();
        
        if (result.csrfToken) {
          localStorage.setItem('csrfToken', result.csrfToken);
          let metaTag = document.querySelector('meta[name="csrf-token"]');
          if (!metaTag) {
            metaTag = document.createElement('meta');
            metaTag.setAttribute('name', 'csrf-token');
            document.head.appendChild(metaTag);
          }
          metaTag.setAttribute('content', result.csrfToken);
        }
        
        if (result.user) {
          if (!userStore.getUser(result.user.id)) {
            userStore.addUser(result.user);
          } else {
            userStore.updateUser(result.user.id, result.user);
          }
          userStore.authenticateUser(result.user.id);
        }
        
        if (window.router) {
          window.router.navigateTo('/');
        } else {
          window.location.href = new URL('/', window.location.origin).href;
        }
      } catch (error) {
        document.getElementById('registerError').textContent = error.message;
      }
    });
  }

  /**
   * Logs out the current user.
   */
  async logout() {
    try {
      // Close WebSocket connection if it exists
      if (window.mainContent && window.mainContent.messagesView) {
        window.mainContent.messagesView.closeWebSocket();
      }

      // Get CSRF token from localStorage or meta tag
      const csrfToken = localStorage.getItem('csrfToken') || 
                       document.querySelector('meta[name="csrf-token"]')?.content;
      
      if (!csrfToken) {
        console.warn('No CSRF token found for logout request');
      }

      const response = await fetch('/api/logout', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken || '' // Include token if available
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Logout failed');
      }
      
      // Clear CSRF token and update userStore state
      localStorage.removeItem('csrfToken');
      document.querySelector('meta[name="csrf-token"]')?.remove();
      userStore.logout(); // This will update the timestamp too
      voteStore.clearVotes();
      
      if (window.router) {
        window.router.navigateTo('/login');
      } else {
        window.location.href = new URL('/login', window.location.origin).href;
      }
    } catch (error) {
      console.error('Logout error:', error);
      alert('Failed to logout. Please try again.');
    }
  }
}

// Utility Functions

/**
 * Creates an instance of Auth and performs an authentication check.
 * @returns {Promise} The result of checkAuthStatus.
 */
export function checkAuth() {
  const auth = new Auth();
  return auth.checkAuthStatus();
}

/**
 * Initializes authentication-related UI.
 * Renders the appropriate form based on the current URL path.
 */
export function initAuth(type = 'login') {
  const auth = new Auth();
  
  // Get the container - prefer mainContent if available
  let container;
  if (window.mainContent) {
    container = window.mainContent;
  } else {
    container = document.querySelector('.main-content');
    if (!container) {
      console.error('Main content container not found');
      return;
    }
  }
  
  // Show loading state if using mainContent
  if (container.setContent) {
    container.setContent('<div class="loading">Loading...</div>');
  }
  
  // Render the appropriate form
  if (type === 'login') {
    auth.renderLoginForm(container);
  } else if (type === 'register') {
    auth.renderRegisterForm(container);
  }
}

/**
 * Convenience function to log out the current user.
 */
export function logout() {
  const auth = new Auth();
  return auth.logout();
}