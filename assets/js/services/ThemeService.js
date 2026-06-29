/**
 * Theme Service
 * 
 * Manages dark/light theme switching
 */

import { EVENTS, STORAGE_KEYS } from '../utils/constants.js';
import { EventBus } from './EventBus.js';

class ThemeService {
    constructor() {
        this.currentTheme = this.loadTheme();
        this.applyTheme(this.currentTheme);
    }

    /**
     * Load theme from localStorage
     * @returns {string} Theme name ('light' or 'dark')
     */
    loadTheme() {
        const saved = localStorage.getItem(STORAGE_KEYS.THEME);
        if (saved) {
            return saved;
        }

        // Check system preference
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }

        return 'light';
    }

    /**
     * Apply theme to document
     * @param {string} theme Theme name
     */
    applyTheme(theme) {
        const html = document.documentElement;

        if (theme === 'dark') {
            html.classList.add('dark');
        } else {
            html.classList.remove('dark');
        }

        this.updateThemeIcons(theme);
        this.currentTheme = theme;

        // Save to localStorage
        localStorage.setItem(STORAGE_KEYS.THEME, theme);

        // Emit event
        EventBus.emit(EVENTS.THEME_CHANGED, theme);
    }

    /**
     * Toggle between light and dark theme
     */
    toggle() {
        const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.applyTheme(newTheme);
    }

    /**
     * Update theme toggle button icons
     * @param {string} theme Current theme
     */
    updateThemeIcons(theme) {
        const lightIcon = document.getElementById('themeIconLight');
        const darkIcon = document.getElementById('themeIconDark');

        if (lightIcon && darkIcon) {
            if (theme === 'dark') {
                lightIcon.classList.remove('hidden');
                darkIcon.classList.add('hidden');
            } else {
                lightIcon.classList.add('hidden');
                darkIcon.classList.remove('hidden');
            }
        }
    }

    /**
     * Get current theme
     * @returns {string} Current theme name
     */
    getTheme() {
        return this.currentTheme;
    }
}

export default new ThemeService();
