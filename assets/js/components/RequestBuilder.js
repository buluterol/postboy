/**
 * Request Builder Component
 * 
 * UI for building and sending HTTP requests
 */

import { HTTP_METHODS, AUTH_TYPES, BODY_TYPES, EVENTS } from '../utils/constants.js';
import { EventBus } from '../services/EventBus.js';
import { interpolateVariables, createElement } from '../utils/helpers.js';
import ApiService from '../services/ApiService.js';
import { RateLimitTester } from './RateLimitTester.js';

export class RequestBuilder {
    constructor(container) {
        this.container = container;
        this.currentRequest = this.getDefaultRequest();
        this.activeBodyType = BODY_TYPES.JSON;
        this.activeAuthType = AUTH_TYPES.NONE;
        this.currentEnvironment = {};
        this.rateLimitTester = new RateLimitTester(this);
        
        this.render();
        this.attachEventListeners();
        this.subscribeToEvents();
    }
    
    getDefaultRequest() {
        return {
            method: 'GET',
            url: '',
            headers: [{ key: '', value: '', enabled: true }],
            queryParams: [],
            body: '',
            formData: [{ key: '', value: '', enabled: true }],
            auth: { type: AUTH_TYPES.NONE }
        };
    }
    
    render() {
        this.container.innerHTML = `
            <!-- Method and URL -->
            <div class="flex gap-2 mb-4">
                <select id="requestMethod" class="select w-32">
                    ${HTTP_METHODS.map(method => `
                        <option value="${method}" ${this.currentRequest.method === method ? 'selected' : ''}>
                            ${method}
                        </option>
                    `).join('')}
                </select>
                
                <input 
                    type="text" 
                    id="requestUrl" 
                    class="input flex-1" 
                    placeholder="https://api.example.com/endpoint"
                    value="${this.currentRequest.url}"
                >
                
                <button id="rateLimitTestBtn" class="btn btn-secondary" title="Rate Limit Tester">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                    </svg>
                </button>
                
                <button id="sendRequestBtn" class="btn btn-primary">
                    <span id="sendBtnText">Send</span>
                    <span id="sendBtnSpinner" class="spinner hidden"></span>
                </button>
            </div>
            
            <!-- Tabs -->
            <div class="border-b border-gray-200 dark:border-gray-700 mb-4">
                <nav class="flex gap-4">
                    <button class="tab tab-active" data-tab="headers">Headers</button>
                    <button class="tab" data-tab="body">Body</button>
                    <button class="tab" data-tab="auth">Auth</button>
                    <button class="tab" data-tab="params">Query Params</button>
                </nav>
            </div>
            
            <!-- Tab Content -->
            <div id="tabContent" class="min-h-[300px]">
                <!-- Headers Tab -->
                <div id="headersTab" class="tab-content">
                    <div id="headersList" class="space-y-2">
                        <!-- Headers will be rendered here -->
                    </div>
                    <button id="addHeaderBtn" class="btn btn-secondary btn-sm mt-2">
                        + Add Header
                    </button>
                </div>
                
                <!-- Body Tab -->
                <div id="bodyTab" class="tab-content hidden">
                    <div class="flex gap-4 mb-3">
                        <label class="flex items-center gap-2">
                            <input type="radio" name="bodyType" value="${BODY_TYPES.NONE}" 
                                   ${this.activeBodyType === BODY_TYPES.NONE ? 'checked' : ''}>
                            <span class="text-sm">None</span>
                        </label>
                        <label class="flex items-center gap-2">
                            <input type="radio" name="bodyType" value="${BODY_TYPES.JSON}" 
                                   ${this.activeBodyType === BODY_TYPES.JSON ? 'checked' : ''}>
                            <span class="text-sm">JSON</span>
                        </label>
                        <label class="flex items-center gap-2">
                            <input type="radio" name="bodyType" value="${BODY_TYPES.FORM}" 
                                   ${this.activeBodyType === BODY_TYPES.FORM ? 'checked' : ''}>
                            <span class="text-sm">Form Data</span>
                        </label>
                        <label class="flex items-center gap-2">
                            <input type="radio" name="bodyType" value="${BODY_TYPES.RAW}" 
                                   ${this.activeBodyType === BODY_TYPES.RAW ? 'checked' : ''}>
                            <span class="text-sm">Raw</span>
                        </label>
                    </div>
                    
                    <div id="bodyEditor">
                        <!-- Body content will be rendered here -->
                    </div>
                </div>
                
                <!-- Auth Tab -->
                <div id="authTab" class="tab-content hidden">
                    <div class="mb-4">
                        <label class="block text-sm font-medium mb-2">Auth Type</label>
                        <select id="authType" class="select">
                            <option value="${AUTH_TYPES.NONE}">No Auth</option>
                            <option value="${AUTH_TYPES.BEARER}">Bearer Token</option>
                            <option value="${AUTH_TYPES.BASIC}">Basic Auth</option>
                            <option value="${AUTH_TYPES.API_KEY}">API Key</option>
                        </select>
                    </div>
                    
                    <div id="authFields">
                        <!-- Auth fields will be rendered here -->
                    </div>
                </div>
                
                <!-- Query Params Tab -->
                <div id="paramsTab" class="tab-content hidden">
                    <div id="paramsList" class="space-y-2">
                        <!-- Params will be rendered here -->
                    </div>
                    <button id="addParamBtn" class="btn btn-secondary btn-sm mt-2">
                        + Add Parameter
                    </button>
                </div>
            </div>
        `;
        
        this.renderHeaders();
        this.renderAuthFields();
        this.renderParams();
        this.renderBodyEditor();
    }
    
