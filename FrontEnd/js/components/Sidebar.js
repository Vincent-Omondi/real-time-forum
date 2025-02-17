export class Sidebar {
    constructor() {
        this.element = document.createElement('aside');
        this.element.className = 'sidebar';
    }

    render() {
        this.element.innerHTML = `
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