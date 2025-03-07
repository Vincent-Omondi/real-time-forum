/**
 * auth-error-handler.js
 * A utility for consistent handling of authentication errors
 * with graceful fallbacks and security considerations.
 */

/**
 * Maps HTTP status codes to user-friendly error messages
 */
const HTTP_ERROR_MESSAGES = {
    400: 'The request was invalid. Please check your information and try again.',
    401: 'Your session has expired. Please log in again.',
    403: 'You do not have permission to perform this action.',
    404: 'The requested resource was not found.',
    429: 'Too many attempts. Please try again later.',
    500: 'A server error occurred. Please try again later.',
    503: 'The service is temporarily unavailable. Please try again later.'
  };
  
  /**
   * Authentication error handler utility
   */
  export const authErrorHandler = {
    /**
     * Gets a user-friendly message for an HTTP status code
     * @param {number} statusCode - The HTTP status code
     * @returns {string} A user-friendly error message
     */
    getMessageForStatusCode(statusCode) {
      return HTTP_ERROR_MESSAGES[statusCode] || 'An unexpected error occurred. Please try again.';
    },
    
    /**
     * Handles API response errors for auth operations
     * @param {Response} response - The fetch response object
     * @returns {Promise<string>} A promise that resolves to an error message
     */
    async handleResponseError(response) {
      // Try to get error details from response body
      let errorMessage = this.getMessageForStatusCode(response.status);
      
      try {
        const errorData = await response.json();
        // Only use server message if it's reasonable and not exposing internals
        if (errorData.message && errorData.message.length < 150) {
          errorMessage = errorData.message;
        }
      } catch (e) {
        // If JSON parsing fails, use the status-based message
        console.warn('Could not parse error response JSON', e);
      }
      
      return errorMessage;
    },
    
    /**
     * Handles network errors during auth operations
     * @param {Error} error - The error object
     * @returns {string} A user-friendly error message
     */
    handleNetworkError(error) {
      console.error('Network error during auth operation:', error);
      
      if (error.name === 'AbortError') {
        return 'The request was cancelled. Please try again.';
      }
      
      if (error.message.includes('Failed to fetch') || 
          error.message.includes('NetworkError')) {
        return 'Unable to connect to the server. Please check your internet connection.';
      }
      
      // For security, use generic messages for unexpected errors
      return 'An error occurred. Please try again later.';
    },
    
    /**
     * Safely parses JSON from auth API responses
     * @param {Response} response - The fetch response
     * @returns {Promise<Object|null>} The parsed JSON or null on error
     */
    async safeParseJson(response) {
      try {
        return await response.json();
      } catch (error) {
        console.error('Failed to parse auth response:', error);
        return null;
      }
    },
    
    /**
     * Handles authentication errors with appropriate logging and actions
     * @param {Error} error - The error that occurred
     * @param {Function} callback - Optional callback for additional actions
     * @returns {string} A user-friendly error message
     */
    handleAuthError(error, callback = null) {
      // For security, use generic message with specific cases only for expected issues
      let message = 'Authentication failed. Please try again.';
      
      if (error.message.includes('Invalid credentials') || 
          error.message.includes('incorrect password')) {
        message = 'Invalid email/username or password. Please try again.';
      } else if (error.message.includes('expired')) {
        message = 'Your session has expired. Please log in again.';
      } else if (error.message.includes('account locked')) {
        message = 'Your account has been temporarily locked due to too many failed attempts. Please try again later.';
      }
      
      // Log error but don't expose details to user
      console.error('Auth error:', error);
      
      // Execute callback if provided
      if (callback && typeof callback === 'function') {
        callback(error, message);
      }
      
      return message;
    }
  };
  
  export default authErrorHandler;