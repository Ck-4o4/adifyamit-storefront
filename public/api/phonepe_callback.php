<?php
require_once __DIR__ . '/db_helper.php';

$bundleId = isset($_GET['bundleId']) ? $_GET['bundleId'] : '';
$email = isset($_GET['email']) ? $_GET['email'] : '';
$name = isset($_GET['name']) ? $_GET['name'] : '';
$merchantOrderId = isset($_GET['merchantOrderId']) ? $_GET['merchantOrderId'] : '';

if (empty($merchantOrderId)) {
    http_response_code(400);
    echo "<h1>Payment order reference missing.</h1>";
    exit;
}

$phonepeMID = getEnvValue('PHONEPE_MID');
$phonepeSaltKey = getEnvValue('PHONEPE_SALT_KEY'); // Client Secret
$phonepeSaltIndex = getEnvValue('PHONEPE_SALT_INDEX', '1'); // Client Version
$phonepeHost = getEnvValue('PHONEPE_HOST', 'https://api.phonepe.com/apis/pg');

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
        throw new Exception("Token generation error: " . $tokenErr);
    }

    $tokenData = json_decode($tokenResponse, true);
    $accessToken = isset($tokenData['access_token']) ? $tokenData['access_token'] : '';

    if (empty($accessToken)) {
        throw new Exception("Access token missing in token response: " . $tokenResponse);
    }

    // 2. Call Order Status API
    $statusUrl = $phonepeHost . "/checkout/v2/order/" . $merchantOrderId . "/status";

    $ch = curl_init($statusUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        "Authorization: O-Bearer $accessToken"
    ]);

    $response = curl_exec($ch);
    $err = curl_error($ch);
    curl_close($ch);

    if ($err) {
        throw new Exception("Status API cURL error: " . $err);
    }

    $statusResponse = json_decode($response, true);

    if (isset($statusResponse['state']) && $statusResponse['state'] === 'COMPLETED') {
        // Payment Successful! Save purchase record and generate download credentials
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
            echo "<h1>Purchased bundle not found.</h1>";
            exit;
        }
        
        $purchaseId = generateUUID();
        $purchase = [
            'id' => $purchaseId,
            'bundleId' => $bundle['id'],
            'bundleTitle' => $bundle['title'],
            'amount' => $bundle['price'],
            'customerName' => $name ? urldecode($name) : 'Guest Customer',
            'customerEmail' => $email ? urldecode($email) : 'guest@example.com',
            'timestamp' => date(DATE_ISO8601)
        ];
        
        $downloadToken = generateUUID();
        $tokenRecord = [
            'token' => $downloadToken,
            'bundleId' => $bundle['id'],
            'purchaseId' => $purchaseId,
            'createdAt' => time() * 1000,
            'expiresAt' => (time() + 15 * 60) * 1000, // Valid for 15 minutes
            'maxDownloads' => 3,
            'downloadCount' => 0
        ];
        
        $db['purchases'][] = $purchase;
        $db['tokens'][] = $tokenRecord;
        writeDB($db);
        
        // Redirect user back to storefront success screen
        $redirectUrl = "/?payment_status=success&token=" . urlencode($downloadToken) . "&title=" . urlencode($bundle['title']);
        header("Location: $redirectUrl");
        exit;
    } else {
        header("Location: /?payment_status=failed");
        exit;
    }
} catch (Exception $e) {
    http_response_code(500);
    echo "<h1>Error verifying payment transaction status with PhonePe: " . htmlspecialchars($e->getMessage()) . "</h1>";
    exit;
}
