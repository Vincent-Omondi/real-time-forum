export class CreatePost {
    constructor() {
        this.selectedCategories = new Set();
        this.mediaFile = null;
    }

    render(container) {
        container.innerHTML = `
            <div class="post-editor-container">
                <div class="post-editor-header">
                    <h2>Create a Post</h2>
                </div>
                
                <form id="postForm" class="post-form">
                    <div class="input-group">
                        <input type="text" 
                               id="post-title" 
                               name="title" 
                               class="input-field" 
                               placeholder="Title" 
                               maxlength="300" 
                               pattern="[^<>]*" 
                               title="HTML tags are not allowed" 
                               required>
                    </div>

                    <div class="tab-container">
                        <div class="tabs">
                            <button type="button" id="text-tab" class="tab active">Text</button>
                            <button type="button" id="media-tab" class="tab">Media</button>
                        </div>

                        <div id="text-content" class="tab-content active">
                            <div class="post-body" 
                                 id="post-body" 
                                 contenteditable="true" 
                                 data-placeholder="Share your thoughts..."></div>
                        </div>

                        <div id="media-content" class="tab-content">
                            <div class="media-upload-area" id="dropzone">
                                <i class="fas fa-cloud-upload-alt"></i>
                                <p>Drag and drop images here</p>
                                <p class="small">or click to upload</p>
                                <input type="file" 
                                       id="file-input" 
                                       name="post-file" 
                                       hidden 
                                       accept="image/*,video/*">
                            </div>
                        </div>
                    </div>

                    <div class="category-section">
                        <select id="category-select" class="input-field">
                            <option value="">Select a category...</option>
                            <option value="technology">Technology</option>
                            <option value="programming">Programming</option>
                            <option value="gaming">Gaming</option>
                            <option value="science">Science</option>
                            <option value="movies">Movies</option>
                            <option value="music">Music</option>
                            <option value="art">Art</option>
                            <option value="food">Food</option>
                            <option value="news">News</option>
                            <option value="fashion">Fashion</option>
                            <option value="business">Business</option>
                            <option value="sports">Sports</option>
                        </select>
                        <div id="selected-categories" class="selected-categories"></div>
                    </div>

                    <div class="post-actions">
                        <button type="submit" class="button-primary">Post</button>
                        <button type="button" class="button-outline" id="cancel-post">Cancel</button>
                    </div>
                </form>
            </div>
            <div id="toast" class="toast">
                <div id="toastMessage" class="toast-message"></div>
            </div>
        `;

        this.attachEventListeners();
    }

    attachEventListeners() {
        const form = document.getElementById('postForm');
        const textTab = document.getElementById('text-tab');
        const mediaTab = document.getElementById('media-tab');
        const dropzone = document.getElementById('dropzone');
        const fileInput = document.getElementById('file-input');
        const categorySelect = document.getElementById('category-select');
        const cancelButton = document.getElementById('cancel-post');

        // Tab switching
        textTab.addEventListener('click', () => this.switchTab('text'));
        mediaTab.addEventListener('click', () => this.switchTab('media'));

        // File upload handling
        dropzone.addEventListener('click', () => fileInput.click());
        dropzone.addEventListener('dragover', this.handleDragOver);
        dropzone.addEventListener('drop', this.handleDrop.bind(this));
        fileInput.addEventListener('change', this.handleFileSelect.bind(this));

        // Category selection
        categorySelect.addEventListener('change', this.handleCategorySelect.bind(this));

        // Form submission
        form.addEventListener('submit', this.handleSubmit.bind(this));

        // Cancel button
        cancelButton.addEventListener('click', () => window.location.href = '/');
    }

    switchTab(tab) {
        const textContent = document.getElementById('text-content');
        const mediaContent = document.getElementById('media-content');
        const textTab = document.getElementById('text-tab');
        const mediaTab = document.getElementById('media-tab');

        if (tab === 'text') {
            textContent.classList.add('active');
            mediaContent.classList.remove('active');
            textTab.classList.add('active');
            mediaTab.classList.remove('active');
        } else {
            mediaContent.classList.add('active');
            textContent.classList.remove('active');
            mediaTab.classList.add('active');
            textTab.classList.remove('active');
        }
    }

    handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const files = e.dataTransfer.files;
        if (files.length) {
            this.handleFile(files[0]);
        }
    }

    handleFileSelect(e) {
        const files = e.target.files;
        if (files.length) {
            this.handleFile(files[0]);
        }
    }

    handleFile(file) {
        if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
            this.mediaFile = file;
            this.updateDropzonePreview(file);
        } else {
            this.showToast('Please upload only image or video files');
        }
    }

    updateDropzonePreview(file) {
        const dropzone = document.getElementById('dropzone');
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                dropzone.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
            };
            reader.readAsDataURL(file);
        } else {
            dropzone.innerHTML = `<p>${file.name}</p>`;
        }
    }

    handleCategorySelect(e) {
        const category = e.target.value;
        if (category && !this.selectedCategories.has(category)) {
            this.selectedCategories.add(category);
            this.updateCategoryDisplay();
        }
        e.target.value = '';
    }

    updateCategoryDisplay() {
        const container = document.getElementById('selected-categories');
        container.innerHTML = Array.from(this.selectedCategories).map(category => `
            <span class="category-tag">
                ${category}
                <button type="button" onclick="this.removeCategory('${category}')">×</button>
            </span>
        `).join('');
    }

    removeCategory(category) {
        this.selectedCategories.delete(category);
        this.updateCategoryDisplay();
    }

    async handleSubmit(e) {
        e.preventDefault();
        
        const title = document.getElementById('post-title').value;
        const content = document.getElementById('post-body').innerHTML;
        const categories = Array.from(this.selectedCategories).join(',');

        const formData = new FormData();
        formData.append('title', title);
        formData.append('content', content);
        formData.append('categories', categories);
        if (this.mediaFile) {
            formData.append('media', this.mediaFile);
        }

        try {
            const response = await fetch('/api/posts', {
                method: 'POST',
                body: formData,
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Failed to create post');
            }

            window.location.href = '/';
        } catch (error) {
            this.showToast(error.message);
        }
    }

    showToast(message) {
        const toast = document.getElementById('toast');
        const toastMessage = document.getElementById('toastMessage');
        toastMessage.textContent = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }
} 