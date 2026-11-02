/**
 * Postman Collection v2.1 / Environment import & export
 *
 * Postboy collection  <->  Postman Collection v2.1
 * Postboy environment <->  Postman environment file
 *
 * Secrets never leave Postboy by accident: exported secret variables are written
 * with an empty value unless `includeSecrets` is explicitly passed.
 */

import { generateId } from './helpers.js';
import { createFolder, emptyScripts, normalizeNode } from './collectionTree.js';

export const POSTMAN_SCHEMA = 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json';

/* ---------------------------------------------------------------- export */

const toLines = text => String(text || '').split('\n');

/** Postboy scripts use pb.*; Postman only knows pm.* (same API subset). */
const toPm = code => String(code || '').replace(/\bpb\./g, 'pm.');
const fromPm = code => String(code || '');

function exportEvents(scripts) {
    const events = [];
    if (scripts?.preRequest?.trim()) {
        events.push({ listen: 'prerequest', script: { type: 'text/javascript', exec: toLines(toPm(scripts.preRequest)) } });
    }
    if (scripts?.test?.trim()) {
        events.push({ listen: 'test', script: { type: 'text/javascript', exec: toLines(toPm(scripts.test)) } });
    }
    return events;
}

function exportAuth(auth) {
    if (!auth || auth.type === 'inherit' || auth.type === undefined) return undefined;
    switch (auth.type) {
        case 'none':
            return { type: 'noauth' };
        case 'bearer':
            return { type: 'bearer', bearer: [{ key: 'token', value: auth.token || '', type: 'string' }] };
        case 'basic':
            return {
                type: 'basic',
                basic: [
                    { key: 'username', value: auth.username || '', type: 'string' },
                    { key: 'password', value: auth.password || '', type: 'string' }
                ]
            };
        case 'apikey':
            return {
                type: 'apikey',
                apikey: [
                    { key: 'key', value: auth.key || '', type: 'string' },
                    { key: 'value', value: auth.value || '', type: 'string' },
                    { key: 'in', value: auth.addTo === 'query' ? 'query' : 'header', type: 'string' }
                ]
            };
        default:
            return undefined;
    }
}

function exportVariables(variables, includeSecrets) {
    return (variables || []).filter(v => v.key).map(v => ({
        key: v.key,
        value: v.secret && !includeSecrets ? '' : v.value ?? '',
        ...(v.secret ? { type: 'secret' } : {}),
        ...(v.enabled === false ? { disabled: true } : {})
    }));
}

function splitUrl(raw) {
    const [withoutQuery] = String(raw || '').split('?');
    const m = withoutQuery.match(/^(\{\{[^}]+\}\}|[a-z][a-z0-9+.-]*:\/\/[^/]+)(\/.*)?$/i);
    const host = m ? m[1] : withoutQuery;
    const path = m && m[2] ? m[2].split('/').filter(Boolean) : [];
    return { host: [host], path };
}

function exportRequest(request, includeSecrets) {
    const query = (request.queryParams || []).filter(p => p.key).map(p => ({
        key: p.key,
        value: p.value ?? '',
        ...(p.enabled === false ? { disabled: true } : {})
    }));
    const qs = query.filter(q => !q.disabled).map(q => `${q.key}=${q.value}`).join('&');
    const raw = (request.url || '') + (qs ? (request.url.includes('?') ? '&' : '?') + qs : '');

    const item = {
        name: request.name || request.url || 'Request',
        request: {
            method: request.method || 'GET',
            header: (request.headers || []).filter(h => h.key).map(h => ({
                key: h.key,
                value: h.value ?? '',
                ...(h.enabled === false ? { disabled: true } : {})
            })),
            url: { raw, ...splitUrl(request.url), ...(query.length ? { query } : {}) }
        }
    };
    if (request.description) item.request.description = request.description;

    const bodyType = request.bodyType || 'json';
    if (bodyType === 'form') {
        item.request.body = {
            mode: 'urlencoded',
            urlencoded: (request.formData || []).filter(f => f.key).map(f => ({
                key: f.key,
                value: f.value ?? '',
                ...(f.enabled === false ? { disabled: true } : {})
            }))
        };
    } else if (bodyType !== 'none' && request.body) {
        item.request.body = {
            mode: 'raw',
            raw: request.body,
            options: { raw: { language: bodyType === 'json' ? 'json' : 'text' } }
        };
    }

    const auth = exportAuth(request.auth);
    if (auth) item.request.auth = auth;

    const events = exportEvents(request.scripts);
    if (events.length) item.event = events;

    const vars = exportVariables(request.variables, includeSecrets);
    if (vars.length) item.request.url.variable = vars;
    return item;
}

