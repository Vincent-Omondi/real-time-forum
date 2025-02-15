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
        
        // Use nickname as username if username is not available
        const username = userData.username || userData.nickname;
        const avatarUrl = userData.avatar_url || this.defaultAvatarPath;
        
        document.getElementById('username').textContent = username;
        document.getElementById('email').textContent = userData.email;
        document.getElementById('joinDate').textContent = `Joined: ${new Date(userData.created_at).toLocaleDateString()}`;
        
        // Update avatar if available
        const avatarImg = document.querySelector('.avatar-large');
        if (avatarImg) {
            avatarImg.src = avatarUrl;
        }
        
        // Update header profile section
        this.updateHeaderProfileUI(userData);
    }

    updateHeaderProfileUI(userData) {
        if (!userData) return;
        
        const userSection = document.getElementById('userSection');
        if (!userSection) return;

        // Use nickname as username if username is not available
        const username = userData.username || userData.nickname;
        const avatarUrl = userData.avatar_url || this.defaultAvatarPath;

        userSection.innerHTML = `
            <div class="profile-section">
                <div class="profile-trigger">
                    <img src="${avatarUrl}" alt="Profile" class="avatar">
                    <span class="username-display">${username}</span>
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
        
        // Add click event for logout
        document.getElementById('logoutButton').addEventListener('click', () => {
            this.handleLogout();
        });

        // Toggle dropdown on click
        const profileTrigger = userSection.querySelector('.profile-trigger');
        profileTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            userSection.querySelector('.profile-dropdown').classList.toggle('show');
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', () => {
            userSection.querySelector('.profile-dropdown').classList.remove('show');
        });
    }

    async handleLogout() {
        try {
            const response = await fetch("/logout", { 
                method: "POST", 
                credentials: "include" 
            });
            
            if (response.ok) {
                window.location.href = "/login";
            } else {
                console.error("Logout failed");
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
        if (data.length === 0) {
            contentDiv.innerHTML = `<p>No ${tab} found.</p>`;
            return;
        }

        const content = data.map(item => {
            return `
                <div class="activity-item">
                    <h4>${item.title}</h4>
                    <p>${item.content.substring(0, 100)}...</p>
                    <div class="activity-meta">
                        <span>${new Date(item.created_at).toLocaleDateString()}</span>
                        ${tab === 'posts' ? 
                            `<span>${item.likes} likes</span>` : 
                            '<span>You liked this</span>'}
                    </div>
                </div>
            `;
        }).join('');

        contentDiv.innerHTML = content;
    }

    async updateProfile(profileData) {
        try {
            const response = await fetch('/api/user/profile/update', {
                method: 'PUT',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(profileData)
            });

            if (!response.ok) {
                throw new Error('Failed to update profile');
            }

            const result = await response.json();
            return result;
        } catch (error) {
            console.error('Error updating profile:', error);
            throw error;
        }
    }
} 