/**
 * userStore.js
 *
 * A centralized state management module for user data and authentication.
 * This module manages user state (stored internally as a Map keyed by user id)
 * and provides robust methods to add, update, remove, and retrieve users.
 * It also implements a subscription system to allow other parts of the application
 * to listen for state changes.
 *
 * Additionally, this version includes a basic authentication mechanism.
 * Only authenticated users (i.e. when a valid user is set as the current user)
 * should be allowed to see main contents. Note that for true production use,
 * authentication should involve secure server-side checks and token management.
 *
 * Usage Example:
 *
 *   import userStore from './userStore.js';
 *
 *   // Subscribe to state changes (including authentication events)
 *   const unsubscribe = userStore.subscribe((event, currentUsers) => {
 *     console.log('State changed:', event, currentUsers);
 *   });
 *
 *   // Add a new user (user object must have a unique id)
 *   userStore.addUser({ id: 1, name: 'Alice', email: 'alice@example.com' });
 *
 *   // Authenticate a user (only valid if the user exists)
 *   userStore.authenticateUser(1);
 *
 *   // Check if a user is authenticated before rendering premium content
 *   if (userStore.isAuthenticated()) {
 *     // Render premium content
 *   }
 *
 *   // Update an existing user
 *   userStore.updateUser(1, { email: 'alice.new@example.com' });
 *
 *   // Remove a user (if removed, consider logging out if this was the authenticated user)
 *   userStore.removeUser(1);
 *
 *   // Logout the current user
 *   userStore.logout();
 *
 *   // Unsubscribe when done
 *   unsubscribe();
 */

class UserStore {
  #currentUser = null;  // Private field
  #users = new Map();   // Private field
  #subscribers = [];    // Private field
  #lastAuthCheck = null; // Private field to track when auth was last checked
  #authCacheExpiryMs = 30000; // Auth cache expires after 30 seconds by default

