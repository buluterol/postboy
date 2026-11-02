/**
 * cURL export / import
 *
 * toCurl() keeps {{variables}} as written, so a copied command never carries
 * a resolved secret. parseCurl() reads a pasted command into a request model.
 */

import { prepareRequestData } from '../services/RequestPipeline.js';

const q = s => `'${String(s).replace(/'/g, `'\\''`)}'`;

/** @returns {string} multi-line curl command for a request model */
export function toCurl(request, chain = []) {
    const data = prepareRequestData(request, [], chain);
    const headers = { ...data.headers };
    let url = data.url;
    const a = data.auth;
    if (a) {
        if (a.type === 'bearer') headers.Authorization = `Bearer ${a.token || ''}`;
        else if (a.type === 'apikey' && a.key) {
            if (a.addTo === 'query') url += (url.includes('?') ? '&' : '?') + `${encodeURIComponent(a.key)}=${encodeURIComponent(a.value || '')}`;
            else headers[a.key] = a.value || '';
        }
    }
    const parts = [`curl${data.method === 'GET' ? '' : ' -X ' + data.method} ${q(url)}`];
    if (a?.type === 'basic') parts.push(`-u ${q(`${a.username || ''}:${a.password || ''}`)}`);
    Object.entries(headers).forEach(([k, v]) => parts.push(`-H ${q(`${k}: ${v}`)}`));
    if (data.body) parts.push(`--data-raw ${q(data.body)}`);
    return parts.join(' \\\n  ');
}

/** Split a shell-ish command line into words (quotes, backslash escapes, line continuations). */
export function tokenize(text) {
    const src = text.replace(/\\\r?\n/g, ' ');
    const out = [];
    let cur = '', has = false, i = 0;
    while (i < src.length) {
        const c = src[i];
        if (c === "'") {
            const end = src.indexOf("'", i + 1);
            cur += src.slice(i + 1, end < 0 ? src.length : end); has = true; i = end < 0 ? src.length : end + 1;
        } else if (c === '"') {
            i++; has = true;
            while (i < src.length && src[i] !== '"') {
                if (src[i] === '\\' && /["\\$`]/.test(src[i + 1] || '')) i++;
                cur += src[i++];
            }
            i++;
        } else if (c === '\\' && i + 1 < src.length) { cur += src[i + 1]; has = true; i += 2; }
        else if (/\s/.test(c)) { if (has) { out.push(cur); cur = ''; has = false; } i++; }
        else { cur += c; has = true; i++; }
    }
    if (has) out.push(cur);
    return out;
}

export function looksLikeCurl(text) { return /^\s*curl\s/i.test(text || ''); }

const WITH_VALUE = new Set(['-X', '--request', '-H', '--header', '-d', '--data', '--data-raw', '--data-binary', '--data-ascii',
    '--data-urlencode', '-u', '--user', '--url', '--json', '-A', '--user-agent', '-b', '--cookie', '-e', '--referer',
    '-o', '--output', '-m', '--max-time', '--connect-timeout', '-x', '--proxy', '-F', '--form']);

/** @returns {object|null} partial request model {method,url,headers,queryParams,body,bodyType,formData,auth} */
export function parseCurl(text) {
    if (!looksLikeCurl(text)) return null;
    const t = tokenize(text.trim()).slice(1);
    let method = '', url = '', body = null, getMode = false, auth = null;
    const headers = [], dataParts = [];
    for (let i = 0; i < t.length; i++) {
        let tok = t[i], val = null;
        const eq = tok.startsWith('--') ? tok.indexOf('=') : -1;
        if (eq > 0) { val = tok.slice(eq + 1); tok = tok.slice(0, eq); }
        if (WITH_VALUE.has(tok) && val === null) val = t[++i] ?? '';
        switch (tok) {
            case '-X': case '--request': method = val.toUpperCase(); break;
            case '-H': case '--header': {
                const k = val.indexOf(':');
                if (k > 0) headers.push({ key: val.slice(0, k).trim(), value: val.slice(k + 1).trim(), enabled: true });
                break;
            }
            case '-d': case '--data': case '--data-raw': case '--data-binary': case '--data-ascii': dataParts.push(val); break;
            case '--data-urlencode': dataParts.push(val); break;
            case '--json': dataParts.push(val); headers.push({ key: 'Content-Type', value: 'application/json', enabled: true }); break;
            case '-u': case '--user': { const k = val.indexOf(':'); auth = { type: 'basic', username: k < 0 ? val : val.slice(0, k), password: k < 0 ? '' : val.slice(k + 1) }; break; }
            case '--url': url = val; break;
            case '-G': case '--get': getMode = true; break;
            case '-A': case '--user-agent': headers.push({ key: 'User-Agent', value: val, enabled: true }); break;
            case '-b': case '--cookie': headers.push({ key: 'Cookie', value: val, enabled: true }); break;
            default:
                if (!tok.startsWith('-') && !url) url = tok;
        }
    }
    if (!url) return null;
    if (dataParts.length) body = dataParts.join('&');
    if (!method) method = body !== null && !getMode ? 'POST' : 'GET';

    let queryParams = [];
    if (getMode && body) { url += (url.includes('?') ? '&' : '?') + body; body = null; }

    // Bearer header -> auth, so the Auth tab shows it
    const authIdx = headers.findIndex(h => h.key.toLowerCase() === 'authorization' && /^bearer\s/i.test(h.value));
    if (authIdx >= 0 && !auth) { auth = { type: 'bearer', token: headers[authIdx].value.replace(/^bearer\s+/i, '') }; headers.splice(authIdx, 1); }

    const ct = (headers.find(h => h.key.toLowerCase() === 'content-type')?.value || '').toLowerCase();
    let bodyType = 'none', formData = [];
    if (body !== null) {
        if (ct.includes('x-www-form-urlencoded')) {
            bodyType = 'form';
            formData = body.split('&').filter(Boolean).map(p => {
                const k = p.indexOf('=');
                const dec = s => { try { return decodeURIComponent(s.replace(/\+/g, ' ')); } catch (e) { return s; } };
                return { key: dec(k < 0 ? p : p.slice(0, k)), value: k < 0 ? '' : dec(p.slice(k + 1)), enabled: true };
            });
            body = '';
        } else bodyType = ct.includes('json') || /^\s*[{[]/.test(body) ? 'json' : 'raw';
    }
    return { method, url, headers, queryParams, body: body ?? '', bodyType, formData, auth: auth || { type: 'none' } };
}
