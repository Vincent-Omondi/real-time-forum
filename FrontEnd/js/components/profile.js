import userStore from '../store/userStore.js';
import { logout } from '../components/auth.js';

export class Profile {
  constructor() {
    this.container = document.querySelector('.main-content');
    this.defaultAvatarPath = './assets/images/default-avatar.png';
  }

  /**
   * Renders the full profile page.
   */
  async render() {
    if (!this.container) {
      console.error('Main content container not found');
      return;
    }
    this.container.innerHTML = this.getProfileHTML();
    this.attachEventListeners();
    await this.loadUserData();
  }

  /**
   * Returns the HTML structure for the profile page.
   */
  getProfileHTML() {
    return `
      <div class="profile-section">
        <div class="profile-header">
          <div class="profile-image-large">
            <img src="${this.defaultAvatarPath}" alt="Profile" class="avatar-large">
          </div>
          <div class="profile-info">
            <h2 id="username">Loading...</h2>
            <p id="email">Loading...</p>
            <p id="joinDate">Joined: Loading...</p>
          </div>
        </div>
        <div class="profile-activities">
          <h3>My Activities</h3>
          <div class="activities-tabs">
            <button class="tab-button active" data-tab="posts">My Posts</button>
            <button class="tab-button" data-tab="likes">My Likes</button>
          </div>
          <div id="activities-content" class="activities-content">
            <!-- Content will be loaded here -->
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Attaches event listeners for tabs in the profile page.
   */
  attachEventListeners() {
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        tabButtons.forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        this.loadActivityContent(e.target.dataset.tab);
      });
    });
  }

  /**
   * Loads the current user data from the centralized state (userStore) and updates the UI.
   */
  async loadUserData() {
    try {
      const currentUser = userStore.getCurrentUser();
      console.log('Current user data:', currentUser);
      
      // Fetch fresh user data from the server
      const response = await fetch('/api/user/profile', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user profile');
      }

      const userData = await response.json();
      console.log('Fetched user data:', userData);

      // Use nickname as ID if no ID is provided
      if (userData && userData.nickname) {
        const userWithId = {
          ...userData,
          id: userData.id || userData.nickname // fallback to nickname if no id
        };
        
        // Update the store with the new user data
        userStore.updateUser(userWithId.id, userWithId);
        
        // If we don't have a current user set, authenticate this user
        if (!currentUser) {
          userStore.authenticateUser(userWithId.id);
        }
        
        this.updateProfileUI(userWithId);
      } else {
        console.error('Invalid user data received from server:', userData);
        throw new Error('Invalid user data received from server');
      }

    } catch (error) {
      console.error('Error loading user data:', error);
      this.container.innerHTML = `
        <div class="error-message">
          <i class="fas fa-exclamation-circle"></i>
          <p>Failed to load profile data. Please try again later.</p>
          <p class="error-details">${error.message}</p>
        </div>
      `;
      
      // If we get an error and there's no authenticated user, redirect to login
      if (!userStore.getCurrentUser()) {
        if (window.router) {
          window.router.navigateTo('/login');
        } else {
          window.location.href = '/login';
        }
      }
    }
  }

  /**
   * Updates the profile page UI with the provided user data.
   * @param {Object} userData - The user data object.
   */
  updateProfileUI(userData) {
    if (!userData) return;

    const { 
      nickname, 
      first_name, 
      last_name, 
      email, 
      created_at 
    } = userData;

    // Construct display name: use full name if available, otherwise fall back to nickname
    let displayName = nickname;
    if (first_name && last_name && first_name.trim() && last_name.trim()) {
      const fullName = `${first_name} ${last_name}`.trim();
      displayName = `${fullName} (${nickname})`;
    }

    // Format the date properly
    let joinDate = 'Join date not available';
    if (created_at) {
      try {
        // Ensure created_at is properly parsed
        const date = new Date(created_at);
        if (!isNaN(date.getTime())) {
          joinDate = date.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });
        }
      } catch (error) {
        console.error('Error parsing date:', error);
      }
    }

    document.getElementById('username').textContent = displayName || 'Anonymous';
    document.getElementById('email').textContent = email || 'No email provided';
    document.getElementById('joinDate').textContent = `Joined: ${joinDate}`;

    // Update avatar image
    const avatarImg = document.querySelector('.avatar-large');
    if (avatarImg) {
      avatarImg.src = userData.avatar_url || this.defaultAvatarPath;
      avatarImg.alt = `${displayName}'s profile picture`;
    }

