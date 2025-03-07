import userStore from '../store/userStore.js';
import { updateUIBasedOnAuth } from '../utils/uiUtils.js';
import { clearVoteStates } from '../utils/voteUtils.js';
import voteStore from '../store/voteStore.js';
import { closeWebSocket } from '../store/websocketManager.js';
import { csrfManager } from '../utils/csrf-manager.js';
import { authErrorHandler } from '../utils/auth-error-handler.js';

/**
 * Auth component for handling authentication.
 * This class leverages the centralized userStore for managing authenticated user state.
 */
export class Auth {
  constructor() {
    this.checkAuthStatus();
  }

  /**
   * Checks the current authentication status by calling the backend API.
   * Uses userStore's caching mechanism to avoid redundant API calls.
   * @returns {Promise<boolean>} True if user is authenticated, false otherwise
   */
  async checkAuthStatus() {
    try {
      // Use cached auth state if recently checked
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
        // Handle specific HTTP error codes
        if (response.status === 401) {
          // Token expired or invalid
          userStore.logout();
          this.redirectToLogin();
          return false;
        }
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const data = await this._safeParseJson(response);

      // Handle successful login data
      if (data?.loggedIn && data?.csrfToken) {
        // Handle CSRF token
        csrfManager.storeToken(data.csrfToken);

        // Normalize user data
        const userData = this._normalizeUserData(data);
        
        // Update userStore
        this._updateUserStore(userData);
      } else {
        // Update timestamp even if not authenticated
        userStore.updateAuthCheckTimestamp();
      }

      const isAuthenticated = userStore.isAuthenticated();
      
      // Handle routing and UI updates
      this._handleAuthenticationResult(isAuthenticated);
      
      return isAuthenticated;

    } catch (error) {
      this._handleAuthError(error);
      return false;
    }
  }

  /**
   * Safely parses JSON from a response, handling potential parse errors
   * @param {Response} response - The fetch response object
   * @returns {Object|null} Parsed JSON or null on error
   * @private
   */
  async _safeParseJson(response) {
    return authErrorHandler.safeParseJson(response);
  }

  /**
   * Creates a normalized user object from response data
   * @param {Object} data - The response data
   * @returns {Object} Normalized user object
   * @private
   */
  _normalizeUserData(data) {
    // Create basic user object from userID if no full user object provided
    if (data.userID && !data.user) {
      return { id: data.userID };
    }
    return data.user;
  }

  /**
   * Updates the userStore with user data
   * @param {Object} userData - The user data to store
   * @private
   */
  _updateUserStore(userData) {
    if (!userData) return;
    
    if (!userStore.getUser(userData.id)) {
      userStore.addUser(userData);
    } else {
      userStore.updateUser(userData.id, userData);
    }
    userStore.authenticateUser(userData.id);
  }

  /**
   * Handles the result of authentication check
   * @param {boolean} isAuthenticated - Whether the user is authenticated
   * @private
   */
  _handleAuthenticationResult(isAuthenticated) {
    if (!isAuthenticated && !this.isPublicPath()) {
      this.redirectToLogin();
    } else if (isAuthenticated) {
      this.updateUserSection();
    }

    updateUIBasedOnAuth(isAuthenticated);
  }

  /**
   * Handles authentication errors
   * @param {Error} error - The error that occurred
   * @private
   */
  _handleAuthError(error) {
    console.error('Auth check failed:', error);
    // Prevent repeated failed calls
    userStore.updateAuthCheckTimestamp();
    updateUIBasedOnAuth(false);
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
    const publicPaths = ['/login', '/register', '/forgot-password', '/reset-password'];
    return publicPaths.some(path => window.location.pathname === path || 
                                    window.location.pathname.startsWith(path + '/'));
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
          <div class="form-group">
            <label class="remember-me">
              <input type="checkbox" name="rememberMe"> Remember me
            </label>
          </div>
          <button type="submit">Login</button>
          <p class="auth-switch">
            Don't have an account? <a href="/register" data-link>Register</a>
          </p>
          <p class="auth-switch">
            <a href="/forgot-password" data-link>Forgot Password?</a>
          </p>
        </form>
        <div id="loginError" class="auth-error"></div>
      </div>
    `;

    this._setContainerContent(container, loginHTML);
    this._attachFormHandlerWhenReady('loginForm', this.attachLoginHandler.bind(this));
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
            <input type="password" name="password" id="password" placeholder="Password" minlength="8" required>
            <div class="password-strength-meter">
              <div class="meter-section"></div>
              <div class="meter-section"></div>
              <div class="meter-section"></div>
              <div class="meter-section"></div>
            </div>
            <div class="password-requirements">
              Password must be at least 8 characters and include uppercase, lowercase, number, and special character.
            </div>
          </div>
          <button type="submit">Register</button>
          <p class="auth-switch">
            Already have an account? <a href="/login" data-link>Login</a>
          </p>
        </form>
        <div id="registerError" class="auth-error"></div>
      </div>
    `;

    this._setContainerContent(container, registerHTML);
    this._attachFormHandlerWhenReady('registerForm', this.attachRegisterHandler.bind(this));
  }

