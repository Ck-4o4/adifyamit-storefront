<?php
require_once __DIR__ . '/db_helper.php';

$db = readDB();

$requestUri = $_SERVER['REQUEST_URI'];
$path = parse_url($requestUri, PHP_URL_PATH);
$isSingular = (preg_match('/\/api\/bundle$/', $path) === 1);

if (empty($db['bundles'])) {
    http_response_code(404);
    echo json_encode(['error' => 'No course bundles available yet. Please upload one in the admin dashboard.']);
    exit;
}

if ($isSingular) {
    // Return latest bundle (singular)
    $latest = end($db['bundles']);
    echo json_encode([
        'id' => $latest['id'],
        'title' => $latest['title'],
        'description' => $latest['description'],
        'price' => $latest['price'],
        'features' => $latest['features'],
        'coverImage' => $latest['coverImage'] ? '/uploads/covers/' . basename($latest['coverImage']) : null,
        'uploadDate' => $latest['uploadDate']
    ]);
} else {
    // Return all bundles
    $publicBundles = array_map(function($b) {
        return [
            'id' => $b['id'],
            'title' => $b['title'],
            'description' => $b['description'],
            'price' => $b['price'],
            'features' => $b['features'],
            'coverImage' => $b['coverImage'] ? '/uploads/covers/' . basename($b['coverImage']) : null,
            'uploadDate' => $b['uploadDate']
        ];
    }, $db['bundles']);
    echo json_encode($publicBundles);
}
