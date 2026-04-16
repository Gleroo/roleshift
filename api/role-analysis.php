<?php
/* =========================================
   ROLESHIFT — Structured Role Analysis API
   Calls Gemini, requests JSON, sanitises,
   and returns a typed result object.
   ========================================= */

// Load API key from config outside web root (same pattern as analyze.php)
$configPath = dirname(__DIR__, 2) . '/roleshift_config.php';
if (file_exists($configPath)) {
    require_once $configPath;
} else {
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
if (!$body || !isset($body['roleConfig'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing roleConfig in request body']);
    exit;
}

$apiKey = defined('GEMINI_API_KEY') ? GEMINI_API_KEY : '';
if (!$apiKey || $apiKey === 'DEIN_API_KEY_HIER') {
    http_response_code(500);
    echo json_encode(['error' => 'API key not configured on server']);
    exit;
}

$roleConfig = $body['roleConfig'];

// Build system instruction and user prompt
$systemInstruction = buildSystemInstruction();
$userPrompt        = buildUserPrompt($roleConfig);

// Try models in order; use responseMimeType to force JSON output
$models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-8b'];

$baseContent = [
    'systemInstruction' => [
        'parts' => [['text' => $systemInstruction]]
    ],
    'contents' => [
        ['parts' => [['text' => $userPrompt]]]
    ],
];

// gemini-2.0-flash: use Google Search Grounding for live web data.
// Search Grounding is incompatible with responseMimeType=json, so we rely on
// the existing tryParseJson() to extract JSON from the text response.
$payloadWithSearch = array_merge($baseContent, [
    'generationConfig' => ['maxOutputTokens' => 4096, 'temperature' => 0.4],
    'tools'            => [['googleSearch' => new stdClass()]],
]);

// Fallback models: no search grounding, force JSON via responseMimeType.
$payloadJson = array_merge($baseContent, [
    'generationConfig' => [
        'maxOutputTokens'  => 4096,
        'temperature'      => 0.4,
        'responseMimeType' => 'application/json',
    ],
]);

$resultJson = null;
$lastError  = 'Kein Modell versucht';

foreach ($models as $model) {
    $url = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$apiKey}";

    $payload = ($model === 'gemini-2.0-flash') ? $payloadWithSearch : $payloadJson;

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode($payload),
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 60,
    ]);

    $raw      = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr  = curl_error($ch);
    curl_close($ch);

    if ($curlErr) {
        error_log("[RoleShift/role-analysis] cURL error for {$model}: {$curlErr}");
        $lastError = "cURL: {$curlErr}";
        continue;
    }

    if ($httpCode === 200) {
        $data = json_decode($raw, true);
        $text = $data['candidates'][0]['content']['parts'][0]['text'] ?? null;

        if ($text) {
            $parsed = tryParseJson($text);
            if ($parsed !== null) {
                $resultJson = $parsed;
                break;  // Success — stop trying models
            }
            // Gemini returned text but not valid JSON — log and try next model
            error_log("[RoleShift/role-analysis] {$model} returned non-JSON text: " . substr($text, 0, 300));
        }
    }

    $lastError = $raw;
    error_log("[RoleShift/role-analysis] {$model} HTTP {$httpCode}: " . substr($raw, 0, 300));
}

if ($resultJson !== null) {
    $sanitized = sanitizeResult($resultJson, $roleConfig);
    echo json_encode(['result' => $sanitized]);
} else {
    http_response_code(502);
    $errData = json_decode($lastError, true);
    echo json_encode([
        'error'   => 'Gemini API error',
        'message' => $errData['error']['message'] ?? 'Kein valides JSON von Gemini erhalten'
    ]);
}

/* =========================================
   PROMPT BUILDERS
   ========================================= */

function buildSystemInstruction(): string
{
    return <<<'SYSINSTRUCTION'
You are a Senior Expert for human–AI collaboration, workforce redesign, and organisational change. You specialise in role-level analysis — not blanket automation-risk scores, but concrete, role-specific restructuring plans.

CORE RULES
1. Every answer MUST be tailored to the SPECIFIC ROLE provided. Generic HR or office examples that do not clearly fit the role are forbidden.
2. Before answering, think: in which domain or industry does this role live? Search your knowledge for AI tools, platforms, and current practices SPECIFIC to that profession and domain.
3. Write in German (professional Geschäftsdeutsch) throughout — all text fields, summaries, tool descriptions, and recommendations.
4. Return ONLY a valid JSON object — no markdown, no code fences, no additional text around it.
5. workDistribution values must sum to exactly 100.
6. Every tool in recommendedTools must genuinely fit the specific role — never recommend tools that obviously do not match.
7. Maintain a human-centric, responsible tone: AI augments humans; humans remain accountable for critical decisions and relationships.
8. Phase labels in implementationPlan should be "Diese Woche bis 30 Tage", "Nächste 90 Tage", "Langfristig".
SYSINSTRUCTION;
}

