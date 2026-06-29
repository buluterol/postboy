/**
 * Helper Functions
 * 
 * Utility functions used throughout the application
 */

/**
 * Generate a unique ID
 * @returns {string} Unique identifier
 */
export function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Format date to readable string
 * @param {string|Date} date Date to format
 * @returns {string} Formatted date string
 */
export function formatDate(date) {
    const d = new Date(date);
    const now = new Date();
    const diff = now - d;
    
    // Less than 1 minute
    if (diff < 60000) {
        return 'Just now';
    }
    
    // Less than 1 hour
    if (diff < 3600000) {
        const minutes = Math.floor(diff / 60000);
        return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
    }
    
    // Less than 24 hours
    if (diff < 86400000) {
        const hours = Math.floor(diff / 3600000);
        return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
    }
    
    // More than 24 hours
    return d.toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'short',
        year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
}

/**
 * Format response time
 * @param {number} ms Milliseconds
 * @returns {string} Formatted time string
 */
export function formatResponseTime(ms) {
    if (ms < 1000) {
        return `${ms}ms`;
    }
    return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Get status code class (1xx, 2xx, 3xx, 4xx, 5xx)
 * @param {number} statusCode HTTP status code
 * @returns {number} Status code class
 */
export function getStatusCodeClass(statusCode) {
    return Math.floor(statusCode / 100);
}

/**
 * Get CSS class for status code
 * @param {number} statusCode HTTP status code
 * @returns {string} CSS class name
 */
export function getStatusCodeColor(statusCode) {
    const statusClass = getStatusCodeClass(statusCode);
    return `status-${statusClass}xx`;
}

/**
 * Interpolate environment variables in string
 * @param {string} str String with {{variable}} placeholders
 * @param {Object} variables Variable key-value pairs
 * @returns {string} Interpolated string
 */
export function interpolateVariables(str, variables = {}) {
    if (!str) return str;
    
    return str.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        return variables[key] !== undefined ? variables[key] : match;
    });
}

/**
 * Deep clone an object
 * @param {*} obj Object to clone
 * @returns {*} Cloned object
 */
export function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

/**
 * Escape HTML special characters
 * @param {string} str String to escape
 * @returns {string} Escaped string
 */
export function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Pretty print JSON
 * @param {string|Object} json JSON string or object
 * @returns {string} Formatted JSON string
 */
export function prettyPrintJson(json) {
    try {
        const obj = typeof json === 'string' ? JSON.parse(json) : json;
        return JSON.stringify(obj, null, 2);
    } catch (e) {
        return json;
    }
}

/**
 * Check if string is valid JSON
 * @param {string} str String to check
 * @returns {boolean} True if valid JSON
 */
export function isValidJson(str) {
    try {
        JSON.parse(str);
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Syntax highlight JSON
 * @param {string} json JSON string
 * @returns {string} HTML with syntax highlighting
 */
export function highlightJson(json) {
    if (!json) return '';
    
    try {
        const obj = JSON.parse(json);
        json = JSON.stringify(obj, null, 2);
    } catch (e) {
        // Not valid JSON, return as is
        return escapeHtml(json);
    }
    
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
        let cls = 'json-number';
        if (/^"/.test(match)) {
            if (/:$/.test(match)) {
                cls = 'json-key';
            } else {
                cls = 'json-string';
            }
        } else if (/true|false/.test(match)) {
            cls = 'json-boolean';
        } else if (/null/.test(match)) {
            cls = 'json-null';
        }
        return `<span class="${cls}">${match}</span>`;
    });
}

/**
 * Debounce function
 * @param {Function} func Function to debounce
 * @param {number} wait Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Create element from HTML string
 * @param {string} html HTML string
 * @returns {Element} DOM element
 */
export function createElement(html) {
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content.firstChild;
}

/**
 * Show toast notification
 * @param {string} message Message to display
 * @param {string} type Type of toast (success, error, warning, info)
 * @param {number} duration Duration in milliseconds
 */
export function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const bgColors = {
        success: 'bg-green-500',
        error: 'bg-red-500',
        warning: 'bg-yellow-500',
        info: 'bg-blue-500'
    };
    
    const toast = createElement(`
        <div class="toast ${bgColors[type]} text-white toast-enter">
            ${escapeHtml(message)}
        </div>
    `);
    
    container.appendChild(toast);
    
    // Trigger animation
    setTimeout(() => toast.classList.remove('toast-enter'), 10);
    
    // Remove after duration
    setTimeout(() => {
        toast.classList.add('toast-leave');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

/**
 * Confirm dialog
 * @param {string} message Confirmation message
 * @returns {boolean} True if confirmed
 */
export function confirm(message) {
    return window.confirm(message);
}

/**
 * Prompt dialog
 * @param {string} message Prompt message
 * @param {string} defaultValue Default value
 * @returns {string|null} User input or null if cancelled
 */
export function prompt(message, defaultValue = '') {
    return window.prompt(message, defaultValue);
}
