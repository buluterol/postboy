/**
 * Collection Manager Component
 * 
 * Manages collections sidebar
 */

import { EVENTS, METHOD_COLORS } from '../utils/constants.js';
import { EventBus } from '../services/EventBus.js';
import { VariableStore } from '../services/VariableService.js';
import StorageService from '../services/StorageService.js';
import { prompt, confirm, showToast, generateId, escapeHtml } from '../utils/helpers.js';
import { createFolder, normalizeNode, findRequest, findNode, countRequests } from '../utils/collectionTree.js';

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
            this.collections = (await StorageService.getCollections()).map(normalizeNode);
            VariableStore.setCollections(this.collections);

            // Load collection order from localStorage
            const savedOrder = localStorage.getItem('collectionOrder');
            if (savedOrder) {
                try {
                    const orderArray = JSON.parse(savedOrder);
                    // Sort collections based on saved order
                    this.collections.sort((a, b) => {
                        const indexA = orderArray.indexOf(a.id);
                        const indexB = orderArray.indexOf(b.id);
                        // If not found in order array, put at end
                        if (indexA === -1) return 1;
                        if (indexB === -1) return -1;
                        return indexA - indexB;
                    });
                } catch (e) {
                    console.error('Failed to parse collection order:', e);
                }
            }

            // Load expanded collections from localStorage
            const savedExpanded = localStorage.getItem('expandedCollections');
            if (savedExpanded) {
                try {
                    const expandedArray = JSON.parse(savedExpanded);
                    this.expandedCollections = new Set(expandedArray);
                } catch (e) {
                    this.expandedCollections = new Set();
                }
            }
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

    iconButton(cls, attrs, title, path, danger = false) {
        return `<button class="p-1 ${danger ? 'hover:bg-red-200 dark:hover:bg-red-900' : 'hover:bg-gray-200 dark:hover:bg-gray-600'} rounded ${cls}" ${attrs} title="${title}">
            <svg class="w-3 h-3 ${danger ? 'text-red-600' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${path}"></path>
            </svg></button>`;
    }

    renderNodeActions(node, collectionId, isCollection) {
        const attrs = `data-collection-id="${collectionId}" data-node-id="${node.id}"`;
        const P = {
            folder: 'M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z',
            cog: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
            pencil: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
            trash: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
            down: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4'
        };
        return `<div class="hidden group-hover:flex gap-1">
            ${isCollection ? this.iconButton('collection-export', attrs, 'Export (Postman v2.1)', P.down) : ''}
            ${this.iconButton('node-add-folder', attrs, 'New folder', P.folder)}
            ${this.iconButton('node-settings', attrs, 'Auth, variables, scripts', P.cog)}
            ${this.iconButton(isCollection ? 'collection-rename' : 'folder-rename', attrs, 'Rename', P.pencil)}
            ${this.iconButton(isCollection ? 'collection-delete' : 'folder-delete', attrs, 'Delete', P.trash, true)}
        </div>`;
    }

    renderNodeChildren(node, collectionId) {
        const folders = (node.folders || []).map(f => this.renderFolder(f, collectionId)).join('');
        const requests = (node.requests || []).map(r => this.renderRequest(r, collectionId, node.id)).join('');
        const empty = !folders && !requests ? '<p class="text-xs text-gray-500 dark:text-gray-400 p-2">No requests</p>' : '';
        return `${folders}${requests}${empty}
            <button class="add-request w-full text-left text-xs text-primary-600 dark:text-primary-400 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                    data-collection-id="${collectionId}" data-node-id="${node.id}">
                + Add Request
            </button>`;
    }

    renderFolder(folder, collectionId) {
        const isExpanded = this.expandedCollections.has(folder.id);
        return `
            <div class="folder-item" data-folder-id="${folder.id}">
                <div class="flex items-center gap-1 p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer group node-header" data-node-id="${folder.id}">
                    <svg class="w-3 h-3 transform transition-transform ${isExpanded ? 'rotate-90' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                    </svg>
                    <svg class="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 24 24"><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"></path></svg>
                    <span class="flex-1 text-sm truncate">${escapeHtml(folder.name)}</span>
                    <span class="text-xs text-gray-500">${countRequests(folder)}</span>
                    ${this.renderNodeActions(folder, collectionId, false)}
                </div>
                ${isExpanded ? `<div class="ml-4 mt-1 space-y-1">${this.renderNodeChildren(folder, collectionId)}</div>` : ''}
            </div>`;
    }

    renderCollection(collection) {
        const isExpanded = this.expandedCollections.has(collection.id);
        const requestCount = countRequests(collection);

        return `
            <div class="collection-item" data-collection-id="${collection.id}" draggable="false">
                <div class="flex items-center gap-2 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer group">
                    <button class="drag-handle-collection cursor-move p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            title="Drag to reorder">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16"></path>
                        </svg>
                    </button>

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

                    <span class="flex-1 text-sm font-medium truncate">${escapeHtml(collection.name)}</span>
                    <span class="text-xs text-gray-500">${requestCount}</span>
                    ${this.renderNodeActions(collection, collection.id, true)}
                </div>

                ${isExpanded ? `<div class="ml-6 mt-1 space-y-1">${this.renderNodeChildren(collection, collection.id)}</div>` : ''}
            </div>
        `;
    }

    renderRequest(request, collectionId, nodeId) {
        const methodClass = METHOD_COLORS[request.method] || 'method-get';

        return `
            <div class="request-item flex items-center gap-2 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer group"
                 data-request-id="${request.id}" data-collection-id="${collectionId}" data-node-id="${nodeId}" draggable="false">
                <button class="drag-handle-request cursor-move p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        title="Drag to reorder">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16"></path>
                    </svg>
                </button>
                <span class="method-badge ${methodClass} text-xs px-1.5 py-0.5">${escapeHtml(request.method)}</span>
                <span class="flex-1 text-sm truncate">${escapeHtml(request.name || request.url)}</span>

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

        // Folder header toggle
        this.container.querySelectorAll('.folder-item > .node-header').forEach(h => {
            h.addEventListener('click', (e) => {
                if (e.target.closest('button')) return;
                this.toggleCollection(h.dataset.nodeId);
            });
        });

        const bind = (selector, fn) => {
            this.container.querySelectorAll(selector).forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    fn(btn.dataset.collectionId, btn.dataset.nodeId);
                });
            });
        };
        bind('.node-add-folder', (cid, nid) => this.addFolderPrompt(cid, nid));
        bind('.node-settings', (cid, nid) => this.openSettings(cid, nid));
        bind('.collection-export', (cid) => EventBus.emit(EVENTS.COLLECTION_EXPORT, cid));
        bind('.folder-rename', (cid, nid) => this.renameFolder(cid, nid));
        bind('.folder-delete', (cid, nid) => this.deleteFolder(cid, nid));

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
                this.addRequestPrompt(collectionId, e.currentTarget.dataset.nodeId);
            });
        });

        // Drag & Drop for collections and requests
        this.attachDragListeners();
    }

    attachDragListeners() {
        const collectionItems = this.container.querySelectorAll('.collection-item');
        const requestItems = this.container.querySelectorAll('.request-item');

        // Shared drag state variables
        let draggedCollectionElement = null;
        let draggedCollectionIndex = null;
        let draggedRequestElement = null;
        let draggedRequestId = null;
        let draggedRequestCollectionId = null;
        let draggedRequestNodeId = null;

        // Collection drag & drop
        collectionItems.forEach((item, index) => {
            const dragHandle = item.querySelector('.drag-handle-collection');

            if (dragHandle) {
                // Enable dragging only when drag handle is pressed
                dragHandle.addEventListener('mousedown', (e) => {
                    item.setAttribute('draggable', 'true');
                    e.stopPropagation();
                });

                dragHandle.addEventListener('mouseup', () => {
                    setTimeout(() => {
                        item.setAttribute('draggable', 'false');
                    }, 100);
                });
            }

            item.addEventListener('dragstart', (e) => {
                draggedCollectionElement = item;
                draggedCollectionIndex = index;
                item.classList.add('opacity-50');
                e.dataTransfer.effectAllowed = 'move';
            });

            item.addEventListener('dragend', (e) => {
                item.classList.remove('opacity-50');
                item.setAttribute('draggable', 'false');
                draggedCollectionElement = null;
                draggedCollectionIndex = null;
                collectionItems.forEach(ci => ci.classList.remove('border-t-2', 'border-b-2', 'border-primary-500'));
            });

            item.addEventListener('dragover', (e) => {
                // Don't show border if dragging a request
                if (draggedRequestElement) return;

                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';

                if (draggedCollectionElement === item) return;

                const rect = item.getBoundingClientRect();
                const midpoint = rect.top + rect.height / 2;

                collectionItems.forEach(ci => ci.classList.remove('border-t-2', 'border-b-2', 'border-primary-500'));

                if (e.clientY < midpoint) {
                    item.classList.add('border-t-2', 'border-primary-500');
                } else {
                    item.classList.add('border-b-2', 'border-primary-500');
                }
            });

            item.addEventListener('drop', async (e) => {
                // Don't drop if dragging a request
                if (draggedRequestElement) return;

                e.preventDefault();

                if (draggedCollectionElement === item) return;

                const dropIndex = index;
                const rect = item.getBoundingClientRect();
                const midpoint = rect.top + rect.height / 2;

                let newIndex = dropIndex;
                if (e.clientY >= midpoint) {
                    newIndex = dropIndex + 1;
                }

                // Reorder collections array
                const collections = [...this.collections];
                const [movedCollection] = collections.splice(draggedCollectionIndex, 1);

                if (draggedCollectionIndex < newIndex) {
                    newIndex--;
                }

                collections.splice(newIndex, 0, movedCollection);
                this.collections = collections;

                // Save all collections with new order
                await this.saveCollectionsOrder();
                this.render();
            });

            item.addEventListener('dragleave', (e) => {
                if (!item.contains(e.relatedTarget)) {
                    item.classList.remove('border-t-2', 'border-b-2', 'border-primary-500');
                }
            });
        });

        // Request drag & drop
        requestItems.forEach(item => {
            const dragHandle = item.querySelector('.drag-handle-request');

            if (dragHandle) {
                // Enable dragging only when drag handle is pressed
                dragHandle.addEventListener('mousedown', (e) => {
                    item.setAttribute('draggable', 'true');
                    e.stopPropagation();
                });

                dragHandle.addEventListener('mouseup', () => {
                    setTimeout(() => {
                        item.setAttribute('draggable', 'false');
                    }, 100);
                });
            }

            item.addEventListener('dragstart', (e) => {
                draggedRequestElement = item;
                draggedRequestId = item.dataset.requestId;
                draggedRequestCollectionId = item.dataset.collectionId;
                draggedRequestNodeId = item.dataset.nodeId;
                item.classList.add('opacity-50');
                e.dataTransfer.effectAllowed = 'move';
                e.stopPropagation();
            });

            item.addEventListener('dragend', (e) => {
                item.classList.remove('opacity-50');
                item.setAttribute('draggable', 'false');
                draggedRequestElement = null;
                draggedRequestId = null;
                draggedRequestCollectionId = null;
                draggedRequestNodeId = null;
                requestItems.forEach(ri => ri.classList.remove('border-t-2', 'border-b-2', 'border-primary-500'));
            });

            item.addEventListener('dragover', (e) => {
                // Only allow drop within same collection
                if (item.dataset.nodeId !== draggedRequestNodeId) return;

                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = 'move';

                if (draggedRequestElement === item) return;

                const rect = item.getBoundingClientRect();
                const midpoint = rect.top + rect.height / 2;

                requestItems.forEach(ri => ri.classList.remove('border-t-2', 'border-b-2', 'border-primary-500'));

                if (e.clientY < midpoint) {
                    item.classList.add('border-t-2', 'border-primary-500');
                } else {
                    item.classList.add('border-b-2', 'border-primary-500');
                }
            });

            item.addEventListener('drop', async (e) => {
                // Only allow drop within same collection
                if (item.dataset.nodeId !== draggedRequestNodeId) return;

                e.preventDefault();
                e.stopPropagation();

                if (draggedRequestElement === item) return;

                const collection = this.collections.find(c => c.id === draggedRequestCollectionId);
                const parent = collection && findNode(collection, draggedRequestNodeId)?.node;
                if (!parent || !parent.requests) return;

                const draggedIndex = parent.requests.findIndex(r => r.id === draggedRequestId);
                const dropIndex = parent.requests.findIndex(r => r.id === item.dataset.requestId);

                const rect = item.getBoundingClientRect();
                const midpoint = rect.top + rect.height / 2;

                let newIndex = dropIndex;
                if (e.clientY >= midpoint) {
                    newIndex = dropIndex + 1;
                }

                // Reorder requests array
                const requests = [...parent.requests];
                const [movedRequest] = requests.splice(draggedIndex, 1);

                if (draggedIndex < newIndex) {
                    newIndex--;
                }

                requests.splice(newIndex, 0, movedRequest);
                parent.requests = requests;

                // Save updated collection
                await StorageService.updateCollection(collection.id, collection);
                await this.loadCollections();
                this.render();
            });

            item.addEventListener('dragleave', (e) => {
                if (!item.contains(e.relatedTarget)) {
                    item.classList.remove('border-t-2', 'border-b-2', 'border-primary-500');
                }
            });
        });
    }

    async saveCollectionsOrder() {
        // Save collection order to localStorage
        try {
            const orderArray = this.collections.map(c => c.id);
            localStorage.setItem('collectionOrder', JSON.stringify(orderArray));
        } catch (error) {
            console.error('Failed to save collections order:', error);
        }
    }

    toggleCollection(collectionId) {
        if (this.expandedCollections.has(collectionId)) {
            this.expandedCollections.delete(collectionId);
        } else {
            this.expandedCollections.add(collectionId);
        }
        // Save to localStorage
        localStorage.setItem('expandedCollections', JSON.stringify([...this.expandedCollections]));
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
        const hit = collection && findRequest(collection, requestId);
        if (!hit) return;

        EventBus.emit(EVENTS.REQUEST_LOADED, hit.request);
    }

    async persist(collection, successMessage) {
        try {
            await StorageService.updateCollection(collection.id, collection);
            await this.loadCollections();
            this.render();
            if (successMessage) showToast(successMessage, 'success');
            EventBus.emit(EVENTS.COLLECTION_UPDATED);
            return true;
        } catch (error) {
            console.error('Failed to save collection:', error);
            showToast('Failed to save collection', 'error');
            return false;
        }
    }

    /** nodeId = folder (or collection) the request goes to when it is new. */
    async saveRequest(request, collectionId, nodeId = collectionId) {
        const collection = this.collections.find(c => c.id === collectionId);
        if (!collection) return;

        const requestWithId = {
            ...request,
            id: request.id || generateId(),
            name: request.name || request.url
        };

        const existing = findRequest(collection, requestWithId.id);
        if (existing) {
            const parent = existing.chain[existing.chain.length - 1];
            const index = parent.requests.findIndex(r => r.id === requestWithId.id);
            // keep per-request settings the builder does not edit (variables, scripts)
            parent.requests[index] = { ...existing.request, ...requestWithId };
        } else {
            const parent = findNode(collection, nodeId)?.node || collection;
            parent.requests.push(requestWithId);
        }

        this.expandedCollections.add(collectionId);
        this.expandedCollections.add(nodeId);
        await this.persist(collection, 'Request saved successfully');
    }

    async deleteRequest(collectionId, requestId) {
        if (!confirm('Are you sure you want to delete this request?')) return;

        const collection = this.collections.find(c => c.id === collectionId);
        const hit = collection && findRequest(collection, requestId);
        if (!hit) return;

        const parent = hit.chain[hit.chain.length - 1];
        parent.requests = parent.requests.filter(r => r.id !== requestId);
        await this.persist(collection, 'Request deleted successfully');
    }

    async addRequestPrompt(collectionId, nodeId = collectionId) {
        const name = prompt('Enter request name:');
        if (!name) return;

        const newRequest = {
            id: generateId(),
            name: name,
            method: 'GET',
            url: '',
            headers: [],
            body: '',
            auth: { type: 'inherit' }
        };

        await this.saveRequest(newRequest, collectionId, nodeId);
        EventBus.emit(EVENTS.REQUEST_LOADED, newRequest);
    }

    async addFolderPrompt(collectionId, parentId = collectionId) {
        const collection = this.collections.find(c => c.id === collectionId);
        const parent = collection && findNode(collection, parentId)?.node;
        if (!parent) return;

        const name = prompt('Enter folder name:');
        if (!name) return;

        const folder = createFolder(name);
        parent.folders.push(folder);
        this.expandedCollections.add(collectionId);
        this.expandedCollections.add(parentId);
        this.expandedCollections.add(folder.id);
        await this.persist(collection, 'Folder created');
    }

    async renameFolder(collectionId, folderId) {
        const collection = this.collections.find(c => c.id === collectionId);
        const folder = collection && findNode(collection, folderId)?.node;
        if (!folder) return;

        const name = prompt('Enter new name:', folder.name);
        if (!name || name === folder.name) return;
        folder.name = name;
        await this.persist(collection, 'Folder renamed');
    }

    async deleteFolder(collectionId, folderId) {
        const collection = this.collections.find(c => c.id === collectionId);
        const hit = collection && findNode(collection, folderId);
        if (!hit) return;

        const count = countRequests(hit.node);
        if (!confirm(`Delete folder "${hit.node.name}" and its ${count} request(s)?`)) return;

        const parent = hit.chain[hit.chain.length - 2];
        parent.folders = parent.folders.filter(f => f.id !== folderId);
        await this.persist(collection, 'Folder deleted');
    }

    /** Auth / variables / scripts editor lives in its own component. */
    openSettings(collectionId, nodeId) {
        EventBus.emit(EVENTS.NODE_SETTINGS, { collectionId, nodeId });
    }

    /** Re-read collections from the server (after import, settings edit...). */
    async reload() {
        await this.loadCollections();
        this.render();
    }

    subscribeToEvents() {
        EventBus.on(EVENTS.COLLECTION_IMPORTED, async (collectionId) => {
            await this.loadCollections();
            if (collectionId) this.expandedCollections.add(collectionId);
            this.render();
        });
    }
}