  /**
   * Sets the container content safely using either setContent or innerHTML
   * @param {HTMLElement} container - The container element
   * @param {string} content - The HTML content
   * @private
   */
  _setContainerContent(container, content) {
    if (container.setContent) {
      container.setContent(content);
    } else {
      container.innerHTML = content;
    }
  }

  /**
   * Attaches a handler to a form when the DOM is ready
   * @param {string} formId - The ID of the form element
   * @param {Function} handler - The handler function to attach
   * @private
   */
  _attachFormHandlerWhenReady(formId, handler) {
    const attachHandler = () => {
      const form = document.getElementById(formId);
      if (form) {
        handler(form);
      } else {
        // If the form isn't ready yet, wait for a bit and try again
        setTimeout(attachHandler, 50);
      }
    };
    
    // Try to attach immediately, wait for next tick if needed
    setTimeout(attachHandler, 0);
  }

  /**
   * Attaches the event handler for the login form submission.
   * @param {HTMLElement} form - The login form element
   */
  attachLoginHandler(form) {
    const errorDiv = document.getElementById('loginError');
    
    // Apply error styling via class instead of inline styles
    errorDiv.classList.add('auth-error-message');
    errorDiv.style.display = 'none';
    
    // Set up password field with visibility toggle
    const passwordField = form.querySelector('input[type="password"]');
    if (passwordField) {
      // Add password visibility toggle button
      const visibilityToggle = document.createElement('button');
      visibilityToggle.type = 'button';
      visibilityToggle.className = 'password-toggle';
      visibilityToggle.innerHTML = '<i class="icon-eye"></i>';
      visibilityToggle.setAttribute('aria-label', 'Toggle password visibility');
      visibilityToggle.setAttribute('tabindex', '-1'); // Don't interrupt tab flow
      
      passwordField.parentNode.appendChild(visibilityToggle);
      
      visibilityToggle.addEventListener('click', (e) => {
        e.preventDefault(); // Prevent form submission
        const newType = passwordField.type === 'password' ? 'text' : 'password';
        passwordField.type = newType;
        visibilityToggle.innerHTML = newType === 'password' ? 
          '<i class="icon-eye"></i>' : '<i class="icon-eye-slash"></i>';
      });
    }
    
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());
      
      // Basic validation for login
      if (!data.password) {
        errorDiv.textContent = 'Please enter your password';
        errorDiv.style.display = 'block';
        return;
      }
      
