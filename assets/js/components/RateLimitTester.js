/**
 * Rate Limit Tester Component
 * 
 * Tests API rate limits by sending repeated requests
 */

import { createElement } from '../utils/helpers.js';
import ApiService from '../services/ApiService.js';

export class RateLimitTester {
    constructor(requestBuilder) {
        this.requestBuilder = requestBuilder;
        this.modalElement = null;
        this.isRunning = false;
        this.intervalId = null;
        this.stats = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            startTime: null,
            responseTimes: []
        };
    }
    
    showModal() {
        this.modalElement = createElement(`
            <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" id="rateLimitModal">
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl">
                    <!-- Header -->
                    <div class="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                        <div>
                            <h2 class="text-xl font-semibold">Rate Limit Tester</h2>
                            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                Test how many requests your API can handle
                            </p>
                        </div>
                        <button id="closeRateLimitModal" class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                        </button>
                    </div>
                    
                    <!-- Body -->
                    <div class="p-6">
                        <!-- Configuration -->
                        <div class="mb-6">
                            <label class="block text-sm font-medium mb-2">Request Interval (milliseconds)</label>
                            <div class="flex gap-3 items-center">
                                <input 
                                    type="number" 
                                    id="requestInterval" 
                                    class="input flex-1" 
                                    value="1000"
                                    min="10"
                                    step="10"
                                    placeholder="1000">
                                <span class="text-sm text-gray-500">ms between requests</span>
                            </div>
                            <p class="text-xs text-gray-500 mt-1">
                                Lower values = more requests per second (be careful!)
                            </p>
                        </div>
                        
                        <!-- Control Buttons -->
                        <div class="mb-6 flex gap-3">
                            <button id="startTestBtn" class="btn btn-primary flex-1">
                                <svg class="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path>
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                </svg>
                                Start Test
                            </button>
                            <button id="resetStatsBtn" class="btn btn-secondary">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                                </svg>
                            </button>
                        </div>
                        
                        <!-- Statistics -->
                        <div class="panel">
                            <div class="panel-header">Live Statistics</div>
                            <div class="panel-body">
                                <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <!-- Total Requests -->
                                    <div class="text-center">
                                        <div class="text-3xl font-bold text-primary-600 dark:text-primary-400" id="totalRequests">
                                            0
                                        </div>
                                        <div class="text-xs text-gray-500 mt-1">Total Requests</div>
                                    </div>
                                    
                                    <!-- Successful -->
                                    <div class="text-center">
                                        <div class="text-3xl font-bold text-green-600 dark:text-green-400" id="successfulRequests">
                                            0
                                        </div>
                                        <div class="text-xs text-gray-500 mt-1">Successful</div>
                                    </div>
                                    
                                    <!-- Failed -->
                                    <div class="text-center">
                                        <div class="text-3xl font-bold text-red-600 dark:text-red-400" id="failedRequests">
                                            0
                                        </div>
                                        <div class="text-xs text-gray-500 mt-1">Failed</div>
                                    </div>
                                    
                                    <!-- Requests per Second -->
                                    <div class="text-center">
                                        <div class="text-3xl font-bold text-blue-600 dark:text-blue-400" id="requestsPerSecond">
                                            0
                                        </div>
                                        <div class="text-xs text-gray-500 mt-1">Req/s</div>
                                    </div>
                                </div>
                                
                                <div class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 grid grid-cols-2 gap-4">
                                    <!-- Average Response Time -->
                                    <div class="text-center">
                                        <div class="text-lg font-semibold text-gray-700 dark:text-gray-300" id="avgResponseTime">
                                            0ms
                                        </div>
                                        <div class="text-xs text-gray-500">Avg Response Time</div>
                                    </div>
                                    
                                    <!-- Elapsed Time -->
                                    <div class="text-center">
                                        <div class="text-lg font-semibold text-gray-700 dark:text-gray-300" id="elapsedTime">
                                            0s
                                        </div>
                                        <div class="text-xs text-gray-500">Elapsed Time</div>
                                    </div>
                                </div>
                                
                                <!-- Success Rate Bar -->
                                <div class="mt-4">
                                    <div class="flex justify-between text-xs text-gray-500 mb-1">
                                        <span>Success Rate</span>
                                        <span id="successRate">0%</span>
                                    </div>
                                    <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                        <div id="successRateBar" class="bg-green-500 h-2 rounded-full transition-all" style="width: 0%"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Warning -->
                        <div class="mt-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                            <div class="flex gap-2">
                                <svg class="w-5 h-5 text-yellow-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                                </svg>
                                <div class="text-xs text-yellow-800 dark:text-yellow-200">
                                    <strong>Warning:</strong> High-frequency requests may trigger rate limiting or get your IP blocked. 
                                    Use responsibly and only on APIs you own or have permission to test.
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `);
        
        document.getElementById('modals').appendChild(this.modalElement);
        this.attachEventListeners();
    }
    
    attachEventListeners() {
        // Close modal
        this.modalElement.querySelector('#closeRateLimitModal').addEventListener('click', () => {
            this.stop();
            this.closeModal();
        });
        
        // Close on background click
        this.modalElement.addEventListener('click', (e) => {
            if (e.target.id === 'rateLimitModal') {
                this.stop();
                this.closeModal();
            }
        });
        
        // Start/Stop button
        const startBtn = this.modalElement.querySelector('#startTestBtn');
        startBtn.addEventListener('click', () => {
            if (this.isRunning) {
                this.stop();
            } else {
                this.start();
            }
        });
        
        // Reset stats button
        this.modalElement.querySelector('#resetStatsBtn').addEventListener('click', () => {
            this.resetStats();
        });
    }
    
    start() {
        const intervalInput = this.modalElement.querySelector('#requestInterval');
        const interval = parseInt(intervalInput.value) || 1000;
        
        if (interval < 10) {
            alert('Interval must be at least 10ms');
            return;
        }
        
        // Update button
        const startBtn = this.modalElement.querySelector('#startTestBtn');
        startBtn.innerHTML = `
            <svg class="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"></path>
            </svg>
            Stop Test
        `;
        startBtn.classList.remove('btn-primary');
        startBtn.classList.add('btn-danger');
        
        // Disable interval input
        intervalInput.disabled = true;
        
        // Start stats
        this.isRunning = true;
        this.stats.startTime = Date.now();
        
        // Start sending requests
        this.sendRequest(); // Send first request immediately
        this.intervalId = setInterval(() => {
            this.sendRequest();
        }, interval);
        
        // Update elapsed time display
        this.elapsedTimeInterval = setInterval(() => {
            this.updateElapsedTime();
        }, 100);
    }
    
    stop() {
        if (!this.isRunning) return;
        
        this.isRunning = false;
        
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        
        if (this.elapsedTimeInterval) {
            clearInterval(this.elapsedTimeInterval);
            this.elapsedTimeInterval = null;
        }
        
        // Update button
        const startBtn = this.modalElement?.querySelector('#startTestBtn');
        if (startBtn) {
            startBtn.innerHTML = `
                <svg class="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                Start Test
            `;
            startBtn.classList.remove('btn-danger');
            startBtn.classList.add('btn-primary');
        }
        
        // Enable interval input
        const intervalInput = this.modalElement?.querySelector('#requestInterval');
        if (intervalInput) {
            intervalInput.disabled = false;
        }
    }
    
    async sendRequest() {
        const startTime = Date.now();
        
        try {
            // Get request data from request builder
            const requestData = this.requestBuilder.prepareRequestData();
            
            // Send request (don't wait for response to update UI)
            ApiService.sendRequest(requestData)
                .then((response) => {
                    const responseTime = Date.now() - startTime;
                    this.stats.responseTimes.push(responseTime);
                    this.stats.successfulRequests++;
                    this.updateStats();
                })
                .catch((error) => {
                    this.stats.failedRequests++;
                    this.updateStats();
                });
            
            this.stats.totalRequests++;
            this.updateStats();
            
        } catch (error) {
            console.error('Failed to send request:', error);
            this.stats.failedRequests++;
            this.updateStats();
        }
    }
    
    updateStats() {
        if (!this.modalElement) return;
        
        // Update counters
        this.modalElement.querySelector('#totalRequests').textContent = this.stats.totalRequests;
        this.modalElement.querySelector('#successfulRequests').textContent = this.stats.successfulRequests;
        this.modalElement.querySelector('#failedRequests').textContent = this.stats.failedRequests;
        
        // Calculate requests per second
        const elapsedSeconds = (Date.now() - this.stats.startTime) / 1000;
        const reqPerSecond = elapsedSeconds > 0 ? (this.stats.totalRequests / elapsedSeconds).toFixed(2) : 0;
        this.modalElement.querySelector('#requestsPerSecond').textContent = reqPerSecond;
        
        // Calculate average response time
        if (this.stats.responseTimes.length > 0) {
            const avgTime = this.stats.responseTimes.reduce((a, b) => a + b, 0) / this.stats.responseTimes.length;
            this.modalElement.querySelector('#avgResponseTime').textContent = Math.round(avgTime) + 'ms';
        }
        
        // Calculate success rate
        const successRate = this.stats.totalRequests > 0 
            ? ((this.stats.successfulRequests / this.stats.totalRequests) * 100).toFixed(1)
            : 0;
        this.modalElement.querySelector('#successRate').textContent = successRate + '%';
        this.modalElement.querySelector('#successRateBar').style.width = successRate + '%';
    }
    
    updateElapsedTime() {
        if (!this.modalElement || !this.stats.startTime) return;
        
        const elapsed = (Date.now() - this.stats.startTime) / 1000;
        this.modalElement.querySelector('#elapsedTime').textContent = elapsed.toFixed(1) + 's';
    }
    
    resetStats() {
        this.stop();
        
        this.stats = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            startTime: null,
            responseTimes: []
        };
        
        if (this.modalElement) {
            this.modalElement.querySelector('#totalRequests').textContent = '0';
            this.modalElement.querySelector('#successfulRequests').textContent = '0';
            this.modalElement.querySelector('#failedRequests').textContent = '0';
            this.modalElement.querySelector('#requestsPerSecond').textContent = '0';
            this.modalElement.querySelector('#avgResponseTime').textContent = '0ms';
            this.modalElement.querySelector('#elapsedTime').textContent = '0s';
            this.modalElement.querySelector('#successRate').textContent = '0%';
            this.modalElement.querySelector('#successRateBar').style.width = '0%';
        }
    }
    
    closeModal() {
        this.stop();
        if (this.modalElement) {
            this.modalElement.remove();
            this.modalElement = null;
        }
    }
}
