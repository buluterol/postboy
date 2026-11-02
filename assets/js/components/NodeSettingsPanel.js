/**
 * Collection / folder settings: auth, variables and scripts.
 * Requests inherit these through the folder chain.
 */

import { EventBus } from '../services/EventBus.js';
import { EVENTS, AUTH_TYPES } from '../utils/constants.js';
import { createElement, escapeHtml } from '../utils/helpers.js';
import { findNode } from '../utils/collectionTree.js';
import { variableTableHtml, attachVariableTable, readVariableTable } from './VariableTable.js';

export class NodeSettingsPanel {
    /** @param {import('./CollectionManager.js').CollectionManager} collectionManager */
    constructor(collectionManager) {
        this.collectionManager = collectionManager;
        EventBus.on(EVENTS.NODE_SETTINGS, ({ collectionId, nodeId }) => this.showModal(collectionId, nodeId));
    }

    authFields(auth) {
        const a = auth || {};
        const field = (id, label, value, ph = '') => `
            <div><label class="block text-sm font-medium mb-1">${label}</label>
            <input type="text" id="${id}" class="input w-full font-mono" placeholder="${ph}" value="${escapeHtml(value || '')}"></div>`;
        switch (a.type) {
            case AUTH_TYPES.BEARER:
                return field('nsToken', 'Token', a.token, '{{token}}');
            case AUTH_TYPES.BASIC:
                return field('nsUser', 'Username', a.username) + field('nsPass', 'Password', a.password);
            case AUTH_TYPES.API_KEY:
                return field('nsKey', 'Key', a.key, 'X-API-Key') + field('nsValue', 'Value', a.value, '{{apiKey}}') + `
                    <div><label class="block text-sm font-medium mb-1">Add to</label>
                    <select id="nsAddTo" class="select">
                        <option value="header" ${a.addTo !== 'query' ? 'selected' : ''}>Header</option>
                        <option value="query" ${a.addTo === 'query' ? 'selected' : ''}>Query Params</option>
                    </select></div>`;
            case AUTH_TYPES.INHERIT:
                return '<p class="text-sm text-gray-500">Uses the parent\'s auth.</p>';
            default:
                return '<p class="text-sm text-gray-500">No authentication.</p>';
        }
    }

    showModal(collectionId, nodeId) {
        const collection = this.collectionManager.collections.find(c => c.id === collectionId);
        const hit = collection && findNode(collection, nodeId || collectionId);
        if (!hit) return;
        const node = hit.node;
        const isCollection = node === collection;
        let auth = { ...(node.auth || { type: isCollection ? AUTH_TYPES.NONE : AUTH_TYPES.INHERIT }) };

        const modal = createElement(`
            <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" id="nodeSettingsModal">
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
                    <div class="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                        <h2 class="text-xl font-semibold">${isCollection ? 'Collection' : 'Folder'} settings: ${escapeHtml(node.name)}</h2>
                        <button id="nsClose" class="text-gray-500 hover:text-gray-700" aria-label="Close">✕</button>
                    </div>
                    <div class="flex-1 overflow-y-auto p-6 space-y-6">
                        <section>
                            <h3 class="font-semibold mb-2">Authorization</h3>
                            <select id="nsAuthType" class="select mb-3">
                                ${isCollection ? '' : `<option value="${AUTH_TYPES.INHERIT}">Inherit from parent</option>`}
                                <option value="${AUTH_TYPES.NONE}">No Auth</option>
                                <option value="${AUTH_TYPES.BEARER}">Bearer Token</option>
                                <option value="${AUTH_TYPES.BASIC}">Basic Auth</option>
                                <option value="${AUTH_TYPES.API_KEY}">API Key</option>
                            </select>
                            <div id="nsAuthFields" class="space-y-3"></div>
                        </section>
                        <section>
                            <h3 class="font-semibold mb-2">Variables</h3>
                            ${variableTableHtml('nsVariables', node.variables)}
                        </section>
                        <section>
                            <h3 class="font-semibold mb-2">Scripts</h3>
                            <label class="block text-sm font-medium mb-1">Pre-request</label>
                            <textarea id="nsPre" class="input w-full font-mono text-sm mb-3" rows="5" spellcheck="false">${escapeHtml(node.scripts?.preRequest || '')}</textarea>
                            <label class="block text-sm font-medium mb-1">Tests</label>
                            <textarea id="nsTest" class="input w-full font-mono text-sm" rows="5" spellcheck="false">${escapeHtml(node.scripts?.test || '')}</textarea>
                        </section>
                    </div>
                    <div class="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
                        <button id="nsCancel" class="btn btn-secondary">Cancel</button>
                        <button id="nsSave" class="btn btn-primary">Save</button>
                    </div>
                </div>
            </div>
        `);
        document.getElementById('modals').appendChild(modal);

        const typeSelect = modal.querySelector('#nsAuthType');
        const fields = modal.querySelector('#nsAuthFields');
        const readAuth = () => {
            const type = typeSelect.value;
            const v = id => modal.querySelector('#' + id)?.value ?? '';
            if (type === AUTH_TYPES.BEARER) return { type, token: v('nsToken') };
            if (type === AUTH_TYPES.BASIC) return { type, username: v('nsUser'), password: v('nsPass') };
            if (type === AUTH_TYPES.API_KEY) return { type, key: v('nsKey'), value: v('nsValue'), addTo: v('nsAddTo') || 'header' };
            return { type };
        };
        typeSelect.value = auth.type;
        if (typeSelect.value !== auth.type) typeSelect.value = AUTH_TYPES.NONE;
        fields.innerHTML = this.authFields(auth);
        typeSelect.addEventListener('change', () => {
            auth = { type: typeSelect.value };
            fields.innerHTML = this.authFields(auth);
        });
        attachVariableTable(modal, 'nsVariables');

        const close = () => modal.remove();
        modal.querySelector('#nsClose').addEventListener('click', close);
        modal.querySelector('#nsCancel').addEventListener('click', close);
        modal.addEventListener('click', e => { if (e.target === modal) close(); });
        modal.querySelector('#nsSave').addEventListener('click', async () => {
            node.auth = readAuth();
            node.variables = readVariableTable(modal, 'nsVariables');
            node.scripts = {
                preRequest: modal.querySelector('#nsPre').value,
                test: modal.querySelector('#nsTest').value
            };
            close();
            await this.collectionManager.persist(collection, 'Settings saved');
        });
    }
}
