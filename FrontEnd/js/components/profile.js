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
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error('Failed to load user data');
            }

            const userData = await response.json();
            this.updateProfileUI(userData);
        } catch (error) {
            console.error('Error loading user data:', error);
            // Show error message to user
        }
    }

    updateProfileUI(userData) {
        document.getElementById('username').textContent = userData.username;
        document.getElementById('email').textContent = userData.email;
        document.getElementById('joinDate').textContent = `Joined: ${new Date(userData.created_at).toLocaleDateString()}`;
        
        // Update header profile section
        this.updateHeaderProfileUI(userData);
    }

    updateHeaderProfileUI(userData) {
        const userSection = document.getElementById('userSection');
        if (!userSection) return;

        userSection.innerHTML = `
            <div class="profile-image">
                <img src="${this.defaultAvatarPath}" alt="Profile" class="avatar">
                <a href="/profile" class="profile-link">My Profile</a>
                <button id="logoutButton" class="logout-button">Logout</button>
            </div>
        `;
        
        document.getElementById('logoutButton').addEventListener('click', () => {
            this.handleLogout();
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
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`Failed to load ${tab}`);
            }

            const data = await response.json();
            this.renderActivityContent(tab, data);
        } catch (error) {
            console.error(`Error loading ${tab}:`, error);
            contentDiv.innerHTML = '<p>Failed to load content. Please try again later.</p>';
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
} 