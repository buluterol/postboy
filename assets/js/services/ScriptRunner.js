/**
 * Script Runner
 *
 * Runs one user script in a throw-away Web Worker (no DOM, no storage; network
 * APIs are removed inside the worker, see scriptSandbox.js). The worker is killed
 * after TIMEOUT_MS so an endless loop cannot freeze the app.
 *
 * Limit: this is a best-effort sandbox, not a security boundary. Scripts are code
 * the user wrote or imported, so only run collections you trust.
 */

import { runInSandbox } from '../utils/scriptSandbox.js';

export const TIMEOUT_MS = 5000;

const WORKER_SOURCE = `
const run = ${runInSandbox.toString()};
self.onmessage = async (e) => {
    try {
        self.postMessage(await run(e.data.code, e.data.ctx));
    } catch (err) {
        self.postMessage({ ok: false, error: String(err && err.message || err), logs: [], tests: [], changes: {}, request: null });
    }
};
`;

let workerUrl = null;
function getWorkerUrl() {
    if (!workerUrl) workerUrl = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: 'text/javascript' }));
    return workerUrl;
}

function failure(error) {
    return { ok: false, error, logs: [], tests: [], changes: { environment: null, collection: null, globals: null, temp: null }, request: null };
}

/**
 * @param {string} code
 * @param {object} ctx see scriptSandbox.js
 * @param {number} [timeoutMs]
 * @returns {Promise<object>} sandbox result; never rejects
 */
export function runScript(code, ctx, timeoutMs = TIMEOUT_MS) {
    return new Promise(resolve => {
        let worker;
        try {
            worker = new Worker(getWorkerUrl());
        } catch (e) {
            resolve(failure('Script worker could not start: ' + e.message));
            return;
        }
        const done = result => { clearTimeout(timer); worker.terminate(); resolve(result); };
        const timer = setTimeout(() => done(failure(`Script timed out after ${timeoutMs / 1000}s`)), timeoutMs);
        worker.onmessage = e => done(e.data);
        worker.onerror = e => done(failure(e.message || 'Script error'));
        try {
            worker.postMessage({ code, ctx });
        } catch (e) {
            done(failure('Script context could not be sent: ' + e.message));
        }
    });
}
