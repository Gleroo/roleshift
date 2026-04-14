<?php
/* =========================================
   ROLESHIFT — Gemini API Proxy
   Keeps the API key server-side.
   ========================================= */

// Load API key from config outside web root
$configPath = dirname(__DIR__, 2) . '/roleshift_config.php';
if (file_exists($configPath)) {
    require_once $configPath;
} else {
    // Fallback: set key directly here if config file not available
    // REPLACE with your actual key, then delete this line after moving to config
    define('GEMINI_API_KEY', 'DEIN_API_KEY_HIER');
}

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$body = json_decode(file_get_contents('php://input'), true);
if (!$body) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON body']);
    exit;
}

$models   = $body['models']            ?? ['gemini-2.0-flash', 'gemini-1.5-flash'];
$apiKey   = defined('GEMINI_API_KEY') ? GEMINI_API_KEY : '';

if (!$apiKey || $apiKey === 'DEIN_API_KEY_HIER') {
    http_response_code(500);
    echo json_encode(['error' => 'API key not configured on server']);
    exit;
}

$payload = [
    'systemInstruction' => $body['systemInstruction'] ?? new stdClass(),
    'contents'          => $body['contents']          ?? [],
    'generationConfig'  => $body['generationConfig']  ?? ['maxOutputTokens' => 3200, 'temperature' => 0.4]
];

$markdown  = null;
$lastError = 'No models tried';

foreach ($models as $model) {
    $url = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$apiKey}";

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode($payload),
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 30,
    ]);

    $result   = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode === 200) {
        $data = json_decode($result, true);
        $text = $data['candidates'][0]['content']['parts'][0]['text'] ?? null;
        if ($text) {
            $markdown = $text;
            break;
        }
    }

    $lastError = $result;
}

if ($markdown) {
    echo json_encode(['markdown' => $markdown]);
} else {
    http_response_code(502);
    $errData = json_decode($lastError, true);
    echo json_encode([
        'error'   => 'Gemini API error',
        'message' => $errData['error']['message'] ?? $lastError
    ]);
}
