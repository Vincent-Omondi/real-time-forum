import { Auth } from "../components/auth.js";

/**
 * Checks the current authentication status using the Auth class.
 * This function instantiates Auth and calls its checkAuthStatus() method,
 * which handles the backend auth check and triggers UI updates.
 */
async function checkAuthStatus() {
  const auth = new Auth();
  await auth.checkAuthStatus();
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
  const currentPath = window.location.pathname;
  const isAuthPage = currentPath === '/login' || currentPath === '/register';

  // On auth pages, hide navigation UI and ensure main content is visible.
  if (isAuthPage) {
    [sidebar, searchBar, navActions, themeToggle].forEach(el => el?.classList.add('hidden'));
    mainContent?.classList.remove('hidden');
    return;
  }

  // If authenticated, display all UI elements.
  if (isAuthenticated) {
    [sidebar, mainContent, searchBar, navActions, themeToggle].forEach(el => el?.classList.remove('hidden'));
  } else {
    // If not authenticated, remove all key UI elements and redirect to login.
    [sidebar, mainContent, searchBar, navActions, themeToggle].forEach(el => el?.remove());
    if (!isAuthPage) {
      window.location.href = "/login";
    }
  }
}

// Run authentication check once the DOM has fully loaded.
document.addEventListener("DOMContentLoaded", checkAuthStatus);
