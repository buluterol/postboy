/**
 * Storage Service
 * 
 * Handles communication with backend API for data persistence
 */

import { API_ENDPOINTS } from '../utils/constants.js';

class StorageService {
    /**
     * Make HTTP request to backend
     * @param {string} url API endpoint
     * @param {Object} options Request options
     * @returns {Promise<Object>} Response data
     */
    async request(url, options = {}) {
        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'Request failed');
            }
            
            return data;
        } catch (error) {
            console.error('Storage request failed:', error);
            throw error;
        }
    }
    
    // Collections
    
    async getCollections() {
        const response = await this.request(API_ENDPOINTS.COLLECTIONS);
        return response.data || [];
    }
    
    async createCollection(collection) {
        const response = await this.request(API_ENDPOINTS.COLLECTIONS, {
            method: 'POST',
            body: JSON.stringify(collection)
        });
        return response.data;
    }
    
    async updateCollection(id, collection) {
        const response = await this.request(`${API_ENDPOINTS.COLLECTIONS}?id=${id}`, {
            method: 'PUT',
            body: JSON.stringify(collection)
        });
        return response.data;
    }
    
    async deleteCollection(id) {
        await this.request(`${API_ENDPOINTS.COLLECTIONS}?id=${id}`, {
            method: 'DELETE'
        });
    }
    
    // Environments
    
    async getEnvironments() {
        const response = await this.request(API_ENDPOINTS.ENVIRONMENTS);
        return response.data || [];
    }
    
    async createEnvironment(environment) {
        const response = await this.request(API_ENDPOINTS.ENVIRONMENTS, {
            method: 'POST',
            body: JSON.stringify(environment)
        });
        return response.data;
    }
    
    async updateEnvironment(id, environment) {
        const response = await this.request(`${API_ENDPOINTS.ENVIRONMENTS}?id=${id}`, {
            method: 'PUT',
            body: JSON.stringify(environment)
        });
        return response.data;
    }
    
    async deleteEnvironment(id) {
        await this.request(`${API_ENDPOINTS.ENVIRONMENTS}?id=${id}`, {
            method: 'DELETE'
        });
    }
    
    // History
    
    async getHistory() {
        const response = await this.request(API_ENDPOINTS.HISTORY);
        return response.data || [];
    }
    
    async addToHistory(entry) {
        const response = await this.request(API_ENDPOINTS.HISTORY, {
            method: 'POST',
            body: JSON.stringify(entry)
        });
        return response.data;
    }
    
    async deleteHistoryItem(id) {
        await this.request(`${API_ENDPOINTS.HISTORY}?id=${id}`, {
            method: 'DELETE'
        });
    }
    
    async clearHistory() {
        await this.request(API_ENDPOINTS.HISTORY, {
            method: 'DELETE'
        });
    }
}

export default new StorageService();
