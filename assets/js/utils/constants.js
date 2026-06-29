/**
 * Constants
 * 
 * Application-wide constants
 */

export const HTTP_METHODS = [
    'GET',
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
    'HEAD',
    'OPTIONS'
];

export const CONTENT_TYPES = {
    JSON: 'application/json',
    FORM: 'application/x-www-form-urlencoded',
    MULTIPART: 'multipart/form-data',
    TEXT: 'text/plain',
    HTML: 'text/html',
    XML: 'application/xml'
};

export const AUTH_TYPES = {
    NONE: 'none',
    BEARER: 'bearer',
    BASIC: 'basic',
    API_KEY: 'apikey'
};

export const BODY_TYPES = {
    NONE: 'none',
    JSON: 'json',
    FORM: 'form',
    RAW: 'raw'
};

export const RESPONSE_FORMATS = {
    JSON: 'json',
    HTML: 'html',
    RAW: 'raw'
};

export const STATUS_CODE_CLASSES = {
    INFORMATIONAL: 1,
    SUCCESS: 2,
    REDIRECTION: 3,
    CLIENT_ERROR: 4,
    SERVER_ERROR: 5
};

export const METHOD_COLORS = {
    GET: 'method-get',
    POST: 'method-post',
    PUT: 'method-put',
    PATCH: 'method-patch',
    DELETE: 'method-delete',
    HEAD: 'method-head',
    OPTIONS: 'method-options'
};

export const API_ENDPOINTS = {
    COLLECTIONS: '/api/collections.php',
    ENVIRONMENTS: '/api/environments.php',
    HISTORY: '/api/history.php',
    PROXY: '/api/proxy.php'
};

export const EVENTS = {
    REQUEST_SENT: 'request:sent',
    RESPONSE_RECEIVED: 'response:received',
    COLLECTION_UPDATED: 'collection:updated',
    ENVIRONMENT_CHANGED: 'environment:changed',
    THEME_CHANGED: 'theme:changed',
    HISTORY_UPDATED: 'history:updated',
    REQUEST_LOADED: 'request:loaded'
};

export const STORAGE_KEYS = {
    THEME: 'postboy_theme',
    ACTIVE_ENVIRONMENT: 'postboy_active_environment',
    LAST_REQUEST: 'postboy_last_request'
};
