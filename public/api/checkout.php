<?php
require_once __DIR__ . '/db_helper.php';

// Parse POST body (JSON)
$input = json_decode(file_get_contents('php://input'), true);
if (empty($input)) {
    $input = $_POST;
}

$bundleId = isset($input['bundleId']) ? trim($input['bundleId']) : '';
$email = isset($input['email']) ? trim($input['email']) : '';
$name = isset($input['name']) ? trim($input['name']) : '';

if (empty($bundleId)) {
    http_response_code(400);
    echo json_encode(['error' => 'Bundle ID is required.']);
    exit;
}

$db = readDB();
$bundle = null;
foreach ($db['bundles'] as $b) {
    if ($b['id'] === $bundleId) {
        $bundle = $b;
        break;
    }
}

if (!$bundle) {
    http_response_code(404);
    echo json_encode(['error' => 'Bundle not found.']);
    exit;
}

$phonepeMID = getEnvValue('PHONEPE_MID');
$phonepeSaltKey = getEnvValue('PHONEPE_SALT_KEY'); // Client Secret
$phonepeSaltIndex = getEnvValue('PHONEPE_SALT_INDEX', '1'); // Client Version
$phonepeHost = getEnvValue('PHONEPE_HOST', 'https://api.phonepe.com/apis/pg');

if (empty($phonepeMID) || empty($phonepeSaltKey)) {
    http_response_code(500);
    echo json_encode(['error' => 'Payment gateway credentials are not configured on the server.']);
    exit;
}

try {
    // 1. Fetch OAuth Token from PhonePe
    $isSandbox = (strpos($phonepeHost, 'pg-sandbox') !== false);
    $tokenUrl = $isSandbox 
      ? "https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token"
      : "https://api.phonepe.com/apis/identity-manager/v1/oauth/token";

    $tokenFields = [
        'client_id' => $phonepeMID,
        'client_secret' => $phonepeSaltKey,
        'client_version' => $phonepeSaltIndex,
        'grant_type' => 'client_credentials'
    ];

    $ch = curl_init($tokenUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($tokenFields));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/x-www-form-urlencoded'
    ]);

    $tokenResponse = curl_exec($ch);
    $tokenErr = curl_error($ch);
    curl_close($ch);

    if ($tokenErr) {
        throw new Exception("Token generation cURL error: " . $tokenErr);
    }

    $tokenData = json_decode($tokenResponse, true);
    $accessToken = isset($tokenData['access_token']) ? $tokenData['access_token'] : '';

    if (empty($accessToken)) {
        throw new Exception("Access token missing in token response: " . $tokenResponse);
    }

    // 2. Initiate Payment (Create Order)
    $merchantOrderId = 'ORD' . time();
    $amountInPaise = round($bundle['price'] * 100);

    // Robust protocol detection behind reverse proxy
    $protocol = 'http';
    if (!empty($_SERVER['HTTP_X_FORWARDED_PROTO'])) {
        $protocol = $_SERVER['HTTP_X_FORWARDED_PROTO'];
    } elseif (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') {
        $protocol = 'https';
    } elseif (!empty($_SERVER['HTTP_REFERER']) && strpos($_SERVER['HTTP_REFERER'], 'https') === 0) {
        $protocol = 'https';
    } elseif (!empty($_SERVER['HTTP_ORIGIN']) && strpos($_SERVER['HTTP_ORIGIN'], 'https') === 0) {
        $protocol = 'https';
    }
    $host = $_SERVER['HTTP_HOST'];
    $redirectUrl = "$protocol://$host/api/phonepe/callback?bundleId=" . urlencode($bundle['id']) . "&email=" . urlencode($email ?: 'guest@example.com') . "&name=" . urlencode($name ?: 'Guest Customer') . "&merchantOrderId=" . urlencode($merchantOrderId);

    $payUrl = $phonepeHost . "/checkout/v2/pay";
    $payPayload = [
        'merchantOrderId' => $merchantOrderId,
        'amount' => $amountInPaise,
        'expireAfter' => 1200,
        'paymentFlow' => [
            'type' => 'PG_CHECKOUT',
            'merchantUrls' => [
                'redirectUrl' => $redirectUrl
            ]
        ],
        'disablePaymentRetry' => true
    ];

    $ch = curl_init($payUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payPayload, JSON_UNESCAPED_SLASHES));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        "Authorization: O-Bearer $accessToken"
    ]);

    $payResponse = curl_exec($ch);
    $payErr = curl_error($ch);
    curl_close($ch);

    if ($payErr) {
        throw new Exception("Pay initiation cURL error: " . $payErr);
    }

    $resData = json_decode($payResponse, true);
    if (isset($resData['redirectUrl'])) {
        echo json_encode([
            'success' => true,
            'redirectUrl' => $resData['redirectUrl']
        ]);
        exit;
    } else {
        http_response_code(400);
        echo json_encode(['error' => isset($resData['message']) ? $resData['message'] : 'Failed to initialize payment with PhonePe V2.']);
        exit;
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Payment gateway error: ' . $e->getMessage()]);
    exit;
}
