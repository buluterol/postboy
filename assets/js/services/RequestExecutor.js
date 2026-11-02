/**
 * Request Executor
 *
 * One full request cycle, shared by the request builder and the collection runner:
 *   pre-request scripts (collection -> folders -> request)
 *   -> variable resolution + auth -> proxy call
 *   -> test scripts (same order) -> persist variable changes.
 *
 * Scripts run on the raw request (before {{variables}} are resolved), so a script
 * can set a variable and use it in the URL in the same run.
 */

import ApiService from './ApiService.js';
import StorageService from './StorageService.js';
import { ConsoleLog } from './ConsoleLog.js';
import { runScript } from './ScriptRunner.js';
import { VariableStore, buildLayers, maskSecrets, SECRET_MASK } from './VariableService.js';
import { prepareRequestData } from './RequestPipeline.js';

const SENSITIVE_HEADER = /^(authorization|proxy-authorization|cookie|set-cookie|x-api-key|api-key)$/i;

/** Scripts to run, in order: collection, folders (outer -> inner), request. */
export function scriptChain(request, chain, phase) {
    const list = chain.map(node => ({ source: node.name || 'collection', code: node.scripts?.[phase] || '' }));
    list.push({ source: request.name || 'request', code: request.scripts?.[phase] || '' });
    return list.filter(s => s.code.trim());
}

const headersToObject = list => {
    const out = {};
    (list || []).filter(h => h.enabled !== false && h.key).forEach(h => { out[h.key] = h.value ?? ''; });
    return out;
};

/** Write script header edits back onto the header list (disabled rows stay untouched). */
function applyHeaders(list, obj) {
    const lower = new Map(Object.entries(obj).map(([k, v]) => [k.toLowerCase(), [k, v]]));
    const kept = [];
    (list || []).forEach(h => {
        if (h.enabled === false || !h.key) { kept.push(h); return; }
        const hit = lower.get(h.key.toLowerCase());
        if (hit) { kept.push({ ...h, value: hit[1] }); lower.delete(h.key.toLowerCase()); }
    });
    lower.forEach(([k, v]) => kept.push({ key: k, value: v, enabled: true }));
    return kept;
}

function maskHeaders(headers, layers) {
    const out = {};
    Object.entries(headers || {}).forEach(([k, v]) => {
        out[k] = SENSITIVE_HEADER.test(k) ? SECRET_MASK : maskSecrets(String(v), layers);
    });
    return out;
}

/**
 * @param {object} request  request as edited (may be unsaved)
 * @param {object} opts
 * @param {Array}  opts.chain        [collection, ...folders] or []
 * @param {Array}  opts.temp         temporary variables, shared across a runner pass (mutated)
 * @param {boolean} opts.interactive emit UI events and write history (builder) vs. silent (runner)
 * @returns {Promise<{requestData, response, error, tests, logs, scriptErrors, phase}>}
 */
