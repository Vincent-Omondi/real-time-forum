export class Sidebar {
    constructor() {
        this.element = document.createElement('aside');
        this.element.className = 'sidebar';
        this.isOpen = false;
        
        // Create a static instance that can be accessed globally
        Sidebar.instance = this;
        
        this.init();
    }

    static getInstance() {
        return Sidebar.instance;
    }

    init() {
        // Initialize hamburger menu functionality
        window.addEventListener('load', () => {
            const hamburgerBtn = document.querySelector('.hamburger-menu');
            if (hamburgerBtn) {
                hamburgerBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.toggleSidebar();
                });
            }

            // Close sidebar when clicking outside
            document.addEventListener('click', (e) => {
                if (this.isOpen && 
                    !e.target.closest('.sidebar') && 
                    !e.target.closest('.hamburger-menu')) {
                    this.closeSidebar();
                }
            });

            // Handle escape key
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.isOpen) {
                    this.closeSidebar();
                }
            });
        });

        // Make toggleSidebar available globally
        window.toggleSidebar = () => {
            Sidebar.instance.toggleSidebar();
        };
    }

    toggleSidebar() {
        this.isOpen = !this.isOpen;
        this.element.classList.toggle('active');
        
        // Toggle body scroll
        document.body.style.overflow = this.isOpen ? 'hidden' : '';
        
        // Toggle hamburger icon
        const hamburgerIcon = document.querySelector('.hamburger-menu i');
        if (hamburgerIcon) {
            hamburgerIcon.className = this.isOpen ? 'fas fa-times' : 'fas fa-bars';
        }

        // Handle overlay
        if (this.isOpen) {
            this.createOverlay();
        } else {
            this.removeOverlay();
        }
    }

    closeSidebar() {
        if (this.isOpen) {
            this.isOpen = false;
            this.element.classList.remove('active');
            document.body.style.overflow = '';
            
            const hamburgerIcon = document.querySelector('.hamburger-menu i');
            if (hamburgerIcon) {
                hamburgerIcon.className = 'fas fa-bars';
            }
            
            this.removeOverlay();
        }
    }

    createOverlay() {
        if (!document.querySelector('.sidebar-overlay')) {
            const overlay = document.createElement('div');
            overlay.className = 'sidebar-overlay';
            overlay.addEventListener('click', () => this.closeSidebar());
            document.body.appendChild(overlay);
            
            // Fade in overlay
            setTimeout(() => overlay.style.opacity = '1', 0);
        }
    }

    removeOverlay() {
        const overlay = document.querySelector('.sidebar-overlay');
        if (overlay) {
            // Fade out overlay
            overlay.style.opacity = '0';
            overlay.addEventListener('transitionend', () => {
                overlay.remove();
            }, { once: true });
        }
    }

    render() {
        this.element.innerHTML = `
            <div class="sidebar-content">
                <div class="sidebar-section">
                    <h3 class="sidebar-title">FEEDS</h3>
                    <a href="/" class="sidebar-link">
                        <i class="fas fa-home"></i>
                        Home
                    </a>
                    <a href="#" class="sidebar-link">
                        <i class="fas fa-fire"></i>
                        Popular
                    </a>
                    <a href="/" class="sidebar-link">
                        <i class="fas fa-globe"></i>
                        All
                    </a>
                </div>
                <div class="sidebar-section">
                    <h3 class="sidebar-title">CATEGORIES</h3>
                    ${this.renderCategories()}
                </div>
            </div>
        `;
        return this.element;
    }

    renderCategories() {
        const categories = [
            { icon: 'code', name: 'Programming' },
            { icon: 'microchip', name: 'Technology' },
            { icon: 'film', name: 'Movies' },
            { icon: 'palette', name: 'Art' },
            { icon: 'gamepad', name: 'Gaming' },
            { icon: 'flask', name: 'Science' },
            { icon: 'newspaper', name: 'News' },
            { icon: 'music', name: 'Music' }
        ];

        return categories.map(cat => `
            <a href="#" class="sidebar-link">
                <i class="fas fa-${cat.icon}"></i>
                ${cat.name}
            </a>
        `).join('');
    }
} 