function buildUserPrompt(array $rc): string
{
    $role = htmlspecialchars_decode($rc['roleTitle'] ?? 'Unbekannte Stelle', ENT_QUOTES);
    $desc = !empty($rc['roleTasks'])
        ? "\nBeschreibung der Tätigkeiten: " . htmlspecialchars_decode($rc['roleTasks'], ENT_QUOTES)
        : '';

    // Scale labels and descriptions
    $scaleMap = [
        'repetitive'     => 'Repetitivität der Aufgaben (1=sehr abwechslungsreich, 5=sehr routinemäßig)',
        'standardized'   => 'Standardisierung der Prozesse (1=ad-hoc, 5=vollständig regelbasiert)',
        'judgment'       => 'Erforderliches Urteilsvermögen (1=regelbasiert, 5=Urteil ist Kernaufgabe)',
        'customerFacing' => 'Kundenkontakt-Intensität (1=intern/Back-Office, 5=direkter Kundenkontakt)',
        'costOfMistakes' => 'Fehlerkosten (1=leicht korrigierbar, 5=schwerwiegend, schwer rückgängig)',
        'sensitivity'    => 'Compliance/Datensensibilität (1=keine, 5=hohe regulatorische Anforderungen)',
        'accountability' => 'Verantwortungsebene (1=geteilt, 5=namentliche Person immer verantwortlich)',
        'reviewNeeded'   => 'Prüfbedarf vor Output-Verwendung (1=direkt verwendet, 5=immer geprüft)',
        'documentation'  => 'Qualität der Prozessdokumentation (1=im Kopf, 5=klar schriftlich festgehalten)',
        'dataStructure'  => 'Qualität der Datenstruktur (1=unstrukturiert, 5=sauber und organisiert)',
        'aiReadiness'    => 'Offenheit des Teams für KI (1=skeptisch, 5=enthusiastische Early Adopter)',
        'toolsAdopted'   => 'Bereits genutzte KI/Automatisierung (1=keine, 5=im täglichen Workflow)',
    ];

    $scaleDesc = static function (int $v): string {
        return match (true) {
            $v <= 0 => 'nicht angegeben',
            $v === 1 => 'sehr niedrig (1/5)',
            $v === 2 => 'niedrig (2/5)',
            $v === 3 => 'mittel (3/5)',
            $v === 4 => 'hoch (4/5)',
            default  => 'sehr hoch (5/5)',
        };
    };

    $scalesText = '';
    foreach ($scaleMap as $key => $label) {
        $val = (int)($rc[$key] ?? 0);
        $scalesText .= "- {$label}: " . $scaleDesc($val) . "\n";
    }

    // Goal labels
    $goalMap = [
        'time'       => 'Zeit sparen',
        'admin'      => 'Verwaltung reduzieren',
        'quality'    => 'Qualität verbessern',
        'compliance' => 'Vertrauen & Compliance sichern',
        'speed'      => 'Durchlaufzeit verkürzen',
        'focus'      => 'Auf Kernaufgaben fokussieren',
    ];
    $goals      = (array)($rc['goals'] ?? []);
    $goalsText  = !empty($goals)
        ? implode(', ', array_map(static fn($g) => $goalMap[$g] ?? $g, $goals))
        : 'keine angegeben';

    // Schema inline in the prompt — Gemini follows it more reliably this way
    return <<<PROMPT
Analysiere die folgende Rollenbewertung und erstelle eine detaillierte, rollenspezifische KI-Kollaborationsanalyse.

ROLLE: {$role}{$desc}
GESCHÄFTLICHE PRIORITÄTEN: {$goalsText}

BEWERTUNGSWERTE:
{$scalesText}

DEINE AUFGABEN:
1. Analysiere die Bewertungen gründlich im Kontext dieser spezifischen Rolle und Branche.
2. Suche in deinem Wissen nach aktuellen, realen KI-Tools, die GENAU für diese Rolle und ihren Berufskontext relevant sind.
3. Leite das passende Kollaborationsmodell her (begründe es mit den Bewertungswerten).
4. Erstelle einen konkreten, stellenspezifischen Umsetzungsplan.
5. Gib dein Ergebnis als valides JSON-Objekt mit GENAU dieser Struktur zurück:

{
  "collaborationModelName": "Kurzer Name des Modells (z.B. 'KI-Copilot Workflow', 'Mensch-geführt mit gezielter KI')",
  "collaborationModelHeadline": "Prägnanter Satz zum Modell, max. 12 Wörter, Deutsch",
  "collaborationModelSummary": "2–3 Sätze: Kontext der Rolle, warum dieses Modell passt, was das konkret bedeutet",
  "workDistribution": {
    "automatable": <Ganzzahl 0–100>,
    "aiAssisted":  <Ganzzahl 0–100>,
    "humanLed":    <Ganzzahl 0–100>,
    "reviewRequired": <Ganzzahl 0–100>
  },
  "taskSplit": [
    {
      "area": "Aufgabenbereich (konkret für diese Rolle)",
      "aiAssisted":  <true|false>,
      "automatable": <true|false>,
      "humanLed":    <true|false>,
      "humanReview": <true|false>,
      "description": "Ein Satz: Was passiert hier konkret?"
    }
  ],
  "aiResponsibilities": [
    "Konkrete Aufgabe 1 (rollenspezifisch)",
    "..."
  ],
  "humanResponsibilities": [
    "Konkrete Aufgabe 1 (rollenspezifisch)",
    "..."
  ],
  "implementationPlan": {
    "next30Days": ["Maßnahme 1", "..."],
    "next90Days": ["Maßnahme 1", "..."],
    "later":      ["Maßnahme 1", "..."]
  },
  "recommendedTools": [
    {
      "name": "Tool-Name",
      "category": "Kategorie",
      "reason": "Warum dieses Tool für diese Rolle?",
      "fitForRole": "Was macht die Person konkret damit?"
    }
  ],
  "risksAndSafeguards": [
    "Risiko + konkrete Gegenmaßnahme (rollenspezifisch)",
    "..."
  ],
  "managerSummary": [
    "Kernaussage für Führungskräfte 1",
    "..."
  ],
  "readinessScore": <Ganzzahl 0–100>,
  "readinessDescription": "1–2 Sätze zum aktuellen Bereitschaftsstatus und nächsten Schritt"
}

MENGENANGABEN:
- workDistribution: summiert sich auf exakt 100
- taskSplit: 5–8 Einträge
- aiResponsibilities: 5–7 Punkte
- humanResponsibilities: 5–7 Punkte
- implementationPlan je Phase: 3–5 Punkte
- recommendedTools: 4–7 Tools (nur real existierende Tools, die klar zu "{$role}" passen)
- risksAndSafeguards: 3–5 Punkte
- managerSummary: 3–5 Punkte

WICHTIG: Alle Texte auf Deutsch. Keine generischen Beispiele — alles muss klar zur Rolle "{$role}" passen.
PROMPT;
}