function exportNode(node, includeSecrets) {
    const items = [
        ...(node.folders || []).map(folder => {
            const out = { name: folder.name, item: exportNode(folder, includeSecrets) };
            const auth = exportAuth(folder.auth);
            if (auth) out.auth = auth;
            const events = exportEvents(folder.scripts);
            if (events.length) out.event = events;
            const vars = exportVariables(folder.variables, includeSecrets);
            if (vars.length) out.variable = vars;
            return out;
        }),
        ...(node.requests || []).map(r => exportRequest(r, includeSecrets))
    ];
    return items;
}

/** @returns {Object} Postman Collection v2.1 document */
export function exportPostmanCollection(collection, { includeSecrets = false } = {}) {
    const out = {
        info: {
            _postman_id: collection.id || generateId(),
            name: collection.name,
            description: collection.description || '',
            schema: POSTMAN_SCHEMA
        },
        item: exportNode(collection, includeSecrets)
    };
    const auth = exportAuth(collection.auth);
    if (auth) out.auth = auth;
    const events = exportEvents(collection.scripts);
    if (events.length) out.event = events;
    const vars = exportVariables(collection.variables, includeSecrets);
    if (vars.length) out.variable = vars;
    return out;
}

/** @returns {Object} Postman environment file */
export function exportPostmanEnvironment(environment, { includeSecrets = false } = {}) {
    return {
        id: environment.id || generateId(),
        name: environment.name,
        values: (environment.variables || []).filter(v => v.key).map(v => ({
            key: v.key,
            value: v.secret && !includeSecrets ? '' : v.value ?? '',
            type: v.secret ? 'secret' : 'default',
            enabled: v.enabled !== false
        })),
        _postman_variable_scope: 'environment'
    };
}

/* ---------------------------------------------------------------- import */

const execToString = exec => (Array.isArray(exec) ? exec.join('\n') : String(exec || ''));

function importScripts(events) {
    const scripts = emptyScripts();
    (events || []).forEach(e => {
        const code = fromPm(execToString(e.script?.exec));
        if (e.listen === 'prerequest') scripts.preRequest = code;
        if (e.listen === 'test') scripts.test = code;
    });
    return scripts;
}

function pmValue(list, key) {
    const hit = (list || []).find(p => p.key === key);
    return hit ? hit.value ?? '' : '';
}

function importAuth(auth) {
    if (!auth) return { type: 'inherit' };
    switch (auth.type) {
        case 'noauth':
            return { type: 'none' };
        case 'bearer':
            return { type: 'bearer', token: pmValue(auth.bearer, 'token') };
        case 'basic':
            return { type: 'basic', username: pmValue(auth.basic, 'username'), password: pmValue(auth.basic, 'password') };
        case 'apikey':
            return {
                type: 'apikey',
                key: pmValue(auth.apikey, 'key'),
                value: pmValue(auth.apikey, 'value'),
                addTo: pmValue(auth.apikey, 'in') === 'query' ? 'query' : 'header'
            };
        default:
            return { type: 'inherit' };
    }
}

function importVariables(list) {
    return (list || []).filter(v => v.key).map(v => ({
        key: v.key,
        value: v.value === undefined || v.value === null ? '' : String(v.value),
        secret: v.type === 'secret',
        enabled: !v.disabled
    }));
}

