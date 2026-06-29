/**
 * Collection Manager Component
 * 
 * Manages collections sidebar
 */

import { EVENTS, METHOD_COLORS } from '../utils/constants.js';
import { EventBus } from '../services/EventBus.js';
import StorageService from '../services/StorageService.js';
import { prompt, confirm, showToast, generateId } from '../utils/helpers.js';

export class CollectionManager {
    constructor(container) {
        this.container = container;
        this.collections = [];
        this.expandedCollections = new Set();

        this.init();
    }

    async init() {
        await this.loadCollections();
        this.render();
        this.subscribeToEvents();
    }

    async loadCollections() {
        try {
            this.collections = await StorageService.getCollections();
        } catch (error) {
            console.error('Failed to load collections:', error);
            this.collections = [];
        }
    }

    render() {
        if (this.collections.length === 0) {
            this.container.innerHTML = `
                <div class="text-center text-gray-500 dark:text-gray-400 py-8">
                    <p class="text-sm">No collections yet</p>
                    <p class="text-xs mt-1">Create your first collection</p>
                </div>
            `;
            return;
        }

        this.container.innerHTML = `
            <div class="space-y-1">
                ${this.collections.map(collection => this.renderCollection(collection)).join('')}
            </div>
        `;

        this.attachEventListeners();
    }

    renderCollection(collection) {
        const isExpanded = this.expandedCollections.has(collection.id);
        const requestCount = collection.requests?.length || 0;

        return `
            <div class="collection-item" data-collection-id="${collection.id}">
                <!-- Collection Header -->
                <div class="flex items-center gap-2 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer group">
                    <button class="collection-toggle w-4 h-4 flex items-center justify-center" 
                            data-collection-id="${collection.id}">
                        <svg class="w-3 h-3 transform transition-transform ${isExpanded ? 'rotate-90' : ''}" 
                             fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                        </svg>
                    </button>
                    
                    <svg class="w-4 h-4 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path>
                    </svg>
                    
                    <span class="flex-1 text-sm font-medium truncate">${collection.name}</span>
                    
                    <span class="text-xs text-gray-500">${requestCount}</span>
                    
                    <!-- Collection Actions -->
                    <div class="hidden group-hover:flex gap-1">
                        <button class="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded collection-rename" 
                                data-collection-id="${collection.id}" title="Rename">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                            </svg>
                        </button>
                        <button class="p-1 hover:bg-red-200 dark:hover:bg-red-900 rounded collection-delete" 
                                data-collection-id="${collection.id}" title="Delete">
                            <svg class="w-3 h-3 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                            </svg>
                        </button>
                    </div>
                </div>
                
                <!-- Requests List -->
                ${isExpanded ? `
                    <div class="ml-6 mt-1 space-y-1">
                        ${collection.requests && collection.requests.length > 0
                    ? collection.requests.map(request => this.renderRequest(request, collection.id)).join('')
                    : '<p class="text-xs text-gray-500 dark:text-gray-400 p-2">No requests</p>'
                }
                        <button class="add-request w-full text-left text-xs text-primary-600 dark:text-primary-400 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded" 
                                data-collection-id="${collection.id}">
                            + Add Request
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    }