  /**
   * Retrieve all users.
   * @returns {Array<Object>} A shallow copy array of user objects.
   */
  getUsers() {
    return Array.from(this.#users.values());
  }

  /**
   * Retrieve a single user by id.
   * @param {string|number} id - The unique identifier of the user.
   * @returns {Object|null} The user object if found; otherwise, null.
   */
  getUser(id) {
    return this.#users.get(id) || null;
  }

  /**
   * Add a new user.
   * @param {Object} user - The user object. Must include a non-null/undefined 'id' property.
   * @throws Will throw an error if the user object is invalid or a user with the same id exists.
   */
  addUser(user) {
    if (!user || typeof user !== 'object') {
      throw new Error('Invalid user object');
    }
    if (user.id === undefined || user.id === null) {
      throw new Error('User must have a valid id property');
    }
    if (this.#users.has(user.id)) {
      throw new Error(`User with id ${user.id} already exists`);
    }
    this.#users.set(user.id, user);
    this._notifySubscribers({ type: 'ADD_USER', payload: user });
  }

  /**
   * Update an existing user.
   * @param {string|number} id - The unique identifier of the user.
   * @param {Object} updatedProperties - An object with properties to update.
   * @throws Will throw an error if the user does not exist or updatedProperties is not a valid object.
   */
  updateUser(id, updatedProperties) {
    if (!this.#users.has(id)) {
      throw new Error(`User with id ${id} does not exist`);
    }
    if (!updatedProperties || typeof updatedProperties !== 'object') {
      throw new Error('updatedProperties must be an object');
    }
    const user = this.#users.get(id);
    const updatedUser = { ...user, ...updatedProperties };
    this.#users.set(id, updatedUser);
    this._notifySubscribers({ type: 'UPDATE_USER', payload: updatedUser });

    // If the updated user is the currently authenticated user, update authentication state
    if (this.#currentUser && this.#currentUser.id === id) {
      this.#currentUser = updatedUser;
      this._notifySubscribers({ type: 'CURRENT_USER_UPDATED', payload: updatedUser });
    }
  }

  /**
   * Remove a user.
   * @param {string|number} id - The unique identifier of the user.
   * @throws Will throw an error if the user does not exist.
   */
  removeUser(id) {
    if (!this.#users.has(id)) {
      throw new Error(`User with id ${id} does not exist`);
    }
    const user = this.#users.get(id);
    this.#users.delete(id);
    this._notifySubscribers({ type: 'REMOVE_USER', payload: user });

    // If the removed user was the authenticated user, log them out.
    if (this.#currentUser && this.#currentUser.id === id) {
      this.logout();
    }
  }

  /**
   * Subscribe to state changes.
   * @param {Function} callback - A function to be called on every state change.
   * @returns {Function} A function that, when called, unsubscribes the callback.
   */
  subscribe(callback) {
    if (typeof callback !== 'function') {
      throw new Error('Subscriber must be a function');
    }
    this.#subscribers.push(callback);
    return () => {
      this.unsubscribe(callback);
    };
  }

  /**
   * Unsubscribe from state changes.
   * @param {Function} callback - The callback function to remove.
   */
  unsubscribe(callback) {
    this.#subscribers = this.#subscribers.filter(sub => sub !== callback);
  }

  /**
   * Notify all subscribers about a state change.
   * @param {Object} event - An event object containing { type, payload }.
   * @private
   */
  _notifySubscribers(event) {
    this.#subscribers.forEach(callback => {
      try {
        callback(event, this.getUsers());
      } catch (err) {
        console.error('Error in subscriber callback:', err);
      }
    });
  }

  /**
   * Authenticate a user by setting the current user.
   * @param {string|number} id - The user id to authenticate.
   * @throws Will throw an error if the user does not exist.
   */
  authenticateUser(id) {
    const user = this.getUser(id);
    if (!user) {
      throw new Error(`User with id ${id} does not exist. Cannot authenticate.`);
    }
    this.#currentUser = user;
    this.#lastAuthCheck = Date.now(); // Update the last auth check timestamp
    this._notifySubscribers({ type: 'USER_AUTHENTICATED', payload: user });
  }

  /**
   * Retrieve the currently authenticated user.
   * @returns {Object|null} The authenticated user object, or null if no user is authenticated.
   */
  getCurrentUser() {
    return this.#currentUser;
  }

  /**
   * Check if a user is currently authenticated.
   * @returns {boolean} True if a user is authenticated, false otherwise.
   */
  isAuthenticated() {
    return this.#currentUser !== null;
  }

  /**
   * Log out the currently authenticated user.
   */
  logout() {
    if (this.#currentUser) {
      const user = this.#currentUser;
      this.#currentUser = null;
      this.#lastAuthCheck = Date.now(); // Update the last auth check timestamp
      this._notifySubscribers({ type: 'USER_LOGOUT', payload: user });
    }
  }

  /**
   * Set the expiry time for authentication cache in milliseconds.
   * @param {number} milliseconds - The cache expiry time in milliseconds.
   */
  setAuthCacheExpiry(milliseconds) {
    if (typeof milliseconds !== 'number' || milliseconds < 0) {
      throw new Error('Cache expiry must be a positive number');
    }
    this.#authCacheExpiryMs = milliseconds;
  }

  /**
   * Checks if authentication status needs to be refreshed from the server.
   * Returns true if auth hasn't been checked yet or if the cache has expired.
   * @returns {boolean} True if auth needs to be checked, false otherwise.
   */
  shouldCheckAuth() {
    // If we've never checked auth, we need to check
    if (this.#lastAuthCheck === null) {
      return true;
    }
    
    // Check if cache has expired
    const elapsed = Date.now() - this.#lastAuthCheck;
    return elapsed > this.#authCacheExpiryMs;
  }

  /**
   * Updates the last authentication check timestamp without changing the auth state.
   * This is useful when we've checked auth with the server but user status hasn't changed.
   */
  updateAuthCheckTimestamp() {
    this.#lastAuthCheck = Date.now();
  }

  /**
   * Get the timestamp of the last authentication check.
   * @returns {number|null} Timestamp in milliseconds, or null if never checked.
   */
  getLastAuthCheckTime() {
    return this.#lastAuthCheck;
  }
}

// Create a singleton instance of UserStore
const userStore = new UserStore();

export default userStore;