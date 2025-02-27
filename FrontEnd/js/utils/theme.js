// Theme management
class ThemeManager {
    constructor() {
        this.theme = localStorage.getItem('theme') || 'light';
        this.themeToggleBtn = document.getElementById('theme-toggle');
        this.initializeTheme();
        this.setupStorageListener();
        this.setupThemeToggle();
    }

    initializeTheme() {
        document.documentElement.setAttribute('data-theme', this.theme);
        document.body.classList.remove('light-theme', 'dark-theme');
        document.body.classList.add(`${this.theme}-theme`);
        this.updateThemeIcon();
        this.updateThemeToggleText();
    }

    toggleTheme() {
        this.theme = this.theme === 'light' ? 'dark' : 'light';
        localStorage.setItem('theme', this.theme);
        this.initializeTheme();
    }

    updateThemeIcon() {
        // Update the main theme toggle button icon
        if (this.themeToggleBtn) {
            const icon = this.themeToggleBtn.querySelector('i');
            if (icon) {
                icon.className = this.theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
            }
        }
        
        // Update the profile dropdown theme toggle button icon
        const profileThemeToggleBtn = document.getElementById('themeToggleButton');
        if (profileThemeToggleBtn) {
            const icon = profileThemeToggleBtn.querySelector('i');
            if (icon) {
                icon.className = this.theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
            }
        }
    }
    
    updateThemeToggleText() {
        const themeToggleText = document.getElementById('themeToggleText');
        if (themeToggleText) {
            themeToggleText.textContent = this.theme === 'light' ? 
                'Switch to dark mode' : 'Switch to light mode';
        }
    }

    setupThemeToggle() {
        if (this.themeToggleBtn) {
            this.themeToggleBtn.addEventListener('click', () => this.toggleTheme());
        }
    }

    setupStorageListener() {
        window.addEventListener('storage', (event) => {
            if (event.key === 'theme') {
                this.theme = event.newValue;
                this.initializeTheme();
            }
        });
    }
}

// Initialize theme manager when DOM is loaded
let themeManager;

function initTheme() {
    if (!themeManager) {
        themeManager = new ThemeManager();
    }
    return themeManager;
}

// Export the initialization function
export { initTheme }; 