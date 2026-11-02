/**
 * Script sandbox core.
 *
 * `runInSandbox` is self-contained on purpose: ScriptRunner stringifies it into a
 * Web Worker, and the same function runs directly under Node for tests.
 * Nothing in here touches the network, DOM or storage.
 *
 * ctx = {
 *   environment, collection, globals, temp: [{key,value,secret?,enabled?}],
 *   request:  { method, url, headers: {name: value}, body } | null,
 *   response: { code, status, headers, body, responseTime, size } | null,
 *   collectionName
 * }
 */
export async function runInSandbox(code, ctx) {
    const logs = [];
    const tests = [];
    const pending = [];

    const fmt = v => {
        if (typeof v === 'string') return v;
        try { return JSON.stringify(v); } catch (e) { return String(v); }
    };
    const log = level => (...args) => logs.push({ level, text: args.map(fmt).join(' ') });
    const console_ = { log: log('log'), info: log('info'), warn: log('warn'), error: log('error'), debug: log('log') };

    // ---- variable scopes ---------------------------------------------------
    const lists = {
        environment: (ctx.environment || []).map(v => ({ ...v })),
        collection: (ctx.collection || []).map(v => ({ ...v })),
        globals: (ctx.globals || []).map(v => ({ ...v })),
        temp: (ctx.temp || []).map(v => ({ ...v }))
    };
    const changed = { environment: false, collection: false, globals: false, temp: false };

    const scopeApi = name => ({
        get: key => { const v = lists[name].find(x => x.key === key && x.enabled !== false); return v ? v.value : undefined; },
        has: key => lists[name].some(x => x.key === key && x.enabled !== false),
        set: (key, value) => {
            const v = lists[name].find(x => x.key === key);
            if (v) { v.value = String(value); v.enabled = true; } else lists[name].push({ key, value: String(value), enabled: true, secret: false });
            changed[name] = true;
        },
        unset: key => { lists[name] = lists[name].filter(x => x.key !== key); changed[name] = true; },
        clear: () => { lists[name] = []; changed[name] = true; },
        toObject: () => Object.fromEntries(lists[name].filter(x => x.enabled !== false).map(x => [x.key, x.value]))
    });

    const order = ['temp', 'environment', 'collection', 'globals'];
    const variables = {
        get: key => { for (const n of order) { const v = scopeApi(n).get(key); if (v !== undefined) return v; } return undefined; },
        has: key => order.some(n => scopeApi(n).has(key)),
        set: (key, value) => scopeApi('temp').set(key, value),
        unset: key => scopeApi('temp').unset(key),
        toObject: () => Object.assign({}, ...[...order].reverse().map(n => scopeApi(n).toObject()))
    };

    // ---- request / response ------------------------------------------------
    const headerApi = obj => ({
        get: name => { const k = Object.keys(obj).find(x => x.toLowerCase() === String(name).toLowerCase()); return k === undefined ? undefined : obj[k]; },
        has: name => Object.keys(obj).some(x => x.toLowerCase() === String(name).toLowerCase()),
        set: (name, value) => {
            const k = Object.keys(obj).find(x => x.toLowerCase() === String(name).toLowerCase());
            obj[k === undefined ? name : k] = String(value);
        },
        remove: name => { Object.keys(obj).forEach(k => { if (k.toLowerCase() === String(name).toLowerCase()) delete obj[k]; }); },
        toObject: () => ({ ...obj })
    });

    const reqState = ctx.request ? { method: ctx.request.method, url: ctx.request.url, body: ctx.request.body, headers: { ...ctx.request.headers } } : null;
    let request = null;
    if (reqState) {
        request = { headers: headerApi(reqState.headers) };
        Object.defineProperty(request, 'method', { get: () => reqState.method, set: v => { reqState.method = String(v).toUpperCase(); }, enumerable: true });
        Object.defineProperty(request, 'url', { get: () => reqState.url, set: v => { reqState.url = String(v); }, enumerable: true });
        Object.defineProperty(request, 'body', { get: () => reqState.body, set: v => { reqState.body = v == null ? v : String(v); }, enumerable: true });
    }

    let response = null;
    if (ctx.response) {
        const r = ctx.response;
        const text = typeof r.body === 'string' ? r.body : fmt(r.body);
        response = {
            code: r.code, status: r.status, responseTime: r.responseTime, size: r.size,
            headers: headerApi({ ...(r.headers || {}) }),
            text: () => text,
            json: () => JSON.parse(text)
        };
    }

    // ---- expect (tiny chai-like) ------------------------------------------
    class AssertionError extends Error {}
    const deepEqual = (a, b) => {
        if (a === b) return true;
        if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false;
        if (Array.isArray(a) !== Array.isArray(b)) return false;
        const ka = Object.keys(a), kb = Object.keys(b);
        return ka.length === kb.length && ka.every(k => deepEqual(a[k], b[k]));
    };
    const typeOf = v => Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v;

    function expect(actual, negate = false, msg = '') {
        const a = { };
        const check = (pass, desc) => {
            if (negate ? pass : !pass) {
                throw new AssertionError((msg ? msg + ': ' : '') + 'expected ' + fmt(actual) + (negate ? ' not ' : ' ') + desc);
            }
        };
        const chain = ['to', 'be', 'been', 'is', 'that', 'which', 'and', 'has', 'have', 'with', 'at', 'of', 'same', 'does', 'still'];
        chain.forEach(w => Object.defineProperty(a, w, { get: () => a }));
        Object.defineProperty(a, 'not', { get: () => expect(actual, !negate, msg) });
        const flag = (name, fn, desc) => Object.defineProperty(a, name, { get: () => { check(fn(), desc); return a; } });
        flag('ok', () => !!actual, 'to be truthy');
        flag('true', () => actual === true, 'to be true');
        flag('false', () => actual === false, 'to be false');
        flag('null', () => actual === null, 'to be null');
        flag('undefined', () => actual === undefined, 'to be undefined');
        flag('exist', () => actual !== null && actual !== undefined, 'to exist');
        flag('empty', () => actual == null || (typeof actual === 'object' ? Object.keys(actual).length === 0 : String(actual).length === 0), 'to be empty');
        const m = (name, fn) => { a[name] = (...args) => { const [pass, desc] = fn(...args); check(pass, desc); return a; }; };
        m('equal', v => [actual === v, 'to equal ' + fmt(v)]);
        m('equals', v => [actual === v, 'to equal ' + fmt(v)]);
        m('eql', v => [deepEqual(actual, v), 'to deeply equal ' + fmt(v)]);
        m('below', n => [actual < n, 'to be below ' + n]);
        m('above', n => [actual > n, 'to be above ' + n]);
        m('least', n => [actual >= n, 'to be at least ' + n]);
        m('most', n => [actual <= n, 'to be at most ' + n]);
        m('a', t => [typeOf(actual) === t, 'to be a ' + t]);
        m('an', t => [typeOf(actual) === t, 'to be an ' + t]);
        m('lengthOf', n => [actual != null && actual.length === n, 'to have length ' + n]);
        m('match', re => [re.test(String(actual)), 'to match ' + re]);
        m('oneOf', list => [list.includes(actual), 'to be one of ' + fmt(list)]);
        m('include', v => [
            typeof actual === 'string' ? actual.includes(v)
                : Array.isArray(actual) ? actual.some(x => deepEqual(x, v))
                : actual && typeof v === 'object' ? Object.keys(v).every(k => deepEqual(actual[k], v[k])) : false,
            'to include ' + fmt(v)]);
        a.includes = a.include; a.contain = a.include; a.contains = a.include;
        m('property', (...pa) => {
            const [name, val] = pa;
            const has = actual != null && Object.prototype.hasOwnProperty.call(Object(actual), name);
            return [has && (pa.length < 2 || val === undefined || deepEqual(actual[name], val)),
                'to have property ' + name + (val === undefined ? '' : ' = ' + fmt(val))];
        });
        m('keys', (...ks) => { const list = Array.isArray(ks[0]) ? ks[0] : ks; return [actual != null && list.every(k => k in Object(actual)), 'to have keys ' + fmt(list)]; });
        m('status', code => [actual && (actual.code === code || actual.status === code), 'to have status ' + code + (actual && actual.code !== undefined ? ' (got ' + actual.code + ')' : '')]);
        return a;
    }

    // ---- test registration -------------------------------------------------
    const test = (name, fn) => {
        const record = (passed, error) => tests.push({ name: String(name), passed, error: error ? String(error.message || error) : '' });
        try {
            const out = fn();
            if (out && typeof out.then === 'function') {
                pending.push(out.then(() => record(true), e => record(false, e)));
            } else record(true);
        } catch (e) { record(false, e); }
    };

    const pb = {
        environment: scopeApi('environment'),
        collectionVariables: scopeApi('collection'),
        globals: scopeApi('globals'),
        variables,
        request, response,
        info: { collectionName: ctx.collectionName || '' },
        test, expect: (v, msg) => expect(v, false, msg)
    };

    // Strip everything that could reach the network or the page before user code runs.
    const g = typeof self !== 'undefined' ? self : globalThis;
    const blocked = ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'importScripts', 'indexedDB', 'caches', 'Worker', 'SharedWorker', 'BroadcastChannel', 'navigator'];
    const saved = {};
    if (typeof importScripts === 'function') {
        blocked.forEach(k => { try { saved[k] = g[k]; Object.defineProperty(g, k, { value: undefined, configurable: true, writable: true }); } catch (e) { /* ignore */ } });
    }

    let error = null;
    try {
        const fn = new Function('pb', 'pm', 'console', '"use strict";\n' + code);
        const result = fn(pb, pb, console_);
        if (result && typeof result.then === 'function') await result;
        await Promise.all(pending);
    } catch (e) {
        error = (e && e.message) ? e.name + ': ' + e.message : String(e);
    }

    if (typeof importScripts === 'function') {
        // The worker is discarded after one run, nothing to restore.
    }

    return {
        ok: !error,
        error,
        logs,
        tests,
        changes: {
            environment: changed.environment ? lists.environment : null,
            collection: changed.collection ? lists.collection : null,
            globals: changed.globals ? lists.globals : null,
            temp: changed.temp ? lists.temp : null
        },
        request: reqState
    };
}
