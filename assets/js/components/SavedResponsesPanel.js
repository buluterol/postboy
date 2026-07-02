/**
 * Saved Responses Panel Component
 * 
 * Displays and manages saved responses
 */

import { EVENTS } from '../utils/constants.js';
import { EventBus } from '../services/EventBus.js';
import { formatResponseTime, getStatusCodeColor, confirm, showToast } from '../utils/helpers.js';

export class SavedResponsesPanel {
    constructor() {
        this.savedResponses = [];
        this.loadSavedResponses();
        this.subscribeToEvents();
    }

    loadSavedResponses() {
        try {
            this.savedResponses = JSON.parse(localStorage.getItem('savedResponses') || '[]');
        } catch (error) {
            console.error('Failed to load saved responses:', error);
            this.savedResponses = [];
        }
    }

    showModal() {
        this.loadSavedResponses();

        const modal = document.createElement('div');
        modal.id = 'savedResponsesModal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content max-w-5xl">
                <div class="modal-header">
                    <h2 class="text-xl font-semibold">Saved Responses</h2>
                    <button class="modal-close" id="closeSavedResponsesModal">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
                <div class="modal-body">
                    ${this.renderSavedResponses()}
                </div>
            </div>
        `;

        document.getElementById('modals').appendChild(modal);
        this.attachModalEventListeners();
    }

    renderSavedResponses() {
        if (this.savedResponses.length === 0) {
            return `
                <div class="text-center py-16 text-gray-500 dark:text-gray-400">
                    <svg class="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"></path>
                    </svg>
                    <p class="text-lg">No saved responses yet</p>
                    <p class="text-sm mt-2">Save responses to view them here</p>
                </div>
            `;
        }

        return `
            <div class="space-y-3 max-h-[600px] overflow-y-auto scrollbar-thin">
                ${this.savedResponses.map((item, index) => `
                    <div class="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-primary-500 dark:hover:border-primary-500 transition-colors">
                        <div class="flex items-start justify-between">
                            <div class="flex-1">
                                <h3 class="font-medium text-sm mb-2">${item.name}</h3>
                                <div class="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400 mb-2">
                                    <span class="method-badge ${this.getMethodClass(item.request.method)} px-2 py-1">
                                        ${item.request.method}
                                    </span>
                                    <span class="badge ${getStatusCodeColor(item.response.status)} px-2 py-1">
                                        ${item.response.status}
                                    </span>
                                    ${item.response.responseTime !== undefined ? `
                                        <span class="badge badge-info px-2 py-1">
                                            ${formatResponseTime(item.response.responseTime)}
                                        </span>
                                    ` : ''}
                                    <span>${new Date(item.timestamp).toLocaleString()}</span>
                                </div>
                                <div class="text-xs text-gray-600 dark:text-gray-400 truncate">
                                    ${item.request.url}
                                </div>
                            </div>
                            <div class="flex gap-2 ml-4">
                                <button class="btn btn-secondary btn-sm load-saved-response" data-index="${index}" title="Load">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path>
                                    </svg>
                                </button>
                                <button class="btn btn-danger btn-sm delete-saved-response" data-index="${index}" title="Delete">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                                    </svg>
                                </button>
                            </div>
                        </div>
                        
                        <!-- Expandable Response Preview -->
                        <details class="mt-3">
                            <summary class="cursor-pointer text-xs text-primary-600 dark:text-primary-400 hover:underline">
                                Show Response Preview
                            </summary>
                            <div class="mt-2 p-3 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
                                <pre class="text-xs overflow-auto max-h-48 scrollbar-thin"><code>${this.formatPreview(item.response.body)}</code></pre>
                            </div>
                        </details>
                    </div>
                `).join('')}
            </div>
        `;
    }

    getMethodClass(method) {
        const methodClasses = {
            GET: 'method-get',
            POST: 'method-post',
            PUT: 'method-put',
            PATCH: 'method-patch',
            DELETE: 'method-delete',
            HEAD: 'method-head',
            OPTIONS: 'method-options'
        };
        return methodClasses[method] || 'method-get';
    }

    formatPreview(body) {
        if (!body) return 'No body';
        
        try {
            // Try to parse and pretty print JSON
            const parsed = JSON.parse(body);
            return JSON.stringify(parsed, null, 2);
        } catch {
            // Return raw text, truncate if too long
            return body.length > 500 ? body.substring(0, 500) + '...' : body;
        }
    }

    attachModalEventListeners() {
        const modal = document.getElementById('savedResponsesModal');

        // Close modal
        const closeBtn = modal.querySelector('#closeSavedResponsesModal');
        closeBtn.addEventListener('click', () => {
            this.closeModal();
        });

        // Click outside to close
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeModal();
            }
        });

        // Load saved response
        modal.querySelectorAll('.load-saved-response').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.currentTarget.dataset.index);
                this.loadResponse(index);
            });
        });

        // Delete saved response
        modal.querySelectorAll('.delete-saved-response').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const index = parseInt(e.currentTarget.dataset.index);
                await this.deleteResponse(index);
            });
        });
    }

    loadResponse(index) {
        const item = this.savedResponses[index];
        if (!item) return;

        // Load the request
        EventBus.emit(EVENTS.REQUEST_LOADED, item.request);
        
        // Display the response
        EventBus.emit(EVENTS.RESPONSE_RECEIVED, item.response);
        
        showToast('Response loaded successfully', 'success');
        this.closeModal();
    }

    async deleteResponse(index) {
        if (!confirm('Are you sure you want to delete this saved response?')) {
            return;
        }

        this.savedResponses.splice(index, 1);
        localStorage.setItem('savedResponses', JSON.stringify(this.savedResponses));
        
        showToast('Saved response deleted', 'success');
        
        // Re-render the modal
        const modalBody = document.querySelector('#savedResponsesModal .modal-body');
        if (modalBody) {
            modalBody.innerHTML = this.renderSavedResponses();
            this.attachModalEventListeners();
        }
    }

    closeModal() {
        const modal = document.getElementById('savedResponsesModal');
        if (modal) {
            modal.remove();
        }
    }

    subscribeToEvents() {
        EventBus.on(EVENTS.RESPONSE_SAVED, () => {
            this.loadSavedResponses();
        });
    }
}
