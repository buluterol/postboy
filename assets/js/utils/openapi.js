/**
 * OpenAPI 3 importer
 *
 * Converts an OpenAPI 3.x document (already parsed to an object) into a Postboy
 * collection:
 *   - tag            -> folder
 *   - operation      -> request (name = summary | operationId | "METHOD path")
 *   - path params    -> {{name}} in the URL + a request-level variable holding the example
 *   - query params   -> queryParams with {{name}} values (optional ones start disabled)
 *   - requestBody    -> example / default / schema-derived JSON
 *   - security       -> collection-level auth (operations can override or opt out)
 */

import { generateId } from './helpers.js';
import { createFolder, emptyScripts } from './collectionTree.js';

const METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];

/* ------------------------------------------------------------------ $ref */

function resolveRef(spec, obj, seen = new Set()) {
    while (obj && typeof obj === 'object' && obj.$ref) {
        const ref = obj.$ref;
        if (seen.has(ref) || !ref.startsWith('#/')) return {};
        seen.add(ref);
        obj = ref.slice(2).split('/').reduce(
            (node, part) => (node ? node[part.replace(/~1/g, '/').replace(/~0/g, '~')] : undefined),
            spec
        );
    }
    return obj || {};
}

/* -------------------------------------------------------- example values */

const FORMAT_EXAMPLES = {
    'date-time': '2024-01-01T00:00:00Z',
    date: '2024-01-01',
    time: '00:00:00',
    email: 'user@example.com',
    uuid: '00000000-0000-0000-0000-000000000000',
    uri: 'https://example.com',
    url: 'https://example.com',
    hostname: 'example.com',
    ipv4: '127.0.0.1',
    ipv6: '::1',
    password: 'changeme',
    byte: '',
    binary: ''
};

/** Build an example value from a JSON schema. Depth limited, readOnly fields skipped. */
export function exampleFromSchema(spec, schema, depth = 0, refStack = []) {
    if (depth > 5 || !schema) return null;

    if (schema.$ref) {
        if (refStack.includes(schema.$ref)) return null;
        return exampleFromSchema(spec, resolveRef(spec, schema), depth, [...refStack, schema.$ref]);
    }

    if (schema.example !== undefined) return schema.example;
    if (schema.default !== undefined) return schema.default;
    if (schema.const !== undefined) return schema.const;
    if (Array.isArray(schema.enum) && schema.enum.length) return schema.enum[0];

    if (Array.isArray(schema.allOf)) {
        const parts = schema.allOf.map(s => exampleFromSchema(spec, s, depth, refStack));
        if (parts.every(p => p && typeof p === 'object' && !Array.isArray(p))) {
            return Object.assign({}, ...parts);
        }
        return parts.find(p => p !== null) ?? null;
    }
    const alt = schema.oneOf || schema.anyOf;
    if (Array.isArray(alt) && alt.length) {
        const first = alt.find(s => resolveRef(spec, s).type !== 'null') || alt[0];
        return exampleFromSchema(spec, first, depth, refStack);
    }

    let type = schema.type;
    if (Array.isArray(type)) type = type.find(t => t !== 'null') || type[0];
    if (!type) type = schema.properties ? 'object' : schema.items ? 'array' : null;

    switch (type) {
        case 'object': {
            const out = {};
            Object.entries(schema.properties || {}).forEach(([name, prop]) => {
                if (resolveRef(spec, prop).readOnly) return;
                out[name] = exampleFromSchema(spec, prop, depth + 1, refStack);
            });
            return out;
        }
        case 'array': {
            const item = exampleFromSchema(spec, schema.items, depth + 1, refStack);
            return item === null ? [] : [item];
        }
        case 'integer':
            return schema.minimum !== undefined ? schema.minimum : 0;
        case 'number':
            return schema.minimum !== undefined ? schema.minimum : 0;
        case 'boolean':
            return false;
        case 'string':
            return FORMAT_EXAMPLES[schema.format] ?? '';
        default:
            return null;
    }
}

function firstExample(spec, media) {
    if (media.example !== undefined) return media.example;
    if (media.examples && typeof media.examples === 'object') {
        const first = Object.values(media.examples)[0];
        const resolved = resolveRef(spec, first);
        if (resolved.value !== undefined) return resolved.value;
    }
    return undefined;
}

