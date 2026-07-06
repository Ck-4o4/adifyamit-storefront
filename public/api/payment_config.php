<?php
require_once __DIR__ . '/db_helper.php';

$mid = getEnvValue('PHONEPE_MID');
$key = getEnvValue('PHONEPE_SALT_KEY');

$phonepeActive = (!empty($mid) && !empty($key));

echo json_encode([
    'gateway' => $phonepeActive ? 'phonepe' : 'sandbox'
]);
