/**
 * Request Pipeline
 *
 * Turns a saved/edited request into what the proxy needs: inherits auth,
 * resolves {{variables}} through every scope. DOM-free, shared by the
 * request builder and the collection runner.
 */

import { interpolate } from './VariableService.js';

/** Nearest non-inherit auth: request -> folders -> collection. */
export function resolveAuth(request, chain = []) {
    const own = request.auth;
    if (own && own.type && own.type !== 'inherit') return own;
    for (let i = chain.length - 1; i >= 0; i--) {
        const a = chain[i].auth;
        if (a && a.type && a.type !== 'inherit') return a;
    }
    return { type: 'none' };
}

/** Where the effective auth comes from, for the "inherited from ..." label. */
export function authSource(request, chain = []) {
    if (request.auth && request.auth.type && request.auth.type !== 'inherit') return 'request';
    for (let i = chain.length - 1; i >= 0; i--) {
        const a = chain[i].auth;
        if (a && a.type && a.type !== 'inherit') return chain[i].name || 'collection';
    }
    return null;
}

export function prepareRequestData(request, layers, chain = []) {
    const sub = s => interpolate(s, layers);
    let url = sub(request.url || '');

    const params = (request.queryParams || []).filter(p => p.enabled !== false && p.key);
    if (params.length) {
        const qs = params.map(p => `${encodeURIComponent(sub(p.key))}=${encodeURIComponent(sub(p.value ?? ''))}`).join('&');
        url += (url.includes('?') ? '&' : '?') + qs;
    }

    const headers = {};
    (request.headers || []).filter(h => h.enabled !== false && h.key)
        .forEach(h => { headers[sub(h.key)] = sub(h.value ?? ''); });

    const bodyType = request.bodyType || 'json';
    const hasHeader = name => Object.keys(headers).some(k => k.toLowerCase() === name);
    let body = null;
    if (bodyType === 'form') {
        const fields = (request.formData || []).filter(f => f.enabled !== false && f.key);
        if (fields.length) {
            body = fields.map(f => `${encodeURIComponent(sub(f.key))}=${encodeURIComponent(sub(f.value ?? ''))}`).join('&');
            if (!hasHeader('content-type')) headers['Content-Type'] = 'application/x-www-form-urlencoded';
        }
    } else if (bodyType !== 'none' && request.body) {
        body = sub(request.body);
        if (bodyType === 'json' && !hasHeader('content-type')) headers['Content-Type'] = 'application/json';
    }

    let auth = null;
    const effective = resolveAuth(request, chain);
    if (effective.type !== 'none') {
        auth = { ...effective };
        ['token', 'username', 'password', 'key', 'value'].forEach(f => { if (auth[f]) auth[f] = sub(auth[f]); });
    }

    return { method: request.method || 'GET', url, headers, body, auth };
}
