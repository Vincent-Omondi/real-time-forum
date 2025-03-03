import { Auth } from "../components/auth.js";
import userStore from "../store/userStore.js";

/**
 * Checks the current authentication status using the Auth class.
 * This function uses the userStore's caching mechanism to prevent redundant auth checks.
 * It only calls the backend when necessary based on cache expiration.
 */
async function checkAuthStatus() {
  // Check if we need to fetch fresh auth data based on cache expiry
  if (userStore.shouldCheckAuth()) {
    console.log("Auth cache expired or not initialized, checking with backend...");
    const auth = new Auth();
    await auth.checkAuthStatus();
  } else {
    console.log("Using cached auth status...");
    // Even though we're using cached data, still update UI
    const isAuthenticated = userStore.isAuthenticated();
    updateUIBasedOnAuth(isAuthenticated);
  }
}

/**
 * Updates the UI based on whether the user is authenticated.
 * If on an authentication page (login or register), non-essential UI elements are hidden.
 * Otherwise, if authenticated, key UI elements are revealed; if not, they are removed and
 * the user is redirected to the login page.
 *
 * @param {boolean} isAuthenticated - True if the user is authenticated.
 */
export function updateUIBasedOnAuth(isAuthenticated) {
  const sidebar = document.querySelector('.sidebar');
  const mainContent = document.querySelector('.main-content');
  const searchBar = document.querySelector('.search-bar-container');
  const navActions = document.querySelector('.nav-actions');
  const themeToggle = document.querySelector('#theme-toggle');
  const rightSidebar = document.querySelector('.right-sidebar');
  const messageLink = document.querySelector('a[href="/messages"]');
  const currentPath = window.location.pathname;
  const isAuthPage = currentPath === '/login' || currentPath === '/register';

  // On auth pages, hide navigation UI and ensure main content is visible.
  if (isAuthPage) {
    [sidebar, searchBar, navActions, themeToggle, rightSidebar, messageLink].forEach(el => el?.classList.add('hidden'));
    mainContent?.classList.remove('hidden');
    return;
  }

  // If authenticated, display all UI elements.
  if (isAuthenticated) {
    [sidebar, mainContent, searchBar, navActions, themeToggle, rightSidebar, messageLink].forEach(el => el?.classList.remove('hidden'));
  } else {
    // If not authenticated, remove all key UI elements and redirect to login.
    // Use the Router if available for a smoother transition
    if (!isAuthPage) {
      if (window.router) {
        window.router.navigateTo("/login");
      } else {
        window.location.href = "/login";
      }
    }
    
    // Hide UI elements instead of removing them - this is gentler and allows them
    // to be restored if the user logs in without a page refresh
    [sidebar, searchBar, navActions, themeToggle, rightSidebar, messageLink].forEach(el => el?.classList.add('hidden'));
  }
}

// Run authentication check once the DOM has fully loaded.
document.addEventListener("DOMContentLoaded", checkAuthStatus);

// Export checkAuthStatus to allow manual auth refresh when needed
export { checkAuthStatus };