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
        const name = prompt('Enter environment name:');
        if (!name) return;
        
        try {
            const environment = await StorageService.createEnvironment({
                name,
                variables: [],
                isActive: this.environments.length === 0
            });
            
            this.environments.push(environment);
            
            if (this.environments.length === 1) {
                this.setActiveEnvironment(environment);
            }
            
            this.updateModalContent();
            showToast('Environment created successfully', 'success');
        } catch (error) {
            console.error('Failed to create environment:', error);
            showToast('Failed to create environment', 'error');
        }
    }
    
    async editEnvironment(envId) {
        const env = this.environments.find(e => e.id === envId);
        if (!env) return;
        
        // Show edit modal (simplified - using prompts for now)
        const newName = prompt('Enter new name:', env.name);
        if (!newName) return;
        
        const variablesJson = prompt(
            'Enter variables as JSON array:\n[{"key": "baseUrl", "value": "https://api.example.com"}]',
            JSON.stringify(env.variables || [], null, 2)
        );
        
        let variables = env.variables;
        try {
            if (variablesJson) {
                variables = JSON.parse(variablesJson);
            }
        } catch (e) {
            showToast('Invalid JSON format', 'error');
            return;
        }
        
        try {
            const updated = await StorageService.updateEnvironment(envId, {
                ...env,
                name: newName,
                variables
            });
            
            const index = this.environments.findIndex(e => e.id === envId);
            this.environments[index] = updated;
            
            if (this.activeEnvironment?.id === envId) {
                this.setActiveEnvironment(updated);
            }
            
            this.updateModalContent();
            showToast('Environment updated successfully', 'success');
        } catch (error) {
            console.error('Failed to update environment:', error);
            showToast('Failed to update environment', 'error');
        }
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
}