/* =========================================
   JSON PARSING (with fallback extraction)
   ========================================= */

function tryParseJson(string $text): ?array
{
    // 1. Direct parse (ideal path — responseMimeType usually ensures this)
    $parsed = json_decode($text, true);
    if (json_last_error() === JSON_ERROR_NONE && is_array($parsed)) {
        return $parsed;
    }

    // 2. Gemini sometimes wraps in ```json ... ``` despite the MIME type setting
    if (preg_match('/```(?:json)?\s*([\s\S]+?)\s*```/', $text, $m)) {
        $parsed = json_decode($m[1], true);
        if (json_last_error() === JSON_ERROR_NONE && is_array($parsed)) {
            return $parsed;
        }
    }

    // 3. Extract the outermost JSON object from the text
    if (preg_match('/\{[\s\S]+\}/', $text, $m)) {
        $parsed = json_decode($m[0], true);
        if (json_last_error() === JSON_ERROR_NONE && is_array($parsed)) {
            return $parsed;
        }
    }

    return null;
}

/* =========================================
   SANITISATION & FALLBACK DEFAULTS
   ========================================= */

function sanitizeResult(array $data, array $rc): array
{
    $role = htmlspecialchars($rc['roleTitle'] ?? 'Diese Stelle', ENT_QUOTES | ENT_HTML5, 'UTF-8');

    return [
        'roleTitle'                  => $role,
        'collaborationModelName'     => sStr($data['collaborationModelName']     ?? 'KI-Augmentierung'),
        'collaborationModelHeadline' => sStr($data['collaborationModelHeadline'] ?? 'Ein strukturierter Weg zur KI-Integration.'),
        'collaborationModelSummary'  => sStr($data['collaborationModelSummary']  ?? ''),
        'workDistribution'           => sanitizeWorkDist($data['workDistribution'] ?? []),
        'taskSplit'                  => sanitizeTaskSplit($data['taskSplit']       ?? []),
        'aiResponsibilities'         => sStrArr($data['aiResponsibilities']        ?? []),
        'humanResponsibilities'      => sStrArr($data['humanResponsibilities']     ?? []),
        'implementationPlan'         => [
            'next30Days' => sStrArr($data['implementationPlan']['next30Days'] ?? []),
            'next90Days' => sStrArr($data['implementationPlan']['next90Days'] ?? []),
            'later'      => sStrArr($data['implementationPlan']['later']      ?? []),
        ],
        'recommendedTools'           => sanitizeTools($data['recommendedTools']   ?? []),
        'risksAndSafeguards'         => sStrArr($data['risksAndSafeguards']       ?? []),
        'managerSummary'             => sStrArr($data['managerSummary']           ?? []),
        'readinessScore'             => max(0, min(100, (int)($data['readinessScore'] ?? 50))),
        'readinessDescription'       => sStr($data['readinessDescription']        ?? ''),
    ];
}

