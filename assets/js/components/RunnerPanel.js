/**
 * Collection Runner
 *
 * Runs every request of a collection (or one folder) in order, silently:
 * no builder UI updates, no history entries. Temp variables are shared across
 * the whole run, so a script can pass values to the next request.
 */

import { VariableStore } from '../services/VariableService.js';
import { executeRequest } from '../services/RequestExecutor.js';
import { listRequests, pathLabel } from '../utils/collectionTree.js';
import { createElement, showToast } from '../utils/helpers.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));

function folderOptions(node, depth = 0, out = []) {
    (node.folders || []).forEach(f => {
        out.push({ id: f.id, label: `${'— '.repeat(depth)}${f.name}` });
        folderOptions(f, depth + 1, out);
    });
    return out;
}

function findNodeById(node, id) {
    if (node.id === id) return node;
    for (const f of node.folders || []) {
        const hit = findNodeById(f, id);
        if (hit) return hit;
    }
    return null;
}

export class RunnerPanel {
    constructor() {
        this.running = false;
        this.stopRequested = false;
        this.results = [];
    }

    showModal() {
        const collections = VariableStore.collections;
        if (!collections.length) { showToast('No collections to run', 'error'); return; }
        const modal = createElement(`
            <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" id="runnerModal">
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                    <div class="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                        <h2 class="text-xl font-semibold">Collection Runner</h2>
                        <button id="closeRunner" class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300" aria-label="Close">✕</button>
                    </div>
                    <div class="p-6 grid grid-cols-2 gap-4 border-b border-gray-200 dark:border-gray-700">
                        <label class="text-sm">Collection<select id="runnerCollection" class="select w-full"></select></label>
                        <label class="text-sm">Folder<select id="runnerFolder" class="select w-full"></select></label>
                        <label class="text-sm">Delay between requests (ms)<input id="runnerDelay" type="number" min="0" value="0" class="input w-full"></label>
                        <label class="text-sm flex items-end gap-2"><input id="runnerStopOnFail" type="checkbox"> Stop on first failure</label>
                    </div>
                    <div class="px-6 py-3 flex items-center gap-3">
                        <button id="runnerRun" class="btn btn-primary">Run</button>
                        <button id="runnerStop" class="btn btn-secondary" disabled>Stop</button>
                        <button id="runnerExport" class="btn btn-secondary" disabled>Export JSON</button>
                        <span id="runnerSummary" class="text-sm text-gray-500"></span>
                    </div>
                    <div class="flex-1 overflow-y-auto px-6 pb-6">
                        <table class="w-full text-sm"><tbody id="runnerRows"></tbody></table>
                    </div>
                </div>
            </div>
        `);
        document.getElementById('modals').appendChild(modal);
        const $ = s => modal.querySelector(s);

        collections.forEach(c => {
            const o = document.createElement('option'); o.value = c.id; o.textContent = c.name; $('#runnerCollection').appendChild(o);
        });
        const fillFolders = () => {
            const col = collections.find(c => c.id === $('#runnerCollection').value);
            const sel = $('#runnerFolder'); sel.textContent = '';
            const all = document.createElement('option'); all.value = ''; all.textContent = 'Whole collection'; sel.appendChild(all);
            folderOptions(col).forEach(f => { const o = document.createElement('option'); o.value = f.id; o.textContent = f.label; sel.appendChild(o); });
        };
        fillFolders();
        $('#runnerCollection').addEventListener('change', fillFolders);

        const close = () => { this.stopRequested = true; modal.remove(); };
        $('#closeRunner').addEventListener('click', close);
        modal.addEventListener('click', e => { if (e.target === modal) close(); });
        $('#runnerStop').addEventListener('click', () => { this.stopRequested = true; });
        $('#runnerExport').addEventListener('click', () => this.exportJson($('#runnerCollection').selectedOptions[0].textContent));
        $('#runnerRun').addEventListener('click', () => this.run(modal, collections));
    }

