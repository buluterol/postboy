/**
 * Import / Export Panel
 *
 * Import: OpenAPI 3 (JSON), Postman Collection v2.1, Postman environment.
 * Export: collections and environments as Postman files (secrets are blanked
 * unless "include secret values" is ticked).
 */

import { EVENTS } from '../utils/constants.js';
import { EventBus } from '../services/EventBus.js';
import StorageService from '../services/StorageService.js';
import { createElement, escapeHtml, showToast } from '../utils/helpers.js';
import { importOpenApi } from '../utils/openapi.js';
import {
    exportPostmanCollection, exportPostmanEnvironment,
    importPostmanCollection, importPostmanEnvironment,
    isOpenApi, isPostmanCollection, isPostmanEnvironment
} from '../utils/postman.js';

const safeFileName = name => String(name || 'export').replace(/[^\w.-]+/g, '_');

export function downloadJson(data, fileName) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export class ImportExportPanel {
    constructor() {
        this.modal = null;
        EventBus.on(EVENTS.COLLECTION_EXPORT, (collectionId) => this.exportCollectionById(collectionId));
    }

    async showModal() {
        this.close();
        const [collections, environments] = await Promise.all([
            StorageService.getCollections().catch(() => []),
            StorageService.getEnvironments().catch(() => [])
        ]);
        this.collections = collections;
        this.environments = environments;

        const row = (kind, item) => `
            <div class="flex items-center justify-between py-1">
                <span class="text-sm truncate">${escapeHtml(item.name)}</span>
                <button class="btn btn-secondary btn-sm export-btn" data-kind="${kind}" data-id="${item.id}">Download</button>
            </div>`;

        this.modal = createElement(`
            <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" id="importExportModal">
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
                    <div class="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                        <h2 class="text-xl font-semibold">Import / Export</h2>
                        <button id="closeImportExport" class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300" title="Close">&times;</button>
                    </div>
                    <div class="p-6 overflow-y-auto space-y-6">
                        <section>
                            <h3 class="font-medium mb-2">Import</h3>
                            <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">
                                OpenAPI 3 (JSON), Postman Collection v2.1 or a Postman environment. The type is detected automatically.
                            </p>
                            <input type="file" id="importFile" accept=".json,application/json" class="text-sm mb-2">
                            <textarea id="importText" rows="6" class="input w-full font-mono text-xs" placeholder="...or paste JSON here"></textarea>
                            <div class="mt-2 flex items-center gap-3">
                                <input id="importBaseUrl" class="input flex-1 text-sm" placeholder="Base URL override for OpenAPI (optional, e.g. {{baseUrl}})">
                                <button id="importBtn" class="btn btn-primary btn-sm">Import</button>
                            </div>
                        </section>
                        <section>
                            <h3 class="font-medium mb-2">Export (Postman v2.1)</h3>
                            <label class="flex items-center gap-2 text-xs mb-2">
                                <input type="checkbox" id="includeSecrets"> Include secret variable values
                            </label>
                            <h4 class="text-xs uppercase text-gray-500 mt-2">Collections</h4>
                            ${collections.map(c => row('collection', c)).join('') || '<p class="text-xs text-gray-500">None</p>'}
                            <h4 class="text-xs uppercase text-gray-500 mt-3">Environments</h4>
                            ${environments.map(e => row('environment', e)).join('') || '<p class="text-xs text-gray-500">None</p>'}
                        </section>
                    </div>
                </div>
            </div>`);
        document.getElementById('modals').appendChild(this.modal);

        this.modal.addEventListener('click', e => { if (e.target === this.modal) this.close(); });
        this.modal.querySelector('#closeImportExport').addEventListener('click', () => this.close());
        this.modal.querySelector('#importFile').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) this.modal.querySelector('#importText').value = await file.text();
        });
        this.modal.querySelector('#importBtn').addEventListener('click', () => this.runImport());
        this.modal.querySelectorAll('.export-btn').forEach(btn => btn.addEventListener('click', () => {
            const includeSecrets = this.modal.querySelector('#includeSecrets').checked;
            if (btn.dataset.kind === 'collection') this.exportCollectionById(btn.dataset.id, includeSecrets);
            else this.exportEnvironmentById(btn.dataset.id, includeSecrets);
        }));
    }

    close() {
        if (this.modal) this.modal.remove();
        this.modal = null;
    }

    async runImport() {
        const text = this.modal.querySelector('#importText').value.trim();
        if (!text) return showToast('Choose a file or paste JSON first', 'warning');

        let doc;
        try {
            doc = JSON.parse(text);
        } catch (e) {
            return showToast('Invalid JSON: ' + e.message, 'error');
        }

        try {
            if (isPostmanCollection(doc)) {
                const created = await StorageService.createCollection(importPostmanCollection(doc));
                EventBus.emit(EVENTS.COLLECTION_IMPORTED, created.id);
                showToast(`Imported collection "${created.name}"`, 'success');
            } else if (isPostmanEnvironment(doc)) {
                await StorageService.createEnvironment(importPostmanEnvironment(doc));
                EventBus.emit(EVENTS.ENVIRONMENT_IMPORTED);
                showToast('Imported environment', 'success');
            } else if (isOpenApi(doc)) {
                const baseUrl = this.modal.querySelector('#importBaseUrl').value.trim();
                const options = baseUrl ? { baseUrl } : {};
                const created = await StorageService.createCollection(importOpenApi(doc, options));
                EventBus.emit(EVENTS.COLLECTION_IMPORTED, created.id);
                showToast(`Imported "${created.name}" from OpenAPI`, 'success');
            } else {
                return showToast('Unrecognized format (expected OpenAPI 3, Postman collection or environment)', 'error');
            }
            this.close();
        } catch (error) {
            console.error('Import failed:', error);
            showToast('Import failed: ' + error.message, 'error');
        }
    }

    async exportCollectionById(id, includeSecrets = false) {
        const collections = this.collections || await StorageService.getCollections();
        const collection = collections.find(c => c.id === id)
            || (await StorageService.getCollections()).find(c => c.id === id);
        if (!collection) return;
        downloadJson(exportPostmanCollection(collection, { includeSecrets }),
            `${safeFileName(collection.name)}.postman_collection.json`);
    }

    async exportEnvironmentById(id, includeSecrets = false) {
        const environment = (this.environments || await StorageService.getEnvironments()).find(e => e.id === id);
        if (!environment) return;
        downloadJson(exportPostmanEnvironment(environment, { includeSecrets }),
            `${safeFileName(environment.name)}.postman_environment.json`);
    }
}
