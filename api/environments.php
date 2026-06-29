<?php

/**
 * Environments API
 * 
 * CRUD operations for environment variables
 * 
 * Endpoints:
 * - GET    /api/environments.php          - List all environments
 * - POST   /api/environments.php          - Create new environment
 * - PUT    /api/environments.php?id={id}  - Update environment
 * - DELETE /api/environments.php?id={id}  - Delete environment
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
 * GET - List all environments
 */
function handleGet()
{
    $environments = readJsonFile('environments.json');
    sendJson([
        'success' => true,
        'data' => $environments
    ]);
}

/**
 * POST - Create new environment
 */
function handlePost()
{
    $data = getRequestBody();

    // Validate required fields
    $validation = validateRequired($data, ['name']);
    if ($validation !== true) {
        sendError($validation);
    }

    // Create new environment
    $environment = [
        'id' => generateId(),
        'name' => $data['name'],
        'variables' => $data['variables'] ?? [],
        'isActive' => $data['isActive'] ?? false,
        'createdAt' => date('c'),
        'updatedAt' => date('c')
    ];

    // If this is set as active, deactivate others
    $environments = readJsonFile('environments.json');
    if ($environment['isActive']) {
        foreach ($environments as &$env) {
            $env['isActive'] = false;
        }
    }

    $environments[] = $environment;

    if (writeJsonFile('environments.json', $environments)) {
        sendJson([
            'success' => true,
            'message' => 'Environment created successfully',
            'data' => $environment
        ], 201);
    } else {
        sendError('Failed to create environment', 500);
    }
}

/**
 * PUT - Update environment
 */
function handlePut()
{
    $id = $_GET['id'] ?? null;

    if (!$id) {
        sendError('Environment ID is required');
    }

    $data = getRequestBody();
    $environments = readJsonFile('environments.json');
    $found = false;

    // If setting this as active, deactivate others
    if (isset($data['isActive']) && $data['isActive']) {
        foreach ($environments as &$env) {
            $env['isActive'] = false;
        }
    }

    // Find and update environment
    foreach ($environments as &$environment) {
        if ($environment['id'] === $id) {
            $environment['name'] = $data['name'] ?? $environment['name'];
            $environment['variables'] = $data['variables'] ?? $environment['variables'];
            if (isset($data['isActive'])) {
                $environment['isActive'] = $data['isActive'];
            }
            $environment['updatedAt'] = date('c');
            $found = true;
            break;
        }
    }

    if (!$found) {
        sendError('Environment not found', 404);
    }

    if (writeJsonFile('environments.json', $environments)) {
        sendJson([
            'success' => true,
            'message' => 'Environment updated successfully',
            'data' => $environment
        ]);
    } else {
        sendError('Failed to update environment', 500);
    }
}

/**
 * DELETE - Delete environment
 */
function handleDelete()
{
    $id = $_GET['id'] ?? null;

    if (!$id) {
        sendError('Environment ID is required');
    }

    $environments = readJsonFile('environments.json');
    $originalCount = count($environments);

    // Filter out the environment to delete
    $environments = array_filter($environments, function ($environment) use ($id) {
        return $environment['id'] !== $id;
    });

    // Re-index array
    $environments = array_values($environments);

    if (count($environments) === $originalCount) {
        sendError('Environment not found', 404);
    }

    if (writeJsonFile('environments.json', $environments)) {
        sendJson([
            'success' => true,
            'message' => 'Environment deleted successfully'
        ]);
    } else {
        sendError('Failed to delete environment', 500);
    }
}
