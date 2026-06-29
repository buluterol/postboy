/**
 * History Panel Component
 * 
 * Displays request history
 */

import { EVENTS, METHOD_COLORS } from '../utils/constants.js';
import { EventBus } from '../services/EventBus.js';
import StorageService from '../services/StorageService.js';
import { formatDate, formatResponseTime, getStatusCodeColor, createElement, confirm, showToast } from '../utils/helpers.js';

export class HistoryPanel {
    constructor() {
        this.history = [];
        this.modalElement = null;

        this.init();
    }

    async init() {
        await this.loadHistory();
        this.subscribeToEvents();
    }

    async loadHistory() {
        try {
            this.history = await StorageService.getHistory();
        } catch (error) {
            console.error('Failed to load history:', error);
            this.history = [];
        }
    }

    showModal() {
        this.modalElement = createElement(`
            <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" id="historyModal">
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col">
                    <!-- Header -->
                    <div class="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                        <h2 class="text-xl font-semibold">Request History</h2>
                        <div class="flex items-center gap-3">
                            <button id="clearHistoryBtn" class="btn btn-danger btn-sm">
                                Clear All
                            </button>
                            <button id="closeHistoryModal" class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                                </svg>
                            </button>
                        </div>
                    </div>
                    
                    <!-- Body -->
                    <div class="flex-1 overflow-y-auto">
                        <div id="historyList">
                            ${this.renderHistoryList()}
                        </div>
                    </div>
                </div>
            </div>
        `);

        document.getElementById('modals').appendChild(this.modalElement);

        // Attach event listeners
        this.attachModalEventListeners();
    }

    renderHistoryList() {
        if (this.history.length === 0) {
            return `
                <div class="text-center text-gray-500 dark:text-gray-400 py-16">
                    <svg class="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <p>No request history yet</p>
                </div>
            `;
        }

        return `
            <div class="divide-y divide-gray-200 dark:divide-gray-700">
                ${this.history.map(entry => this.renderHistoryEntry(entry)).join('')}
            </div>
        `;
    }

    renderHistoryEntry(entry) {
        const methodClass = METHOD_COLORS[entry.method] || 'method-get';
        const statusColor = entry.status ? getStatusCodeColor(entry.status) : 'text-gray-500';

        return `
            <div class="p-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer history-entry" 
                 data-entry='${JSON.stringify(entry).replace(/'/g, "&apos;")}'>
                <div class="flex items-center gap-3 mb-2">
                    <span class="method-badge ${methodClass} text-xs">${entry.method}</span>
                    ${entry.status ? `
                        <span class="badge ${statusColor} text-xs">${entry.status}</span>
                    ` : ''}
                    ${entry.responseTime !== null && entry.responseTime !== undefined ? `
                        <span class="text-xs text-gray-500">${formatResponseTime(entry.responseTime)}</span>
                    ` : ''}
                    <span class="text-xs text-gray-500 ml-auto">${formatDate(entry.timestamp)}</span>
                </div>
                <div class="text-sm font-mono text-gray-700 dark:text-gray-300 truncate">
                    ${entry.url}
                </div>
            </div>
        `;
    }

    attachModalEventListeners() {
        // Close modal
        this.modalElement.querySelector('#closeHistoryModal').addEventListener('click', () => {
            this.closeModal();
        });

        // Close on background click
        this.modalElement.addEventListener('click', (e) => {
            if (e.target.id === 'historyModal') {
                this.closeModal();
            }
        });

        // Clear history
        this.modalElement.querySelector('#clearHistoryBtn').addEventListener('click', () => {
            this.clearHistory();
        });

        // Click on history entry
        this.modalElement.querySelectorAll('.history-entry').forEach(entry => {
            entry.addEventListener('click', (e) => {
                const data = JSON.parse(e.currentTarget.dataset.entry);
                this.loadHistoryEntry(data);
            });
        });
    }

    closeModal() {
        if (this.modalElement) {
            this.modalElement.remove();
            this.modalElement = null;
        }
    }

    async clearHistory() {
        if (!confirm('Are you sure you want to clear all history?')) return;

        try {
            await StorageService.clearHistory();
            this.history = [];
            this.updateModalContent();
            showToast('History cleared successfully', 'success');
        } catch (error) {
            console.error('Failed to clear history:', error);
            showToast('Failed to clear history', 'error');
        }
    }

    loadHistoryEntry(entry) {
        // Load the request into the request builder
        const request = {
            method: entry.method,
            url: entry.url,
            headers: [],
            body: ''
        };

        EventBus.emit(EVENTS.REQUEST_LOADED, request);
        this.closeModal();
    }

    updateModalContent() {
        const container = this.modalElement?.querySelector('#historyList');
        if (container) {
            container.innerHTML = this.renderHistoryList();

            // Re-attach entry click listeners
            container.querySelectorAll('.history-entry').forEach(entry => {
                entry.addEventListener('click', (e) => {
                    const data = JSON.parse(e.currentTarget.dataset.entry);
                    this.loadHistoryEntry(data);
                });
            });
        }
    }

    subscribeToEvents() {
        EventBus.on(EVENTS.HISTORY_UPDATED, async () => {
            await this.loadHistory();
            this.updateModalContent();
        });
    }
}
