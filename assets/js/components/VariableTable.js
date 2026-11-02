/**
 * Variable table
 *
 * Editable key / value / secret rows shared by the environment editor,
 * the collection/folder settings and the globals dialog.
 */

import { escapeHtml, createElement } from '../utils/helpers.js';

const TRASH = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>';

export function variableRowHtml(variable = {}) {
    const secret = !!variable.secret;
    return `
        <tr class="variable-row border-b border-gray-200 dark:border-gray-700">
            <td class="px-2 py-2">
                <input type="text" class="input input-sm w-full font-mono variable-key"
                       value="${escapeHtml(variable.key || '')}" placeholder="key" autocomplete="off">
            </td>
            <td class="px-2 py-2">
                <input type="${secret ? 'password' : 'text'}" class="input input-sm w-full font-mono variable-value"
                       value="${escapeHtml(variable.value ?? '')}" placeholder="value" autocomplete="off">
            </td>
            <td class="px-2 py-2 text-center">
                <label class="inline-flex items-center gap-1 text-xs text-gray-500" title="Secret values are masked in the UI, console and history">
                    <input type="checkbox" class="variable-secret" ${secret ? 'checked' : ''}> secret
                </label>
            </td>
            <td class="px-2 py-2 text-center">
                <button type="button" class="text-red-500 hover:text-red-700 delete-variable" title="Delete">${TRASH}</button>
            </td>
        </tr>`;
}

/** Table markup; give it an id so callers can find the tbody. */
export function variableTableHtml(id, variables = []) {
    const rows = (variables.length ? variables : [{}]).map(variableRowHtml).join('');
    return `
        <div class="flex justify-end mb-2">
            <button type="button" class="btn btn-secondary btn-sm" data-add-variable="${id}">+ Add Variable</button>
        </div>
        <div class="bg-gray-50 dark:bg-gray-900 rounded-lg overflow-hidden">
            <table class="w-full">
                <thead class="bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                    <tr class="text-xs text-gray-600 dark:text-gray-400">
                        <th class="px-2 py-2 text-left">Key</th>
                        <th class="px-2 py-2 text-left">Value</th>
                        <th class="px-2 py-2 w-20"></th>
                        <th class="px-2 py-2 w-10"></th>
                    </tr>
                </thead>
                <tbody id="${id}">${rows}</tbody>
            </table>
        </div>`;
}

/** Wire add/delete/secret toggle inside `root` for the table with this id. */
export function attachVariableTable(root, id) {
    const tbody = root.querySelector('#' + id);
    root.querySelector(`[data-add-variable="${id}"]`).addEventListener('click', () => {
        const row = createElement(variableRowHtml({}).trim());
        tbody.appendChild(row);
        row.querySelector('.variable-key').focus();
    });
    tbody.addEventListener('click', (e) => {
        const btn = e.target.closest('.delete-variable');
        if (!btn) return;
        const row = btn.closest('.variable-row');
        if (tbody.querySelectorAll('.variable-row').length > 1) {
            row.remove();
        } else {
            row.querySelector('.variable-key').value = '';
            row.querySelector('.variable-value').value = '';
            row.querySelector('.variable-secret').checked = false;
            row.querySelector('.variable-value').type = 'text';
        }
    });
    tbody.addEventListener('change', (e) => {
        if (!e.target.classList.contains('variable-secret')) return;
        e.target.closest('.variable-row').querySelector('.variable-value').type = e.target.checked ? 'password' : 'text';
    });
}

/** Read rows back; values are NOT trimmed (leading/trailing spaces can matter). */
export function readVariableTable(root, id) {
    const out = [];
    root.querySelectorAll(`#${id} .variable-row`).forEach(row => {
        const key = row.querySelector('.variable-key').value.trim();
        if (!key) return;
        out.push({
            key,
            value: row.querySelector('.variable-value').value,
            enabled: true,
            secret: row.querySelector('.variable-secret').checked
        });
    });
    return out;
}
