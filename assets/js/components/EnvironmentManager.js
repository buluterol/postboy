/**
 * Environment Manager Component
 * 
 * Manages environment variables
 */

import { EVENTS, STORAGE_KEYS } from '../utils/constants.js';
import { EventBus } from '../services/EventBus.js';
import StorageService from '../services/StorageService.js';
import { showToast, prompt, confirm, generateId, createElement } from '../utils/helpers.js';

export class EnvironmentManager {
    constructor() {
        this.environments = [];
        this.activeEnvironment = null;
        this.modalElement = null;

        this.init();
    }

    async init() {
        await this.loadEnvironments();
        this.loadActiveEnvironment();
        this.updateEnvironmentSelector();
        EventBus.on(EVENTS.ENVIRONMENT_IMPORTED, async () => {
            await this.loadEnvironments();
            this.updateEnvironmentSelector();
        });
    }

    async loadEnvironments() {
        try {
            this.environments = await StorageService.getEnvironments();
        } catch (error) {
            console.error('Failed to load environments:', error);
            this.environments = [];
        }
    }

    loadActiveEnvironment() {
        // Load from localStorage
        const savedId = localStorage.getItem(STORAGE_KEYS.ACTIVE_ENVIRONMENT);
        if (savedId) {
            const env = this.environments.find(e => e.id === savedId);
            if (env) {
                this.setActiveEnvironment(env);
                return;
            }
        }

        // Try to find an active environment
        const active = this.environments.find(e => e.isActive);
        if (active) {
            this.setActiveEnvironment(active);
        }
    }

    setActiveEnvironment(environment) {
        this.activeEnvironment = environment;

        // Convert variables array to object
        const variables = {};
        if (environment && environment.variables) {
            environment.variables.forEach(v => {
                if (v.key) {
                    variables[v.key] = v.value;
                }
            });
        }

        // Save to localStorage
        localStorage.setItem(STORAGE_KEYS.ACTIVE_ENVIRONMENT, environment?.id || '');

        // Emit event
        EventBus.emit(EVENTS.ENVIRONMENT_CHANGED, variables);

        this.updateEnvironmentSelector();
    }

    updateEnvironmentSelector() {
        const select = document.getElementById('activeEnvironment');
        if (!select) return;

        select.innerHTML = `
            <option value="">No Environment</option>
            ${this.environments.map(env => `
                <option value="${env.id}" ${this.activeEnvironment?.id === env.id ? 'selected' : ''}>
                    ${env.name}
                </option>
            `).join('')}
        `;

        // Update select change handler
        select.onchange = (e) => {
            const envId = e.target.value;
            const env = this.environments.find(e => e.id === envId);
            this.setActiveEnvironment(env || null);
        };
    }

    showModal() {
        this.modalElement = createElement(`
            <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" id="envModal">
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                    <!-- Header -->
                    <div class="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                        <h2 class="text-xl font-semibold">Manage Environments</h2>
                        <button id="closeEnvModal" class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                        </button>
                    </div>
                    
                    <!-- Body -->
                    <div class="flex-1 overflow-y-auto p-6">
                        <div class="mb-4">
                            <button id="addEnvironmentBtn" class="btn btn-primary btn-sm">
                                + New Environment
                            </button>
                        </div>
                        
                        <div id="environmentsList" class="space-y-4">
                            ${this.renderEnvironmentsList()}
                        </div>
                    </div>
                </div>
            </div>
        `);

        document.getElementById('modals').appendChild(this.modalElement);

        // Attach event listeners
        this.attachModalEventListeners();
    }

