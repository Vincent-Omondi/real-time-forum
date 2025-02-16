import { Auth } from "../components/auth.js";  // Import the Auth class

async function checkAuthStatus() {
    document.addEventListener("DOMContentLoaded", async () => {
        const auth = new Auth(); // Create an instance of Auth
        await auth.checkAuthStatus(); // Call checkAuthStatus(), which updates UI automatically
    });
}

export function updateUIBasedOnAuth(isAuthenticated) {
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');
    const searchBar = document.querySelector('.search-bar-container');
    const navActions = document.querySelector('.nav-actions');
    const themeToggle = document.querySelector('#theme-toggle');
    const currentPath = window.location.pathname;
    const isAuthPage = currentPath === '/login' || currentPath === '/register';

    if (isAuthPage) {
        [sidebar, searchBar, navActions, themeToggle].forEach(el => el?.classList.add('hidden'));
        mainContent?.classList.remove('hidden');
        return;
    }

    if (isAuthenticated) {
        [sidebar, mainContent, searchBar, navActions, themeToggle].forEach(el => el?.classList.remove('hidden'));
    } else {
        [sidebar, mainContent, searchBar, navActions, themeToggle].forEach(el => el?.remove());

        if (!isAuthPage) {
            window.location.href = "/login"; // Redirect to login
        }
    }
}

document.addEventListener("DOMContentLoaded", checkAuthStatus);