    renderHeaders() {
        const container = this.container.querySelector('#headersList');
        if (!container) return;
        
        container.innerHTML = this.currentRequest.headers.map((header, index) => `
            <div class="flex gap-2 items-center">
                <input type="checkbox" ${header.enabled ? 'checked' : ''} 
                       class="header-enabled" data-index="${index}">
                <input type="text" class="input flex-1 header-key" 
                       placeholder="Key" value="${header.key}" data-index="${index}">
                <input type="text" class="input flex-1 header-value" 
                       placeholder="Value" value="${header.value}" data-index="${index}">
                <button class="btn btn-danger btn-sm remove-header" data-index="${index}">×</button>
            </div>
        `).join('');
    }
    
    renderParams() {
        const container = this.container.querySelector('#paramsList');
        if (!container) return;
        
        const params = this.currentRequest.queryParams || [];
        
        if (params.length === 0) {
            container.innerHTML = '<p class="text-sm text-gray-500">No query parameters</p>';
            return;
        }
        
        container.innerHTML = params.map((param, index) => `
            <div class="flex gap-2 items-center">
                <input type="checkbox" ${param.enabled ? 'checked' : ''} 
                       class="param-enabled" data-index="${index}">
                <input type="text" class="input flex-1 param-key" 
                       placeholder="Key" value="${param.key}" data-index="${index}">
                <input type="text" class="input flex-1 param-value" 
                       placeholder="Value" value="${param.value}" data-index="${index}">
                <button class="btn btn-danger btn-sm remove-param" data-index="${index}">×</button>
            </div>
        `).join('');
    }
    
    renderAuthFields() {
        const container = this.container.querySelector('#authFields');
        if (!container) return;
        
        const auth = this.currentRequest.auth || { type: AUTH_TYPES.NONE };
        
        switch (auth.type) {
            case AUTH_TYPES.BEARER:
                container.innerHTML = `
                    <div>
                        <label class="block text-sm font-medium mb-2">Token</label>
                        <input type="text" id="authToken" class="input" 
                               placeholder="Enter bearer token" value="${auth.token || ''}">
                    </div>
                `;
                break;
            
            case AUTH_TYPES.BASIC:
                container.innerHTML = `
                    <div class="space-y-3">
                        <div>
                            <label class="block text-sm font-medium mb-2">Username</label>
                            <input type="text" id="authUsername" class="input" 
                                   placeholder="Enter username" value="${auth.username || ''}">
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-2">Password</label>
                            <input type="password" id="authPassword" class="input" 
                                   placeholder="Enter password" value="${auth.password || ''}">
                        </div>
                    </div>
                `;
                break;
            
            case AUTH_TYPES.API_KEY:
                container.innerHTML = `
                    <div class="space-y-3">
                        <div>
                            <label class="block text-sm font-medium mb-2">Key</label>
                            <input type="text" id="authKey" class="input" 
                                   placeholder="e.g., X-API-Key" value="${auth.key || ''}">
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-2">Value</label>
                            <input type="text" id="authValue" class="input" 
                                   placeholder="Enter API key" value="${auth.value || ''}">
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-2">Add to</label>
                            <select id="authAddTo" class="select">
                                <option value="header" ${auth.addTo === 'header' ? 'selected' : ''}>Header</option>
                                <option value="query" ${auth.addTo === 'query' ? 'selected' : ''}>Query Params</option>
                            </select>
                        </div>
                    </div>
                `;
                break;
            
            default:
                container.innerHTML = '<p class="text-sm text-gray-500">No authentication</p>';
        }
    }
    
