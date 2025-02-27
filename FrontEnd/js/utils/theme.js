// Theme management
class ThemeManager {
    constructor() {
        this.theme = localStorage.getItem('theme') || 'light';
        this.initializeTheme();
        this.setupStorageListener();
    }

    initializeTheme() {
        document.documentElement.setAttribute('data-theme', this.theme);
        document.body.classList.remove('light-theme', 'dark-theme');
        document.body.classList.add(`${this.theme}-theme`);
        this.updateThemeIcons();
    }

    toggleTheme() {
        this.theme = this.theme === 'light' ? 'dark' : 'light';
        localStorage.setItem('theme', this.theme);
        this.initializeTheme();
    }

    updateThemeIcons() {
        // Update all theme toggle icons and text in the application
        const themeToggles = document.querySelectorAll('#theme-toggle');
        themeToggles.forEach(toggle => {
            const icon = toggle.querySelector('i');
            const text = toggle.querySelector('.theme-text');
            
            if (icon) {
                icon.className = this.theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
            }
            if (text) {
                text.textContent = this.theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode';
            }
        });
    }

    setupStorageListener() {
        window.addEventListener('storage', (event) => {
            if (event.key === 'theme') {
                this.theme = event.newValue;
                this.initializeTheme();
            }
        });
    }

    // Method to setup theme toggle buttons
    setupThemeToggle(toggleButton) {
        if (!toggleButton) return;
        
        // Set initial icon and text state
        const icon = toggleButton.querySelector('i');
        const text = toggleButton.querySelector('.theme-text');
        
        if (icon) {
            icon.className = this.theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
        }
        if (text) {
            text.textContent = this.theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode';
        }

        // Add click handler
        toggleButton.addEventListener('click', () => {
            this.toggleTheme();
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