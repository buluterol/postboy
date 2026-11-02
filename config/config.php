<?php

/**
 * Postboy Configuration
 * 
 * Main configuration file for the application
 */

// Error reporting
error_reporting(E_ALL);
ini_set('display_errors', 1);

// CORS: the UI is served from the same origin, so only loopback origins and the
// host the app itself is served from are allowed. A foreign website must not be
// able to drive the proxy (it can reach internal addresses) or read local data.
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '') {
    $originHost = parse_url($origin, PHP_URL_HOST);
    $serverHost = parse_url('http://' . ($_SERVER['HTTP_HOST'] ?? ''), PHP_URL_HOST);
    $loopback = ['localhost', '127.0.0.1', '[::1]', '::1'];
    $allowed = $originHost && ($originHost === $serverHost || in_array($originHost, $loopback, true));
    if (!$allowed) {
        http_response_code(403);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['success' => false, 'error' => 'Origin not allowed']);
        exit();
    }
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
}

// Handle OPTIONS requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// JSON response header
header('Content-Type: application/json; charset=utf-8');

// Define constants
define('APP_ROOT', dirname(__DIR__));
define('DATA_DIR', APP_ROOT . '/data');
define('API_DIR', APP_ROOT . '/api');

// Ensure data directory exists
if (!is_dir(DATA_DIR)) {
    mkdir(DATA_DIR, 0755, true);
}

// Initialize data files if they don't exist
$dataFiles = [
    'collections.json' => [],
    'environments.json' => [],
    'history.json' => [],
    'globals.json' => []
];

foreach ($dataFiles as $filename => $defaultContent) {
    $filepath = DATA_DIR . '/' . $filename;
    if (!file_exists($filepath)) {
        file_put_contents($filepath, json_encode($defaultContent, JSON_PRETTY_PRINT));
    }
}

/**
 * Helper Functions
 */

/**
 * Read JSON file and return as array
 * 
 * @param string $filename Filename in data directory
 * @return array Decoded JSON data
 */
function readJsonFile($filename)
{
    $filepath = DATA_DIR . '/' . $filename;
    if (!file_exists($filepath)) {
        return [];
    }

    $content = file_get_contents($filepath);
    $data = json_decode($content, true);

    return $data ?: [];
}

/**
 * Write array to JSON file
 * 
 * @param string $filename Filename in data directory
 * @param array $data Data to write
 * @return bool Success status
 */
function writeJsonFile($filename, $data)
{
    $filepath = DATA_DIR . '/' . $filename;
    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

    return file_put_contents($filepath, $json) !== false;
}

/**
 * Send JSON response
 * 
 * @param mixed $data Response data
 * @param int $statusCode HTTP status code
 */
function sendJson($data, $statusCode = 200)
{
    http_response_code($statusCode);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit();
}

/**
 * Send error response
 * 
 * @param string $message Error message
 * @param int $statusCode HTTP status code
 */
function sendError($message, $statusCode = 400)
{
    sendJson([
        'error' => true,
        'message' => $message
    ], $statusCode);
}

/**
 * Get request body as array
 * 
 * @return array Request body data
 */
function getRequestBody()
{
    $body = file_get_contents('php://input');
    $data = json_decode($body, true);

    return $data ?: [];
}

/**
 * Generate unique ID
 * 
 * @return string Unique identifier
 */
function generateId()
{
    return uniqid('', true);
}

/**
 * Validate required fields
 * 
 * @param array $data Data to validate
 * @param array $requiredFields Required field names
 * @return bool|string True if valid, error message if invalid
 */
function validateRequired($data, $requiredFields)
{
    foreach ($requiredFields as $field) {
        if (!isset($data[$field]) || $data[$field] === '') {
            return "Missing required field: $field";
        }
    }
    return true;
}