    // Update header profile section
    this.updateHeaderProfileUI(userData);
  }

  /**
   * Updates the header profile section with the provided user data.
   * @param {Object} userData - The user data object.
   */
  updateHeaderProfileUI(userData) {
    if (!userData) return;

    const userSection = document.getElementById('userSection');
    if (!userSection) return;

    const { nickname } = userData;

    userSection.innerHTML = `
      <div class="profile-section">
        <div class="profile-trigger">
          <img src="${this.defaultAvatarPath}" alt="${nickname}'s profile picture" class="avatar">
          <span class="username-display">${this.escapeHtml(nickname)}</span>
          <i class="fas fa-chevron-down"></i>
        </div>
        <div class="profile-dropdown">
          <a data-link href="/profile" class="dropdown-item">
            <i class="fas fa-user"></i> My Profile
          </a>
          <button class="dropdown-item" id="logoutButton">
            <i class="fas fa-sign-out-alt"></i> Logout
          </button>
        </div>
      </div>
    `;

    this.attachDropdownEventListeners(userSection);
  }

  /**
   * Attaches event listeners for the dropdown in the header profile section.
   * @param {HTMLElement} userSection - The DOM element containing the user section.
   */
  attachDropdownEventListeners(userSection) {
    const profileTrigger = userSection.querySelector('.profile-trigger');
    const profileDropdown = userSection.querySelector('.profile-dropdown');
    const logoutButton = document.getElementById('logoutButton');

    if (profileTrigger && profileDropdown) {
      profileTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        profileDropdown.classList.toggle('show');
      });

      document.addEventListener('click', () => {
        profileDropdown.classList.remove('show');
      });
    }

    if (logoutButton) {
      logoutButton.addEventListener('click', () => {
        this.handleLogout();
      });
    }
  }

  /**
   * Handles user logout by delegating to the centralized logout function.
   */
  async handleLogout() {
    try {
      await logout();
      // Clear any user data from store
      userStore.logout();
      // Refresh the page to ensure a clean state
      window.location.reload();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  }

  /**
   * Loads the activity content (posts or likes) for the given tab.
   * @param {string} tab - The selected tab ('posts' or 'likes').
   */
  async loadActivityContent(tab) {
    const contentDiv = document.getElementById('activities-content');
    contentDiv.innerHTML = '<p>Loading...</p>';

    try {
      const endpoint = tab === 'posts' ? '/api/user/posts' : '/api/user/likes';
      const response = await fetch(endpoint, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to load ${tab}`);
      }

      const data = await response.json();
      this.renderActivityContent(tab, data);
    } catch (error) {
      console.error(`Error loading ${tab}:`, error);
      contentDiv.innerHTML = `
        <div class="error-message">
          <i class="fas fa-exclamation-circle"></i>
          <p>Failed to load content. Please try again later.</p>
        </div>
      `;
    }
  }

  /**
   * Renders the activity content for the given tab.
   * @param {string} tab - The activity tab ('posts' or 'likes').
   * @param {Array} data - Array of activity items.
   */
  renderActivityContent(tab, data) {
    const contentDiv = document.getElementById('activities-content');
    if (!Array.isArray(data) || data.length === 0) {
      contentDiv.innerHTML = `<p>No ${tab} found.</p>`;
      return;
    }

    const content = data.map(item => {
      const { title, content, created_at, likes, id } = item;
      return `
        <div class="activity-item" data-link href="/viewPost?id=${id}">
          <h4>${this.escapeHtml(title)}</h4>
          <p>${this.escapeHtml(content.substring(0, 100))}${content.length > 100 ? '...' : ''}</p>
          <div class="activity-meta">
            <span>${new Date(created_at).toLocaleDateString()}</span>
            ${tab === 'posts' ? 
              `<span>${likes} like${likes !== 1 ? 's' : ''}</span>` : 
              '<span>You liked this</span>'}
          </div>
        </div>
      `;
    }).join('');

    contentDiv.innerHTML = content;
  }

  /**
   * Updates the user's profile information.
   * @param {Object} profileData - The profile data to update.
   * @returns {Promise<Object>} The server response.
   */
  async updateProfile(profileData) {
    try {
      const validatedData = {
        first_name: profileData.first_name || '',
        last_name: profileData.last_name || ''
      };

      const response = await fetch('/api/user/profile/update', {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(validatedData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update profile');
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  }

  /**
   * Escapes HTML to prevent XSS attacks.
   * @param {string} unsafe - The untrusted string.
   * @returns {string} The escaped string.
   */
  escapeHtml(unsafe) {
    if (!unsafe) return '';
    return String(unsafe)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}
