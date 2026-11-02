/**
 * Globals panel: modal to edit global variables (shared by every request).
 */

import StorageService from '../services/StorageService.js';
import { VariableStore } from '../services/VariableService.js';
import { createElement, showToast } from '../utils/helpers.js';
import { variableTableHtml, attachVariableTable, readVariableTable } from './VariableTable.js';

export class GlobalsPanel {
    constructor() {
        this.load();
    }

    async load() {
        try {
            VariableStore.setGlobals(await StorageService.getGlobals());
        } catch (error) {
            console.error('Failed to load globals:', error);
        }
    }

    showModal() {
        const modal = createElement(`
            <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" id="globalsModal">
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
                    <div class="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                        <h2 class="text-xl font-semibold">Global Variables</h2>
                        <button id="closeGlobals" class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300" aria-label="Close">✕</button>
                    </div>
                    <div class="flex-1 overflow-y-auto p-6">
                        <p class="text-xs text-gray-500 mb-3">Lowest priority: environment, collection and folder variables override a global with the same name.</p>
                        ${variableTableHtml('globalsTable', VariableStore.globals)}
                    </div>
                    <div class="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
                        <button id="cancelGlobals" class="btn btn-secondary">Cancel</button>
                        <button id="saveGlobals" class="btn btn-primary">Save</button>
                    </div>
                </div>
            </div>
        `);
        document.getElementById('modals').appendChild(modal);
        attachVariableTable(modal, 'globalsTable');

        const close = () => modal.remove();
        modal.querySelector('#closeGlobals').addEventListener('click', close);
        modal.querySelector('#cancelGlobals').addEventListener('click', close);
        modal.addEventListener('click', e => { if (e.target === modal) close(); });
        modal.querySelector('#saveGlobals').addEventListener('click', async () => {
            const variables = readVariableTable(modal, 'globalsTable');
            try {
                const saved = await StorageService.saveGlobals(variables);
                VariableStore.setGlobals(saved || variables);
                showToast('Globals saved', 'success');
                close();
            } catch (error) {
                showToast('Failed to save globals', 'error');
            }
        });
    }
}