export async function executeRequest(request, { chain = [], temp = [], interactive = false } = {}) {
    const collection = chain[0] || null;
    const env = VariableStore.environment;
    const dirty = { environment: false, collection: false, globals: false };
    const logs = [];
    const scriptErrors = [];
    const tests = [];

    const layersNow = raw => buildLayers({ temp, environment: env?.variables || [], request: raw, chain, globals: VariableStore.globals });
    const mask = text => maskSecrets(text, layersNow(request));

    const absorb = (res, source, phase) => {
        res.logs.forEach(l => {
            const text = mask(l.text);
            logs.push({ ...l, text, source, phase });
            ConsoleLog.add({ kind: 'script', level: l.level, text: `[${source}] ${text}` });
        });
        res.tests.forEach(t => tests.push({ ...t, source, phase }));
        if (res.error) {
            const message = mask(res.error);
            scriptErrors.push({ source, phase, message });
            ConsoleLog.add({ kind: 'error', level: 'error', text: `[${source}] ${phase} script: ${message}` });
        }
        const c = res.changes || {};
        if (c.environment && env) { env.variables = c.environment; dirty.environment = true; }
        if (c.globals) { VariableStore.globals = c.globals; dirty.globals = true; }
        if (c.temp) { temp.length = 0; c.temp.forEach(v => temp.push(v)); }
        // Collection variables need a saved collection; for a loose request they fall back to temp.
        if (c.collection) {
            if (collection) { collection.variables = c.collection; dirty.collection = true; }
            else c.collection.forEach(v => upsert(temp, v));
        }
    };

    const ctxFor = (reqState, response) => ({
        environment: env?.variables || [],
        collection: collection?.variables || [],
        globals: VariableStore.globals,
        temp,
        collectionName: collection?.name || '',
        request: reqState,
        response
    });

    const persist = async () => {
        try {
            if (dirty.environment && env?.id) { await StorageService.updateEnvironment(env.id, env); VariableStore.setEnvironment(env); }
            if (dirty.globals) await StorageService.saveGlobals(VariableStore.globals);
            if (dirty.collection) await StorageService.updateCollection(collection.id, collection);
        } catch (e) {
            ConsoleLog.add({ kind: 'error', level: 'error', text: 'Could not save variable changes: ' + e.message });
        }
        dirty.environment = dirty.globals = dirty.collection = false;
    };

    // ---- pre-request -------------------------------------------------------
    const raw = { ...request, headers: (request.headers || []).map(h => ({ ...h })) };
    for (const s of scriptChain(request, chain, 'preRequest')) {
        const res = await runScript(s.code, ctxFor({ method: raw.method || 'GET', url: raw.url || '', headers: headersToObject(raw.headers), body: raw.body ?? null }, null));
        absorb(res, s.source, 'pre-request');
        if (res.request) {
            raw.method = res.request.method;
            raw.url = res.request.url;
            raw.body = res.request.body;
            raw.headers = applyHeaders(raw.headers, res.request.headers);
        }
        if (res.error) break;
    }
    await persist();

    const failedPre = scriptErrors.length > 0;
    if (failedPre) {
        return { requestData: null, response: null, error: 'Pre-request script failed: ' + scriptErrors[0].message, tests, logs, scriptErrors, phase: 'pre-request' };
    }

    // ---- send --------------------------------------------------------------
    const layers = layersNow(raw);
    const requestData = prepareRequestData(raw, layers, chain);
    ConsoleLog.add({
        kind: 'request', level: 'log',
        text: `→ ${requestData.method} ${maskSecrets(requestData.url, layers)}`,
        detail: JSON.stringify({ headers: maskHeaders(requestData.headers, layers), body: maskSecrets(requestData.body || '', layers) || null, auth: requestData.auth ? SECRET_MASK : null }, null, 2)
    });

    let response = null;
    let error = null;
    try {
        response = interactive ? await ApiService.sendRequest(requestData) : await ApiService.send(requestData);
        ConsoleLog.add({
            kind: 'response', level: response.status >= 400 ? 'warn' : 'log',
            text: `← ${response.status} ${response.statusText || ''} · ${response.responseTime ?? '?'} ms`.trim(),
            detail: mask(typeof response.body === 'string' ? response.body.slice(0, 2000) : JSON.stringify(response.body || '').slice(0, 2000))
        });
    } catch (e) {
        error = e.message || 'Request failed';
        ConsoleLog.add({ kind: 'error', level: 'error', text: `✕ ${requestData.method} ${maskSecrets(requestData.url, layers)}: ${mask(error)}` });
    }

    // ---- tests -------------------------------------------------------------
    if (response) {
        const body = typeof response.body === 'string' ? response.body : JSON.stringify(response.body ?? '');
        const resState = {
            code: response.status, status: response.statusText || '', headers: response.headers || {},
            body, responseTime: response.responseTime ?? 0, size: response.size ?? body.length
        };
        const reqState = { method: requestData.method, url: requestData.url, headers: requestData.headers, body: requestData.body };
        for (const s of scriptChain(request, chain, 'test')) {
            absorb(await runScript(s.code, ctxFor(reqState, resState)), s.source, 'test');
        }
        await persist();
    }

    return { requestData, response, error, tests, logs, scriptErrors, phase: response ? 'test' : 'send' };
}

function upsert(list, v) {
    const hit = list.find(x => x.key === v.key);
    if (hit) hit.value = v.value; else list.push({ ...v });
}
