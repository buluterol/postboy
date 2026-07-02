/**
 * Response Viewer Component
 * 
 * Displays HTTP response data
 */

import { EVENTS, RESPONSE_FORMATS } from '../utils/constants.js';
import { EventBus } from '../services/EventBus.js';
import {
    formatResponseTime,
    getStatusCodeColor,
    highlightJson,
    prettyPrintJson
} from '../utils/helpers.js';

export class ResponseViewer {
    constructor(container) {
        this.container = container;
        this.currentResponse = null;
        this.currentRequest = null;
        this.activeFormat = RESPONSE_FORMATS.JSON;
        this.dropdownOpen = false;

        this.subscribeToEvents();
        this.renderEmpty();
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (this.dropdownOpen && !e.target.closest('#savedResponsesDropdown')) {
                this.dropdownOpen = false;
                this.updateDropdownVisibility();
            }
        });
    }

    renderEmpty() {
        this.container.innerHTML = `
            <div class="text-center text-gray-500 dark:text-gray-400 py-16">
                <svg class="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <p>Send a request to see the response</p>
            </div>
        `;
    }

    render() {
        if (!this.currentResponse) {
            this.renderEmpty();
            return;
        }

        const { status, statusText, responseTime, headers, body, error } = this.currentResponse;
        const savedResponses = this.getSavedResponsesForCurrentRequest();

        this.container.innerHTML = `
            <!-- Status Bar -->
            <div class="flex items-center justify-between mb-4 pb-3 border-b border-gray-200 dark:border-gray-700">
                <div class="flex items-center gap-4">
                    <span class="text-sm text-gray-600 dark:text-gray-400">Status:</span>
                    <span class="badge ${error ? 'badge-error' : getStatusCodeColor(status)} font-mono">
                        ${status || 'Error'} ${statusText || ''}
                    </span>
                    
                    ${responseTime !== undefined ? `
                        <span class="text-sm text-gray-600 dark:text-gray-400">Time:</span>
                        <span class="badge badge-info font-mono">${formatResponseTime(responseTime)}</span>
                    ` : ''}
                </div>
                
                <div class="flex gap-2 items-center">
                    <button id="saveResponseBtn" class="btn btn-primary btn-sm">
                        <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path>
                        </svg>
                        Save Response
                    </button>
                    
                    <button id="copyResponseBtn" class="btn btn-secondary btn-sm">
                        Copy Response
                    </button>
                    
                    <!-- Saved Responses Dropdown -->
                    ${savedResponses.length > 0 ? `
                        <div id="savedResponsesDropdown" class="relative">
                            <button id="savedResponsesBtn" class="btn btn-secondary btn-sm">
                                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"></path>
                                </svg>
                                Saved Responses (${savedResponses.length})
                                <svg class="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                                </svg>
                            </button>
                            
                            <!-- Dropdown Menu -->
                            <div id="savedResponsesMenu" class="hidden absolute right-0 mt-2 w-96 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 max-h-96 overflow-y-auto scrollbar-thin">
                                <div class="p-2">
                                    ${savedResponses.map((saved, index) => `
                                        <div class="saved-response-item p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg cursor-pointer transition-colors mb-2"
                                             data-saved-index="${index}"
                                             title="${saved.name}">
                                            <div class="flex items-center justify-between mb-2">
                                                <span class="badge ${getStatusCodeColor(saved.response.status)} text-xs px-2 py-1">
                                                    ${saved.response.status} ${saved.request.method}
                                                </span>
                                                ${saved.response.responseTime !== undefined ? `
                                                    <span class="badge badge-info text-xs px-2 py-1">
                                                        ${formatResponseTime(saved.response.responseTime)}
                                                    </span>
                                                ` : ''}
                                            </div>
                                            <div class="text-sm text-gray-800 dark:text-gray-200 font-medium mb-1 truncate">
                                                ${saved.name}
                                            </div>
                                            <div class="text-xs text-gray-500 dark:text-gray-400 truncate mb-1">
                                                ${saved.request.url}
                                            </div>
                                            <div class="text-xs text-gray-400 dark:text-gray-500">
                                                ${new Date(saved.timestamp).toLocaleString()}
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
                    
                    <!-- Tabs -->
                    <div class="border-b border-gray-200 dark:border-gray-700 mb-4">
                        <nav class="flex gap-4">
                            <button class="tab tab-active" data-tab="body">Body</button>
                            <button class="tab" data-tab="headers">Headers</button>
                        </nav>
                    </div>
                    
            <!-- Tab Content -->
            <div id="responseTabContent">
                <!-- Body Tab -->
                <div id="responseBodyTab" class="tab-content">
                    ${!error ? `
                        <!-- Format Buttons -->
                        <div class="flex gap-2 mb-3">
                            <button class="btn btn-sm ${this.activeFormat === RESPONSE_FORMATS.JSON ? 'btn-primary' : 'btn-secondary'}" 
                                    data-format="${RESPONSE_FORMATS.JSON}">
                                JSON
                            </button>
                            <button class="btn btn-sm ${this.activeFormat === RESPONSE_FORMATS.RAW ? 'btn-primary' : 'btn-secondary'}" 
                                    data-format="${RESPONSE_FORMATS.RAW}">
                                Raw
                            </button>
                            <button class="btn btn-sm ${this.activeFormat === RESPONSE_FORMATS.HTML ? 'btn-primary' : 'btn-secondary'}" 
                                    data-format="${RESPONSE_FORMATS.HTML}">
                                Preview
                            </button>
                        </div>
                    ` : ''}
                    
                    <!-- Response Content -->
                    <div id="responseContent" class="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 overflow-auto max-h-96 scrollbar-thin">
                        ${this.renderBody()}
                    </div>
                </div>
                
                <!-- Headers Tab -->
                <div id="responseHeadersTab" class="tab-content hidden">
                    <div class="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 overflow-auto max-h-96 scrollbar-thin">
                        ${this.renderHeaders()}
                    </div>
                </div>
            </div>
        `;

        this.attachEventListeners();
    }

    renderBody() {
        if (!this.currentResponse) return '';

        const { body, error, message, isJson } = this.currentResponse;

        if (error) {
            return `
                <div class="text-red-600 dark:text-red-400">
                    <p class="font-semibold mb-2">Request Failed</p>
                    <p class="text-sm">${message || 'An error occurred'}</p>
                </div>
            `;
        }

        if (!body) {
            return '<p class="text-gray-500 dark:text-gray-400 text-sm">Empty response</p>';
        }

        // Format based on active format
        if (this.activeFormat === RESPONSE_FORMATS.JSON && isJson) {
            try {
                const formatted = prettyPrintJson(body);
                const highlighted = highlightJson(formatted);
                return `<pre class="code-editor text-sm">${highlighted}</pre>`;
            } catch (e) {
                return `<pre class="code-editor text-sm">${this.escapeHtml(body)}</pre>`;
            }
        }

        if (this.activeFormat === RESPONSE_FORMATS.HTML) {
            // Check if body looks like HTML
            if (body.trim().startsWith('<')) {
                return `<iframe srcdoc="${this.escapeHtml(body)}" class="w-full h-96 border-0"></iframe>`;
            }
            return `<p class="text-gray-500 text-sm">Not HTML content</p>`;
        }

        // Raw format
        return `<pre class="code-editor text-sm whitespace-pre-wrap">${this.escapeHtml(body)}</pre>`;
    }

    renderHeaders() {
        if (!this.currentResponse || !this.currentResponse.headers) {
            return '<p class="text-gray-500 dark:text-gray-400 text-sm">No headers</p>';
        }

        const headers = this.currentResponse.headers;
        const entries = Object.entries(headers);

        if (entries.length === 0) {
            return '<p class="text-gray-500 dark:text-gray-400 text-sm">No headers</p>';
        }

        return `
            <table class="w-full text-sm">
                <thead class="border-b border-gray-200 dark:border-gray-700">
                    <tr>
                        <th class="text-left py-2 font-semibold">Header</th>
                        <th class="text-left py-2 font-semibold">Value</th>
                    </tr>
                </thead>
                <tbody>
                    ${entries.map(([key, value]) => `
                        <tr class="border-b border-gray-200 dark:border-gray-700">
                            <td class="py-2 font-mono text-purple-600 dark:text-purple-400">${this.escapeHtml(key)}</td>
                            <td class="py-2 font-mono">${this.escapeHtml(value)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    attachEventListeners() {
        // Tab switching
        this.container.querySelectorAll('[data-tab]').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.target.dataset.tab;
                this.switchTab(tabName);
            });
        });

        // Format switching
        this.container.querySelectorAll('[data-format]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.activeFormat = e.target.dataset.format;
                this.render();
            });
        });

        // Copy response
        const copyBtn = this.container.querySelector('#copyResponseBtn');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                this.copyResponse();
            });
        }
        
        // Save response
        const saveBtn = this.container.querySelector('#saveResponseBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.saveResponse();
            });
        }
        
        // Saved responses dropdown toggle
        const dropdownBtn = this.container.querySelector('#savedResponsesBtn');
        if (dropdownBtn) {
            dropdownBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.dropdownOpen = !this.dropdownOpen;
                this.updateDropdownVisibility();
            });
        }
        
        // Load saved response
        this.container.querySelectorAll('.saved-response-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const index = parseInt(e.currentTarget.dataset.savedIndex);
                this.loadSavedResponse(index);
                this.dropdownOpen = false;
                this.updateDropdownVisibility();
            });
        });
    }
    
    updateDropdownVisibility() {
        const menu = this.container.querySelector('#savedResponsesMenu');
        if (menu) {
            if (this.dropdownOpen) {
                menu.classList.remove('hidden');
            } else {
                menu.classList.add('hidden');
            }
        }
    }

    switchTab(tabName) {
        // Update tab buttons
        this.container.querySelectorAll('[data-tab]').forEach(tab => {
            if (tab.dataset.tab === tabName) {
                tab.classList.add('tab-active');
            } else {
                tab.classList.remove('tab-active');
            }
        });

        // Update tab content
        const bodyTab = this.container.querySelector('#responseBodyTab');
        const headersTab = this.container.querySelector('#responseHeadersTab');

        if (tabName === 'body') {
            bodyTab.classList.remove('hidden');
            headersTab.classList.add('hidden');
        } else if (tabName === 'headers') {
            bodyTab.classList.add('hidden');
            headersTab.classList.remove('hidden');
        }
    }

    copyResponse() {
        if (!this.currentResponse || !this.currentResponse.body) return;

        const body = this.currentResponse.body;

        navigator.clipboard.writeText(body).then(() => {
            // Show success message
            import('../utils/helpers.js').then(({ showToast }) => {
                showToast('Response copied to clipboard', 'success');
            });
        }).catch(err => {
            console.error('Failed to copy:', err);
        });
    }
    
    saveResponse() {
        if (!this.currentResponse || !this.currentRequest) {
            import('../utils/helpers.js').then(({ showToast }) => {
                showToast('No response to save', 'error');
            });
            return;
        }
        
        import('../utils/helpers.js').then(({ prompt, showToast, generateId }) => {
            const defaultName = `${this.currentRequest.method} ${this.currentRequest.url} - ${new Date().toLocaleString()}`;
            const name = prompt('Enter a name for this saved response:', defaultName);
            
            if (!name) return;
            
            const savedResponse = {
                id: generateId(),
                name,
                timestamp: Date.now(),
                requestId: this.currentRequest.id, // Link to request
                request: this.currentRequest,
                response: this.currentResponse
            };
            
            // Get existing saved responses
            const saved = JSON.parse(localStorage.getItem('savedResponses') || '[]');
            saved.unshift(savedResponse);
            
            // Keep only last 50 responses
            if (saved.length > 50) {
                saved.splice(50);
            }
            
            localStorage.setItem('savedResponses', JSON.stringify(saved));
            showToast('Response saved successfully', 'success');
            
            EventBus.emit(EVENTS.RESPONSE_SAVED, savedResponse);
            
            // Re-render to show the new saved response in sidebar
            this.render();
        });
    }
    
    getSavedResponsesForCurrentRequest() {
        if (!this.currentRequest || !this.currentRequest.id) {
            return [];
        }
        
        try {
            const saved = JSON.parse(localStorage.getItem('savedResponses') || '[]');
            // Filter by request ID and sort by timestamp (newest first)
            return saved
                .filter(item => item.requestId === this.currentRequest.id)
                .sort((a, b) => b.timestamp - a.timestamp);
        } catch (error) {
            console.error('Failed to get saved responses:', error);
            return [];
        }
    }
    
    loadSavedResponse(index) {
        const savedResponses = this.getSavedResponsesForCurrentRequest();
        const savedItem = savedResponses[index];
        
        if (!savedItem) return;
        
        // Load the saved response AND request data
        this.currentResponse = savedItem.response;
        this.currentRequest = savedItem.request;
        this.render();
        
        // Also emit event to update the request builder UI
        EventBus.emit(EVENTS.REQUEST_LOADED, savedItem.request);
        
        import('../utils/helpers.js').then(({ showToast }) => {
            showToast(`Loaded: ${savedItem.name}`, 'success');
        });
    }

    subscribeToEvents() {
        EventBus.on(EVENTS.REQUEST_SENT, (requestData) => {
            // Store current request for saving purposes
            this.currentRequest = requestData;
        });
        
        EventBus.on(EVENTS.RESPONSE_RECEIVED, (response) => {
            this.currentResponse = response;
            this.activeFormat = response.isJson ? RESPONSE_FORMATS.JSON : RESPONSE_FORMATS.RAW;
            this.render();
        });
    }

    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}
