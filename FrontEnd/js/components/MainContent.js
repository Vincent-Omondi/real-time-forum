export class MainContent {
    constructor() {
        this.element = document.createElement('main');
        this.element.className = 'main-content';
    }

    render() {
        this.element.innerHTML = `
            <div id="app-container">
                <!-- Dynamic content will be inserted here -->
            </div>
        `;
        return this.element;
    }
} 