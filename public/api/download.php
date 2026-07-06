<?php
require_once __DIR__ . '/db_helper.php';

$token = isset($_GET['token']) ? trim($_GET['token']) : '';

if (empty($token)) {
    http_response_code(400);
    echo "<h1>Download token missing.</h1>";
    exit;
}

$db = readDB();
$now = time() * 1000; // milliseconds

// Clean expired tokens (older than now)
$activeTokens = [];
foreach ($db['tokens'] as $t) {
    if ($t['expiresAt'] > $now) {
        $activeTokens[] = $t;
    }
}
$db['tokens'] = $activeTokens;

// Find the token record
$tokenRecord = null;
$tokenIndex = -1;
foreach ($db['tokens'] as $idx => $t) {
    if ($t['token'] === $token) {
        $tokenRecord = $t;
        $tokenIndex = $idx;
        break;
    }
}

if (!$tokenRecord) {
    writeDB($db); // write back cleaned list
    http_response_code(403);
    echo "<h1>Download link is expired or invalid.</h1><p>Please contact support if you need assistance.</p>";
    exit;
}

if ($tokenRecord['downloadCount'] >= $tokenRecord['maxDownloads']) {
    http_response_code(403);
    echo "<h1>Download limit exceeded.</h1><p>You have already downloaded this file the maximum number of times.</p>";
    exit;
}

// Find bundle
$bundle = null;
$bundleIndex = -1;
foreach ($db['bundles'] as $idx => $b) {
    if ($b['id'] === $tokenRecord['bundleId']) {
        $bundle = $b;
        $bundleIndex = $idx;
        break;
    }
}

if (!$bundle) {
    http_response_code(404);
    echo "<h1>File not found.</h1>";
    exit;
}

// Update token stats and total download count
$db['tokens'][$tokenIndex]['downloadCount'] += 1;
if ($bundleIndex !== -1) {
    $db['bundles'][$bundleIndex]['downloads'] = (isset($db['bundles'][$bundleIndex]['downloads']) ? $db['bundles'][$bundleIndex]['downloads'] : 0) + 1;
}
writeDB($db);

// If Google Drive link is configured, redirect directly to it
if (!empty($bundle['driveUrl'])) {
    header("Location: " . $bundle['driveUrl']);
    exit;
}

// Otherwise stream the local file (fallback)
$filePath = __DIR__ . '/../../uploads/bundles/' . $bundle['fileName']; // Root directory uploads
if (!file_exists($filePath)) {
    $filePath = __DIR__ . '/../uploads/bundles/' . $bundle['fileName']; // public directory uploads fallback
}
if (!file_exists($filePath)) {
    http_response_code(404);
    echo "<h1>Course file does not exist on the server.</h1>";
    exit;
}

// Stream download
header('Content-Description: File Transfer');
header('Content-Type: application/octet-stream');
header('Content-Disposition: attachment; filename="' . basename($bundle['originalName']) . '"');
header('Content-Transfer-Encoding: binary');
header('Expires: 0');
header('Cache-Control: must-revalidate');
header('Pragma: public');
header('Content-Length: ' . filesize($filePath));

readfile($filePath);
exit;
