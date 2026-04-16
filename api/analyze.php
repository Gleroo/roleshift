<?php
/* =========================================
   ROLESHIFT — Gemini API Proxy
   Keeps the API key server-side.
   ========================================= */

// Load API key — tries several locations in order:
//   1. Two levels above this file (sibling of the roleshift/ folder — preferred, outside web root)
//   2. One level above this file (inside roleshift/ folder — fallback for flat setups)
//   3. Same directory as this file (roleshift/api/ — last resort)
$configCandidates = [
    dirname(__DIR__, 2) . '/roleshift_config.php',   // e.g. /var/www/roleshift_config.php
    dirname(__DIR__, 1) . '/roleshift_config.php',   // e.g. /var/www/html/roleshift/roleshift_config.php
    __DIR__             . '/config.php',              // e.g. /var/www/html/roleshift/api/config.php
];

$loadedConfig = null;
foreach ($configCandidates as $candidate) {
    if (file_exists($candidate)) {
        require_once $candidate;
        $loadedConfig = $candidate;
        break;
    }
}

if (!$loadedConfig) {
    error_log('[RoleShift] roleshift_config.php not found. Checked: ' . implode(', ', $configCandidates));
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
    $hint = $loadedConfig
        ? "Config found at {$loadedConfig} but GEMINI_API_KEY is empty or still placeholder."
        : "No config file found. Create roleshift_config.php at: " . $configCandidates[0];
    error_log("[RoleShift] API key missing. {$hint}");
    echo json_encode(['error' => 'API key not configured', 'message' => $hint]);
    exit;
}

$basePayload = [
    'systemInstruction' => $body['systemInstruction'] ?? new stdClass(),
    'contents'          => $body['contents']          ?? [],
    'generationConfig'  => $body['generationConfig']  ?? ['maxOutputTokens' => 3200, 'temperature' => 0.4]
];

// Google Search Grounding: Gemini searches the live web before responding.
// Only supported by gemini-2.0-flash and newer — incompatible with responseMimeType JSON.
$payloadWithSearch = array_merge($basePayload, [
    'tools' => [['googleSearch' => new stdClass()]]
]);

$markdown  = null;
$lastError = 'No models tried';

foreach ($models as $model) {
    $url = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$apiKey}";

    $payload = ($model === 'gemini-2.0-flash') ? $payloadWithSearch : $basePayload;

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode($payload),
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 45,
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
