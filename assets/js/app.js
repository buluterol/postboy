/**
 * Postboy Application
 * 
 * Main application entry point
 */

import ThemeService from './services/ThemeService.js';
import { RequestBuilder } from './components/RequestBuilder.js';
import { ResponseViewer } from './components/ResponseViewer.js';
import { CollectionManager } from './components/CollectionManager.js';
import { EnvironmentManager } from './components/EnvironmentManager.js';
import { HistoryPanel } from './components/HistoryPanel.js';
import { SavedResponsesPanel } from './components/SavedResponsesPanel.js';
import { ResizeManager } from './utils/ResizeManager.js';

class PostboyApp {
    constructor() {
        this.components = {};
        this.init();
    }

    async init() {
        console.log('🚀 Initializing Postboy...');

        // Initialize theme first
        this.initTheme();

        // Initialize components
        await this.initComponents();

        // Initialize resize manager
        this.resizeManager = new ResizeManager();
        this.resizeManager.startListening();

        // Attach global event listeners
        this.attachEventListeners();

        console.log('✅ Postboy initialized successfully!');
    }

    initTheme() {
        // Theme service is already initialized as a singleton
        // Just attach the toggle button
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                ThemeService.toggle();
            });
        }
    }

    async initComponents() {
        // Request Builder
        const requestBuilderContainer = document.getElementById('requestBuilder');
        if (requestBuilderContainer) {
            this.components.requestBuilder = new RequestBuilder(requestBuilderContainer);
        }

        // Response Viewer
        const responseViewerContainer = document.getElementById('responseViewer');
        if (responseViewerContainer) {
            this.components.responseViewer = new ResponseViewer(responseViewerContainer);
        }

        // Collection Manager
        const collectionsTreeContainer = document.getElementById('collectionsTree');
        if (collectionsTreeContainer) {
            this.components.collectionManager = new CollectionManager(collectionsTreeContainer);
        }

        // Environment Manager
        this.components.environmentManager = new EnvironmentManager();

        // History Panel
        this.components.historyPanel = new HistoryPanel();
        
        // Saved Responses Panel
        this.components.savedResponsesPanel = new SavedResponsesPanel();
    }

    attachEventListeners() {
        // New Collection Button
        const newCollectionBtn = document.getElementById('newCollectionBtn');
        if (newCollectionBtn) {
            newCollectionBtn.addEventListener('click', () => {
                this.components.collectionManager?.createCollection();
            });
        }

        // Save Request Button
        const saveRequestBtn = document.getElementById('saveRequestBtn');
        if (saveRequestBtn) {
            saveRequestBtn.addEventListener('click', () => {
                this.saveCurrentRequest();
            });
        }

        // Manage Environments Button
        const manageEnvironmentsBtn = document.getElementById('manageEnvironmentsBtn');
        if (manageEnvironmentsBtn) {
            manageEnvironmentsBtn.addEventListener('click', () => {
                this.components.environmentManager?.showModal();
            });
        }

        // History Button
        const historyBtn = document.getElementById('historyBtn');
        if (historyBtn) {
            historyBtn.addEventListener('click', () => {
                this.components.historyPanel?.showModal();
            });
        }
        
        // Saved Responses Button
        const savedResponsesBtn = document.getElementById('savedResponsesBtn');
        if (savedResponsesBtn) {
            savedResponsesBtn.addEventListener('click', () => {
                this.components.savedResponsesPanel?.showModal();
            });
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + S - Save to collection
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                this.saveCurrentRequest();
            }
        });
    }

    async saveCurrentRequest() {
        const requestBuilder = this.components.requestBuilder;
        const collectionManager = this.components.collectionManager;

        if (!requestBuilder || !collectionManager) return;

        // Get current request data
        const currentRequest = requestBuilder.getCurrentRequest();

        // Validate URL
        if (!currentRequest.url) {
            alert('Please enter a URL before saving');
            return;
        }

        // Check if there are any collections
        if (collectionManager.collections.length === 0) {
            alert('Please create a collection first');
            return;
        }

        // Check if request already exists in a collection (has ID)
        let selectedCollectionId = null;
        let requestName = currentRequest.name;

        if (currentRequest.id) {
            // Find which collection this request belongs to
            for (const collection of collectionManager.collections) {
                const existingRequest = collection.requests?.find(r => r.id === currentRequest.id);
                if (existingRequest) {
                    selectedCollectionId = collection.id;
                    requestName = existingRequest.name || currentRequest.name || currentRequest.url;
                    break;
                }
            }
        }

        // If request not found in any collection, ask user
        if (!selectedCollectionId) {
            // Show collection selector
            if (collectionManager.collections.length === 1) {
                selectedCollectionId = collectionManager.collections[0].id;
            } else {
                // Simple prompt for now - could be replaced with a modal
                const collectionNames = collectionManager.collections
                    .map((c, i) => `${i + 1}. ${c.name}`)
                    .join('\n');

                const choice = prompt(
                    `Select collection:\n${collectionNames}\n\nEnter number:`,
                    '1'
                );

                if (!choice) return;

                const index = parseInt(choice) - 1;
                if (index >= 0 && index < collectionManager.collections.length) {
                    selectedCollectionId = collectionManager.collections[index].id;
                } else {
                    alert('Invalid selection');
                    return;
                }
            }

            // Ask for request name (only for new requests)
            const promptedName = prompt('Enter request name:', currentRequest.url);
            if (!promptedName) return;
            requestName = promptedName;
        }

        // Save request
        const request = {
            ...currentRequest,
            name: requestName
        };

        await collectionManager.saveRequest(request, selectedCollectionId);
    }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new PostboyApp();
    });
} else {
    new PostboyApp();
}