/* ------------------------------------------------------------- helpers */

/** Variable names must be safe inside {{ }}. */
function varName(name) {
    return String(name).replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '') || 'param';
}

function scalarToString(value) {
    if (value === undefined || value === null) return '';
    return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

function paramExample(spec, param) {
    if (param.example !== undefined) return scalarToString(param.example);
    const schema = resolveRef(spec, param.schema);
    if (schema.default !== undefined) return scalarToString(schema.default);
    if (schema.example !== undefined) return scalarToString(schema.example);
    if (Array.isArray(schema.enum) && schema.enum.length) return scalarToString(schema.enum[0]);
    return '';
}

function serverUrl(spec) {
    const server = (spec.servers || [])[0];
    if (!server || !server.url) return '';
    return server.url.replace(/\{(\w+)\}/g, (m, name) => server.variables?.[name]?.default ?? m).replace(/\/+$/, '');
}

/** Map an OpenAPI security scheme to a Postboy auth object. */
function authFromScheme(scheme) {
    if (!scheme) return { type: 'none' };
    if (scheme.type === 'apiKey') {
        return {
            type: 'apikey',
            key: scheme.name || 'X-API-Key',
            value: '{{apiKey}}',
            addTo: scheme.in === 'query' ? 'query' : 'header'
        };
    }
    if (scheme.type === 'http' && /^basic$/i.test(scheme.scheme || '')) {
        return { type: 'basic', username: '{{username}}', password: '{{password}}' };
    }
    return { type: 'bearer', token: '{{token}}' };
}

function schemeFromRequirement(spec, requirement) {
    if (!Array.isArray(requirement) || requirement.length === 0) return null;
    const name = Object.keys(requirement[0])[0];
    if (!name) return null;
    const scheme = resolveRef(spec, spec.components?.securitySchemes?.[name]);
    return scheme && scheme.type ? { name, scheme } : null;
}

/* ----------------------------------------------------------- operation */

function buildRequest(spec, path, method, operation, pathItem, collectionScheme) {
    const params = [];
    const byKey = new Map();
    // path-item level first, operation level overrides
    [...(pathItem.parameters || []), ...(operation.parameters || [])].forEach(raw => {
        const p = resolveRef(spec, raw);
        if (!p.name) return;
        byKey.set(`${p.in}:${p.name}`, p);
    });
    byKey.forEach(p => params.push(p));

    const variables = [];
    const addVariable = (key, value) => {
        if (!variables.some(v => v.key === key)) variables.push({ key, value, enabled: true });
    };

    // URL with path params
    const url = '{{baseUrl}}' + path.replace(/\{([^}]+)\}/g, (m, name) => {
        const param = params.find(p => p.in === 'path' && p.name === name);
        const key = varName(name);
        addVariable(key, param ? paramExample(spec, param) : '');
        return `{{${key}}}`;
    });

    const queryParams = [];
    params.filter(p => p.in === 'query').forEach(p => {
        const key = varName(p.name);
        addVariable(key, paramExample(spec, p));
        queryParams.push({
            key: p.name,
            value: `{{${key}}}`,
            enabled: !!p.required,
            description: p.description || ''
        });
    });

    const headers = [];
    params.filter(p => p.in === 'header').forEach(p => {
        const key = varName(p.name);
        addVariable(key, paramExample(spec, p));
        headers.push({ key: p.name, value: `{{${key}}}`, enabled: !!p.required });
    });
    if (headers.length === 0) headers.push({ key: '', value: '', enabled: true });

    // Body
    let bodyType = 'none';
    let body = '';
    let formData = [{ key: '', value: '', enabled: true }];
    const requestBody = resolveRef(spec, operation.requestBody);
    const content = requestBody.content || {};
    const jsonKey = Object.keys(content).find(c => /json/i.test(c));
    const formKey = Object.keys(content).find(c => /x-www-form-urlencoded|multipart/i.test(c));
    const textKey = Object.keys(content).find(c => /^text\//i.test(c) || /xml/i.test(c));

    if (jsonKey) {
        bodyType = 'json';
        const media = content[jsonKey];
        let example = firstExample(spec, media);
        if (example === undefined) example = exampleFromSchema(spec, media.schema);
        body = example === undefined || example === null ? '{}' : JSON.stringify(example, null, 2);
    } else if (formKey) {
        bodyType = 'form';
        const schema = resolveRef(spec, content[formKey].schema);
        const props = Object.entries(schema.properties || {});
        const example = firstExample(spec, content[formKey]);
        if (props.length) {
            formData = props.map(([name, prop]) => {
                const v = example && example[name] !== undefined
                    ? example[name]
                    : exampleFromSchema(spec, prop);
                return { key: name, value: scalarToString(v), enabled: true };
            });
        }
    } else if (textKey) {
        bodyType = 'raw';
        const example = firstExample(spec, content[textKey]);
        body = scalarToString(example);
    }

    // Auth: inherit unless the operation overrides security
    let auth = { type: 'inherit' };
    if (Array.isArray(operation.security)) {
        if (operation.security.length === 0) {
            auth = { type: 'none' };
        } else {
            const own = schemeFromRequirement(spec, operation.security);
            if (own && own.name !== collectionScheme) auth = authFromScheme(own.scheme);
        }
    }

    return {
        id: generateId(),
        name: operation.summary || operation.operationId || `${method.toUpperCase()} ${path}`,
        description: operation.description || '',
        method: method.toUpperCase(),
        url,
        headers,
        queryParams,
        body,
        bodyType,
        formData,
        auth,
        variables,
        scripts: emptyScripts()
    };
}

/* ---------------------------------------------------------------- main */

/**
 * @param {Object} spec parsed OpenAPI 3 document
 * @param {Object} [options]
 * @param {string|null} [options.baseUrl] value for the collection `baseUrl` variable;
 *        defaults to the first server URL, pass '' to leave it empty.
 * @param {string} [options.name] collection name (defaults to info.title)
 * @returns {Object} collection (without server-side fields)
 */
export function importOpenApi(spec, options = {}) {
    if (!spec || typeof spec !== 'object' || !spec.paths) {
        throw new Error('Not an OpenAPI document: "paths" is missing');
    }
    if (!/^3\./.test(String(spec.openapi || ''))) {
        throw new Error('Only OpenAPI 3.x is supported (found ' + (spec.openapi || spec.swagger || 'unknown') + ')');
    }

    const topRequirement = schemeFromRequirement(spec, spec.security);
    const collectionScheme = topRequirement ? topRequirement.name : null;
    const baseUrl = options.baseUrl !== undefined && options.baseUrl !== null ? options.baseUrl : serverUrl(spec);

    // Folders in the order the spec lists its tags, then by first use.
    const folders = new Map();
    const folderFor = tag => {
        if (!folders.has(tag)) {
            const folder = createFolder(tag);
            const meta = (spec.tags || []).find(t => t.name === tag);
            if (meta && meta.description) folder.description = meta.description;
            folders.set(tag, folder);
        }
        return folders.get(tag);
    };
    (spec.tags || []).forEach(t => folderFor(t.name));

    const rootRequests = [];
    Object.entries(spec.paths).forEach(([path, rawItem]) => {
        const pathItem = resolveRef(spec, rawItem);
        METHODS.forEach(method => {
            const operation = pathItem[method];
            if (!operation) return;
            const request = buildRequest(spec, path, method, operation, pathItem, collectionScheme);
            const tag = (operation.tags || [])[0];
            if (tag) folderFor(tag).requests.push(request);
            else rootRequests.push(request);
        });
    });

    return {
        name: options.name || spec.info?.title || 'Imported API',
        description: spec.info?.description || '',
        requests: rootRequests,
        folders: [...folders.values()].filter(f => f.requests.length > 0),
        auth: collectionScheme ? authFromScheme(topRequirement.scheme) : { type: 'none' },
        variables: [{ key: 'baseUrl', value: baseUrl, enabled: true }],
        scripts: emptyScripts(),
        source: { type: 'openapi', version: spec.openapi, apiVersion: spec.info?.version || '' }
    };
}
