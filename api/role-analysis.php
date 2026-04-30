<?php
/* =========================================
   ROLESHIFT — Rule-Based Analysis Engine
   roleshift-ki-analyse Skill — kein externer KI-Dienst
   ========================================= */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

// Config laden (Gemini API-Key)
$_cfgFile = __DIR__ . '/roleshift_config.php';
if (file_exists($_cfgFile)) { require_once $_cfgFile; }

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

$result = analyzeRole($body['roleConfig']);
echo json_encode(['result' => $result]);

/* =========================================
   GEMINI API
   ========================================= */

function callGemini(string $prompt): ?string
{
    $apiKey = defined('GEMINI_API_KEY') ? GEMINI_API_KEY : null;
    if (!$apiKey || $apiKey === 'HIER_NEUEN_KEY_EINTRAGEN') return null;

    $model = defined('GEMINI_MODEL') ? GEMINI_MODEL : 'gemini-2.5-flash';
    $url   = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$apiKey}";

    $payload = json_encode([
        'contents'         => [['parts' => [['text' => $prompt]]]],
        'generationConfig' => ['responseMimeType' => 'application/json'],
    ]);

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_TIMEOUT        => 30,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);
    $response = curl_exec($ch);
    $code     = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($code !== 200 || !$response) return null;
    $json = json_decode($response, true);
    return $json['candidates'][0]['content']['parts'][0]['text'] ?? null;
}

