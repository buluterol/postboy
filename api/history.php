<?php
/**
 * History API
 * 
 * Manage request history
 * 
 * Endpoints:
 * - GET    /api/history.php         - List request history
 * - POST   /api/history.php         - Add request to history
 * - DELETE /api/history.php         - Clear all history
 * - DELETE /api/history.php?id={id} - Delete specific history item
 */

require_once __DIR__ . '/../config/config.php';

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        handleGet();
        break;
    
    case 'POST':
        handlePost();
        break;
    
    case 'DELETE':
        handleDelete();
        break;
    
    default:
        sendError('Method not allowed', 405);
}

/**
 * GET - List request history
 */
function handleGet() {
    $history = readJsonFile('history.json');
    
    // Sort by timestamp descending (newest first)
    usort($history, function($a, $b) {
        return strtotime($b['timestamp']) - strtotime($a['timestamp']);
    });
    
    // Limit to last 100 items
    $history = array_slice($history, 0, 100);
    
    sendJson([
        'success' => true,
        'data' => $history
    ]);
}

/**
 * POST - Add request to history
 */
function handlePost() {
    $data = getRequestBody();
    
    // Validate required fields
    $validation = validateRequired($data, ['method', 'url']);
    if ($validation !== true) {
        sendError($validation);
    }
    
    // Create history entry
    $entry = [
        'id' => generateId(),
        'method' => $data['method'],
        'url' => $data['url'],
        'status' => $data['status'] ?? null,
        'responseTime' => $data['responseTime'] ?? null,
        'timestamp' => date('c')
    ];
    
    // Add to history
    $history = readJsonFile('history.json');
    array_unshift($history, $entry); // Add to beginning
    
    // Keep only last 100 items
    $history = array_slice($history, 0, 100);
    
    if (writeJsonFile('history.json', $history)) {
        sendJson([
            'success' => true,
            'message' => 'Added to history',
            'data' => $entry
        ], 201);
    } else {
        sendError('Failed to add to history', 500);
    }
}

/**
 * DELETE - Clear history or delete specific item
 */
function handleDelete() {
    $id = $_GET['id'] ?? null;
    
    if ($id) {
        // Delete specific item
        $history = readJsonFile('history.json');
        $originalCount = count($history);
        
        $history = array_filter($history, function($item) use ($id) {
            return $item['id'] !== $id;
        });
        
        $history = array_values($history);
        
        if (count($history) === $originalCount) {
            sendError('History item not found', 404);
        }
        
        if (writeJsonFile('history.json', $history)) {
            sendJson([
                'success' => true,
                'message' => 'History item deleted'
            ]);
        } else {
            sendError('Failed to delete history item', 500);
        }
    } else {
        // Clear all history
        if (writeJsonFile('history.json', [])) {
            sendJson([
                'success' => true,
                'message' => 'History cleared'
            ]);
        } else {
            sendError('Failed to clear history', 500);
        }
    }
}
