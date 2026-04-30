/**
 * Beispiel-Datenobjekt für RoleShiftDashboard
 *
 * So bindest du echte Kalkulator-Daten ein:
 *
 *   // Option A — direkt aus dem PHP-API (fetch)
 *   const res  = await fetch('/api/role-analysis.php', { method: 'POST', body: JSON.stringify(payload) });
 *   const raw  = await res.json();
 *   const data = mapApiToResultData(raw);  // Mapping-Funktion unten
 *   return <RoleShiftDashboard resultData={data} />;
 *
 *   // Option B — aus deinem eigenen State / Redux
 *   const data = buildResultData(calculatorState);
 *   return <RoleShiftDashboard resultData={data} />;
 */

export const exampleResultData = {

  /* ── Rolle ─────────────────────────────── */
  role: {
    title:      'Marketing Manager',
    department: 'Marketing & Kommunikation',
    category:   'marketing',           // für interne Logik
  },

  /* ── Kernergebnisse ────────────────────── */
  score:      72,           // 0 – 100: KI-Bereitschafts-Score
  confidence: 87,           // 0 – 100: Vertrauen in die Analyse
  riskLevel:  'medium',     // 'low' | 'medium' | 'high'
  status:     'KI-bereit',  // Anzeige-Label im Hero

  /* ── Aufgabenverteilung (% muss 100 ergeben) */
  distribution: {
    automatisierbar: 25,   // vollständig automatisierbar
    kiUnterstuetzt:  38,   // mit KI-Unterstützung
    pruefung:        22,   // menschliche Prüfung nötig
    menschlich:      15,   // rein menschlich
  },

  /* ── KPI-Karten ────────────────────────── */
  kpis: [
    { id: 'potential',  label: 'KI-Potenzial',    value: '63%',    delta: '+8%', trend: 'up'   },
    { id: 'human',      label: 'Menschl. Kern',   value: '37%',    delta: null,  trend: null   },
    { id: 'efficiency', label: 'Effizienzgewinn', value: '2.4×',   delta: null,  trend: null   },
    { id: 'effort',     label: 'Impl. Aufwand',   value: 'Mittel', delta: null,  trend: null   },
  ],

  /* ── Trendkurve (optional — leer lassen wenn nicht vorhanden) */
  trendData: [
    { period: 'Jan', automation: 41, aiAssist: 24 },
    { period: 'Feb', automation: 48, aiAssist: 29 },
    { period: 'Mär', automation: 52, aiAssist: 34 },
    { period: 'Apr', automation: 59, aiAssist: 39 },
    { period: 'Mai', automation: 64, aiAssist: 44 },
    { period: 'Jun', automation: 72, aiAssist: 51 },
  ],

  /* ── Faktoren-Analyse ──────────────────── */
  factors: [
    { name: 'Wiederholbarkeit',   score: 4, max: 5, inverted: false },
    { name: 'Strukturierbarkeit', score: 3, max: 5, inverted: false },
    { name: 'Urteilsbedarf',      score: 2, max: 5, inverted: true  }, // inverted = niedrig ist gut
    { name: 'Datenverfügbarkeit', score: 4, max: 5, inverted: false },
    { name: 'Regulierungsgrad',   score: 2, max: 5, inverted: true  },
  ],

  /* ── Empfehlungen ──────────────────────── */
  recommendations: [
    {
      priority:    'high',
      title:       'Reporting automatisieren',
      description: 'BI-Tools für automatische Berichte sparen ca. 6 Std./Woche.',
      tool:        'Tableau + ChatGPT',
    },
    {
      priority:    'medium',
      title:       'KI-Schreibassistenz einführen',
      description: 'Content-Erstellung beschleunigen, menschliche Kontrolle behalten.',
      tool:        'Jasper AI',
    },
    {
      priority:    'low',
      title:       'Interne Datenpipeline aufbauen',
      description: 'Langfristig: zentrale Datenquelle für KI-Auswertungen.',
      tool:        'Intern',
    },
  ],

  /* ── Freitexte aus PHP-Backend ─────────── */
  einleitung: 'Als Marketing Manager liegt Ihre Rolle an der Schnittstelle zwischen kreativem Denken und datengetriebener Entscheidung. Das KI-Potenzial ist in dieser Rolle überdurchschnittlich hoch – besonders in den Bereichen Reporting und Content-Produktion.',
};


/**
 * Mapping-Funktion: PHP-API-Response → resultData
 *
 * Passe diese Funktion an deine tatsächliche API-Antwort an.
 * Die PHP-API gibt zurück: { role, summary, einleitung, kollaborationsmodell, umsetzungsplan, abschluss }
 */
export function mapApiToResultData(apiResponse, roleConfig) {
  const s = apiResponse.summary || {};

  // Gesamtpotenzial = automatisierbar + kiUnterstuetzt
  const aiPotential = (s.automatisierbar || 0) + (s.kiUnterstuetzt || 0);

  // Einfacher Heuristik-Score aus den Anteilen
  const score = Math.min(100, Math.round(aiPotential * 0.85 + (s.automatisierbar || 0) * 0.15));

  return {
    role: {
      title:      roleConfig?.title || 'Unbekannte Rolle',
      department: roleConfig?.department || '',
      category:   apiResponse.role?.category || 'generic',
    },
    score,
    confidence: 80,   // ggf. aus API befüllen
    riskLevel:  score >= 70 ? 'low' : score >= 40 ? 'medium' : 'high',
    status:     score >= 70 ? 'KI-bereit' : score >= 40 ? 'In Entwicklung' : 'Vorbereitung nötig',
    distribution: {
      automatisierbar: s.automatisierbar || 0,
      kiUnterstuetzt:  s.kiUnterstuetzt  || 0,
      pruefung:        s.pruefung        || 0,
      menschlich:      s.menschlich      || 0,
    },
    kpis: [
      { id: 'potential',  label: 'KI-Potenzial',    value: `${aiPotential}%`,  delta: null, trend: null },
      { id: 'human',      label: 'Menschl. Kern',   value: `${s.menschlich || 0}%`, delta: null, trend: null },
      { id: 'auto',       label: 'Automatisierbar', value: `${s.automatisierbar || 0}%`, delta: null, trend: null },
      { id: 'review',     label: 'Prüfung nötig',   value: `${s.pruefung || 0}%`, delta: null, trend: null },
    ],
    trendData:       [],    // optional: aus historischen Daten befüllen
    factors:         [],    // optional: aus roleConfig.tasks befüllen
    recommendations: [],    // optional: aus umsetzungsplan befüllen
    einleitung:      apiResponse.einleitung || '',
  };
}
