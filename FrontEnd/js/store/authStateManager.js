import userStore from './userStore.js';

class AuthStateManager {
  constructor() {
    this.authCheckPromise = null;
    this.lastCheck = 0;
    this.cacheTimeout = 30000; // 30 seconds
    this.subscribers = new Set();
    this.initialized = false;
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  notifySubscribers(authState) {
    this.subscribers.forEach(callback => callback(authState));
  }

  async checkAuth() {
    const now = Date.now();
    
    if (this.authCheckPromise && (now - this.lastCheck) < this.cacheTimeout) {
      return this.authCheckPromise;
    }

    this.lastCheck = now;
    this.authCheckPromise = (async () => {
      try {
        const response = await fetch('/api/check-auth', {
          credentials: 'include',
          headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.loggedIn && data.userID) {
          // First check if we need to fetch user data
          if (!userStore.getUser(data.userID)) {
            try {
              // Fetch user data from backend
              const userResponse = await fetch(`/api/user/profile`, {
                credentials: 'include',
                headers: { 
                  'Accept': 'application/json',
                  'X-CSRF-Token': data.csrfToken || this.getCSRFToken() || ''
                }
              });
              
              if (!userResponse.ok) {
                throw new Error(`Failed to fetch user data: ${userResponse.status}`);
              }

              let userData;
              try {
                userData = await userResponse.json();
              } catch (parseError) {
                console.error('Failed to parse user data:', parseError);
                throw new Error('Invalid user data received from server');
              }

              if (!userData || typeof userData !== 'object') {
                throw new Error('Invalid user data format');
              }

              // Ensure the user data has the correct ID
              userData.id = data.userID;
              userStore.addUser(userData);
            } catch (error) {
              console.error('Failed to fetch user data:', error);
              // Don't throw here, continue with basic auth data
            }
          }
          
          // Now try to authenticate
          try {
            userStore.authenticateUser(data.userID);
          } catch (error) {
            console.warn('Authentication failed:', error);
            data.loggedIn = false;
          }
          
          if (data.csrfToken) {
            this.updateCSRFToken(data.csrfToken);
          }
        } else {
          userStore.logout();
        }

        this.initialized = true;
        this.notifySubscribers({ isAuthenticated: data.loggedIn });
        return data;

      } catch (error) {
        console.error('Auth check failed:', error);
        userStore.logout();
        this.notifySubscribers({ isAuthenticated: false });
        throw error;
      } finally {
        this.authCheckPromise = null;
      }
    })();

    return this.authCheckPromise;
  }

  updateCSRFToken(token) {
    if (!token) return;
    
    localStorage.setItem('csrfToken', token);
    let metaTag = document.querySelector('meta[name="csrf-token"]');
    if (!metaTag) {
      metaTag = document.createElement('meta');
      metaTag.setAttribute('name', 'csrf-token');
      document.head.appendChild(metaTag);
    }
    metaTag.setAttribute('content', token);
  }

  getCSRFToken() {
    return localStorage.getItem('csrfToken') || 
           document.querySelector('meta[name="csrf-token"]')?.content;
  }

  clearAuth() {
    localStorage.removeItem('csrfToken');
    document.querySelector('meta[name="csrf-token"]')?.remove();
    userStore.logout();
    this.notifySubscribers({ isAuthenticated: false });
  }

  isInitialized() {
    return this.initialized;
  }
}

// Create and export singleton instance
export const authStateManager = new AuthStateManager();

// Remove the automatic initialization on module load
// Let the app.js handle initialization 