/**
 * Variable Service
 *
 * Scopes, highest priority first:
 *   temp (script, one run)  >  environment  >  request  >  folders (deepest first)
 *   >  collection  >  globals
 * Request, folder and collection variables are the "collection scope"; the closer one wins.
 *
 * A variable is { key, value, enabled?, secret? }. A layer is { scope, vars }.
 * Pure functions take layers; the store keeps the loaded globals/environment.
 */

import { findRequest } from '../utils/collectionTree.js';

export const SCOPES = ['temp', 'environment', 'request', 'folder', 'collection', 'global'];
export const SECRET_MASK = '••••••';

const VAR_PATTERN = /\{\{\s*([^{}\s]+?)\s*\}\}/g;

export function makeLayer(scope, vars) {
    return { scope, vars: Array.isArray(vars) ? vars : [] };
}

/** Build the layer list for one request. chain = [collection, ...folders]. */
export function buildLayers({ temp = [], environment = [], request = null, chain = [], globals = [] } = {}) {
    const layers = [makeLayer('temp', temp), makeLayer('environment', environment)];
    if (request) layers.push(makeLayer('request', request.variables));
    for (let i = chain.length - 1; i >= 1; i--) layers.push(makeLayer('folder', chain[i].variables));
    if (chain[0]) layers.push(makeLayer('collection', chain[0].variables));
    layers.push(makeLayer('global', globals));
    return layers;
}

/** @returns {{key, value, secret, scope}|null} first enabled match by layer priority */
export function lookup(name, layers) {
    for (const layer of layers) {
        for (const v of layer.vars) {
            if (v.key === name && v.enabled !== false) {
                return { key: v.key, value: v.value ?? '', secret: !!v.secret, scope: layer.scope };
            }
        }
    }
    return null;
}

/** Replace {{name}}; unknown names stay as written. */
export function interpolate(str, layers) {
    if (typeof str !== 'string' || !str.includes('{{')) return str;
    return str.replace(VAR_PATTERN, (match, name) => {
        const hit = lookup(name, layers);
        return hit ? String(hit.value) : match;
    });
}

/** Names of every variable in layers marked secret (their values must never be logged). */
export function secretValues(layers) {
    const out = new Set();
    layers.forEach(l => l.vars.forEach(v => {
        if (v.secret && v.enabled !== false && v.value) out.add(String(v.value));
    }));
    return [...out];
}

/** Replace secret values inside text with the mask. */
export function maskSecrets(text, layers) {
    if (typeof text !== 'string' || !text) return text;
    let out = text;
    // longest first so a short secret cannot split a longer one
    secretValues(layers).sort((a, b) => b.length - a.length).forEach(s => {
        out = out.split(s).join(SECRET_MASK);
    });
    return out;
}

export function setVar(list, key, value) {
    const hit = list.find(v => v.key === key);
    if (hit) { hit.value = value; hit.enabled = true; } else list.push({ key, value, enabled: true, secret: false });
}

export function unsetVar(list, key) {
    const i = list.findIndex(v => v.key === key);
    if (i >= 0) list.splice(i, 1);
}

/**
 * Keeps the loaded globals + active environment for the UI and the runner.
 * Persistence is injected (kept out so the module stays testable in Node).
 */
class VariableStoreClass {
    constructor() {
        this.globals = [];
        this.environment = null; // { id, name, variables: [] }
        this.collections = [];
        this.persist = { globals: null, environment: null };
    }

    setGlobals(vars) { this.globals = Array.isArray(vars) ? vars : []; }
    setEnvironment(env) { this.environment = env || null; }
    setCollections(list) { this.collections = Array.isArray(list) ? list : []; }

    /** @returns {{collection, request, chain}|null} for a saved request id */
    locate(requestId) {
        if (!requestId) return null;
        for (const collection of this.collections) {
            const hit = findRequest(collection, requestId);
            if (hit) return { collection, request: hit.request, chain: hit.chain };
        }
        return null;
    }
    get envVars() { return this.environment?.variables || []; }

    layers(chain = [], request = null, temp = []) {
        return buildLayers({ temp, environment: this.envVars, request, chain, globals: this.globals });
    }
}

export const VariableStore = new VariableStoreClass();