    renderRequest(request, collectionId) {
        const methodClass = METHOD_COLORS[request.method] || 'method-get';

        return `
            <div class="request-item flex items-center gap-2 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer group"
                 data-request-id="${request.id}" data-collection-id="${collectionId}">
                <span class="method-badge ${methodClass} text-xs px-1.5 py-0.5">${request.method}</span>
                <span class="flex-1 text-sm truncate">${request.name || request.url}</span>
                
                <div class="hidden group-hover:flex gap-1">
                    <button class="p-1 hover:bg-red-200 dark:hover:bg-red-900 rounded request-delete" 
                            data-request-id="${request.id}" data-collection-id="${collectionId}" title="Delete">
                        <svg class="w-3 h-3 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }

    attachEventListeners() {
        // Collection toggle
        this.container.querySelectorAll('.collection-toggle').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const collectionId = e.currentTarget.dataset.collectionId;
                this.toggleCollection(collectionId);
            });
        });

        // Collection rename
        this.container.querySelectorAll('.collection-rename').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const collectionId = e.currentTarget.dataset.collectionId;
                this.renameCollection(collectionId);
            });
        });

        // Collection delete
        this.container.querySelectorAll('.collection-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const collectionId = e.currentTarget.dataset.collectionId;
                this.deleteCollection(collectionId);
            });
        });

        // Request click - load request
        this.container.querySelectorAll('.request-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.closest('button')) return;

                const requestId = item.dataset.requestId;
                const collectionId = item.dataset.collectionId;
                this.loadRequest(collectionId, requestId);
            });
        });

        // Request delete
        this.container.querySelectorAll('.request-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const requestId = e.currentTarget.dataset.requestId;
                const collectionId = e.currentTarget.dataset.collectionId;
                this.deleteRequest(collectionId, requestId);
            });
        });

        // Add request
        this.container.querySelectorAll('.add-request').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const collectionId = e.currentTarget.dataset.collectionId;
                this.addRequestPrompt(collectionId);
            });
        });
    }

    toggleCollection(collectionId) {
        if (this.expandedCollections.has(collectionId)) {
            this.expandedCollections.delete(collectionId);
        } else {
            this.expandedCollections.add(collectionId);
        }
        this.render();
    }

    async createCollection() {
        const name = prompt('Enter collection name:');
        if (!name) return;

        try {
            const collection = await StorageService.createCollection({ name, requests: [] });
            this.collections.push(collection);
            this.expandedCollections.add(collection.id);
            this.render();
            showToast('Collection created successfully', 'success');
            EventBus.emit(EVENTS.COLLECTION_UPDATED);
        } catch (error) {
            console.error('Failed to create collection:', error);
            showToast('Failed to create collection', 'error');
        }
    }

    async renameCollection(collectionId) {
        const collection = this.collections.find(c => c.id === collectionId);
        if (!collection) return;

        const newName = prompt('Enter new name:', collection.name);
        if (!newName || newName === collection.name) return;

        try {
            const updated = await StorageService.updateCollection(collectionId, {
                ...collection,
                name: newName
            });

            const index = this.collections.findIndex(c => c.id === collectionId);
            this.collections[index] = updated;
            this.render();
            showToast('Collection renamed successfully', 'success');
            EventBus.emit(EVENTS.COLLECTION_UPDATED);
        } catch (error) {
            console.error('Failed to rename collection:', error);
            showToast('Failed to rename collection', 'error');
        }
    }

    async deleteCollection(collectionId) {
        if (!confirm('Are you sure you want to delete this collection?')) return;

        try {
            await StorageService.deleteCollection(collectionId);
            this.collections = this.collections.filter(c => c.id !== collectionId);
            this.expandedCollections.delete(collectionId);
            this.render();
            showToast('Collection deleted successfully', 'success');
            EventBus.emit(EVENTS.COLLECTION_UPDATED);
        } catch (error) {
            console.error('Failed to delete collection:', error);
            showToast('Failed to delete collection', 'error');
        }
    }

    loadRequest(collectionId, requestId) {
        const collection = this.collections.find(c => c.id === collectionId);
        if (!collection) return;

        const request = collection.requests.find(r => r.id === requestId);
        if (!request) return;

        EventBus.emit(EVENTS.REQUEST_LOADED, request);
    }

    async saveRequest(request, collectionId) {
        const collection = this.collections.find(c => c.id === collectionId);
        if (!collection) return;

        const requestWithId = {
            ...request,
            id: request.id || generateId(),
            name: request.name || request.url
        };

        // Check if request already exists
        const existingIndex = collection.requests.findIndex(r => r.id === requestWithId.id);

        if (existingIndex >= 0) {
            collection.requests[existingIndex] = requestWithId;
        } else {
            collection.requests.push(requestWithId);
        }

        try {
            await StorageService.updateCollection(collectionId, collection);
            await this.loadCollections();
            this.expandedCollections.add(collectionId);
            this.render();
            showToast('Request saved successfully', 'success');
            EventBus.emit(EVENTS.COLLECTION_UPDATED);
        } catch (error) {
            console.error('Failed to save request:', error);
            showToast('Failed to save request', 'error');
        }
    }

    async deleteRequest(collectionId, requestId) {
        if (!confirm('Are you sure you want to delete this request?')) return;

        const collection = this.collections.find(c => c.id === collectionId);
        if (!collection) return;

        collection.requests = collection.requests.filter(r => r.id !== requestId);

        try {
            await StorageService.updateCollection(collectionId, collection);
            await this.loadCollections();
            this.render();
            showToast('Request deleted successfully', 'success');
            EventBus.emit(EVENTS.COLLECTION_UPDATED);
        } catch (error) {
            console.error('Failed to delete request:', error);
            showToast('Failed to delete request', 'error');
        }
    }

    async addRequestPrompt(collectionId) {
        const name = prompt('Enter request name:');
        if (!name) return;

        const newRequest = {
            id: generateId(),
            name: name,
            method: 'GET',
            url: '',
            headers: [],
            body: ''
        };

        await this.saveRequest(newRequest, collectionId);
        EventBus.emit(EVENTS.REQUEST_LOADED, newRequest);
    }

    subscribeToEvents() {
        // No events to subscribe to yet
    }
}
