/**
 * API Service
 * 
 * Handles HTTP requests through the proxy endpoint
 */

import { API_ENDPOINTS, EVENTS } from '../utils/constants.js';
import { EventBus } from './EventBus.js';
import StorageService from './StorageService.js';

class ApiService {
    /**
     * Send HTTP request through proxy
     * @param {Object} requestData Request configuration
     * @returns {Promise<Object>} Response data
     */
    async sendRequest(requestData) {
        const { method, url, headers, body, auth } = requestData;
        
        // Emit request sent event
        EventBus.emit(EVENTS.REQUEST_SENT, requestData);
        
        try {
            const response = await fetch(API_ENDPOINTS.PROXY, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    method,
                    url,
                    headers: headers || {},
                    body: body || null,
                    auth: auth || null
                })
            });
            
            const data = await response.json();
            
            if (!response.ok || data.error) {
                throw new Error(data.message || 'Request failed');
            }
            
            // Add to history
            this.addToHistory({
                method,
                url,
                status: data.status,
                responseTime: data.responseTime
            });
            
            // Emit response received event
            EventBus.emit(EVENTS.RESPONSE_RECEIVED, data);
            
            return data;
        } catch (error) {
            console.error('API request failed:', error);
            
            // Emit error response
            const errorResponse = {
                success: false,
                error: true,
                message: error.message,
                status: 0,
                statusText: 'Error',
                body: error.message,
                responseTime: 0
            };
            
            EventBus.emit(EVENTS.RESPONSE_RECEIVED, errorResponse);
            
            throw error;
        }
    }
    
    /**
     * Add request to history
     * @param {Object} entry History entry
     */
    async addToHistory(entry) {
        try {
            await StorageService.addToHistory(entry);
            EventBus.emit(EVENTS.HISTORY_UPDATED);
        } catch (error) {
            console.error('Failed to add to history:', error);
        }
    }
}

export default new ApiService();