    renderBodyEditor() {
        const container = this.container.querySelector('#bodyEditor');
        if (!container) return;
        
        if (this.activeBodyType === BODY_TYPES.FORM) {
            // Render Form Data table
            container.innerHTML = `
                <div id="formDataList" class="space-y-2">
                    <!-- Form data fields will be rendered here -->
                </div>
                <button id="addFormDataBtn" class="btn btn-secondary btn-sm mt-2">
                    + Add Field
                </button>
            `;
            this.renderFormData();
        } else if (this.activeBodyType === BODY_TYPES.NONE) {
            container.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400">No body content</p>';
        } else {
            // Render textarea for JSON/Raw
            container.innerHTML = `
                <textarea 
                    id="requestBody" 
                    class="textarea code-editor h-64"
                    placeholder="${this.activeBodyType === BODY_TYPES.JSON ? 'Enter JSON body...' : 'Enter raw body...'}"
                >${this.currentRequest.body}</textarea>
            `;
            
            // Attach textarea event listener
            const textarea = container.querySelector('#requestBody');
            if (textarea) {
                textarea.addEventListener('input', (e) => {
                    this.currentRequest.body = e.target.value;
                });
            }
        }
    }
    
    renderFormData() {
        const container = this.container.querySelector('#formDataList');
        if (!container) return;
        
        const formData = this.currentRequest.formData || [];
        
        container.innerHTML = formData.map((field, index) => `
            <div class="flex gap-2 items-center">
                <input type="checkbox" ${field.enabled ? 'checked' : ''} 
                       class="formdata-enabled" data-index="${index}">
                <input type="text" class="input flex-1 formdata-key" 
                       placeholder="Key" value="${field.key}" data-index="${index}">
                <input type="text" class="input flex-1 formdata-value" 
                       placeholder="Value" value="${field.value}" data-index="${index}">
                <button class="btn btn-danger btn-sm remove-formdata" data-index="${index}">×</button>
            </div>
        `).join('');
    }
    