function importRequest(item) {
    const r = item.request || {};
    const url = typeof r.url === 'string' ? { raw: r.url } : r.url || {};
    let raw = url.raw || '';

    // Query params: prefer the structured list, then strip "?..." from the raw URL.
    let queryParams = (url.query || []).filter(q => q.key !== undefined).map(q => ({
        key: q.key,
        value: q.value ?? '',
        enabled: !q.disabled
    }));
    const qIndex = raw.indexOf('?');
    if (qIndex >= 0) {
        if (queryParams.length === 0) {
            queryParams = raw.slice(qIndex + 1).split('&').filter(Boolean).map(pair => {
                const [k, ...v] = pair.split('=');
                return { key: decodeURIComponent(k), value: v.join('='), enabled: true };
            });
        }
        raw = raw.slice(0, qIndex);
    }

    // :id path variables -> {{id}} + request variable
    const variables = [];
    (url.variable || []).forEach(v => {
        if (v.key) variables.push({ key: v.key, value: v.value ?? '', enabled: !v.disabled });
    });
    raw = raw.replace(/\/:([A-Za-z_]\w*)/g, (m, name) => {
        if (!variables.some(v => v.key === name)) variables.push({ key: name, value: '', enabled: true });
        return `/{{${name}}}`;
    });

    const headers = (r.header || []).map(h => ({ key: h.key, value: h.value ?? '', enabled: !h.disabled }));
    if (headers.length === 0) headers.push({ key: '', value: '', enabled: true });

    let bodyType = 'none';
    let body = '';
    let formData = [{ key: '', value: '', enabled: true }];
    const b = r.body;
    if (b) {
        if (b.mode === 'raw') {
            const lang = b.options?.raw?.language;
            bodyType = lang === 'json' || /^\s*[{[]/.test(b.raw || '') ? 'json' : 'raw';
            body = b.raw || '';
        } else if (b.mode === 'urlencoded' || b.mode === 'formdata') {
            bodyType = 'form';
            const rows = (b[b.mode] || []).filter(f => f.type !== 'file').map(f => ({
                key: f.key, value: f.value ?? '', enabled: !f.disabled
            }));
            if (rows.length) formData = rows;
        } else if (b.mode === 'graphql') {
            bodyType = 'json';
            body = JSON.stringify({ query: b.graphql?.query || '', variables: b.graphql?.variables ? JSON.parse(b.graphql.variables) : {} }, null, 2);
        }
    }

    return {
        id: generateId(),
        name: item.name || raw || 'Request',
        description: typeof r.description === 'string' ? r.description : r.description?.content || '',
        method: (r.method || 'GET').toUpperCase(),
        url: raw,
        headers,
        queryParams,
        body,
        bodyType,
        formData,
        auth: importAuth(r.auth),
        variables,
        scripts: importScripts(item.event)
    };
}

function importItems(items, node) {
    (items || []).forEach(item => {
        if (Array.isArray(item.item)) {
            const folder = createFolder(item.name || 'Folder');
            folder.auth = importAuth(item.auth);
            folder.scripts = importScripts(item.event);
            folder.variables = importVariables(item.variable);
            importItems(item.item, folder);
            node.folders.push(folder);
        } else if (item.request) {
            node.requests.push(importRequest(item));
        }
    });
}

/** @returns {Object} Postboy collection (without server-side fields) */
export function importPostmanCollection(doc) {
    if (!doc || !doc.info || !Array.isArray(doc.item)) {
        throw new Error('Not a Postman collection: "info" or "item" is missing');
    }
    const collection = normalizeNode({
        name: doc.info.name || 'Imported collection',
        description: typeof doc.info.description === 'string' ? doc.info.description : doc.info.description?.content || '',
        requests: [],
        folders: [],
        auth: doc.auth ? importAuth(doc.auth) : { type: 'none' },
        variables: importVariables(doc.variable),
        scripts: importScripts(doc.event),
        source: { type: 'postman', schema: doc.info.schema || '' }
    });
    importItems(doc.item, collection);
    return collection;
}

/** @returns {Object} Postboy environment (without server-side fields) */
export function importPostmanEnvironment(doc) {
    if (!doc || !Array.isArray(doc.values)) {
        throw new Error('Not a Postman environment: "values" is missing');
    }
    return {
        name: doc.name || 'Imported environment',
        variables: doc.values.filter(v => v.key).map(v => ({
            key: v.key,
            value: v.value === undefined || v.value === null ? '' : String(v.value),
            secret: v.type === 'secret',
            enabled: v.enabled !== false
        }))
    };
}

export const isPostmanCollection = doc => !!(doc && doc.info && Array.isArray(doc.item));
export const isPostmanEnvironment = doc => !!(doc && Array.isArray(doc.values) && !doc.item);
export const isOpenApi = doc => !!(doc && (doc.openapi || doc.swagger) && doc.paths);
