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
    }

    toggleTheme() {
        this.theme = this.theme === 'light' ? 'dark' : 'light';
        localStorage.setItem('theme', this.theme);
        this.initializeTheme();
    }

    updateThemeIcon() {
        const icon = this.themeToggleBtn.querySelector('i');
        icon.className = this.theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
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