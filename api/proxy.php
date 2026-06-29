<?php

/**
 * HTTP Proxy API
 * 
 * Proxies HTTP requests to external APIs to bypass CORS restrictions
 * 
 * Endpoint:
 * - POST /api/proxy.php
 * 
 * Request body:
 * {
 *   "method": "GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS",
 *   "url": "https://api.example.com/endpoint",
 *   "headers": {"Header-Name": "value"},
 *   "body": "request body content",
 *   "auth": {
 *     "type": "bearer|basic|apikey",
 *     "token": "...",
 *     "username": "...",
 *     "password": "...",
 *     "key": "...",
 *     "value": "...",
 *     "addTo": "header|query"
 *   }
 * }
 */

require_once __DIR__ . '/../config/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendError('Only POST method is allowed', 405);
}

$data = getRequestBody();

// Validate required fields
$validation = validateRequired($data, ['method', 'url']);
if ($validation !== true) {
    sendError($validation);
}

$method = strtoupper($data['method']);
$url = $data['url'];
$headers = $data['headers'] ?? [];
$body = $data['body'] ?? null;
$auth = $data['auth'] ?? null;

// Validate URL
if (!filter_var($url, FILTER_VALIDATE_URL)) {
    sendError('Invalid URL provided');
}

// Validate HTTP method
$allowedMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
if (!in_array($method, $allowedMethods)) {
    sendError('Invalid HTTP method');
}

// Process authentication
if ($auth && isset($auth['type'])) {
    switch ($auth['type']) {
        case 'bearer':
            if (isset($auth['token'])) {
                $headers['Authorization'] = 'Bearer ' . $auth['token'];
            }
            break;

        case 'basic':
            if (isset($auth['username']) && isset($auth['password'])) {
                $credentials = base64_encode($auth['username'] . ':' . $auth['password']);
                $headers['Authorization'] = 'Basic ' . $credentials;
            }
            break;

        case 'apikey':
            if (isset($auth['key']) && isset($auth['value'])) {
                $addTo = $auth['addTo'] ?? 'header';
                if ($addTo === 'header') {
                    $headers[$auth['key']] = $auth['value'];
                } elseif ($addTo === 'query') {
                    $separator = strpos($url, '?') !== false ? '&' : '?';
                    $url .= $separator . urlencode($auth['key']) . '=' . urlencode($auth['value']);
                }
            }
            break;
    }
}

// Initialize cURL
$ch = curl_init();

// Set cURL options
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HEADER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_MAXREDIRS, 5);
curl_setopt($ch, CURLOPT_TIMEOUT, 30);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);

// Set headers
$curlHeaders = [];
foreach ($headers as $key => $value) {
    $curlHeaders[] = "$key: $value";
}
if (!empty($curlHeaders)) {
    curl_setopt($ch, CURLOPT_HTTPHEADER, $curlHeaders);
}

// Set body for methods that support it
if (in_array($method, ['POST', 'PUT', 'PATCH']) && $body !== null) {
    curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
}

// Execute request
$startTime = microtime(true);
$response = curl_exec($ch);
$endTime = microtime(true);

// Calculate response time
$responseTime = round(($endTime - $startTime) * 1000); // in milliseconds

// Check for cURL errors
if (curl_errno($ch)) {
    $error = curl_error($ch);
    curl_close($ch);
    sendError('Request failed: ' . $error, 500);
}

// Get response info
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
$contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);

curl_close($ch);

// Split headers and body
$responseHeaders = substr($response, 0, $headerSize);
$responseBody = substr($response, $headerSize);

// Parse response headers
$parsedHeaders = [];
$headerLines = explode("\r\n", $responseHeaders);
foreach ($headerLines as $line) {
    if (strpos($line, ':') !== false) {
        list($key, $value) = explode(':', $line, 2);
        $parsedHeaders[trim($key)] = trim($value);
    }
}

// Try to detect if response is JSON
$isJson = false;
if ($contentType && strpos($contentType, 'application/json') !== false) {
    $isJson = true;
} else {
    // Try to decode as JSON
    $decoded = json_decode($responseBody);
    if (json_last_error() === JSON_ERROR_NONE) {
        $isJson = true;
    }
}

// Prepare response
$result = [
    'success' => true,
    'status' => $httpCode,
    'statusText' => getHttpStatusText($httpCode),
    'headers' => $parsedHeaders,
    'body' => $responseBody,
    'isJson' => $isJson,
    'responseTime' => $responseTime,
    'contentType' => $contentType ?: 'text/plain'
];

sendJson($result);

/**
 * Get HTTP status text
 * 
 * @param int $code HTTP status code
 * @return string Status text
 */
function getHttpStatusText($code)
{
    $statusTexts = [
        200 => 'OK',
        201 => 'Created',
        204 => 'No Content',
        301 => 'Moved Permanently',
        302 => 'Found',
        304 => 'Not Modified',
        400 => 'Bad Request',
        401 => 'Unauthorized',
        403 => 'Forbidden',
        404 => 'Not Found',
        405 => 'Method Not Allowed',
        409 => 'Conflict',
        422 => 'Unprocessable Entity',
        429 => 'Too Many Requests',
        500 => 'Internal Server Error',
        502 => 'Bad Gateway',
        503 => 'Service Unavailable',
        504 => 'Gateway Timeout'
    ];

    return $statusTexts[$code] ?? 'Unknown Status';
}
