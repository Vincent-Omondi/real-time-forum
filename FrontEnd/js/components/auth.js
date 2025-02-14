// Auth component for handling authentication
export class Auth {
    constructor() {
        this.isAuthenticated = false;
        this.checkAuthStatus();
    }

    async checkAuthStatus() {
        try {
            const response = await fetch('/api/check-auth', { 
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            this.isAuthenticated = data.loggedIn;

            if (this.isAuthenticated && data.csrfToken) {
                // Update CSRF token
                localStorage.setItem('csrfToken', data.csrfToken);
                let metaTag = document.querySelector('meta[name="csrf-token"]');
                if (!metaTag) {
                    metaTag = document.createElement('meta');
                    metaTag.setAttribute('name', 'csrf-token');
                    document.head.appendChild(metaTag);
                }
                metaTag.setAttribute('content', data.csrfToken);
            }

            if (!this.isAuthenticated && !this.isPublicPath()) {
                window.location.href = '/login';
            } else if (this.isAuthenticated) {
                this.updateUserSection();
            }
        } catch (error) {
            console.error('Auth check failed:', error);
        }
    }

    isPublicPath() {
        const publicPaths = ['/login', '/register'];
        return publicPaths.includes(window.location.pathname);
    }

    updateUserSection() {
        const userSection = document.getElementById('userSection');
        if (userSection) {
            userSection.innerHTML = `
                <button id="logoutBtn" class="logout-btn">Logout</button>
            `;
            document.getElementById("logoutBtn").addEventListener("click", () => this.logout());
        }
    }

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
                        Don't have an account? <a href="/register">Register</a>
                    </p>
                </form>
                <div id="loginError" class="auth-error"></div>
            </div>
        `;

        container.innerHTML = loginHTML;
        this.attachLoginHandler();
    }

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
                        Already have an account? <a href="/login">Login</a>
                    </p>
                </form>
                <div id="registerError" class="auth-error"></div>
            </div>
        `;

        container.innerHTML = registerHTML;
        this.attachRegisterHandler();
    }

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
                
                // Store CSRF token in localStorage and meta tag
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

                this.isAuthenticated = true;
                window.location.href = '/';
            } catch (error) {
                document.getElementById('loginError').textContent = error.message;
            }
        });
    }

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
                });
    
                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.message || 'Registration failed');
                }
    
                window.location.href = '/login';
            } catch (error) {
                document.getElementById('registerError').textContent = error.message;
            }
        });
    }
    

    async logout() {
        try {
            // Get CSRF token from localStorage or meta tag
            const csrfToken = localStorage.getItem('csrfToken') || 
                             document.querySelector('meta[name="csrf-token"]')?.content;
            
            if (!csrfToken) {
                throw new Error('No CSRF token available');
            }

            const response = await fetch('/api/logout', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken
                }
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Logout failed');
            }

            // Clear CSRF token and authentication state
            localStorage.removeItem('csrfToken');
            document.querySelector('meta[name="csrf-token"]')?.remove();
            this.isAuthenticated = false;
            window.location.href = '/login';
        } catch (error) {
            console.error('Logout error:', error);
            alert('Failed to logout. Please try again.');
        }
    }
}

// Utility Functions
export function checkAuth() {
    const auth = new Auth();
    return auth.checkAuthStatus();
}

export function initAuth() {
    const auth = new Auth();
    const container = document.getElementById('app-container');
    
    if (window.location.pathname === '/login') {
        auth.renderLoginForm(container);
    } else if (window.location.pathname === '/register') {
        auth.renderRegisterForm(container);
    }
}

export function logout() {
    const auth = new Auth();
    return auth.logout();
}