    renderEnvironmentsList() {
        if (this.environments.length === 0) {
            return '<p class="text-gray-500 dark:text-gray-400 text-sm">No environments yet. Create one to get started.</p>';
        }

        return this.environments.map(env => `
            <div class="panel">
                <div class="panel-header flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <input type="radio" name="activeEnv" value="${env.id}" 
                               ${this.activeEnvironment?.id === env.id ? 'checked' : ''}
                               class="env-active-radio">
                        <span class="font-semibold">${env.name}</span>
                    </div>
                    <div class="flex gap-2">
                        <button class="btn btn-secondary btn-sm env-edit" data-env-id="${env.id}">
                            Edit
                        </button>
                        <button class="btn btn-danger btn-sm env-delete" data-env-id="${env.id}">
                            Delete
                        </button>
                    </div>
                </div>
                <div class="panel-body">
                    <div class="text-sm space-y-2">
                        ${env.variables && env.variables.length > 0 ? `
                            <table class="w-full">
                                <thead class="text-xs text-gray-500">
                                    <tr>
                                        <th class="text-left pb-2">Key</th>
                                        <th class="text-left pb-2">Value</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${env.variables.map(v => `
                                        <tr>
                                            <td class="py-1 font-mono text-purple-600 dark:text-purple-400">{{${v.key}}}</td>
                                            <td class="py-1 font-mono">${v.value}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        ` : '<p class="text-gray-500">No variables</p>'}
                    </div>
                </div>
            </div>
        `).join('');
    }

    attachModalEventListeners() {
        // Close modal
        this.modalElement.querySelector('#closeEnvModal').addEventListener('click', () => {
            this.closeModal();
        });

        // Close on background click
        this.modalElement.addEventListener('click', (e) => {
            if (e.target.id === 'envModal') {
                this.closeModal();
            }
        });

        // Add environment
        this.modalElement.querySelector('#addEnvironmentBtn').addEventListener('click', () => {
            this.createEnvironment();
        });

        // Active radio
        this.modalElement.querySelectorAll('.env-active-radio').forEach(radio => {
            radio.addEventListener('change', (e) => {
                const envId = e.target.value;
                const env = this.environments.find(e => e.id === envId);
                this.setActiveEnvironment(env);
            });
        });

        // Edit environment
        this.modalElement.querySelectorAll('.env-edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const envId = e.target.dataset.envId;
                this.editEnvironment(envId);
            });
        });

        // Delete environment
        this.modalElement.querySelectorAll('.env-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const envId = e.target.dataset.envId;
                this.deleteEnvironment(envId);
            });
        });
    }

    closeModal() {
        if (this.modalElement) {
            this.modalElement.remove();
            this.modalElement = null;
        }
    }

    async createEnvironment() {
        this.showEnvironmentEditModal(null);
    }

    async editEnvironment(envId) {
        const env = this.environments.find(e => e.id === envId);
        if (!env) return;

        this.showEnvironmentEditModal(env);
    }

    async deleteEnvironment(envId) {
        if (!confirm('Are you sure you want to delete this environment?')) return;

        try {
            await StorageService.deleteEnvironment(envId);
            this.environments = this.environments.filter(e => e.id !== envId);

            if (this.activeEnvironment?.id === envId) {
                this.setActiveEnvironment(null);
            }

            this.updateModalContent();
            showToast('Environment deleted successfully', 'success');
        } catch (error) {
            console.error('Failed to delete environment:', error);
            showToast('Failed to delete environment', 'error');
        }
    }

    updateModalContent() {
        const container = this.modalElement?.querySelector('#environmentsList');
        if (container) {
            container.innerHTML = this.renderEnvironmentsList();
            this.attachModalEventListeners();
        }
    }

    showEnvironmentEditModal(environment) {
        const isEdit = !!environment;
        const variables = environment?.variables || [{ key: '', value: '' }];

        const editModal = createElement(`
            <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" id="envEditModal">
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
                    <!-- Header -->
                    <div class="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                        <h2 class="text-xl font-semibold">${isEdit ? 'Edit' : 'Create'} Environment</h2>
                        <button id="closeEnvEditModal" class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                        </button>
                    </div>
                    
                    <!-- Body -->
                    <div class="flex-1 overflow-y-auto p-6 space-y-4">
                        <!-- Name Input -->
                        <div>
                            <label class="block text-sm font-medium mb-2">Environment Name</label>
                            <input type="text" id="envName" value="${environment?.name || ''}" 
                                   class="input w-full" placeholder="e.g., Production, Development" required>
                        </div>

                        <!-- Variables Table -->
                        <div>
                            <div class="flex items-center justify-between mb-2">
                                <label class="block text-sm font-medium">Variables</label>
                                <button id="addEnvVariable" class="btn btn-secondary btn-sm">
                                    + Add Variable
                                </button>
                            </div>
                            
                            <div class="bg-gray-50 dark:bg-gray-900 rounded-lg overflow-hidden">
                                <table class="w-full">
                                    <thead class="bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                                        <tr>
                                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 w-12"></th>
                                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400">Key</th>
                                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400">Value</th>
                                            <th class="px-4 py-3 text-center text-xs font-medium text-gray-600 dark:text-gray-400 w-16">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody id="envVariablesTable">
                                        ${this.renderVariableRows(variables)}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <p class="text-xs text-gray-500 dark:text-gray-400">
                            💡 Use variables in your requests with <code class="bg-gray-200 dark:bg-gray-700 px-1 rounded">{{variableName}}</code> syntax
                        </p>
                    </div>
                    
                    <!-- Footer -->
                    <div class="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
                        <button id="cancelEnvEdit" class="btn btn-secondary">
                            Cancel
                        </button>
                        <button id="saveEnvEdit" class="btn btn-primary">
                            ${isEdit ? 'Update' : 'Create'} Environment
                        </button>
                    </div>
                </div>
            </div>
        `);

        document.getElementById('modals').appendChild(editModal);

        // Attach event listeners
        this.attachEditModalEventListeners(editModal, environment);
    }

    renderVariableRows(variables) {
        if (!variables || variables.length === 0) {
            variables = [{ key: '', value: '' }];
        }

        return variables.map((variable, index) => `
            <tr class="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 variable-row" data-index="${index}">
                <td class="px-4 py-3 text-center">
                    <span class="drag-handle cursor-move text-gray-400 hover:text-gray-600">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16"></path>
                        </svg>
                    </span>
                </td>
                <td class="px-4 py-3">
                    <input type="text" class="input input-sm w-full font-mono variable-key" 
                           value="${variable.key || ''}" placeholder="key">
                </td>
                <td class="px-4 py-3">
                    <input type="text" class="input input-sm w-full font-mono variable-value" 
                           value="${variable.value || ''}" placeholder="value">
                </td>
                <td class="px-4 py-3 text-center">
                    <button class="text-red-500 hover:text-red-700 delete-variable" title="Delete">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                        </svg>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    attachEditModalEventListeners(modal, environment) {
        const isEdit = !!environment;

        // Close modal
        modal.querySelector('#closeEnvEditModal').addEventListener('click', () => {
            modal.remove();
        });

        modal.querySelector('#cancelEnvEdit').addEventListener('click', () => {
            modal.remove();
        });

        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target.id === 'envEditModal') {
                modal.remove();
            }
        });

        // Add variable
        modal.querySelector('#addEnvVariable').addEventListener('click', () => {
            const tbody = modal.querySelector('#envVariablesTable');
            const newRow = createElement(this.renderVariableRows([{ key: '', value: '' }]));
            tbody.appendChild(newRow);
            
            // Reattach delete listeners
            this.attachVariableRowListeners(modal);
            
            // Focus on the new key input
            const newKeyInput = newRow.querySelector('.variable-key');
            if (newKeyInput) {
                newKeyInput.focus();
            }
        });

        // Delete and drag listeners
        this.attachVariableRowListeners(modal);

        // Save environment
        modal.querySelector('#saveEnvEdit').addEventListener('click', async () => {
            const name = modal.querySelector('#envName').value.trim();
            
            if (!name) {
                showToast('Please enter environment name', 'error');
                return;
            }

            // Collect variables
            const variables = [];
            const rows = modal.querySelectorAll('.variable-row');
            
            rows.forEach(row => {
                const key = row.querySelector('.variable-key').value.trim();
                const value = row.querySelector('.variable-value').value.trim();
                
                if (key) { // Only add if key is not empty
                    variables.push({ key, value });
                }
            });

            try {
                if (isEdit) {
                    // Update existing environment
                    const updated = await StorageService.updateEnvironment(environment.id, {
                        ...environment,
                        name,
                        variables
                    });

                    const index = this.environments.findIndex(e => e.id === environment.id);
                    this.environments[index] = updated;

                    if (this.activeEnvironment?.id === environment.id) {
                        this.setActiveEnvironment(updated);
                    }

                    showToast('Environment updated successfully', 'success');
                } else {
                    // Create new environment
                    const newEnv = await StorageService.createEnvironment({
                        name,
                        variables,
                        isActive: this.environments.length === 0
                    });

                    this.environments.push(newEnv);

                    if (this.environments.length === 1) {
                        this.setActiveEnvironment(newEnv);
                    }

                    showToast('Environment created successfully', 'success');
                }

                modal.remove();
                this.updateModalContent();
            } catch (error) {
                console.error('Failed to save environment:', error);
                showToast('Failed to save environment', 'error');
            }
        });
    }

    attachVariableRowListeners(modal) {
        // Delete variable
        modal.querySelectorAll('.delete-variable').forEach(btn => {
            btn.onclick = (e) => {
                const row = e.target.closest('.variable-row');
                const tbody = modal.querySelector('#envVariablesTable');
                
                // Keep at least one row
                if (tbody.querySelectorAll('.variable-row').length > 1) {
                    row.remove();
                } else {
                    // Clear the inputs instead of removing
                    row.querySelector('.variable-key').value = '';
                    row.querySelector('.variable-value').value = '';
                    showToast('At least one row is required', 'info');
                }
            };
        });
    }
}
