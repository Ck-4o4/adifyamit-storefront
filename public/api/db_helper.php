<?php
// Set headers for JSON responses and CORS
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Parse .env file manually to support spaces/quotes and ignore comments
function getEnvConfig() {
    static $env = null;
    if ($env === null) {
        $env = [];
        $envFile = __DIR__ . '/../../.env'; // Root directory
        if (!file_exists($envFile)) {
            $envFile = __DIR__ . '/../.env'; // public directory fallback
        }
        if (file_exists($envFile)) {
            $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            foreach ($lines as $line) {
                $line = trim($line);
                if (empty($line) || strpos($line, '#') === 0) continue;
                
                $parts = explode('=', $line, 2);
                if (count($parts) === 2) {
                    $key = trim($parts[0]);
                    $value = trim($parts[1]);
                    // Strip quotes if present
                    if (preg_match('/^"([^"]*)"$/', $value, $matches) || preg_match('/^\'([^\']*)\'$/', $value, $matches)) {
                        $value = $matches[1];
                    }
                    $env[$key] = $value;
                }
            }
        }
    }
    return $env;
}

function getEnvValue($key, $default = '') {
    $env = getEnvConfig();
    return isset($env[$key]) ? $env[$key] : $default;
}

// DB helper functions using db.json
function getDBFilePath() {
    $rootFile = __DIR__ . '/../../db.json';
    if (file_exists($rootFile) || is_writable(dirname($rootFile))) {
        return $rootFile;
    }
    return __DIR__ . '/../db.json';
}

function readDB() {
    $dataFile = getDBFilePath();
    if (!file_exists($dataFile)) {
        $initialData = ['bundles' => [], 'purchases' => [], 'tokens' => []];
        file_put_contents($dataFile, json_encode($initialData, JSON_PRETTY_PRINT), LOCK_EX);
        return $initialData;
    }
    $raw = file_get_contents($dataFile);
    $data = json_decode($raw, true);
    return is_array($data) ? $data : ['bundles' => [], 'purchases' => [], 'tokens' => []];
}

function writeDB($data) {
    $dataFile = getDBFilePath();
    file_put_contents($dataFile, json_encode($data, JSON_PRETTY_PRINT), LOCK_EX);
}

// Generate UUID v4
function generateUUID() {
    return sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
        mt_rand(0, 0xffff), mt_rand(0, 0xffff),
        mt_rand(0, 0xffff),
        mt_rand(0, 0x0fff) | 0x4000,
        mt_rand(0, 0x3fff) | 0x8000,
        mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
    );
}