function buildGeminiPrompt(
    string $roleTitle, string $roleCategory,
    array $taskAnalysis, array $goals
): string {
    $tasksJson = json_encode($taskAnalysis, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    $goalsStr  = implode(', ', $goals) ?: 'nicht angegeben';

    return <<<PROMPT
Du bist ein erfahrener KI-Implementierungsberater für Unternehmen.
Erstelle einen professionellen deutschen Analysebericht auf Basis der folgenden Daten.

Stelle: {$roleTitle}
Funktionsbereich: {$roleCategory}
Ziele: {$goalsStr}

Analysierte Aufgaben:
{$tasksJson}

Kategorien:
- "automatisierbar"  → KI übernimmt vollständig, kein Mensch nötig
- "ki-unterstuetzt"  → KI liefert Entwurf, Mensch entscheidet und gibt frei
- "pruefung"         → KI-Einsatz denkbar, sorgfältige Pilotphase erforderlich
- "menschlich"       → menschliche Kernkompetenz, keine KI-Übernahme sinnvoll

Antworte ausschließlich mit diesem JSON-Objekt, ohne Markdown, ohne Erklärungen:
{
  "einleitung": "Fließender Einleitungstext, 2–3 Sätze, rollenspezifisch und auf den konkreten KI-Anteil dieser Stelle bezogen.",
  "kollaborationsmodell": "Fließender Text, 3–4 Sätze: Wie sieht die ideale Mensch-KI-Zusammenarbeit für genau diese Stelle aus? Konkret, keine Allgemeinplätze.",
  "umsetzungsplan": {
    "phase1": {
      "label": "Phase 1 – Quick Wins",
      "intro": "Ein Satz, der beschreibt, worauf diese Phase fokussiert.",
      "items": ["Konkreter erster Schritt", "Zweiter Schritt", "Dritter Schritt"]
    },
    "phase2": {
      "label": "Phase 2 – Integration",
      "intro": "Ein Satz, der beschreibt, worauf diese Phase fokussiert.",
      "items": ["Konkreter erster Schritt", "Zweiter Schritt", "Dritter Schritt"]
    },
    "phase3": {
      "label": "Phase 3 – Transformation",
      "intro": "Ein Satz, der beschreibt, worauf diese Phase fokussiert.",
      "items": ["Konkreter erster Schritt", "Zweiter Schritt", "Dritter Schritt"]
    }
  },
  "abschluss": "1–2 Sätze: Konkreter erster Handlungsschritt, spezifisch auf die Rolle und die automatisierbaren Aufgaben bezogen, motivierend formuliert."
}
PROMPT;
}

function generateTextsWithGemini(
    string $roleTitle, string $roleCategory,
    array $taskAnalysis, array $goals
): array {
    $prompt = buildGeminiPrompt($roleTitle, $roleCategory, $taskAnalysis, $goals);
    $raw    = callGemini($prompt);

    if ($raw) {
        $parsed = json_decode($raw, true);
        if (
            $parsed &&
            isset($parsed['einleitung'], $parsed['kollaborationsmodell'],
                  $parsed['umsetzungsplan'], $parsed['abschluss']) &&
            isset($parsed['umsetzungsplan']['phase1'],
                  $parsed['umsetzungsplan']['phase2'],
                  $parsed['umsetzungsplan']['phase3'])
        ) {
            return $parsed;
        }
    }

    // Fallback: regelbasierte Textgenerierung
    return [
        'einleitung'           => generateEinleitung($roleTitle, $roleCategory, $taskAnalysis, $goals),
        'kollaborationsmodell' => generateKollaborationsmodell($roleTitle, $roleCategory, $taskAnalysis, $goals),
        'umsetzungsplan'       => generateUmsetzungsplan($taskAnalysis, $roleCategory, $goals, $roleTitle),
        'abschluss'            => generateAbschluss($roleTitle, $taskAnalysis, $goals, $roleCategory),
    ];
}

/* =========================================
   KERN-ANALYSE
   ========================================= */

function analyzeRole(array $rc): array
{
    $roleTitle    = clean(trim($rc['roleTitle'] ?? 'Diese Stelle'));
    $tasks        = (array)($rc['tasks']  ?? []);
    $goals        = (array)($rc['goals']  ?? []);
    $roleCategory = detectRoleCategory($roleTitle);

    $taskAnalysis = [];
    foreach ($tasks as $i => $task) {
        $name     = clean(trim($task['name'] ?? 'Aufgabe ' . ($i + 1)));
        $rep      = clamp((int)($task['repetitive']   ?? 2), 1, 3);
        $std      = clamp((int)($task['standardized'] ?? 2), 1, 3);
        $jud      = clamp((int)($task['judgment']     ?? 2), 1, 3);
        $category = classifyTask($rep, $std, $jud);
        $tool     = getToolForTask($name, $category, $roleCategory);

        $taskAnalysis[] = [
            'taskName'   => $name,
            'category'   => $category,
            'reasoning'  => generateTaskReasoning($name, $rep, $std, $jud, $category, $roleCategory, $i),
            'toolName'   => $tool['name']   ?? null,
            'toolReason' => $tool['reason'] ?? null,
        ];
    }

    // Texte via Gemini 2.5 Flash generieren (Fallback: regelbasiert)
    $texts = generateTextsWithGemini($roleTitle, $roleCategory, $taskAnalysis, $goals);

    return [
        'roleTitle'            => $roleTitle,
        'einleitung'           => $texts['einleitung'],
        'taskAnalysis'         => $taskAnalysis,
        'kollaborationsmodell' => $texts['kollaborationsmodell'],
        'umsetzungsplan'       => $texts['umsetzungsplan'],
        'abschluss'            => $texts['abschluss'],
    ];
}

/* =========================================
   KLASSIFIZIERUNG (1:1 mit JS-Logik)
   ========================================= */

function classifyTask(int $rep, int $std, int $jud): string
{
    if ($jud === 3)                              return 'menschlich';
    if ($jud === 2 && $std === 3)               return 'menschlich';
    if ($rep === 1 && $std === 1 && $jud === 1) return 'automatisierbar';
    if ($jud === 2 && $std === 2 && $rep >= 2)  return 'pruefung';
    if ($rep === 1 && $std === 1 && $jud === 2) return 'pruefung';
    return 'ki-unterstuetzt';
}

/* =========================================
   ROLLENERKENNUNG
   ========================================= */

function detectRoleCategory(string $title): string
{
    $t = mb_strtolower($title, 'UTF-8');

    $patterns = [
        'hr'         => ['hr ', 'human resource', 'personal', 'people & culture', 'people and culture',
                         'recruiting', 'recruiter', 'talent acqui', 'talent management', 'hrbp',
                         'hr business partner', 'employer branding', 'payroll'],
        'finance'    => ['finance', 'finanз', 'controller', 'controlling', 'buchhalter', 'buchhaltung',
                         'treasury', 'rechnungswesen', 'steuerberater', 'cfo', 'bilanz', 'kreditoren',
                         'debitoren', 'payroll'],
        'marketing'  => ['marketing', 'brand manager', 'content manager', 'seo', 'sem ', 'social media',
                         'growth hacker', 'campaign', 'kommunikation', 'public relations', 'pr manager',
                         'werbung', 'performance marketing', 'crm manager'],
        'sales'      => ['sales', 'vertrieb', 'account manager', 'account executive', 'business development',
                         'bdr', 'sdr', 'außendienst', 'key account', 'inside sales', 'pre-sales'],
        'operations' => ['operations', 'koordinat', 'office manager', 'project manager', 'projektmanager',
                         'prozessmanager', 'supply chain', 'einkauf', 'procurement', 'assistenz',
                         'teamassistenz', 'office koordinat'],
        'it'         => ['developer', 'entwickler', 'software engineer', 'it manager', 'devops',
                         'sysadmin', 'system admin', 'cloud architect', 'it leiter', 'full stack',
                         'backend', 'frontend', 'mobile developer', 'it sicherheit', 'cybersecurity'],
        'data'       => ['data ', 'analyst', 'analytics', ' bi ', 'business intelligence',
                         'data scientist', 'data engineer', 'reporting manager', 'insights manager'],
        'legal'      => ['legal', 'jurist', 'rechtsanwalt', 'syndikusanwalt', 'compliance',
                         'datenschutz', 'contract manager', 'vertragsmanager', 'in-house counsel'],
        'support'    => ['support', 'helpdesk', 'service desk', 'kundenservice', 'customer success',
                         'customer care', 'kundenbetreuer', 'service manager', 'customer experience'],
        'logistics'  => ['logistik', 'lager', 'warehouse', 'spedition', 'transport', 'fleet manager',
                         'fuhrpark', 'disposition', 'supply planner', 'import', 'export'],
        'healthcare' => ['arzt', 'ärztin', 'pflege', 'therapeut', 'apothek', 'medizin', 'klinik',
                         'health', 'physio', 'sanitäter', 'psycholog', 'ergotherap'],
        'education'  => ['lehrer', 'lehrerin', 'trainer', 'dozent', 'ausbilder', 'pädagog',
                         'bildung', 'schulung', 'e-learning', 'instructional designer'],
        'executive'  => ['ceo', 'coo', 'cto', 'cmo', 'geschäftsführer', 'geschäftsführerin',
                         'direktor', 'direktorin', 'head of', 'vp ', 'vice president', 'chief '],
        'creative'   => ['designer', 'ux ', 'ui designer', 'grafiker', 'texter', 'copywriter',
                         'art director', 'videograph', 'fotograf', 'kreativdirektor', 'motion'],
    ];

    foreach ($patterns as $category => $keywords) {
        foreach ($keywords as $kw) {
            if (str_contains($t, $kw)) return $category;
        }
    }
    return 'generic';
}

/* =========================================
   TOOL-DATENBANK
   ========================================= */

function getToolForTask(string $taskName, string $taskCategory, string $roleCategory): array
{
    if ($taskCategory === 'menschlich') return ['name' => null, 'reason' => null];

    $t   = mb_strtolower($taskName, 'UTF-8');
    $isAuto = ($taskCategory === 'automatisierbar');

    // Aufgaben-Keyword-Matching (spezifisch vor generisch)
    $kwMap = [
        ['kw' => ['e-mail', 'email', 'mail', 'postfach', 'inbox', 'korrespondenz', 'e-mails'],
         'auto' => ['Microsoft Copilot (Outlook)',
                    'Klassifiziert, priorisiert und beantwortet eingehende Mails regelbasiert — direkt in Outlook, ohne Toolwechsel.'],
         'ki'   => ['Microsoft Copilot (Outlook)',
                    'Erstellt Antwortvorschläge und fasst lange Thread-Verläufe zusammen — Sie überarbeiten und senden.']],

        ['kw' => ['bericht', 'report', 'reporting', 'zusammenfassung', 'protokoll erstell', 'wochenbericht'],
         'auto' => ['Power BI mit Copilot',
                    'Generiert Berichte und Dashboards automatisch aus verbundenen Datenquellen — keine manuelle Aufbereitung mehr.'],
         'ki'   => ['Power BI mit Copilot',
                    'Beschleunigt Berichterstellung erheblich: Copilot erklärt Abweichungen und formuliert automatische Narratives zu den Zahlen.']],

        ['kw' => ['protokoll', 'meeting', 'besprechung', 'sitzung', 'gesprächs', 'call notiz'],
         'auto' => ['Fireflies.ai',
                    'Transkribiert Meetings vollautomatisch und extrahiert Action Items — ohne manuelles Mitschreiben.'],
         'ki'   => ['Otter.ai',
                    'Erstellt strukturierte Zusammenfassungen inkl. Beschlüssen und Aufgaben — Sie validieren vor dem Versand.']],

        ['kw' => ['präsentation', 'slides', 'folie', 'powerpoint', 'pitch deck'],
         'auto' => ['Gamma',
                    'Generiert vollständige, designte Präsentationen aus einem Briefing in wenigen Minuten.'],
         'ki'   => ['Gamma',
                    'Übernimmt Struktur und visuelle Aufbereitung — Sie liefern die Kernaussagen, Gamma die Folie.']],

        ['kw' => ['recherche', 'research', 'markt', 'wettbewerb', 'literatur', 'hintergrund'],
         'auto' => ['Perplexity Pro',
                    'Liefert quellenbelegte Recherche-Zusammenfassungen in Echtzeit — drastisch schneller als manuelle Suche.'],
         'ki'   => ['Perplexity Pro',
                    'Liefert zitierfähige Quellen und strukturierte Zusammenfassungen als belastbare Recherchebasis.']],

        ['kw' => ['übersetzen', 'übersetzung', 'translation', 'lokalisier', 'übersetz'],
         'auto' => ['DeepL Pro',
                    'Übersetzt Dokumente mit nachweislich hoher Qualität vollautomatisch — inklusive Formaterhalt.'],
         'ki'   => ['DeepL Pro',
                    'Liefert hochwertige Basistexte, die nur noch auf branchenspezifische Fachbegriffe geprüft werden müssen.']],

        ['kw' => ['code', 'programmier', 'entwickl', 'script', 'bug', 'debugging', 'testen'],
         'auto' => ['GitHub Copilot',
                    'Schreibt repetitiven Code, Unit-Tests und Boilerplate vollständig — der Entwickler reviewt das Ergebnis.'],
         'ki'   => ['GitHub Copilot',
                    'Schlägt Implementierungsoptionen vor und dokumentiert Code — architektonische Entscheidungen bleiben beim Team.']],

        ['kw' => ['social media', 'instagram', 'linkedin', 'twitter', 'post', 'beitrag', 'content planen'],
         'auto' => ['Buffer (AI Assistant)',
                    'Generiert und plant Posts auf Basis von Themen-Briefings vollautomatisch — inklusive Posting-Zeitpunkt-Optimierung.'],
         'ki'   => ['Jasper AI',
                    'Erstellt Postentwürfe in der definierten Markensprache — redaktionelle Freigabe bleibt beim Team.']],

        ['kw' => ['rechnung', 'invoice', 'faktur', 'buchhaltung', 'beleg', 'rechnungsprüf'],
         'auto' => ['Candis',
                    'Liest Rechnungen automatisch aus, erstellt Buchungsvorschläge und überträgt sie in DATEV — DSGVO-konform.'],
         'ki'   => ['Candis',
                    'Übernimmt Datenextraktion und Vorkontierung — Freigabe und Ausnahmen bleiben beim Finanzverantwortlichen.']],

        ['kw' => ['vertrag', 'contract', 'nda', 'klausel', 'recht', 'vereinbarung'],
         'auto' => ['Ironclad AI',
                    'Prüft Standardverträge automatisch gegen vordefinierte Regelwerke und flaggt Abweichungen.'],
         'ki'   => ['Harvey AI',
                    'Unterstützt bei Vertragsanalyse und Klauselprüfung — finale Beurteilung bleibt immer beim Juristen.']],

        ['kw' => ['daten', 'analyse', 'analytics', 'auswertung', 'statistik', 'kennzahl', 'kpi'],
         'auto' => ['Tableau (Pulse)',
                    'Erkennt Anomalien und liefert automatische Analyse-Updates ohne manuelle Abfragearbeit.'],
         'ki'   => ['Julius AI',
                    'Analysiert hochgeladene Datensätze per natürlicher Spracheingabe — kein SQL oder Programmierkenntnisse nötig.']],

        ['kw' => ['onboarding', 'einarbeitung', 'einführ'],
         'auto' => ['Notion AI',
                    'Erstellt und pflegt Onboarding-Dokumentation und Lernpfade automatisch auf dem aktuellen Stand.'],
         'ki'   => ['Notion AI',
                    'Unterstützt bei Aufbau und Aktualisierung von Onboarding-Materialien — Freigabe durch den HR-Manager.']],

        ['kw' => ['bewerbung', 'kandidat', 'screening', 'lebenslauf', 'cv', 'applicant'],
         'auto' => ['Personio (AI-Screening)',
                    'Scannt Bewerbungen gegen Anforderungsprofile und erstellt eine priorisierte Shortlist regelbasiert.'],
         'ki'   => ['Personio (AI-Screening)',
                    'Erstellt eine vorpriorisierte Longlist — die finale Beurteilung von Kandidaten bleibt beim HR-Manager.']],

        ['kw' => ['content', 'artikel', 'blog', 'text erstell', 'textent'],
         'auto' => ['Jasper AI',
                    'Generiert SEO-optimierten Content nach Brand-Voice-Vorgaben — skalierbar ohne Qualitätsverlust.'],
         'ki'   => ['Jasper AI',
                    'Erstellt strukturierte Rohentwürfe und Varianten — redaktionelle Qualitätskontrolle und Ton-Anpassung bleiben beim Team.']],

        ['kw' => ['stellenausschreib', 'jobanzeige', 'stellenanzeige', 'jobposting'],
         'auto' => ['ChatGPT (Custom GPT)',
                    'Generiert zielgruppengerechte Ausschreibungen aus Anforderungsprofilen in Sekunden.'],
         'ki'   => ['ChatGPT (Custom GPT)',
                    'Liefert einen starken Erstentwurf — HR prüft auf Tonalität, Vollständigkeit und spezifische Anforderungen.']],

        ['kw' => ['dokumentation', 'handbuch', 'richtlinie', 'prozessdoku'],
         'auto' => ['Notion AI',
                    'Aktualisiert und pflegt Prozessdokumentationen auf Basis von Änderungs-Briefings automatisch.'],
         'ki'   => ['Notion AI',
                    'Unterstützt beim Erstellen und Strukturieren von Dokumentation — inhaltliche Richtigkeit liegt beim Fachexperten.']],

        ['kw' => ['termin', 'kalender', 'scheduling', 'planung', 'ressourcen'],
         'auto' => ['Microsoft Copilot (Outlook)',
                    'Plant Termine automatisch nach Verfügbarkeit, Priorität und Meetingtyp — ohne manuelle Abstimmung.'],
         'ki'   => ['Reclaim.ai',
                    'Optimiert Kalenderplanung intelligent und schützt Fokuszeiten — besonders wertvoll bei vielen parallelen Projekten.']],

        ['kw' => ['daten eingabe', 'dateneingabe', 'stammdaten', 'crm pflege', 'erfassen'],
         'auto' => ['Zapier mit KI-Aktionen',
                    'Überträgt Daten automatisch zwischen Systemen — keine manuelle Eingabe mehr nötig.'],
         'ki'   => ['Microsoft Power Automate',
                    'Automatisiert strukturierte Datenübertragungen zwischen Systemen mit regelbasierter Logik.']],

        ['kw' => ['feedback', 'performance', 'beurteilung', 'mitarbeitergespräch vorbereitung'],
         'auto' => ['Leapsome AI',
                    'Erstellt automatisch strukturierte Feedback-Vorlagen auf Basis von Zielvereinbarungen.'],
         'ki'   => ['Leapsome AI',
                    'Unterstützt bei Vorbereitung und Nachbereitung von Feedback-Gesprächen — das Gespräch selbst bleibt menschlich.']],

        ['kw' => ['rechnungswesen', 'monatsabschluss', 'jahresabschluss', 'bilanz'],
         'auto' => ['Candis',
                    'Automatisiert Belegerfassung, Buchungsvorschläge und Abschlussvorbereitungen DATEV-konform.'],
         'ki'   => ['DATEV (KI-Features)',
                    'Unterstützt bei Vorbereitung und Plausibilitätsprüfung — Freigabe und Urteil bleiben beim Controller.']],
    ];

    foreach ($kwMap as $entry) {
        foreach ($entry['kw'] as $kw) {
            if (str_contains($t, $kw)) {
                $toolData = $isAuto ? $entry['auto'] : $entry['ki'];
                return ['name' => $toolData[0], 'reason' => $toolData[1]];
            }
        }
    }

    // Rollen-spezifische Fallbacks
    $roleDefaults = [
        'hr' => [
            'automatisierbar' => ['Personio (AI)', 'Automatisiert administrative HR-Workflows regelbasiert und DSGVO-konform für den DACH-Markt.'],
            'ki-unterstuetzt' => ['Microsoft Copilot', 'Unterstützt bei Textaufgaben, Zusammenfassungen und Datenauswertungen direkt in Office.'],
            'pruefung'        => ['HiBob', 'Flexible HR-Plattform mit skalierbaren KI-Features — gut geeignet für schrittweise Einführung.'],
        ],
        'finance' => [
            'automatisierbar' => ['Candis', 'DSGVO-konformer Standard für automatisierte Buchhaltungsprozesse im DACH-Markt.'],
            'ki-unterstuetzt' => ['Power BI mit Copilot', 'Beschleunigt Finanzanalysen und erstellt automatische Narratives zu Abweichungen.'],
            'pruefung'        => ['Spendesk', 'Strukturiert Ausgabenprozesse mit klaren Freigabe-Workflows — guter Pilotpunkt für KI.'],
        ],
        'marketing' => [
            'automatisierbar' => ['Jasper AI', 'Skaliert Content-Produktion nach Brand-Voice und Zielgruppe zuverlässig und schnell.'],
            'ki-unterstuetzt' => ['HubSpot (AI)', 'Unterstützt bei Content, E-Mail-Kampagnen und Performance-Analyse in einer Plattform.'],
            'pruefung'        => ['Semrush (AI)', 'Bietet messbare erste KI-Ergebnisse bei SEO und Content-Optimierung.'],
        ],
        'sales' => [
            'automatisierbar' => ['HubSpot (AI)', 'Automatisiert CRM-Datenpflege, Follow-up-Sequenzen und Pipeline-Updates regelbasiert.'],
            'ki-unterstuetzt' => ['Gong', 'Analysiert Verkaufsgespräche und liefert konkrete Coaching-Hinweise und Abschlusswahrscheinlichkeiten.'],
            'pruefung'        => ['Clari', 'KI-gestützte Pipeline-Prognose — zunächst im kleinen Rahmen pilotieren.'],
        ],
        'operations' => [
            'automatisierbar' => ['n8n', 'Automatisiert wiederkehrende Prozesse selbst gehostet — DSGVO-konform und flexibel.'],
            'ki-unterstuetzt' => ['Notion AI', 'Unterstützt bei Dokumentation, Koordination und Zusammenfassungen im bestehenden Workspace.'],
            'pruefung'        => ['Make (Integromat)', 'Visueller Workflow-Builder für erste Automatisierungstests mit niedrigem Einstieg.'],
        ],
        'it' => [
            'automatisierbar' => ['GitHub Copilot', 'Automatisiert Boilerplate, Tests und Dokumentation direkt in der bestehenden IDE.'],
            'ki-unterstuetzt' => ['Cursor', 'KI-nativer Code-Editor für komplexe Refactorings und tiefergehende Code-Reviews.'],
            'pruefung'        => ['GitHub Copilot', 'Einfachster Einstieg in KI-Entwicklerunterstützung mit messbarer Zeitersparnis ab Tag eins.'],
        ],
        'data' => [
            'automatisierbar' => ['Tableau (Pulse)', 'Automatisierte Datenüberwachung mit KI-gestützter Anomalieerkennung ohne manuelle Abfragen.'],
            'ki-unterstuetzt' => ['Julius AI', 'Ermöglicht Datenanalyse per natürlicher Sprache — ohne SQL oder Programmierkenntnisse.'],
            'pruefung'        => ['Power BI mit Copilot', 'Niedrigschwelliger KI-Einstieg für Teams, die bereits Microsoft-Infrastruktur nutzen.'],
        ],
        'legal' => [
            'automatisierbar' => ['Ironclad AI', 'Automatisiert Standardvertragsanalyse gegen vordefinierte Regelwerke.'],
            'ki-unterstuetzt' => ['Harvey AI', 'Unterstützt bei Recherche, Vertragsanalyse und Dokumentenentwürfen — speziell für Juristen kalibriert.'],
            'pruefung'        => ['Luminance', 'DSGVO-konformer Einstieg in KI-gestützte Dokumentenanalyse für Rechtsteams.'],
        ],
        'support' => [
            'automatisierbar' => ['Zendesk AI', 'Beantwortet Standardanfragen automatisch und leitet komplexe Tickets an Menschen weiter.'],
            'ki-unterstuetzt' => ['Intercom (Fin AI)', 'Löst einfache Anfragen autonom und gibt Agenten vollen Kontext für komplexere Fälle.'],
            'pruefung'        => ['Freshdesk (Freddy AI)', 'Modularer KI-Einstieg für Support-Teams ohne vollständigen Systemwechsel.'],
        ],
        'logistics' => [
            'automatisierbar' => ['SAP TM (KI-Features)', 'Automatisiert Transportplanung, Frachtoptimierung und Sendungsverfolgung regelbasiert.'],
            'ki-unterstuetzt' => ['Microsoft Copilot', 'Unterstützt bei Dokumentation, Kommunikation und operativen Auswertungen.'],
            'pruefung'        => ['Make (Integromat)', 'Erster Schritt zur Prozessautomatisierung zwischen Systemen ohne Programmieraufwand.'],
        ],
        'healthcare' => [
            'automatisierbar' => ['Doctolib (KI-Funktionen)', 'Automatisiert Terminbuchung, Erinnerungen und Patientenadministration DSGVO-konform.'],
            'ki-unterstuetzt' => ['Dragon Medical One', 'Diktier-KI für medizinische Dokumentation — erhebliche Zeitersparnis bei hoher Genauigkeit.'],
            'pruefung'        => ['Microsoft Copilot', 'Für administrative Aufgaben außerhalb des klinischen Kernprozesses geeigneter Einstieg.'],
        ],
        'education' => [
            'automatisierbar' => ['Notion AI', 'Erstellt und pflegt Kursmaterialien, Zusammenfassungen und Lernpfade automatisch.'],
            'ki-unterstuetzt' => ['Synthesia', 'Erstellt Lernvideos aus Skripten ohne Aufnahmeaufwand — Inhalte bleiben beim Trainer.'],
            'pruefung'        => ['NotebookLM', 'Eignet sich für erste KI-Experimente bei Recherche und Materialaufbereitung.'],
        ],
        'executive' => [
            'automatisierbar' => ['Microsoft Copilot', 'Automatisiert Briefings, Meeting-Zusammenfassungen und Termin-Vor- und Nachbereitung.'],
            'ki-unterstuetzt' => ['Perplexity Pro', 'Liefert schnelle, quellenbelegte Markt- und Wettbewerberinformationen zur Entscheidungsvorbereitung.'],
            'pruefung'        => ['NotebookLM', 'Analysiert interne Dokumente und Berichte für strukturierte Entscheidungsvorlagen.'],
        ],
        'creative' => [
            'automatisierbar' => ['Canva AI (Magic Studio)', 'Generiert Designvarianten, Hintergründe und Marketingassets auf Basis von Briefings.'],
            'ki-unterstuetzt' => ['Adobe Firefly', 'KI-Bildgenerierung nativ in Creative Cloud — lizenzrechtlich sicher für kommerzielle Nutzung.'],
            'pruefung'        => ['Midjourney', 'Starke Bildgenerierung für Konzeptphasen — Nutzungsrechte vor kommerziellem Einsatz klären.'],
        ],
        'generic' => [
            'automatisierbar' => ['n8n', 'Automatisiert wiederkehrende, regelbasierte Prozesse flexibel und datenschutzkonform.'],
            'ki-unterstuetzt' => ['Microsoft Copilot', 'Unterstützt bei Texterstellung, Zusammenfassungen und Datenauswertungen direkt in Office.'],
            'pruefung'        => ['ChatGPT (Plus)', 'Vielseitiger Einstiegspunkt für KI-Experimente ohne IT-Einrichtungsaufwand.'],
        ],
    ];

    $defaults = $roleDefaults[$roleCategory] ?? $roleDefaults['generic'];
    $toolData  = $defaults[$taskCategory] ?? $defaults['ki-unterstuetzt'];
    return ['name' => $toolData[0], 'reason' => $toolData[1]];
}

/* =========================================
   TEXTGENERIERUNG
   ========================================= */

function generateTaskReasoning(
    string $name, int $rep, int $std, int $jud,
    string $category, string $roleCategory, int $idx
): string {
    $repL = match($rep) {
        1 => 'gleichförmig und gut vorhersehbar',
        2 => 'teils routinemäßig, teils situationsabhängig',
        3 => 'von Fall zu Fall verschieden',
        default => 'variabel'
    };
    $stdL = match($std) {
        1 => 'folgt klaren Regeln und definierten Prozessen',
        2 => 'ist teils standardisiert, teils ermessensabhängig',
        3 => 'erfordert erhebliches Ermessen und Erfahrung',
        default => 'ist teilweise strukturiert'
    };
    $judL = match($jud) {
        1 => 'kommt ohne menschliches Urteilsvermögen aus',
        2 => 'erfordert punktuell situatives Urteil',
        3 => 'lebt von menschlichem Kontext, Empathie und Erfahrung',
        default => 'erfordert teilweise Beurteilung'
    };

    // Variante nach Index wählen — so variieren aufeinanderfolgende Aufgaben
    $v  = $idx % 3;
    $n  = "\u{201E}{$name}\u{201C}"; // „name"

    if ($category === 'automatisierbar') {
        $opts = [
            "{$n} ist {$repL} und {$stdL} — ein Profil, das direkt für vollständige Automatisierung qualifiziert. Da die Aufgabe {$judL}, kann KI sie zuverlässig und schneller übernehmen als jeder manuelle Ablauf. Die freigewordene Zeit lässt sich direkt in strategisch wertvollere Tätigkeiten investieren.",
            "Das Muster bei {$n} ist eindeutig: {$repL}, {$stdL}, und die Aufgabe {$judL}. Genau diese Kombination macht sie zum idealen Kandidaten für Automatisierung — mit maximalem Return on Investment nach minimaler Einrichtungszeit.",
            "{$n} erfüllt alle Voraussetzungen für eine vollständige KI-Übernahme: Die Aufgabe ist {$repL} und {$stdL}. Weil sie {$judL}, entstehen keine Qualitätsverluste — im Gegenteil, KI liefert hier konsistentere Ergebnisse als ein manueller Prozess.",
        ];
        return $opts[$v];
    }

    if ($category === 'ki-unterstuetzt') {
        $opts = [
            "{$n} hat einen klar strukturierbaren Anteil, der sich gut an KI delegieren lässt — Rohentwürfe, Vorverarbeitung oder erste Analysen. Die Aufgabe ist {$repL} und {$stdL}, {$judL} — das macht sie zum Paradebeispiel für Mensch-KI-Kollaboration: KI liefert den Ausgangspunkt, Sie die Qualitätssicherung.",
            "Bei {$n} greift das Kernprinzip guter KI-Zusammenarbeit: Die Aufgabe ist {$repL} und {$stdL}. Da sie {$judL}, übernimmt KI den vorbereitenden Teil, während die inhaltliche Entscheidung beim Menschen bleibt. Die Effizienzgewinne sind real und sofort spürbar.",
            "{$n} profitiert von KI-Unterstützung, ohne dabei vollständig automatisierbar zu sein. {$stdL} und {$judL} — das ergibt eine klare Aufgabenteilung: KI erstellt den ersten validen Entwurf, Sie steuern Kontext, Ton und Freigabe bei.",
        ];
        return $opts[$v];
    }

    if ($category === 'menschlich') {
        $opts = [
            "{$n} lebt von Qualitäten, die KI nicht replizieren kann: Die Aufgabe {$judL} und ist {$repL}. KI kann hier höchstens unterstützende Hintergrundinformationen bereitstellen — die eigentliche Durchführung ist und bleibt eine originär menschliche Kernkompetenz dieser Stelle.",
            "Hier ist KI als Ersatz fehl am Platz. {$n} {$judL} und ist {$stdL} — beides zeigt auf Tätigkeiten, bei denen menschliche Präsenz, Erfahrungsurteil und Vertrauensaufbau die eigentliche Wertschöpfung ausmachen. Die KI-Einführung an anderen Stellen schafft gerade mehr Raum für Aufgaben wie diese.",
            "{$n} gehört zum unersetzlichen menschlichen Kern dieser Stelle: {$judL} und {$repL}. Diese Aufgabe zeigt, warum KI-Integration keine Gleichmacherei ist — sie verlagert Zeit und Energie dorthin, wo menschliche Kompetenz wirklich gebraucht wird.",
        ];
        return $opts[$v];
    }

    // pruefung (default)
    $opts = [
        "{$n} zeigt gemischte Signale: {$repL}, {$stdL}, und {$judL}. Das KI-Potenzial ist vorhanden, aber die Umsetzung erfordert Sorgfalt. Starten Sie mit einem kontrollierten Pilot in begrenztem Umfang und messen Sie Qualität und Aufwand, bevor Sie breiter ausrollen.",
        "Das Potenzial bei {$n} ist real — aber nicht auf direktem Weg erschließbar. Die Aufgabe ist {$stdL} und {$judL}, was weder klare Automatisierung noch rein menschliche Verantwortung ergibt. Eine Pilotphase schafft die Fakten, auf denen eine belastbare Entscheidung aufbaut.",
        "Bei {$n} lohnt eine differenzierte Betrachtung vor dem Einstieg. {$repL} und {$stdL} — ob KI hier echten Mehrwert bringt, hängt von der konkreten Ausgestaltung ab. Beginnen Sie mit einem Zwei-Wochen-Pilot und vergleichen Sie Ergebnis und Aufwand mit dem Status quo.",
    ];
    return $opts[$v];
}

function generateEinleitung(
    string $roleTitle, string $roleCategory,
    array $taskAnalysis, array $goals
): string {
    $contexts = [
        'hr'        => "Im HR-Management verschiebt sich mit KI-Integration der Schwerpunkt von administrativer Verwaltung hin zu strategischer Personalarbeit — genau das, wofür diese Stelle eigentlich gedacht ist.",
        'finance'   => "Finance- und Controlling-Rollen zählen zu den Bereichen mit dem höchsten messbaren KI-ROI — insbesondere bei dokumenten- und datenintensiven Prozessen, die präzise, aber repetitiv ablaufen.",
        'marketing' => "Marketing-Teams profitieren früh und direkt von KI: Von der Contentproduktion über Kampagnenoptimierung bis zur Marktanalyse sind Einstiegspunkte zahlreich und die Lernkurve flach.",
        'sales'     => "Vertriebsrollen stehen im Zentrum der KI-Transformation: Wer schneller und präziser auf Kunden reagiert, gewinnt — und KI macht genau das skalierbar, ohne an menschlicher Bindungskraft zu verlieren.",
        'operations' => "Operative Rollen profitieren besonders dann, wenn KI wiederkehrende Koordinations- und Dokumentationsaufgaben übernimmt — und so Kapazität für die strategische Steuerung freisetzt, die wirklich zählt.",
        'it'        => "IT-Rollen erleben durch KI einen produktivitätssteigernden Wandel: Repetitive Entwicklungsarbeit, Tests und Dokumentation werden erheblich beschleunigt — Architektur und Problemlösung bleiben beim Menschen.",
        'data'      => "Daten- und Analyserollen profitieren enorm: KI beschleunigt Analysezyklen, automatisiert Reporting und schafft Raum, um sich auf Interpretation und strategische Entscheidungsfindung zu konzentrieren.",
        'legal'     => "Im Rechts- und Compliance-Bereich verspricht KI substanzielle Entlastung bei Dokumentenanalyse und Recherche — bei konsequentem DSGVO-Fokus und klarer menschlicher Verantwortung für alle Urteile.",
        'support'   => "Support-Teams stehen vor einem produktiven Paradox: Je mehr KI Standardanfragen löst, desto mehr Kapazität entsteht für komplexe, wertschöpfende Kundengespräche — die eigentliche Stärke dieser Rolle.",
        'logistics' => "In der Logistik entfaltet KI sein Potenzial bei Disposition, Dokumentenverarbeitung und proaktiver Ausnahmebehandlung — mit direkter Auswirkung auf Liefertreue, Kosten und Kundenzufriedenheit.",
        'healthcare' => "Im Gesundheitswesen liegt das KI-Potenzial primär in der administrativen Entlastung — klinische Kernkompetenz, Empathie und menschliche Fürsorge bleiben dabei klar und unverrückbar beim Menschen.",
        'education' => "In Bildungs- und Trainingsrollen kann KI Vorbereitung, Nachbereitung und Materialerstellung erheblich beschleunigen — die eigentliche Lernerfahrung und pädagogische Beziehung bleibt originär menschlich.",
        'executive' => "Auf Führungsebene unterstützt KI durch schnellere Informationsaggregation, strukturierte Entscheidungsvorbereitung und entlastete Kommunikation — strategische Weichenstellungen bleiben beim Menschen.",
        'creative'  => "Kreative Rollen profitieren nicht durch Ersatz, sondern durch Beschleunigung: KI übernimmt Rohentwürfe, Recherche und Varianten — damit mehr Zeit für das bleibt, was KI schlicht nicht kann.",
        'generic'   => "KI-Integration verändert heute nahezu jede Berufsstelle, unabhängig von Branche oder Funktionsbereich — die entscheidende Frage ist nicht ob, sondern wo und wie der erste sinnvolle Schritt gelingt.",
    ];

    $goalFraming = [
        'time'      => "Mit dem klaren Fokus auf Zeitersparnis zeigt die Analyse, wo Automatisierung sofort und dauerhaft wirkt.",
        'quality'   => "Der Qualitätsfokus lenkt den Blick auf Aufgaben, bei denen KI Fehlerquellen reduziert und Konsistenz sichert, die manuell schwer zu halten ist.",
        'admin'     => "Im Mittelpunkt steht die Reduktion administrativer Last — Dokumentation, E-Mails und Reporting werden gezielt entschlackt.",
        'decisions' => "KI wird hier als Analysewerkzeug eingesetzt: schnellere Datenauswertung, bessere Informationsgrundlagen, klarere Entscheidungsbasis.",
        'focus'     => "Das Ziel ist Befreiung: lästige Routinen werden delegiert, damit Energie und Aufmerksamkeit für bedeutsame Arbeit entstehen.",
    ];

    $context  = $contexts[$roleCategory]  ?? $contexts['generic'];
    $goalText = '';
    if (!empty($goals)) {
        $goalText = ' ' . ($goalFraming[$goals[0]] ?? '');
    }

    $cats      = array_column($taskAnalysis, 'category');
    $aiCount   = count(array_filter($cats, fn($c) => in_array($c, ['automatisierbar', 'ki-unterstuetzt'])));
    $total     = count($cats);
    $humanOnly = $aiCount === 0;

    if ($humanOnly) {
        $tailoring = "Die Analyse von {$total} Kernaufgaben ergibt ein differenziertes Bild: Der menschliche Kern dieser Stelle ist stark — KI spielt hier eine ergänzende, keine tragende Rolle.";
    } elseif ($aiCount === $total) {
        $tailoring = "Alle {$total} analysierten Kernaufgaben bieten konkretes KI-Potenzial — ein klares Signal für einen fokussierten, schrittweisen Einstieg.";
    } else {
        $tailoring = "Von den {$total} Kernaufgaben bieten {$aiCount} konkretes KI-Potenzial — ein realistisches Verhältnis, das einen gezielten Einstieg ohne Überforderung erlaubt.";
    }

    return "{$context}{$goalText} {$tailoring}";
}

function generateKollaborationsmodell(
    string $roleTitle, string $roleCategory,
    array $taskAnalysis, array $goals
): string {
    $autoTasks  = array_values(array_filter($taskAnalysis, fn($t) => $t['category'] === 'automatisierbar'));
    $kiTasks    = array_values(array_filter($taskAnalysis, fn($t) => $t['category'] === 'ki-unterstuetzt'));
    $humanTasks = array_values(array_filter($taskAnalysis, fn($t) => $t['category'] === 'menschlich'));

    $roleFrames = [
        'hr'        => 'als strategischer Personalpartner statt als Verwalter',
        'finance'   => 'als analytischer Finanzstratege statt als Datenpfleger',
        'marketing' => 'als kreativer Markenstratege statt als Content-Produzent',
        'sales'     => 'als beziehungsgetriebener Vertriebspartner statt als Datenpfleger',
        'operations'=> 'als strategischer Prozessgestalter statt als Koordinationsmaschine',
        'it'        => 'als Architektur- und Problemlösungsexperte statt als Code-Schreiber',
        'data'      => 'als Interpret und Entscheider statt als Datenaufbereiter',
        'legal'     => 'als juristischer Urteilsträger statt als Dokumenten-Sortierer',
        'support'   => 'als Experte für komplexe Situationen statt als FAQ-Beantworter',
        'logistics' => 'als strategischer Netzwerkgestalter statt als Dispositions-Assistent',
        'healthcare'=> 'als klinischer und empathischer Kompetenzträger statt als Dokumentations-Ressource',
        'education' => 'als Gestalter von Lernerfahrungen statt als Materiallieferant',
        'executive' => 'als strategischer Entscheidungsträger statt als Informationsverarbeiter',
        'creative'  => 'als kreativer Kurator und Qualitätssicherer statt als Produktionseinheit',
        'generic'   => 'als Experte für Entscheidungen und Beziehungen statt als Aufgaben-Abarbeiter',
    ];
    $roleFrame = $roleFrames[$roleCategory] ?? $roleFrames['generic'];

    $parts = [];
    $parts[] = "Das Zukunftsbild für die Stelle des {$roleTitle} ist klar: KI übernimmt den strukturierten, regelbasierten Teil der Arbeit — und schafft so Raum, {$roleFrame} zu agieren.";

    $aiParts = [];
    if (!empty($autoTasks)) {
        $names = listTaskNames($autoTasks, 2);
        $aiParts[] = "{$names} laufen vollständig automatisiert im Hintergrund";
    }
    if (!empty($kiTasks)) {
        $names = listTaskNames($kiTasks, 2);
        $aiParts[] = "bei {$names} liefert KI den strukturierten Ausgangspunkt, den der {$roleTitle} veredelt und freigibt";
    }
    if (!empty($aiParts)) {
        $parts[] = ucfirst(implode('; ', $aiParts)) . '.';
    }

    if (!empty($humanTasks)) {
        $names = listTaskNames($humanTasks, 3);
        $parts[] = "Was bleibt — und was bleibt immer: {$names}. Diese Aufgaben erfordern menschliches Urteilsvermögen, Vertrauen und situatives Handeln, das kein Algorithmus replizieren kann.";
    } else {
        $parts[] = "Die menschliche Kernkompetenz dieser Stelle — strategisches Denken, Beziehungsgestaltung und situatives Urteilsvermögen — wird durch KI-Integration nicht ersetzt, sondern durch den Wegfall repetitiver Arbeit erst vollständig freigesetzt.";
    }

    $goalClosings = [
        'time'      => "Das Ergebnis ist eine Rolle, die mehr leistet — nicht weil sie mehr arbeitet, sondern weil sie an den richtigen Stellen intelligenter arbeitet.",
        'quality'   => "Das Ergebnis ist nicht nur mehr Kapazität, sondern konsistentere Qualität in allem, wofür der Mensch die Verantwortung trägt.",
        'admin'     => "Weniger Verwaltungsaufwand bedeutet mehr Energie für die Arbeit, die wirklich einen Unterschied macht.",
        'decisions' => "Bessere Datengrundlagen und schnellere Analysen machen aus einem guten Entscheider einen exzellenten.",
        'focus'     => "Wenn lästige Routinen verschwinden, entsteht Raum für die Arbeit, die motiviert — und die nur Menschen wirklich gut machen können.",
    ];
    $closing = (!empty($goals) ? ($goalClosings[$goals[0]] ?? null) : null)
        ?? "Diese Aufteilung ist kein Kompromiss — sie ist die konsequente Weiterentwicklung einer leistungsstarken Rolle.";
    $parts[] = $closing;

    return implode(' ', $parts);
}

function generateUmsetzungsplan(
    array $taskAnalysis, string $roleCategory,
    array $goals, string $roleTitle
): array {
    $autoTasks  = array_values(array_filter($taskAnalysis, fn($t) => $t['category'] === 'automatisierbar'));
    $kiTasks    = array_values(array_filter($taskAnalysis, fn($t) => $t['category'] === 'ki-unterstuetzt'));
    $pruefTasks = array_values(array_filter($taskAnalysis, fn($t) => $t['category'] === 'pruefung'));
    $shortLabel = getRoleShortLabel($roleCategory);

    // Phase 1: Quick Wins
    $p1Items = [];
    foreach (array_slice($autoTasks, 0, 2) as $task) {
        if ($task['toolName']) {
            $tq = "\u{201E}{$task['taskName']}\u{201C}";
            $p1Items[] = "{$task['toolName']} für {$tq} einrichten und testen — Zeiteinsparung ist innerhalb der ersten Woche messbar.";
        }
    }
    if (count($p1Items) < 2) {
        foreach (array_slice($kiTasks, 0, 2 - count($p1Items)) as $task) {
            if ($task['toolName']) {
                $tq = "\u{201E}{$task['taskName']}\u{201C}";
                $p1Items[] = "Pilottest: {$task['toolName']} für {$tq} eine Woche parallel zur bestehenden Arbeitsweise einsetzen und Aufwand vergleichen.";
            }
        }
    }
    if (empty($p1Items)) {
        $p1Items[] = "Microsoft 365 oder Google Workspace auf bereits enthaltene KI-Features prüfen — viele sind bereits lizenziert, aber nicht aktiviert.";
        $p1Items[] = "ChatGPT oder Perplexity Pro für eine Woche als KI-Assistent testen: Für welche Alltagsaufgaben bringt es den größten Mehrwert?";
    }
    $p1Items[] = "Ziele und Qualitätsstandards für alle eingeführten KI-Tools klar definieren und im Team kommunizieren.";
    $p1Items[] = "Zeitmessung starten: Wie lange dauern die Pilotaufgaben vor und nach KI-Einsatz? Baseline für spätere Evaluation schaffen.";

    // Phase 2: Integration
    $p2Items = [];
    foreach (array_slice($kiTasks, 0, 3) as $task) {
        if ($task['toolName']) {
            $tq = "\u{201E}{$task['taskName']}\u{201C}";
            $p2Items[] = "{$task['toolName']} fest in den Workflow für {$tq} integrieren — Qualitätsprüfung durch den {$shortLabel} bleibt verpflichtend.";
        }
    }
    if (!empty($autoTasks)) {
        $p2Items[] = "Automatisierungen aus Phase 1 in den Regelbetrieb überführen und Ausnahme-Handling definieren: Was tut KI bei unbekannten Fällen?";
    }
    $p2Items[] = "3-Monats-Review: Zeiteinsparung, Fehlerquote und Nutzungshäufigkeit der eingeführten Tools auswerten.";
    if (in_array('decisions', $goals)) {
        $p2Items[] = "Entscheidungs-Dashboard aufbauen: Daten aus automatisierten Prozessen aggregieren und als Entscheidungsgrundlage nutzbar machen.";
    }
    if (in_array('admin', $goals)) {
        $p2Items[] = "Dokumentations- und Reporting-Workflows auf KI-Erstellung umstellen — {$shortLabel} prüft und gibt frei.";
    }
    if (empty($p2Items)) {
        $p2Items[] = "Bestehende Tool-Implementierungen auf weitere Aufgabenbereiche ausweiten.";
        $p2Items[] = "Feedback des Teams einsammeln: Was funktioniert, was verursacht Reibung?";
    }

    // Phase 3: Transformation
    $p3Items = [];
    if (!empty($pruefTasks)) {
        $task = $pruefTasks[0];
        $tq = "\u{201E}{$task['taskName']}\u{201C}";
        $p3Items[] = "Pilotauswertung für {$tq} abschließen: Hat KI-Unterstützung hier den erhofften Mehrwert gebracht? Entscheidung über Skalierung treffen.";
    }
    $p3Items[] = "Lessons Learned dokumentieren: Welche Tools bleiben, welche wurden ersetzt, was wurde angepasst?";
    $p3Items[] = "KI-Kompetenz im Team verbreitern: Internes Schulungsformat entwickeln, damit alle Beteiligten sicher und eigenständig mit den eingeführten Tools arbeiten.";
    $p3Items[] = "Nächste Automatisierungswelle identifizieren: Mit 6 Monaten Praxiserfahrung entstehen neue Möglichkeiten, die heute noch nicht sichtbar sind.";
    if (in_array('focus', $goals)) {
        $p3Items[] = "Mitarbeiterbefragung durchführen: Hat die KI-Integration die wahrgenommene Sinnhaftigkeit und Zufriedenheit in der Rolle messbar erhöht?";
    }
    if (in_array('quality', $goals)) {
        $p3Items[] = "Qualitäts-Audit: Systematisch prüfen, ob KI-gestützte Outputs die definierten Qualitätsstandards zuverlässig einhalten.";
    }

    return [
        'phase1' => [
            'label' => 'Phase 1 – Quick Wins',
            'intro' => 'Erste KI-Tools dort einführen, wo Einrichtungsaufwand minimal und Wirkung maximal ist.',
            'items' => array_slice($p1Items, 0, 5),
        ],
        'phase2' => [
            'label' => 'Phase 2 – Integration',
            'intro' => 'Erfolgreiche Piloten in den Regelbetrieb überführen und weitere Aufgaben systematisch erschließen.',
            'items' => array_slice($p2Items, 0, 5),
        ],
        'phase3' => [
            'label' => 'Phase 3 – Transformation',
            'intro' => 'KI-Nutzung evaluieren, skalieren und zur dauerhaften, selbstverständlichen Arbeitsweise machen.',
            'items' => array_slice($p3Items, 0, 5),
        ],
    ];
}

function generateAbschluss(
    string $roleTitle, array $taskAnalysis,
    array $goals, string $roleCategory
): string {
    $autoTasks = array_values(array_filter($taskAnalysis, fn($t) => $t['category'] === 'automatisierbar'));
    $kiTasks   = array_values(array_filter($taskAnalysis, fn($t) => $t['category'] === 'ki-unterstuetzt'));

    $firstTask = $autoTasks[0] ?? $kiTasks[0] ?? null;

    if ($firstTask && $firstTask['toolName']) {
        $starters = [
            'time'      => "Wenn Sie heute eine Sache angehen",
            'admin'     => "Der schnellste Weg zur Entlastung",
            'quality'   => "Der wirkungsvollste erste Schritt",
            'focus'     => "Um sofort spürbare Verbesserungen zu erleben",
            'decisions' => "Für bessere Entscheidungsgrundlagen ab sofort",
        ];
        $starter = (!empty($goals) ? ($starters[$goals[0]] ?? null) : null) ?? "Der empfohlene Einstieg";
        $tq = "\u{201E}{$firstTask['taskName']}\u{201C}";
        return "{$starter}: {$firstTask['toolName']} für {$tq} einrichten. Die Lernkurve ist flach, die Wirkung ist innerhalb weniger Tage messbar — und dieser erste Schritt schafft das Vertrauen und die Praxis, die alle weiteren KI-Integrationen erleichtern.";
    }

    return "Starten Sie mit einem strukturierten Zwei-Wochen-Pilot: Wählen Sie eine Aufgabe, setzen Sie ein KI-Tool ein und messen Sie den Unterschied zu Ihrem bisherigen Vorgehen. Diese erste konkrete Erfahrung ist die wertvollste Grundlage für alle weiteren Entscheidungen — besser als jede Theorie.";
}

/* =========================================
   HILFSFUNKTIONEN
   ========================================= */

function listTaskNames(array $tasks, int $max): string
{
    $names = array_slice(array_column($tasks, 'taskName'), 0, $max);
    $oq = "\u{201E}";
    $cq = "\u{201C}";
    if (count($names) === 1) return $oq . $names[0] . $cq;
    $last = array_pop($names);
    return implode(', ', array_map(fn($n) => $oq . $n . $cq, $names)) . ' und ' . $oq . $last . $cq;
}

function getRoleShortLabel(string $roleCategory): string
{
    return match($roleCategory) {
        'hr'        => 'HR-Verantwortlichen',
        'finance'   => 'Finance-Experten',
        'marketing' => 'Marketing-Manager',
        'sales'     => 'Sales-Manager',
        'operations'=> 'Operations-Verantwortlichen',
        'it'        => 'IT-Experten',
        'data'      => 'Data-Analysten',
        'legal'     => 'Juristen',
        'support'   => 'Support-Experten',
        'logistics' => 'Logistik-Experten',
        'healthcare'=> 'medizinischen Fachkraft',
        'education' => 'Trainer',
        'executive' => 'Führungskraft',
        'creative'  => 'kreativen Experten',
        default     => 'Fachexperten',
    };
}

function clean(string $s): string
{
    return strip_tags(trim($s));
}

function clamp(int $v, int $min, int $max): int
{
    return max($min, min($max, $v));
}