    async run(modal, collections) {
        if (this.running) return;
        const $ = s => modal.querySelector(s);
        const collection = collections.find(c => c.id === $('#runnerCollection').value);
        const folderId = $('#runnerFolder').value;
        const node = folderId ? findNodeById(collection, folderId) : collection;
        const chainTo = folderId ? this.chainTo(collection, folderId) : [collection];
        const items = listRequests(node, chainTo);
        const delay = Math.max(0, parseInt($('#runnerDelay').value, 10) || 0);
        const stopOnFail = $('#runnerStopOnFail').checked;

        this.running = true; this.stopRequested = false; this.results = [];
        const rows = $('#runnerRows'); rows.textContent = '';
        $('#runnerRun').disabled = true; $('#runnerStop').disabled = false; $('#runnerExport').disabled = true;
        const temp = [];
        const summary = $('#runnerSummary');

        for (let i = 0; i < items.length && !this.stopRequested; i++) {
            const { request, chain } = items[i];
            summary.textContent = `Running ${i + 1}/${items.length}…`;
            const t0 = performance.now();
            let outcome;
            try {
                outcome = await executeRequest(request, { chain, temp, interactive: false });
            } catch (e) {
                outcome = { response: null, error: e.message || 'Run failed', tests: [], scriptErrors: [] };
            }
            const failedTests = outcome.tests.filter(t => !t.passed).length;
            const row = {
                name: pathLabel(chain, request),
                method: request.method,
                url: request.url, // template, not the resolved URL: resolved values may hold secrets
                status: outcome.response?.status ?? null,
                ms: outcome.response?.responseTime ?? Math.round(performance.now() - t0),
                tests: { passed: outcome.tests.length - failedTests, failed: failedTests },
                errors: [outcome.error, ...(outcome.scriptErrors || []).map(s => s.message)].filter(Boolean),
                failedTests: outcome.tests.filter(t => !t.passed).map(t => ({ name: t.name, error: t.error }))
            };
            row.ok = row.errors.length === 0 && failedTests === 0;
            this.results.push(row);
            this.appendRow(rows, row);
            if (!row.ok && stopOnFail) break;
            if (delay && i < items.length - 1) await sleep(delay);
        }

        const failed = this.results.filter(r => !r.ok).length;
        summary.textContent = `${this.results.length}/${items.length} run · ${this.results.length - failed} passed · ${failed} failed` +
            (this.stopRequested ? ' · stopped' : '');
        this.running = false;
        if (document.body.contains(modal)) {
            $('#runnerRun').disabled = false; $('#runnerStop').disabled = true; $('#runnerExport').disabled = !this.results.length;
        }
    }

    chainTo(collection, folderId) {
        const walk = (node, chain) => {
            for (const f of node.folders || []) {
                const next = [...chain, f];
                if (f.id === folderId) return next;
                const hit = walk(f, next);
                if (hit) return hit;
            }
            return null;
        };
        return walk(collection, [collection]) || [collection];
    }

    appendRow(tbody, r) {
        const tr = document.createElement('tr');
        tr.className = 'border-b border-gray-100 dark:border-gray-700 align-top';
        const cell = (text, cls = '') => { const td = document.createElement('td'); td.className = `py-1 pr-3 ${cls}`; td.textContent = text; tr.appendChild(td); return td; };
        cell(r.ok ? '✓' : '✕', r.ok ? 'text-green-600' : 'text-red-600');
        cell(`${r.method} ${r.name}`);
        cell(r.status ?? '—', r.status >= 500 ? 'text-red-600' : '');
        cell(`${r.ms} ms`);
        cell(`${r.tests.passed}/${r.tests.passed + r.tests.failed} tests`);
        if (r.errors.length || r.failedTests.length) {
            const detail = document.createElement('tr');
            const td = document.createElement('td'); td.colSpan = 5; td.className = 'pb-2 pl-6 text-xs text-red-600';
            td.textContent = [...r.errors, ...r.failedTests.map(t => `${t.name}: ${t.error}`)].join(' | ');
            detail.appendChild(td);
            tbody.appendChild(tr); tbody.appendChild(detail);
        } else tbody.appendChild(tr);
    }

    exportJson(name) {
        const failed = this.results.filter(r => !r.ok).length;
        const report = { collection: name, date: new Date().toISOString(), total: this.results.length, passed: this.results.length - failed, failed, results: this.results };
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
        a.download = `runner-${name.replace(/[^\w.-]+/g, '_')}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }
}
