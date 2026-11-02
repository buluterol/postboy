<?php

/**
 * Global Variables API
 *
 * Endpoints:
 * - GET /api/globals.php  : list global variables
 * - PUT /api/globals.php  : replace global variables ({"variables": [{key, value, secret}]})
 */

require_once __DIR__ . '/../config/config.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    sendJson([
        'success' => true,
        'data' => readJsonFile('globals.json')
    ]);
}

if ($method === 'PUT') {
    $data = getRequestBody();

    if (!isset($data['variables']) || !is_array($data['variables'])) {
        sendError('Missing required field: variables');
    }

    $variables = [];
    foreach ($data['variables'] as $variable) {
        if (!is_array($variable) || !isset($variable['key']) || $variable['key'] === '') {
            continue;
        }
        $variables[] = [
            'key' => (string) $variable['key'],
            'value' => (string) ($variable['value'] ?? ''),
            'secret' => !empty($variable['secret'])
        ];
    }

    if (!writeJsonFile('globals.json', $variables)) {
        sendError('Failed to save globals', 500);
    }

    sendJson([
        'success' => true,
        'data' => $variables
    ]);
}

sendError('Method not allowed', 405);
