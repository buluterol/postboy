/**
 * Collection Tree helpers
 *
 * A collection is a tree:
 *   collection { requests[], folders[] }
 *   folder     { id, name, requests[], folders[], auth, variables, scripts }
 * Collections and folders share the same shape, so the helpers below treat them
 * as "nodes". Older collections without `folders` keep working.
 */

import { generateId } from './helpers.js';

export const AUTH_INHERIT = 'inherit';

export function emptyScripts() {
    return { preRequest: '', test: '' };
}

export function createFolder(name = 'New Folder') {
    return {
        id: generateId(),
        name,
        requests: [],
        folders: [],
        auth: { type: AUTH_INHERIT },
        variables: [],
        scripts: emptyScripts()
    };
}

/** Make sure a node has every array/object the rest of the app expects. */
export function normalizeNode(node) {
    node.requests = node.requests || [];
    node.folders = node.folders || [];
    node.variables = node.variables || [];
    node.scripts = { ...emptyScripts(), ...(node.scripts || {}) };
    node.auth = node.auth || { type: 'none' };
    node.folders.forEach(normalizeNode);
    return node;
}

/**
 * Visit every request depth-first (folders first, like the sidebar renders them).
 * @param {Object} node collection or folder
 * @param {(request: Object, chain: Object[]) => void} fn chain = [collection, ...folders]
 */
export function walkRequests(node, fn, chain = [node]) {
    (node.folders || []).forEach(folder => walkRequests(folder, fn, [...chain, folder]));
    (node.requests || []).forEach(request => fn(request, chain));
}

/** Flat list of {request, chain} for a node, in run order. */
export function listRequests(node, chain = [node]) {
    const out = [];
    walkRequests(node, (request, c) => out.push({ request, chain: c }), chain);
    return out;
}

/** @returns {{request: Object, chain: Object[]}|null} */
export function findRequest(collection, requestId) {
    let found = null;
    walkRequests(collection, (request, chain) => {
        if (!found && request.id === requestId) found = { request, chain };
    });
    return found;
}

/** @returns {{folder: Object, chain: Object[]}|null} */
export function findFolder(collection, folderId, chain = [collection]) {
    for (const folder of collection.folders || []) {
        const next = [...chain, folder];
        if (folder.id === folderId) return { folder, chain: next };
        const nested = findFolder(folder, folderId, next);
        if (nested) return nested;
    }
    return null;
}

/** Find the node (collection or folder) with this id inside a collection. */
export function findNode(collection, nodeId) {
    if (collection.id === nodeId) return { node: collection, chain: [collection] };
    const hit = findFolder(collection, nodeId);
    return hit ? { node: hit.folder, chain: hit.chain } : null;
}

export function countRequests(node) {
    let n = (node.requests || []).length;
    (node.folders || []).forEach(f => { n += countRequests(f); });
    return n;
}

/** "Users / List" style label for a request's position. */
export function pathLabel(chain, request) {
    return [...chain.slice(1).map(n => n.name), request.name || request.url].join(' / ');
}
