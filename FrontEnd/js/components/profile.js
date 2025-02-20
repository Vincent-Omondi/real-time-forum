export class Profile {
    constructor() {
        this.container = document.getElementById('app-container');
        this.defaultAvatarPath = './assets/images/default-avatar.png';
    }

    async render() {
        this.container.innerHTML = this.getProfileHTML();
        this.attachEventListeners();
        await this.loadUserData();
    }

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

    async loadUserData() {
        try {
            const response = await fetch('/api/user/profile', {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to load user data');
            }

            const userData = await response.json();
            this.updateProfileUI(userData);
        } catch (error) {
            console.error('Error loading user data:', error);
            // Show error message to user
            this.container.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>Failed to load profile data. Please try again later.</p>
                </div>
            `;
        }
    }

    updateProfileUI(userData) {
        if (!userData) return;
        
        const {
            nickname,
            first_name,
            last_name,
            email,
            created_at
        } = userData;

        // Only create full name if both first_name and last_name exist and are not empty
        let displayName = nickname;
        if (first_name && last_name && first_name.trim() && last_name.trim()) {
            const fullName = `${first_name} ${last_name}`.trim();
            displayName = `${fullName} (${nickname})`;
        }
        
        // Update profile information
        document.getElementById('username').textContent = displayName;
        document.getElementById('email').textContent = email || 'No email provided';
        document.getElementById('joinDate').textContent = `Joined: ${new Date(created_at).toLocaleDateString()}`;
        
        // Update avatar if available
        const avatarImg = document.querySelector('.avatar-large');
        if (avatarImg) {
            avatarImg.src = this.defaultAvatarPath;
            avatarImg.alt = `${nickname}'s profile picture`;
        }
        
        // Update header profile section
        this.updateHeaderProfileUI(userData);
    }

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
                    <a href="/profile" class="dropdown-item">
                        <i class="fas fa-user"></i> My Profile
                    </a>
                    <button class="dropdown-item" id="logoutButton">
                        <i class="fas fa-sign-out-alt"></i> Logout
                    </button>
                </div>
            </div>
        `;

        // After HTML is populated, add event listeners
        this.attachDropdownEventListeners(userSection);
    }

    attachDropdownEventListeners(userSection) {
        const profileTrigger = userSection.querySelector('.profile-trigger');
        const profileDropdown = userSection.querySelector('.profile-dropdown');
        const logoutButton = document.getElementById('logoutButton');

        if (profileTrigger && profileDropdown) {
            // Toggle dropdown on click
            profileTrigger.addEventListener('click', (e) => {
                e.stopPropagation();
                profileDropdown.classList.toggle('show');
            });

            // Close dropdown when clicking outside
            document.addEventListener('click', () => {
                profileDropdown.classList.remove('show');
            });
        }

        // Add click event for logout
        if (logoutButton) {
            logoutButton.addEventListener('click', () => {
                this.handleLogout();
            });
        }
    }

    async handleLogout() {
        try {
            // First check auth status to get fresh CSRF token
            const authResponse = await fetch('/api/check-auth', {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
    
            if (!authResponse.ok) {
                throw new Error('Failed to verify authentication');
            }
    
            const authData = await authResponse.json();
            if (!authData.csrfToken) {
                throw new Error('No CSRF token available');
            }
    
            // Close WebSocket connection if it exists
            if (this.webSocket && this.webSocket.readyState === WebSocket.OPEN) {
                this.webSocket.close();
            }
    
            // Now make the logout request with the fresh CSRF token
            const response = await fetch("/api/logout", { 
                method: "POST", 
                credentials: "include",
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': authData.csrfToken
                }
            });
            
            if (response.ok) {
                // Clear any stored tokens
                document.querySelector('meta[name="csrf-token"]')?.remove();
                window.location.href = "/login";
            } else {
                const error = await response.json();
                console.error("Logout failed:", error.message || "Unknown error");
            }
        } catch (error) {
            console.error("Logout failed:", error);
        }
    }

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

    renderActivityContent(tab, data) {
        const contentDiv = document.getElementById('activities-content');
        if (!Array.isArray(data) || data.length === 0) {
            contentDiv.innerHTML = `<p>No ${tab} found.</p>`;
            return;
        }

        const content = data.map(item => {
            const {
                title,
                content,
                created_at,
                likes,
            } = item;

            return `
                <div class="activity-item">
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

    async updateProfile(profileData) {
        try {
            // Validate profile data structure
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

    // Utility method to prevent XSS
    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
} 