/**
 * Format a timestamp into a human-readable string
 * @param {string} timestamp - The timestamp to format
 * @returns {string} The formatted timestamp
 */
export function formatTimestamp(timestamp) {
    // Convert UTC string to local time
    const date = new Date(timestamp + 'Z'); // Append 'Z' to ensure UTC parsing
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) {
        return 'just now';
    }

    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
        return `${diffInMinutes}m ago`;
    }

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
        return `${diffInHours}h ago`;
    }

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) {
        return `${diffInDays}d ago`;
    }

    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return date.toLocaleDateString(undefined, options);
} 