    attachEventListeners() {
        // Send button
        this.container.querySelector('#sendRequestBtn').addEventListener('click', () => {
            this.sendRequest();
        });
        
        // Rate Limit Test button
        this.container.querySelector('#rateLimitTestBtn').addEventListener('click', () => {
            this.rateLimitTester.showModal();
        });
        
        // Keyboard shortcut (Ctrl/Cmd + Enter)
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                this.sendRequest();
            }
        });
        
        // Method and URL changes
        this.container.querySelector('#requestMethod').addEventListener('change', (e) => {
            this.currentRequest.method = e.target.value;
        });
        
        this.container.querySelector('#requestUrl').addEventListener('input', (e) => {
            this.currentRequest.url = e.target.value;
        });
        
        // Tab switching
        this.container.querySelectorAll('[data-tab]').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.target.dataset.tab;
                this.switchTab(tabName);
            });
        });
        
        // Headers
        this.container.querySelector('#addHeaderBtn').addEventListener('click', () => {
            this.currentRequest.headers.push({ key: '', value: '', enabled: true });
            this.renderHeaders();
        });
        
        this.container.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-header')) {
                const index = parseInt(e.target.dataset.index);
                this.currentRequest.headers.splice(index, 1);
                this.renderHeaders();
            }
        });
        
        this.container.addEventListener('input', (e) => {
            if (e.target.classList.contains('header-key')) {
                const index = parseInt(e.target.dataset.index);
                this.currentRequest.headers[index].key = e.target.value;
            } else if (e.target.classList.contains('header-value')) {
                const index = parseInt(e.target.dataset.index);
                this.currentRequest.headers[index].value = e.target.value;
            }
        });
        
        this.container.addEventListener('change', (e) => {
            if (e.target.classList.contains('header-enabled')) {
                const index = parseInt(e.target.dataset.index);
                this.currentRequest.headers[index].enabled = e.target.checked;
            }
        });
        
        // Body type
        this.container.querySelectorAll('input[name="bodyType"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.activeBodyType = e.target.value;
                this.renderBodyEditor();
            });
        });
        
        // Auth type
        const authTypeSelect = this.container.querySelector('#authType');
        if (authTypeSelect) {
            authTypeSelect.addEventListener('change', (e) => {
                this.activeAuthType = e.target.value;
                this.currentRequest.auth = { type: e.target.value };
                this.renderAuthFields();
            });
        }
        
        // Form Data
        this.container.addEventListener('click', (e) => {
            if (e.target.id === 'addFormDataBtn') {
                if (!this.currentRequest.formData) {
                    this.currentRequest.formData = [];
                }
                this.currentRequest.formData.push({ key: '', value: '', enabled: true });
                this.renderFormData();
            } else if (e.target.classList.contains('remove-formdata')) {
                const index = parseInt(e.target.dataset.index);
                this.currentRequest.formData.splice(index, 1);
                this.renderFormData();
            }
        });
        
        this.container.addEventListener('input', (e) => {
            if (e.target.classList.contains('formdata-key')) {
                const index = parseInt(e.target.dataset.index);
                if (this.currentRequest.formData && this.currentRequest.formData[index]) {
                    this.currentRequest.formData[index].key = e.target.value;
                }
            } else if (e.target.classList.contains('formdata-value')) {
                const index = parseInt(e.target.dataset.index);
                if (this.currentRequest.formData && this.currentRequest.formData[index]) {
                    this.currentRequest.formData[index].value = e.target.value;
                }
            }
        });
        
        this.container.addEventListener('change', (e) => {
            if (e.target.classList.contains('formdata-enabled')) {
                const index = parseInt(e.target.dataset.index);
                if (this.currentRequest.formData && this.currentRequest.formData[index]) {
                    this.currentRequest.formData[index].enabled = e.target.checked;
                }
            }
        });
        
        // Query params
        this.container.querySelector('#addParamBtn').addEventListener('click', () => {
            if (!this.currentRequest.queryParams) {
                this.currentRequest.queryParams = [];
            }
            this.currentRequest.queryParams.push({ key: '', value: '', enabled: true });
            this.renderParams();
        });
        
        this.container.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-param')) {
                const index = parseInt(e.target.dataset.index);
                this.currentRequest.queryParams.splice(index, 1);
                this.renderParams();
            }
        });
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
        const tabs = {
            headers: this.container.querySelector('#headersTab'),
            body: this.container.querySelector('#bodyTab'),
            auth: this.container.querySelector('#authTab'),
            params: this.container.querySelector('#paramsTab')
        };
        
        Object.keys(tabs).forEach(key => {
            if (key === tabName) {
                tabs[key].classList.remove('hidden');
            } else {
                tabs[key].classList.add('hidden');
            }
        });
    }
    
    async sendRequest() {
        const btn = this.container.querySelector('#sendRequestBtn');
        const btnText = this.container.querySelector('#sendBtnText');
        const btnSpinner = this.container.querySelector('#sendBtnSpinner');
        
        // Validate URL
        if (!this.currentRequest.url) {
            alert('Please enter a URL');
            return;
        }
        
        // Show loading state
        btn.disabled = true;
        btnText.classList.add('hidden');
        btnSpinner.classList.remove('hidden');
        
        try {
            // Prepare request data
            const requestData = this.prepareRequestData();
            
            // Send request
            await ApiService.sendRequest(requestData);
        } catch (error) {
            console.error('Request failed:', error);
        } finally {
            // Reset button state
            btn.disabled = false;
            btnText.classList.remove('hidden');
            btnSpinner.classList.add('hidden');
        }
    }
    
    prepareRequestData() {
        // Interpolate environment variables in URL
        let url = interpolateVariables(this.currentRequest.url, this.currentEnvironment);
        
        // Add query parameters
        if (this.currentRequest.queryParams && this.currentRequest.queryParams.length > 0) {
            const enabledParams = this.currentRequest.queryParams.filter(p => p.enabled && p.key);
            if (enabledParams.length > 0) {
                const separator = url.includes('?') ? '&' : '?';
                const queryString = enabledParams
                    .map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
                    .join('&');
                url += separator + queryString;
            }
        }
        
        // Prepare headers
        const headers = {};
        this.currentRequest.headers
            .filter(h => h.enabled && h.key)
            .forEach(h => {
                headers[h.key] = interpolateVariables(h.value, this.currentEnvironment);
            });
        
        // Prepare body
        let body = null;
        if (this.activeBodyType === BODY_TYPES.FORM && this.currentRequest.formData) {
            // Convert form data to URL encoded
            const enabledFields = this.currentRequest.formData.filter(f => f.enabled && f.key);
            if (enabledFields.length > 0) {
                body = enabledFields
                    .map(f => {
                        const key = interpolateVariables(f.key, this.currentEnvironment);
                        const value = interpolateVariables(f.value, this.currentEnvironment);
                        return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
                    })
                    .join('&');
                
                // Set content type for form data
                if (!headers['Content-Type']) {
                    headers['Content-Type'] = 'application/x-www-form-urlencoded';
                }
            }
        } else if (this.activeBodyType !== BODY_TYPES.NONE && this.currentRequest.body) {
            body = interpolateVariables(this.currentRequest.body, this.currentEnvironment);
            
            // Set content type for JSON
            if (this.activeBodyType === BODY_TYPES.JSON && !headers['Content-Type']) {
                headers['Content-Type'] = 'application/json';
            }
        }
        
        // Prepare auth
        let auth = null;
        if (this.currentRequest.auth && this.currentRequest.auth.type !== AUTH_TYPES.NONE) {
            auth = { ...this.currentRequest.auth };
            
            // Interpolate auth values
            if (auth.token) auth.token = interpolateVariables(auth.token, this.currentEnvironment);
            if (auth.username) auth.username = interpolateVariables(auth.username, this.currentEnvironment);
            if (auth.password) auth.password = interpolateVariables(auth.password, this.currentEnvironment);
            if (auth.key) auth.key = interpolateVariables(auth.key, this.currentEnvironment);
            if (auth.value) auth.value = interpolateVariables(auth.value, this.currentEnvironment);
        }
        
        return {
            method: this.currentRequest.method,
            url,
            headers,
            body,
            auth
        };
    }
    
    subscribeToEvents() {
        EventBus.on(EVENTS.REQUEST_LOADED, (request) => {
            this.currentRequest = request;
            this.activeBodyType = request.bodyType || BODY_TYPES.JSON;
            this.activeAuthType = request.auth?.type || AUTH_TYPES.NONE;
            this.render();
            this.attachEventListeners();
        });
        
        EventBus.on(EVENTS.ENVIRONMENT_CHANGED, (environment) => {
            this.currentEnvironment = environment;
        });
    }
    
    getCurrentRequest() {
        // Update auth fields before returning
        const authType = this.container.querySelector('#authType')?.value || AUTH_TYPES.NONE;
        
        if (authType === AUTH_TYPES.BEARER) {
            this.currentRequest.auth = {
                type: authType,
                token: this.container.querySelector('#authToken')?.value || ''
            };
        } else if (authType === AUTH_TYPES.BASIC) {
            this.currentRequest.auth = {
                type: authType,
                username: this.container.querySelector('#authUsername')?.value || '',
                password: this.container.querySelector('#authPassword')?.value || ''
            };
        } else if (authType === AUTH_TYPES.API_KEY) {
            this.currentRequest.auth = {
                type: authType,
                key: this.container.querySelector('#authKey')?.value || '',
                value: this.container.querySelector('#authValue')?.value || '',
                addTo: this.container.querySelector('#authAddTo')?.value || 'header'
            };
        } else {
            this.currentRequest.auth = { type: AUTH_TYPES.NONE };
        }
        
        this.currentRequest.bodyType = this.activeBodyType;
        
        return this.currentRequest;
    }
}