      await this._handleLogin(form, data, errorDiv);
    });
  }

  /**
   * Handles the login submission process
   * @param {HTMLElement} form - The login form
   * @param {Object} data - The form data
   * @param {HTMLElement} errorDiv - The error message container
   * @private
   */
  async _handleLogin(form, data, errorDiv) {
    try {
      // Prepare form and clear errors - Fix: Corrected method name
      this._prepareFormForSubmission(form, errorDiv);
      
      // Attempt login
      const loginResponse = await this._sendLoginRequest(data);
      
      // Re-enable form
      this._enableForm(form);
      
      // Handle response
      await this._processLoginResponse(loginResponse, data);
      
    } catch (error) {
      this._handleLoginError(error, form, errorDiv);
    }
  }

  /**
   * Prepares the form for submission by disabling inputs and clearing errors
   * @param {HTMLElement} form - The form element
   * @param {HTMLElement} errorDiv - The error message container
   * @private
   */
  _prepareFormForSubmission(form, errorDiv) {
    errorDiv.style.display = 'none';
    errorDiv.textContent = '';
    this._disableForm(form);
  }

  /**
   * Sends the login request to the server
   * @param {Object} data - The login credentials
   * @returns {Promise<Response>} The fetch response
   * @private
   */
  async _sendLoginRequest(data) {
    // Create a new object with login data
    const requestBody = {
      identifier: data.identifier,
      password: data.password,
      // Add extended session flag from remember me
      extendedSession: !!data.rememberMe
    };

    return await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      credentials: 'include'
    });
  }

  /**
   * Processes the login response
   * @param {Response} loginResponse - The fetch response
   * @param {Object} formData - The original form data
   * @private
   */
  async _processLoginResponse(loginResponse, formData) {
    if (!loginResponse.ok) {
      const errorMessage = await authErrorHandler.handleResponseError(loginResponse);
      throw new Error(errorMessage);
    }

    const loginResult = await this._safeParseJson(loginResponse);
    
    // Handle error response
    if (loginResult.error) {
      throw new Error(loginResult.error);
    }

    // Check if login was successful
    if (loginResult.message === "Login successful") {
      await this._completeSuccessfulLogin(loginResult, formData);
    } else {
      throw new Error('Unexpected server response');
    }
  }

  /**
   * Completes the login process after successful authentication
   * @param {Object} loginResult - The login response data
   * @param {Object} formData - The original form data
   * @private
   */
  async _completeSuccessfulLogin(loginResult, formData) {
    // Handle CSRF token if present
    if (loginResult.csrfToken) {
      csrfManager.storeToken(loginResult.csrfToken);
    }
    
    // Get complete user data if not provided in login response
    let userData = loginResult.user;
    
    if (!userData) {
      userData = await this._fetchUserData();
    }
    
    if (!userData || !userData.id) {
      throw new Error('Invalid user data received');
    }
    
    // Update user store
    this._updateUserStore(userData);
    
    // Redirect to home page
    window.location.href = '/';
  }

  /**
   * Fetches additional user data after login
   * @returns {Promise<Object>} User data
   * @private
   */
  async _fetchUserData() {
    const userDataResponse = await fetch('/api/check-auth', {
      method: 'GET',
      credentials: 'include',
      headers: { 'Accept': 'application/json' }
    });

    const checkAuthResult = await this._safeParseJson(userDataResponse);
    
    if (checkAuthResult.user) {
      return checkAuthResult.user;
    } else if (checkAuthResult.userID) {
      return { id: checkAuthResult.userID };
    } else {
      throw new Error('No user data in response');
    }
  }

  /**
   * Handles login errors
   * @param {Error} error - The error that occurred
   * @param {HTMLElement} form - The form element
   * @param {HTMLElement} errorDiv - The error message container
   * @private
   */
  _handleLoginError(error, form, errorDiv) {
    this._enableForm(form);
    const errorMessage = authErrorHandler.handleAuthError(error);
    errorDiv.textContent = errorMessage;
    errorDiv.style.display = 'block';
  }

  /**
   * Disables all form inputs and buttons
   * @param {HTMLElement} form - The form element
   * @private
   */
  _disableForm(form) {
    form.querySelectorAll('input, button, select').forEach(el => {
      // Don't disable the password visibility toggle button
      if (!el.classList.contains('password-toggle')) {
        el.disabled = true;
      }
    });
  }

  /**
   * Enables all form inputs and buttons
   * @param {HTMLElement} form - The form element
   * @private
   */
  _enableForm(form) {
    form.querySelectorAll('input, button, select').forEach(el => el.disabled = false);
  }

  /**
   * Evaluates password strength and updates strength meter
   * @param {Event} e - The input event
   * @private
   */
  _evaluatePasswordStrength(e) {
    const password = e.target.value;
    const meter = e.target.parentElement.querySelector('.password-strength-meter');
    
    if (!meter) return;
    
    const sections = meter.querySelectorAll('.meter-section');
    
    // Clear existing classes
    sections.forEach(section => {
      section.className = 'meter-section';
    });
    
    // Evaluate strength
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    
    // Update meter
    for (let i = 0; i < strength; i++) {
      if (sections[i]) {
        sections[i].classList.add(
          strength === 1 ? 'weak' : 
          strength === 2 ? 'medium' : 
          strength === 3 ? 'good' : 
          'strong'
        );
      }
    }
  }

  /**
   * Attaches the event handler for the registration form submission.
   * @param {HTMLElement} form - The registration form element
   */
  attachRegisterHandler(form) {
    const errorDiv = document.getElementById('registerError');
    errorDiv.classList.add('auth-error-message');
    
    // Set up password strength meter if password field exists
    const passwordField = form.querySelector('input[type="password"]');
    if (passwordField) {
      passwordField.addEventListener('input', this._evaluatePasswordStrength);
      
      // Add password visibility toggle with the same improvements
      const visibilityToggle = document.createElement('button');
      visibilityToggle.type = 'button';
      visibilityToggle.className = 'password-toggle';
      visibilityToggle.innerHTML = '<i class="icon-eye"></i>';
      visibilityToggle.setAttribute('aria-label', 'Toggle password visibility');
      visibilityToggle.setAttribute('tabindex', '-1'); // Don't interrupt tab flow
      
      passwordField.parentNode.appendChild(visibilityToggle);
      
      visibilityToggle.addEventListener('click', (e) => {
        e.preventDefault(); // Prevent form submission
        const newType = passwordField.type === 'password' ? 'text' : 'password';
        passwordField.type = newType;
        visibilityToggle.innerHTML = newType === 'password' ? 
          '<i class="icon-eye"></i>' : '<i class="icon-eye-slash"></i>';
      });
    }
    
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      // Validate password strength before submission
      if (passwordField && !this._isPasswordStrong(passwordField.value)) {
        errorDiv.textContent = 'Please use a stronger password that meets all requirements.';
        errorDiv.style.display = 'block';
        return;
      }
      
      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());
      
      // Convert age from string to integer
      data.age = parseInt(data.age, 10);

      await this._handleRegistration(form, data, errorDiv);
    });
  }

  /**
   * Checks if a password meets strength requirements
   * @param {string} password - The password to check
   * @returns {boolean} True if the password is strong enough
   * @private
   */
  _isPasswordStrong(password) {
    return password.length >= 8 && 
           /[A-Z]/.test(password) && 
           /[0-9]/.test(password) && 
           /[^A-Za-z0-9]/.test(password);
  }

  /**
   * Handles the registration submission process
   * @param {HTMLElement} form - The registration form
   * @param {Object} data - The form data
   * @param {HTMLElement} errorDiv - The error message container
   * @private
   */
  async _handleRegistration(form, data, errorDiv) {
    try {
      this._disableForm(form);
      errorDiv.style.display = 'none';
      
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include'
      });

      if (!response.ok) {
        const errorMessage = await authErrorHandler.handleResponseError(response);
        throw new Error(errorMessage);
      }

      const result = await this._safeParseJson(response);
      
      // Handle CSRF token
      if (result.csrfToken) {
        csrfManager.storeToken(result.csrfToken);
      }
      
      // Update user store
      if (result.user) {
        this._updateUserStore(result.user);
      }
      
      // Redirect to home
      window.location.href = '/';
      
    } catch (error) {
      this._enableForm(form);
      const errorMessage = authErrorHandler.handleAuthError(error);
      errorDiv.textContent = errorMessage;
      errorDiv.style.display = 'block';
    }
  }

  /**
   * Logs out the current user.
   */
  async logout() {
    try {
      // Close WebSocket connection if it exists
      if (window.mainContent?.messagesView?.closeWebSocket) {
        window.mainContent.messagesView.closeWebSocket();
      } else {
        closeWebSocket();
      }

      // Get CSRF token
      const csrfToken = csrfManager.getToken();
      
      const response = await fetch('/api/logout', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken || ''
        }
      });

      // Regardless of server response, clean up client-side state
      this._cleanupAfterLogout();
      
      // If server response indicates an error, log it but don't block logout
      if (!response.ok) {
        const errorData = await this._safeParseJson(response);
        console.error('Logout had server errors:', errorData?.message || 'Unknown error');
      }
      
      // Redirect to login
      window.location.href = '/login';
      
    } catch (error) {
      console.error('Logout error:', error);
      
      // Even on error, attempt to clean up and redirect
      this._cleanupAfterLogout();
      window.location.href = '/login';
    }
  }

  /**
   * Cleans up client-side state after logout
   * @private
   */
  _cleanupAfterLogout() {
    // Clear CSRF token
    csrfManager.clearToken();
    
    // Clear user state
    userStore.logout();
    
    // Clear votes
    voteStore.clearVotes();
  }
}

/**
 * Creates an instance of Auth and performs an authentication check.
 * @returns {Promise<boolean>} The result of checkAuthStatus.
 */
export function checkAuth() {
  const auth = new Auth();
  return auth.checkAuthStatus();
}

/**
 * Initializes authentication-related UI.
 * Renders the appropriate form based on the current URL path.
 * @param {string} type - The type of form to render ('login' or 'register')
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
 * @returns {Promise<void>}
 */
export function logout() {
  const auth = new Auth();
  return auth.logout();
}