/** Sanitise a single string value */
function sStr(mixed $s): string
{
    return htmlspecialchars(strip_tags((string)$s), ENT_QUOTES | ENT_HTML5, 'UTF-8');
}

/** Sanitise an array of strings */
function sStrArr(mixed $arr): array
{
    if (!is_array($arr)) return [];
    return array_values(array_filter(array_map('sStr', $arr)));
}

/** Normalise workDistribution so its values sum to exactly 100 */
function sanitizeWorkDist(mixed $wd): array
{
    if (!is_array($wd)) $wd = [];

    $auto   = max(0, (int)($wd['automatable']    ?? 20));
    $ai     = max(0, (int)($wd['aiAssisted']     ?? 30));
    $human  = max(0, (int)($wd['humanLed']       ?? 35));
    $review = max(0, (int)($wd['reviewRequired'] ?? 15));

    $total = $auto + $ai + $human + $review;
    if ($total === 0) { $auto = 20; $ai = 30; $human = 35; $review = 15; $total = 100; }

    $f = 100.0 / $total;
    $result = [
        'automatable'    => (int)round($auto   * $f),
        'aiAssisted'     => (int)round($ai     * $f),
        'humanLed'       => (int)round($human  * $f),
        'reviewRequired' => (int)round($review * $f),
    ];

    // Fix any rounding drift so it sums to exactly 100
    $diff = 100 - array_sum($result);
    $result['humanLed'] = max(0, $result['humanLed'] + $diff);

    return $result;
}

function sanitizeTaskSplit(mixed $arr): array
{
    if (!is_array($arr)) return [];
    $out = [];
    foreach (array_slice($arr, 0, 10) as $item) {
        if (!is_array($item)) continue;
        $out[] = [
            'area'        => sStr($item['area']        ?? ''),
            'aiAssisted'  => (bool)($item['aiAssisted']  ?? false),
            'automatable' => (bool)($item['automatable'] ?? false),
            'humanLed'    => (bool)($item['humanLed']    ?? false),
            'humanReview' => (bool)($item['humanReview'] ?? false),
            'description' => sStr($item['description']   ?? ''),
        ];
    }
    return $out;
}

function sanitizeTools(mixed $arr): array
{
    if (!is_array($arr)) return [];
    $out = [];
    foreach (array_slice($arr, 0, 8) as $item) {
        if (!is_array($item)) continue;
        $out[] = [
            'name'       => sStr($item['name']       ?? ''),
            'category'   => sStr($item['category']   ?? ''),
            'reason'     => sStr($item['reason']      ?? ''),
            'fitForRole' => sStr($item['fitForRole']  ?? ''),
        ];
    }
    return $out;
}
