<?php

/**
 * Collections API
 * 
 * CRUD operations for request collections
 * 
 * Endpoints:
 * - GET    /api/collections.php          - List all collections
 * - POST   /api/collections.php          - Create new collection
 * - PUT    /api/collections.php?id={id}  - Update collection
 * - DELETE /api/collections.php?id={id}  - Delete collection
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

    case 'PUT':
        handlePut();
        break;

    case 'DELETE':
        handleDelete();
        break;

    default:
        sendError('Method not allowed', 405);
}

/**
 * GET - List all collections
 */
function handleGet()
{
    $collections = readJsonFile('collections.json');
    sendJson([
        'success' => true,
        'data' => $collections
    ]);
}

/**
 * POST - Create new collection
 */
function handlePost()
{
    $data = getRequestBody();

    // Validate required fields
    $validation = validateRequired($data, ['name']);
    if ($validation !== true) {
        sendError($validation);
    }

    // Create new collection
    $collection = [
        'id' => generateId(),
        'name' => $data['name'],
        'description' => $data['description'] ?? '',
        'requests' => $data['requests'] ?? [],
        'createdAt' => date('c'),
        'updatedAt' => date('c')
    ];

    // Add to collections
    $collections = readJsonFile('collections.json');
    $collections[] = $collection;

    if (writeJsonFile('collections.json', $collections)) {
        sendJson([
            'success' => true,
            'message' => 'Collection created successfully',
            'data' => $collection
        ], 201);
    } else {
        sendError('Failed to create collection', 500);
    }
}

/**
 * PUT - Update collection
 */
function handlePut()
{
    $id = $_GET['id'] ?? null;

    if (!$id) {
        sendError('Collection ID is required');
    }

    $data = getRequestBody();
    $collections = readJsonFile('collections.json');
    $found = false;

    // Find and update collection
    foreach ($collections as &$collection) {
        if ($collection['id'] === $id) {
            $collection['name'] = $data['name'] ?? $collection['name'];
            $collection['description'] = $data['description'] ?? $collection['description'];
            $collection['requests'] = $data['requests'] ?? $collection['requests'];
            $collection['updatedAt'] = date('c');
            $found = true;
            break;
        }
    }

    if (!$found) {
        sendError('Collection not found', 404);
    }

    if (writeJsonFile('collections.json', $collections)) {
        sendJson([
            'success' => true,
            'message' => 'Collection updated successfully',
            'data' => $collection
        ]);
    } else {
        sendError('Failed to update collection', 500);
    }
}

/**
 * DELETE - Delete collection
 */
function handleDelete()
{
    $id = $_GET['id'] ?? null;

    if (!$id) {
        sendError('Collection ID is required');
    }

    $collections = readJsonFile('collections.json');
    $originalCount = count($collections);

    // Filter out the collection to delete
    $collections = array_filter($collections, function ($collection) use ($id) {
        return $collection['id'] !== $id;
    });

    // Re-index array
    $collections = array_values($collections);

    if (count($collections) === $originalCount) {
        sendError('Collection not found', 404);
    }

    if (writeJsonFile('collections.json', $collections)) {
        sendJson([
            'success' => true,
            'message' => 'Collection deleted successfully'
        ]);
    } else {
        sendError('Failed to delete collection', 500);
    }
}
