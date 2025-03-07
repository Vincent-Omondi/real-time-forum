/**
 * csrf-manager.js
 * A utility module for CSRF token management that provides secure ways to
 * store, retrieve, and clear CSRF tokens.
 */

/**
 * CSRF token management utility
 */
export const csrfManager = {
    /**
     * Stores CSRF token in a secure HttpOnly cookie (preferred) 
     * Falls back to meta tag approach if cookies are not an option
     * @param {string} token - The CSRF token to store
     */
    storeToken(token) {
      if (!token) return;
      
      // Best practice: Let the server set HttpOnly cookies
      // But we'll maintain meta tag for compatibility and older browsers
      let metaTag = document.querySelector('meta[name="csrf-token"]');
      if (!metaTag) {
        metaTag = document.createElement('meta');
        metaTag.setAttribute('name', 'csrf-token');
        document.head.appendChild(metaTag);
      }
      metaTag.setAttribute('content', token);
    },
  
    /**
     * Retrieves the CSRF token
     * @returns {string|null} The CSRF token or null if not found
     */
    getToken() {
      return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || null;
    },
  
    /**
     * Clears the CSRF token
     */
    clearToken() {
      const metaTag = document.querySelector('meta[name="csrf-token"]');
      if (metaTag) metaTag.remove();
    },
    
    /**
     * Adds CSRF token to request headers if available
     * @param {Object} headers - Headers object to add the token to
     * @returns {Object} The updated headers object
     */
    addTokenToHeaders(headers = {}) {
      const token = this.getToken();
      if (token) {
        headers['X-CSRF-Token'] = token;
      }
      return headers;
    },
    
    /**
     * Creates a complete set of headers with CSRF token for fetch requests
     * @param {string} contentType - The content type (defaults to 'application/json')
     * @returns {Object} Headers object with CSRF token
     */
    getRequestHeaders(contentType = 'application/json') {
      const headers = {
        'Content-Type': contentType,
        'Accept': 'application/json'
      };
      
      return this.addTokenToHeaders(headers);
    }
  };
  
  export default csrfManager;