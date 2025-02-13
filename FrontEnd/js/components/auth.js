// Auth component for handling authentication
export function initAuth() {
    const loginForm = document.getElementById('login-form');
    const googleBtn = document.getElementById('google-login');
    const githubBtn = document.getElementById('github-login');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(loginForm);
            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    body: formData
                });
                
                if (response.ok) {
                    const data = await response.json();
                    localStorage.setItem('user', JSON.stringify(data.user));
                    window.location.href = '/';
                } else {
                    const error = await response.json();
                    alert(error.message);
                }
            } catch (error) {
                console.error('Login error:', error);
                alert('An error occurred during login');
            }
        });
    }

    // OAuth handlers
    if (googleBtn) {
        googleBtn.addEventListener('click', () => {
            window.location.href = '/auth/google/login';
        });
    }

    if (githubBtn) {
        githubBtn.addEventListener('click', () => {
            window.location.href = '/auth/github/login';
        });
    }
}

export function checkAuth() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
}

export function logout() {
    localStorage.removeItem('user');
    window.location.href = '/login';
}

// Register component
export function initRegister() {
    const container = document.getElementById('app-container');
    container.innerHTML = `
        <div class="auth-container">
            <h2>Register</h2>
            <form id="register-form">
                <input type="text" name="username" placeholder="Username" required>
                <input type="email" name="email" placeholder="Email" required>
                <input type="password" name="password" placeholder="Password" required>
                <input type="password" name="confirm_password" placeholder="Confirm Password" required>
                <button type="submit">Register</button>
            </form>
        </div>
    `;

    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(registerForm);
            
            if (formData.get('password') !== formData.get('confirm_password')) {
                alert('Passwords do not match');
                return;
            }

            try {
                const response = await fetch('/api/register', {
                    method: 'POST',
                    body: formData
                });
                
                if (response.ok) {
                    alert('Registration successful! Please login.');
                    window.location.href = '/login';
                } else {
                    const error = await response.json();
                    alert(error.message);
                }
            } catch (error) {
                console.error('Registration error:', error);
                alert('An error occurred during registration');
            }
        });
    }
} 