export class Header {
    constructor() {
        this.element = document.createElement('header');
        this.element.className = 'header';
    }

    render() {
        this.element.innerHTML = `
            <a href="/" class="logo-link">
                <div class="logo">
                    <i class="fas fa-comments"></i>
                    <span>Forum</span>
                </div>
            </a>
            <div class="hamburger-menu">
                <i class="fas fa-bars"></i>
            </div>
            <div class="search-bar-container">
                <div class="search-bar">
                    <input type="text" class="search-input" placeholder="Search...">
                </div>
            </div>
            <div class="nav-actions">
                <a href="/create" data-link class="button-post">
                    <i class="fas fa-plus"></i>
                    <span class="button-text">New Post</span>
                </a>
            </div>
            <a href="/messages" class="nav-link">
                <i class="fas fa-envelope"></i>
            </a>
            <div id="userSection" class="profile-section">
                <!-- User section will be dynamically populated -->
            </div>
        `;
        return this.element;
    }
} 