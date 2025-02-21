export class MainContent {
    constructor() {
        this.element = document.createElement('main');
        this.element.className = 'main-content';
        this._content = '';
        this._container = null;
    }

    setContent(content) {
        this._content = content;
        this.render();
        // After rendering, initialize the posts container if needed
        if (content instanceof HTMLElement && !this._container) {
            this._container = this.element.querySelector('.posts-container');
        }
    }

    render() {
        if (typeof this._content === 'string') {
            this.element.innerHTML = this._content;
            // After rendering string content, check for posts container
            this._container = this.element.querySelector('.posts-container');
        } else if (this._content instanceof HTMLElement) {
            this.element.innerHTML = '';
            this.element.appendChild(this._content);
            // After appending element, check for posts container
            this._container = this.element.querySelector('.posts-container');
        }
        return this.element;
    }

    getElement() {
        return this.element;
    }

    getContainer() {
        return this._container;
    }
} 