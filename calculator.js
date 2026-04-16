/* =========================================
   ROLESHIFT — CALCULATOR ENGINE v2
   Expert-level rules-based recommendation
   ========================================= */

// --- THEME INIT (runs before paint) -------
(function () {
  const stored = localStorage.getItem('rs-theme');
  if (stored === 'dark' || stored === 'light') {
    document.documentElement.setAttribute('data-theme', stored);
  }
})();

const state = {
  current: 1,
  data: {
    roleTitle: '', roleTasks: '',
    repetitive: 0, standardized: 0, judgment: 0, customerFacing: 0,
    costOfMistakes: 0, sensitivity: 0, accountability: 0, reviewNeeded: 0,
    documentation: 0, dataStructure: 0, aiReadiness: 0, toolsAdopted: 0,
    goals: []
  }
};

// --- PROGRESS BAR ------------------------
function setProgress(step) {
  const fill  = document.getElementById('progressFill');
  const label = document.getElementById('progressLabel');
  if (fill)  fill.style.width  = step <= 5 ? (step / 5 * 100) + '%' : '100%';
  if (label) label.textContent = step <= 5 ? `Schritt ${step} von 5` : 'Ihre Analyse';
}

// --- NAVIGATION --------------------------
function goTo(nextStep) {
  const cur  = document.getElementById(`step-${state.current}`);
  const next = document.getElementById(`step-${nextStep}`);
  if (!next) return;
  cur?.classList.add('leaving');
  setTimeout(() => {
    cur?.classList.add('calc-step-hidden');
    cur?.classList.remove('leaving');
    next.classList.remove('calc-step-hidden');
    next.style.animation = 'none';
    next.offsetHeight;
    next.style.animation = '';
    state.current = nextStep;
    setProgress(nextStep);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, 260);
}

// --- NEXT / BACK -------------------------
document.querySelectorAll('.calc-next').forEach(btn => {
  btn.addEventListener('click', () => {
    const next = +btn.dataset.next;
    if (state.current === 1) {
      const val = document.getElementById('roleTitle')?.value?.trim();
      if (!val) { document.getElementById('roleTitle')?.focus(); return; }
      state.data.roleTitle = val;
      state.data.roleTasks = document.getElementById('roleTasks')?.value?.trim() || '';
    }
    goTo(next);
  });
});
document.querySelectorAll('.calc-back').forEach(btn =>
  btn.addEventListener('click', () => goTo(+btn.dataset.back))
);

// --- ROLE CHIPS --------------------------
document.querySelectorAll('#roleChips .calc-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('#roleChips .calc-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    const inp = document.getElementById('roleTitle');
    if (inp) { inp.value = chip.dataset.val; }
  });
});
document.getElementById('roleTitle')?.addEventListener('input', e => {
  document.querySelectorAll('#roleChips .calc-chip').forEach(c =>
    c.classList.toggle('active', c.dataset.val === e.target.value)
  );
});

// --- SCALE QUESTIONS ---------------------
document.querySelectorAll('.scale-q').forEach(block => {
  const key = block.dataset.key;
  block.querySelectorAll('.sq-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      block.querySelectorAll('.sq-opt').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      state.data[key] = +btn.dataset.val;
    });
  });
});

// --- GOAL CARDS --------------------------
const generateBtn = document.getElementById('generateBtn');
document.querySelectorAll('.calc-goal-card').forEach(card => {
  card.addEventListener('click', () => {
    const val = card.dataset.val;
    const idx = state.data.goals.indexOf(val);
    if (idx === -1) {
      state.data.goals.push(val);
      card.classList.add('selected');
    } else {
      state.data.goals.splice(idx, 1);
      card.classList.remove('selected');
    }
    if (generateBtn) generateBtn.disabled = state.data.goals.length === 0;
  });
});

// --- GENERATE ----------------------------
generateBtn?.addEventListener('click', () => {
  state.data.roleTitle = document.getElementById('roleTitle')?.value?.trim() || 'Diese Stelle';
  state.data.roleTasks = document.getElementById('roleTasks')?.value?.trim() || '';
  showLoading();

  try {
    const result = computeStructuredResult(state.data);
    renderStructuredResult(result);
  } catch (err) {
    console.error('[RoleShift] Analyse-Fehler:', err);
    showApiError('Die Analyse konnte nicht durchgeführt werden. Bitte versuchen Sie es erneut.');
  }
});

// --- GEMINI API --------------------------
// API key is managed server-side. The frontend sends the assembled request
// body to /api/analyze — the backend adds credentials and proxies to Gemini.
const GEMINI_MODELS = [
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b'
];

// System instruction — expert persona, deep-analysis methodology, and strict output format.
// This is the primary driver of output quality. Kept server-side via /api/analyze.php.
const SYSTEM_INSTRUCTION = `You are not the UI. You are the analysis engine behind the RoleShift calculator.

Act as a senior expert in human–AI collaboration and role redesign.
Your job is to generate a precise, role-specific recommendation for how humans and AI should work together in THIS specific role.

Generic templates are not acceptable. Every sentence must be clearly about THIS role.

═══════════════════════════════════════
STEP 1 — DEEP ROLE ANALYSIS (internal, before writing)
═══════════════════════════════════════

1a) Understand the domain
- What domain does this role belong to? (education, healthcare, logistics, finance, legal, …)
- What are the typical tasks, information flows, decisions, stakeholders, and constraints in that domain?
- If the title is vague, pick the most plausible context and stay consistent throughout.

1b) Interpret the numeric answers
Use every score intentionally:
- High repetitiveness + high standardization → strong automation / AI-support potential.
- High judgement + high error cost + high compliance → human-led; AI only as information layer, mandatory human review.
- Low documentation / low data structure → fix the foundation before deploying tools.
- Low AI readiness → start small, invest in enablement first.

1c) Web research
Before writing your answer, search your knowledge for current, real AI tools and solution types that people in THIS profession and domain realistically use today.
Include domain-specific constraints (student data privacy for teachers, patient safety for nurses, GDPR, union rules, etc.).

═══════════════════════════════════════
STEP 2 — ROLE-SPECIFICITY CHECK (internal, before writing)
═══════════════════════════════════════

For every task, example, and tool you plan to include, ask:
- "Would a person in this role realistically do this task?"
- "Would they realistically use this tool in their actual work environment?"

If the answer to either is no, replace it with something that fits.

Domain examples of what NOT to do:
- For TEACHERS: do not mention applicant tracking, CRM pipelines, or warehouse picking.
  Talk about: lessons, grading, student feedback, parents, curriculum, LMS, school admin systems.
- For NURSES: do not mention marketing or HR performance reviews.
  Talk about: patients, vital signs, medication, documentation, doctor coordination.
- For WAREHOUSE WORKERS: do not mention strategic planning or board presentations.
  Talk about: picking routes, scan errors, shift handovers, safety protocols.

═══════════════════════════════════════
STEP 3 — SELF-CHECK (internal, before writing)
═══════════════════════════════════════

Run this consistency check before producing the final output:
- Do all tasks, examples, and tools clearly match the role and domain?
- Are there contradictions? (e.g. proposing full automation when judgement + error cost + compliance are all 5/5 — if so, correct it silently.)
- Do the AI vs human splits add up logically to ~100%?
- Does the plan address the user's selected priorities?
- Are domain-specific risks and safeguards addressed (e.g. student data for teachers, patient safety for nurses)?

Silently correct any inconsistencies. Only output the corrected version.

═══════════════════════════════════════
OUTPUT FORMAT AND LANGUAGE
═══════════════════════════════════════

- Write your ENTIRE answer in German (professional Geschäftsdeutsch).
- ALL headings, body text, tables, examples, and tool descriptions must be in German.
- Return structured Markdown. Use EXACTLY this section structure — no extra sections, no reordering:

# Kollaborationsmodell für <STELLENBEZEICHNUNG>
1 Absatz: Rollenkontext und empfohlenes Mensch-KI-Modell.
3–5 Aufzählungspunkte: Warum dieses Modell zu den konkreten Bewertungswerten passt.

## Aufgabenverteilung in dieser Stelle
Kurze Einleitung in der Sprache des Berufsfelds (1–2 Sätze).
Dann diese Tabelle (nur realistische Aufgabenbereiche für dieses Berufsbild):

Aufgabenbereich | KI-unterstützt | Automatisierbar | Menschlich geleitet | Menschliche Prüfung
---|---|---|---|---
<Bereich 1> | ja/nein | ja/nein | ja/nein | ja/nein

## Was KI in dieser Stelle übernehmen sollte
3–7 Stichpunkte. Jeder Punkt:
**Aufgabenname** – wie KI konkret hilft und was der Mensch weiterhin tut (in der Fachsprache dieser Berufsgruppe).

## Was Menschen behalten sollten
3–7 Stichpunkte: Urteilsvermögen, Beziehungen, Verantwortung, risikoreiche Entscheidungen — in der Fachsprache des Berufsfelds.

## Umsetzungsplan für <STELLENBEZEICHNUNG>

### Diese Woche bis 30 Tage
3–7 sehr konkrete Schritte im täglichen Workflow dieses Berufsbilds.
Für JEDEN Schritt nennen:
- Wer ist beteiligt? (z.B. Lehrerin, Schulleitung, IT-Admin)
- Was ändert sich konkret in der Praxis?
- Woran erkennt man, dass es funktioniert? (einfacher, messbarer Indikator)

### Nächste 90 Tage
3–7 Schritte zur tieferen Integration — gleiche Detailtiefe (Wer? Was ändert sich? Indikator?).

### Langfristig
3–7 Schritte zur kontinuierlichen Verbesserung — gleiche Detailtiefe.

## Empfohlene KI-Tools für dieses Berufsbild
Kurze Einleitung (1–2 Sätze), dann 3–7 Tools:
- **Tool- oder Kategorienname** – was es konkret für diese Rolle tut (2–3 Sätze). Warum es zu den Rahmenbedingungen des Berufsfelds passt (Datenschutz, Regulation, Praxis-Kontext).
Nur reale Tools oder klar definierte Tool-Kategorien. Niemals Tools, die offensichtlich nicht passen.

## Risiken und Schutzmaßnahmen in diesem Bereich
3–6 Punkte: jeweils ein bereichsspezifisches Risiko + 1 Satz konkrete Gegenmaßnahme.

## Manager-Zusammenfassung
3–5 prägnante Stichpunkte für Führungskräfte dieses Berufsfelds:
Kernaussagen, erwartete Vorteile, notwendige Investitionen — sofort nutzbar für ein Briefing.`;

function buildPrompt(d) {
  // Readable scale labels for Gemini
  const scale = v => {
    if (!v || v <= 0) return 'nicht angegeben';
    return ['', 'sehr niedrig (1/5)', 'niedrig (2/5)', 'mittel (3/5)', 'hoch (4/5)', 'sehr hoch (5/5)'][Math.min(5, v)];
  };
  const goalLabels = {
    time:       'Zeit sparen',
    admin:      'Verwaltung reduzieren',
    quality:    'Qualität verbessern',
    compliance: 'Vertrauen & Compliance sichern',
    speed:      'Durchlaufzeit verkürzen',
    focus:      'Auf Kernaufgaben / höherwertige Arbeit fokussieren'
  };
  const selectedGoals = (d.goals || []).map(g => goalLabels[g] || g).join(', ') || 'nicht angegeben';
  const role  = d.roleTitle || 'Unbekannte Stelle';
  const tasks = d.roleTasks
    ? `\nBeschreibung der tatsächlichen Tätigkeiten (vom Nutzer eingegeben): "${d.roleTasks}"`
    : '\n(Keine detaillierte Tätigkeitsbeschreibung angegeben — bitte aus dem Rollentitel und Domain ableiten.)';

  return `Analysiere die folgende Rollenbewertung und erstelle eine vollständige, stellenspezifische Analyse gemäß den Vorgaben im System-Prompt.

══ ROLLE ══
Stellenbezeichnung: ${role}${tasks}

══ GESCHÄFTLICHE PRIORITÄTEN ══
${selectedGoals}

══ BEWERTUNGSWERTE (1 = sehr niedrig, 5 = sehr hoch) ══

AUFGABENSTRUKTUR
- Repetitivität der täglichen Arbeit: ${scale(d.repetitive)}
  (1 = sehr abwechslungsreich · 5 = sehr routinemäßig)
- Standardisierung der Prozesse: ${scale(d.standardized)}
  (1 = ad-hoc, kontextabhängig · 5 = vollständig regelbasiert)
- Erforderliches Urteilsvermögen: ${scale(d.judgment)}
  (1 = überwiegend regelbasiert · 5 = Urteil ist die Kernaufgabe)
- Kunden-/Beziehungsorientierung: ${scale(d.customerFacing)}
  (1 = intern / Back-Office · 5 = direkter Kundenkontakt)

RISIKO & VERANTWORTUNG
- Fehlerkosten: ${scale(d.costOfMistakes)}
  (1 = leicht korrigierbar · 5 = schwerwiegend, schwer rückgängig)
- Compliance / Datensensibilität: ${scale(d.sensitivity)}
  (1 = keine · 5 = hohe regulatorische Anforderungen)
- Verantwortungsebene: ${scale(d.accountability)}
  (1 = geteilt / unklar · 5 = namentliche Person immer verantwortlich)
- Prüfbedarf vor Output-Verwendung: ${scale(d.reviewNeeded)}
  (1 = direkt verwendet, keine Prüfung · 5 = immer geprüft und freigegeben)

TEAM & UMSETZBARKEIT
- Qualität der Prozessdokumentation: ${scale(d.documentation)}
  (1 = hauptsächlich im Kopf der Mitarbeiter · 5 = klar schriftlich festgehalten)
- Qualität der Datenstruktur: ${scale(d.dataStructure)}
  (1 = unstrukturiert, inkonsistent · 5 = sauber und gut organisiert)
- Offenheit des Teams für KI: ${scale(d.aiReadiness)}
  (1 = skeptisch, veränderungsresistent · 5 = enthusiastische Early Adopter)
- Bereits aktiv genutzte KI/Automatisierung: ${scale(d.toolsAdopted)}
  (1 = überhaupt keine · 5 = im täglichen Workflow integriert)

══ AUFGABE ══
Erstelle jetzt die vollständige, stellenspezifische Analyse auf Deutsch.
Halte dich exakt an die Abschnittsstruktur aus dem System-Prompt.
Jede Aussage muss klar zur Stelle "${role}" und ihrer Branche passen.`;
}

async function fetchGeminiMarkdown(d) {
  const payload = {
    systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    contents: [{ parts: [{ text: buildPrompt(d) }] }],
    models: GEMINI_MODELS,
    generationConfig: { maxOutputTokens: 4096, temperature: 0.35 }
  };

  const response = await fetch('/api/analyze.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || `HTTP ${response.status}`);
  }

  const { markdown } = await response.json();
  if (!markdown) throw new Error('Leere Antwort vom Server');
  return markdown;
}

// =========================================
// STRUCTURED ROLE ANALYSIS — new endpoint
// =========================================

/**
 * Calls /api/role-analysis.php and returns the typed result object.
 * The backend builds the Gemini prompt, forces JSON output, sanitises, and returns.
 */
async function fetchStructuredAnalysis(d) {
  const response = await fetch('/api/role-analysis.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roleConfig: d })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || `HTTP ${response.status}`);
  }

  const { result, error } = await response.json();
  if (error) throw new Error(error);
  if (!result) throw new Error('Leere Antwort vom Server');
  return result;
}

// --- STRUCTURED RESULT RENDERER ----------

/**
 * Renders the structured Gemini JSON response as a rich,
 * fully-typed result page. Mirrors the visual language of renderResult()
 * but adds task-split table, manager summary, and role-specific tools
 * as promised on the landing page.
 *
 * @param {Object} data  Sanitised result from /api/role-analysis.php
 */
function renderStructuredResult(data) {
  const res  = document.getElementById('step-result');
  const role = esc(data.roleTitle || state.data.roleTitle || 'Stelle');
  const wd   = data.workDistribution || { automatable: 25, aiAssisted: 35, humanLed: 30, reviewRequired: 10 };

  res.innerHTML = `
<div class="result-wrap">

  <!-- ① Summary / collaboration model -->
  <div class="result-hero">
    <div class="result-model-badge">${esc(data.collaborationModelName || 'KI-Analyse')}</div>
    <h2 class="result-headline">${esc(data.collaborationModelHeadline || '')}</h2>
    <p class="result-expert-summary">${esc(data.collaborationModelSummary || '')}</p>
  </div>

  <!-- ② Work distribution bars -->
  <div class="result-split-card">
    <div class="result-section-label">Arbeitsaufteilung — ${role}</div>
    <div class="result-bars">
      ${resultBar('Automatisierbar',      wd.automatable,    'auto')}
      ${resultBar('KI-unterstützt',       wd.aiAssisted,     'ai')}
      ${resultBar('Menschlich geleitet',  wd.humanLed,       'human')}
      ${resultBar('Prüfung erforderlich', wd.reviewRequired, 'review')}
    </div>
  </div>

  <!-- ③ Task-split table (aufgabenspezifische Orientierung) -->
  ${renderTaskSplit(data.taskSplit || [], role)}

  <!-- ④ AI vs. Human responsibilities (2-column) -->
  <div class="result-tasks-grid">
    <div class="result-task-col">
      <div class="result-task-col-title col-title-ai">Mit KI starten</div>
      <ul class="result-task-list">
        ${(data.aiResponsibilities || []).map(t => `<li>${esc(t)}</li>`).join('')}
      </ul>
    </div>
    <div class="result-task-col">
      <div class="result-task-col-title col-title-human">Menschlich geleitet behalten</div>
      <ul class="result-task-list">
        ${(data.humanResponsibilities || []).map(t => `<li>${esc(t)}</li>`).join('')}
      </ul>
    </div>
  </div>

  <!-- ⑤ Phasenweiser Umsetzungsfahrplan -->
  <div class="result-phases">
    <div class="result-section-label">Umsetzungsfahrplan — ${role}</div>
    <div class="result-phase-grid">
      <div class="result-phase">
        <div class="rp-label">Diese Woche bis 30 Tage</div>
        <div class="rp-items">
          ${(data.implementationPlan?.next30Days || []).map(a => `<div class="rp-item">${esc(a)}</div>`).join('')}
        </div>
      </div>
      <div class="result-phase">
        <div class="rp-label rp-label-2">Nächste 90 Tage</div>
        <div class="rp-items">
          ${(data.implementationPlan?.next90Days || []).map(a => `<div class="rp-item">${esc(a)}</div>`).join('')}
        </div>
      </div>
      <div class="result-phase">
        <div class="rp-label rp-label-3">Langfristig</div>
        <div class="rp-items">
          ${(data.implementationPlan?.later || []).map(a => `<div class="rp-item">${esc(a)}</div>`).join('')}
        </div>
      </div>
    </div>
  </div>

  <!-- ⑥ Domänenspezifische KI-Tool-Empfehlungen -->
  ${renderToolsSection(data.recommendedTools || [], role)}

  <!-- ⑦ Risiken & Leitplanken -->
  ${renderRisksSection(data.risksAndSafeguards || [])}

  <!-- ⑧ Manager-Zusammenfassung (neu) -->
  ${renderManagerSummary(data.managerSummary || [])}

  <!-- ⑨ Implementierungsbereitschaft -->
  <div class="result-readiness">
    <div class="readiness-score-block">
      <div class="readiness-number" id="readinessNum">0</div>
      <div class="readiness-label">Bereitschaft</div>
    </div>
    <div class="readiness-right">
      <div class="result-section-label" style="margin-bottom:10px">Implementierungsbereitschaft</div>
      <div class="readiness-track-wrap">
        <div class="readiness-track">
          <div class="readiness-fill ${readinessClass(data.readinessScore || 50)}" id="readinessFill" style="width:0"></div>
        </div>
      </div>
      <p class="readiness-desc">${esc(data.readinessDescription || '')}</p>
    </div>
  </div>

  <!-- Footer -->
  <div class="result-footer">
    <p class="result-disclaimer">Diese Analyse wurde von einem KI-Modell erstellt und dient als Ausgangspunkt für eine fundierte Teamdiskussion — keine Direktive. Menschliches Urteilsvermögen, organisatorischer Kontext und direkter Input der betroffenen Mitarbeitenden sollten stets leiten, wie Stellen neu gestaltet werden.</p>
    <div class="result-actions">
      <button class="btn btn-ghost" id="restartBtn">Weitere Stelle analysieren</button>
      <a href="index.html" class="btn btn-primary">Zurück zu RoleShift</a>
    </div>
  </div>

</div>`;

  // Animate bars and readiness gauge
  setTimeout(() => {
    document.querySelectorAll('[data-target]').forEach(el => {
      el.style.width = el.dataset.target + '%';
    });
    const fill  = document.getElementById('readinessFill');
    const num   = document.getElementById('readinessNum');
    const score = data.readinessScore || 50;
    if (fill) fill.style.width = score + '%';
    if (num)  animateCount(num, score, '%');
  }, 120);

  document.getElementById('restartBtn')?.addEventListener('click', restart);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- STRUCTURED RESULT HELPERS -----------

function readinessClass(score) {
  if (score < 35) return 'low';
  if (score < 65) return 'medium';
  return 'high';
}

/**
 * Task-split table — shows each task area with coloured dots
 * for the four attributes: automatable / AI-assisted / human-led / human-review.
 * Delivers the "aufgabenspezifische Orientierung" promised on the landing page.
 */
function renderTaskSplit(taskSplit, role) {
  if (!taskSplit.length) return '';
  return `
<div class="result-task-split">
  <div class="result-section-label">Aufgabenverteilung — ${role}</div>
  <div class="rts-wrap">
    <table class="rts-table">
      <thead>
        <tr>
          <th class="rts-th-area">Aufgabenbereich</th>
          <th class="rts-th-dot" title="Automatisierbar"><span class="rts-col-label">Auto</span></th>
          <th class="rts-th-dot" title="KI-unterstützt"><span class="rts-col-label">KI</span></th>
          <th class="rts-th-dot" title="Menschlich geleitet"><span class="rts-col-label">Mensch</span></th>
          <th class="rts-th-dot" title="Menschliche Prüfung"><span class="rts-col-label">Prüfung</span></th>
        </tr>
      </thead>
      <tbody>
        ${taskSplit.map(t => `
        <tr>
          <td class="rts-td-area">
            <div class="rts-area-name">${esc(t.area)}</div>
            ${t.description ? `<div class="rts-area-desc">${esc(t.description)}</div>` : ''}
          </td>
          <td class="rts-td-dot"><span class="rts-dot ${t.automatable ? 'rts-dot-auto' : 'rts-dot-off'}"></span></td>
          <td class="rts-td-dot"><span class="rts-dot ${t.aiAssisted  ? 'rts-dot-ai'   : 'rts-dot-off'}"></span></td>
          <td class="rts-td-dot"><span class="rts-dot ${t.humanLed   ? 'rts-dot-human' : 'rts-dot-off'}"></span></td>
          <td class="rts-td-dot"><span class="rts-dot ${t.humanReview ? 'rts-dot-review': 'rts-dot-off'}"></span></td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>
  <div class="rts-legend">
    <span class="rts-legend-item"><span class="rts-dot rts-dot-auto"></span>Automatisierbar</span>
    <span class="rts-legend-item"><span class="rts-dot rts-dot-ai"></span>KI-unterstützt</span>
    <span class="rts-legend-item"><span class="rts-dot rts-dot-human"></span>Menschlich geleitet</span>
    <span class="rts-legend-item"><span class="rts-dot rts-dot-review"></span>Prüfung erforderlich</span>
    <span class="rts-legend-item"><span class="rts-dot rts-dot-off"></span>Nicht zutreffend</span>
  </div>
</div>`;
}

/**
 * Recommended tools — domänenspezifische Tool-Empfehlungen as promised.
 * Shows name, category, why, and what the person concretely does with it.
 */
function renderToolsSection(tools, role) {
  if (!tools.length) return '';
  return `
<div class="result-ai-tools">
  <div class="result-section-label">Empfohlene KI-Tools für ${role}</div>
  <div class="result-tools-grid">
    ${tools.map(t => `
    <div class="result-tool-card">
      <div class="tool-card-top">
        <span class="tool-name">${esc(t.name)}</span>
        <span class="tool-category">${esc(t.category)}</span>
      </div>
      <p class="tool-use">${esc(t.reason)}</p>
      ${t.fitForRole ? `<p class="tool-fit">${esc(t.fitForRole)}</p>` : ''}
    </div>`).join('')}
  </div>
</div>`;
}

/** Risks & safeguards section */
function renderRisksSection(risks) {
  if (!risks.length) return '';
  return `
<div class="result-risks">
  <div class="result-section-label">Risiken &amp; Leitplanken</div>
  <div class="result-risk-list">
    ${risks.map(r => `
    <div class="result-risk-item">
      <div class="risk-icon"></div>
      <p>${esc(r)}</p>
    </div>`).join('')}
  </div>
</div>`;
}

/**
 * Manager summary — new section that delivers the "sofort nutzbar für Führungskräfte"
 * promise: key takeaways ready to share with stakeholders.
 */
function renderManagerSummary(items) {
  if (!items.length) return '';
  return `
<div class="result-manager-summary">
  <div class="result-section-label result-section-label--mgr">Manager-Zusammenfassung</div>
  <ul class="result-mgr-list">
    ${items.map(item => `<li>${esc(item)}</li>`).join('')}
  </ul>
</div>`;
}

function renderMarkdownResult(markdownText) {
  const res = document.getElementById('step-result');
  const rawHtml = typeof marked !== 'undefined'
    ? marked.parse(markdownText)
    : markdownText.replace(/\n/g, '<br>');
  const safeHtml = typeof DOMPurify !== 'undefined'
    ? DOMPurify.sanitize(rawHtml, {
        ALLOWED_TAGS: ['h1','h2','h3','h4','p','br','strong','em','b','i',
                       'ul','ol','li','table','thead','tbody','tr','th','td',
                       'blockquote','code','pre','hr'],
        ALLOWED_ATTR: []
      })
    : rawHtml;

  res.innerHTML = `
<div class="result-wrap">
  <div class="result-markdown">${safeHtml}</div>
  <div class="result-footer" style="margin-top:10px">
    <p class="result-disclaimer">Diese Analyse wurde von einem KI-Modell erstellt und dient als Ausgangspunkt für eine fundierte Teamdiskussion — keine Direktive. Menschliches Urteilsvermögen, organisatorischer Kontext und direkter Input der betroffenen Mitarbeitenden sollten stets leiten, wie Stellen neu gestaltet werden.</p>
    <div class="result-actions">
      <button class="btn btn-ghost" id="restartBtn">Weitere Stelle analysieren</button>
      <a href="index.html" class="btn btn-primary">Zurück zu RoleShift</a>
    </div>
  </div>
</div>`;

  document.getElementById('restartBtn')?.addEventListener('click', restart);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showLoading() {
  const cur = document.getElementById(`step-${state.current}`);
  cur?.classList.add('calc-step-hidden');
  const res = document.getElementById('step-result');
  res.classList.remove('calc-step-hidden');
  res.innerHTML = `
    <div class="result-loading">
      <div class="loading-dots"><div class="loading-dot"></div><div class="loading-dot"></div><div class="loading-dot"></div></div>
      <div class="loading-text">Ihre Stelle wird analysiert und ein personalisierter Plan erstellt…</div>
    </div>`;
  setProgress(6);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showApiError(msg) {
  const res = document.getElementById('step-result');
  res.innerHTML = `
    <div class="result-wrap">
      <div class="result-hero" style="text-align:center;padding:48px 24px">
        <div class="result-model-badge" style="background:#fee2e2;color:#b91c1c;border-color:#fca5a5">API-Fehler</div>
        <h2 class="result-headline" style="margin-top:16px;font-size:1.3rem">Gemini konnte nicht erreicht werden</h2>
        <p style="color:var(--text-3);margin-top:12px;font-size:.9rem;max-width:480px;margin-inline:auto">${esc(msg)}</p>
        <p style="color:var(--text-3);margin-top:16px;font-size:.85rem">Öffnen Sie die Browser-Konsole (F12 → Console) für Details.</p>
        <div style="margin-top:32px">
          <button class="btn btn-ghost" onclick="location.reload()">Neu starten</button>
        </div>
      </div>
    </div>`;
}

// =========================================
// ANALYSIS ENGINE — Expert rules-based
// =========================================

function computeResult(d) {
  // === DIMENSION SCORES (all 1–5) ===
  const autoScore  = avg([d.repetitive, d.standardized]);
  const aiRaw      = avg([d.repetitive, d.standardized, d.dataStructure, d.toolsAdopted]);
  const humanScore = avg([d.judgment, d.customerFacing, d.accountability]);
  const riskScore  = avg([d.sensitivity, d.costOfMistakes, d.reviewNeeded]);
  const readiness  = avg([d.documentation, d.dataStructure, d.aiReadiness, d.toolsAdopted]);

  // AI score adjusted downward by high judgment and risk
  const judgeAdj = Math.max(d.judgment - 3, 0) * 0.15;
  const riskAdj  = Math.max(riskScore  - 3, 0) * 0.12;
  const aiScore  = clamp(aiRaw * (1 - judgeAdj) * (1 - riskAdj), 1, 5);

  // === PATTERN FLAGS ===
  const F = {
    processGap:       d.documentation <= 2 && d.dataStructure <= 2,
    readinessGap:     d.aiReadiness <= 2,
    highAuto:         autoScore >= 3.8,
    moderateAuto:     autoScore >= 2.8,
    judgmentCritical: d.judgment >= 4,
    complianceHeavy:  d.sensitivity >= 4,
    errorCostly:      d.costOfMistakes >= 4,
    customerSensitive:d.customerFacing >= 4,
    highRisk:         riskScore >= 3.8,
    highAccountable:  d.accountability >= 4,
    aiReady:          readiness >= 3.5 && d.aiReadiness >= 3.5,
    hasTools:         d.toolsAdopted >= 3,
    strongReview:     d.reviewNeeded >= 4,
    paradox:          autoScore >= 3.8 && riskScore >= 3.8,
    trustSensitive:   d.customerFacing >= 4 && d.costOfMistakes >= 4,
  };

  // === MATURITY LABEL (priority cascade) ===
  let maturity, maturityClass, readinessClass;
  if (F.processGap && !F.aiReady) {
    maturity = 'Foundation-first';               maturityClass = 'foundation';
  } else if (F.judgmentCritical && F.highRisk) {
    maturity = 'Human-led with targeted AI support'; maturityClass = 'human-led';
  } else if (F.paradox) {
    maturity = 'AI-assisted with mandatory review';   maturityClass = 'review-required';
  } else if (F.highAuto && !F.highRisk) {
    maturity = 'Repetitive workflow automation';      maturityClass = 'automation';
  } else if (aiScore >= 3.4 && (F.errorCostly || F.strongReview)) {
    maturity = 'AI first-draft, human review';        maturityClass = 'draft-review';
  } else if (aiScore >= 3.2 && humanScore >= 2.8) {
    maturity = 'AI co-pilot workflow';                maturityClass = 'copilot';
  } else if (aiScore >= 2.5) {
    maturity = 'Selective AI augmentation';           maturityClass = 'selective';
  } else {
    maturity = 'Human-led with selective AI support'; maturityClass = 'human-led';
  }

  // === WORK DISTRIBUTION ===
  let autoP   = normalizeRange(autoScore, 3, 38);
  let aiP     = normalizeRange(aiScore,   3, 33);
  let humanP  = normalizeRange(humanScore,15,42);
  let reviewP = normalizeRange(riskScore,  4, 22);

  if (F.processGap)         { autoP *= .50; aiP *= .60; }
  if (F.complianceHeavy)    { reviewP = Math.max(reviewP, 20); autoP *= .75; }
  if (F.judgmentCritical)   { humanP  = Math.max(humanP,  36); }
  if (F.trustSensitive)     { humanP  = Math.max(humanP,  32); reviewP = Math.max(reviewP, 15); }
  if (!F.aiReady)           { aiP    *= .72; autoP *= .80; }
  if (F.hasTools)           { aiP    *= 1.1; autoP *= 1.05; }
  if (F.paradox)            { reviewP = Math.max(reviewP, 22); autoP *= .65; }

  // Normalize to 100
  [autoP, aiP, humanP, reviewP] = normalize100([autoP, aiP, humanP, reviewP]);

  // === IMPLEMENTATION READINESS (0–100) ===
  let readinessScore = Math.round(normalize(readiness) * 75 + 12);
  if (F.processGap)     readinessScore = Math.min(readinessScore, 28);
  if (F.readinessGap)   readinessScore = Math.min(readinessScore, 42);
  if (F.aiReady && F.hasTools) readinessScore = Math.min(100, readinessScore + 12);

  if      (readinessScore < 35) readinessClass = 'low';
  else if (readinessScore < 65) readinessClass = 'medium';
  else                          readinessClass = 'high';

  // === BUILD RESULT ===
  return {
    maturity, maturityClass,
    autoP, aiP, humanP, reviewP,
    readinessScore, readinessClass,
    _flags:           F,
    expertSummary:    buildExpertSummary(d, { autoScore, aiScore, humanScore, riskScore, readiness }, F),
    whyThisModel:     buildWhyThisModel(d, F, maturity, { autoScore, aiScore, humanScore, riskScore }),
    risks:            buildRisks(d, F),
    tasks:            buildTasks(d, F),
    phases:           buildPhases(d, F, maturity),
    readinessDesc:    buildReadinessDesc(readinessScore, F),
    goalNote:         buildGoalNote(d.goals, F),
    aiTools:          buildAiTools(d)
  };
}

// =============================================================================
// CONTENT GENERATORS — expert-level, input-responsive
// =============================================================================

function buildExpertSummary(d, scores, F) {
  const role = d.roleTitle || 'Diese Stelle';
  let parts = [];

  if (F.processGap) {
    parts.push(`${role} steht vor einer strukturellen Herausforderung, bevor eine sinnvolle KI-Einführung möglich ist. Die Kombination aus undokumentierten Workflows und unstrukturierten Daten schafft eine schwache Grundlage für jede Automatisierung oder KI-Tool-Nutzung — Tools werden unterdurchschnittlich abschneiden, bis die Prozessebene geklärt ist.`);
  } else if (F.paradox) {
    parts.push(`${role} zeigt ein interessantes Paradox: Die Aufgabenstruktur ist technisch gut für Automatisierung geeignet, aber die Compliance- und Verantwortungsanforderungen setzen klare Grenzen dafür, wie weit KI ohne menschliche Kontrolle gehen kann. Das ist kein Hindernis — es ist eine Gestaltungseinschränkung, die das richtige Modell vorgibt.`);
  } else if (F.judgmentCritical && scores.humanScore >= 4) {
    parts.push(`${role} ist grundlegend menschlich geprägt. Urteilsvermögen und kontextuelles Denken sind zentral für die Arbeit — nicht peripher. KI dient hier am besten als Informations- und Vorbereitungsebene, nicht als primärer Beiträger zu Ergebnissen oder Entscheidungen.`);
  } else if (F.highAuto && scores.aiScore >= 3.5) {
    parts.push(`${role} hat ein starkes strukturelles Profil für KI-Augmentierung. Ein erheblicher Anteil der Arbeit ist repetitiv und regelbasiert, und der Teamkontext deutet auf eine umsetzbare Einführung hin. Die Chance hier ist bedeutend — das ist keine marginale Effizienzsteigerung, sondern eine echte Neugestaltungsmöglichkeit.`);
  } else if (scores.aiScore >= 3.2) {
    parts.push(`${role} befindet sich in einem produktiven Bereich für KI-Augmentierung. Die Arbeitsstruktur hat genug Konsistenz und Muster, damit KI effektiv unterstützen kann, während das menschliche Element für Qualität, Urteilsvermögen und Stakeholder-Management wichtig bleibt.`);
  } else {
    parts.push(`${role} hat begrenzte, aber reale KI-Augmentierungsmöglichkeiten. Die Arbeit erfordert zu viel kontextuelles Denken für eine breite Automatisierung, aber gezielte KI-Unterstützung — bei klar definierten, risikoärmeren Teilaufgaben — kann den administrativen Aufwand reduzieren, ohne die Qualität der Kernarbeit zu beeinträchtigen.`);
  }

  if (!F.processGap) {
    if (F.trustSensitive && scores.aiScore >= 3) {
      parts.push(`Der Kundenkontakt und die hohen Fehlerkosten dieser Stelle bedeuten, dass jede KI-Beteiligung sichtbar und kontrolliert sein muss — unsichtbare Automatisierung würde Vertrauen und Qualität gleichzeitig gefährden.`);
    } else if (F.complianceHeavy && F.highAuto) {
      parts.push(`Das regulatorische Umfeld bestimmt die Implementierungsgrenze: Das Volumen rechtfertigt KI, aber Compliance-Anforderungen bedeuten, dass menschliche Prüfung in jeden Output-Workflow eingebaut bleibt.`);
    } else if (!F.aiReady && scores.aiScore >= 3) {
      parts.push(`Das aktuelle Bereitschaftsniveau des Teams bedeutet, dass das Potenzial hier schrittweise erschlossen werden sollte — beginnend mit risikoärmeren Aufgaben und mit zunehmendem Vertrauen den Umfang erweiternd.`);
    }
  }

  return parts.join(' ');
}

function buildWhyThisModel(d, F, maturity, scores) {
  const reasons = [];

  if (maturity === 'Foundation-first') {
    reasons.push('KI-Tools funktionieren am besten bei klar definierten, konsistent ausgeführten Prozessen mit strukturierten Eingaben. Keine dieser Bedingungen ist hier ausreichend erfüllt. Ein Tool-Einsatz jetzt würde fragile Workflows schaffen, die bei Ausnahmen scheitern und das Vertrauen des Teams in KI-Einführungen untergraben.');
    reasons.push('Die Investition in Dokumentation und Datenstruktur ist keine Verzögerung — sie bestimmt direkt, wie viel Wert KI liefern wird, wenn sie eingeführt wird. Teams, die diesen Schritt überspringen, wiederholen ihn typischerweise unter Druck, zu höheren Kosten.');
  } else if (maturity === 'Human-led with targeted AI support') {
    reasons.push('Die Kombination aus hohen Urteilsanforderungen und bedeutendem Risiko bedeutet, dass der menschliche Beitrag nicht nebensächlich ist — er ist das Produkt. Menschliches Urteilsvermögen hier zu entfernen oder zu verwässern würde verändern, was die Stelle liefert, nicht nur wie sie es liefert.');
    reasons.push('KI kann kognitive Last und Vorbereitungszeit reduzieren, ohne die Kernurteils-Ebene zu berühren. Das ist die richtige Grenze: KI liefert Informationen, Menschen treffen Entscheidungen.');
  } else if (maturity === 'AI-assisted with mandatory review') {
    reasons.push('Das Aufgabenvolumen und die Struktur schaffen legitimes Automatisierungspotenzial. Aber die Compliance- und Verantwortungsanforderungen bedeuten, dass kein KI-Output seinen endgültigen Verwendungszweck erreichen sollte, ohne dass ein qualifizierter Mensch ihn überprüft hat. Das ist keine übermäßige Vorsicht — es ist die Mindestaufsicht angesichts der Einsätze.');
    reasons.push('Das Modell hier ist: KI entwirft, Menschen verantworten. Das bewahrt Effizienzgewinne, während die Verantwortung dort bleibt, wo sie hingehört.');
  } else if (maturity === 'Repetitive workflow automation') {
    reasons.push('Das Aufgabenprofil der Stelle passt strukturell gut zur Automatisierung: hohe Repetitivität, standardisierte Logik, strukturierte Eingaben und überschaubare Folgen bei Fehlkonfiguration. Das sind die klarsten Bedingungen dafür, dass Automatisierung zuverlässig Wert liefert.');
    reasons.push('Die menschliche Rolle entwickelt sich hier weiter, anstatt zu verschwinden. Menschliche Kapazität sollte in Richtung Ausnahmebehandlung, Qualitätssicherung und strategische Arbeit verschoben werden, die nicht schabloniert werden kann.');
  } else if (maturity === 'AI first-draft, human review') {
    reasons.push('KI-Generierung ist effizient für das Volumen und die Struktur dieser Stelle — aber die Fehlerkosten und Prüfanforderungen bedeuten, dass das Output-Vertrauen nicht hoch genug ist, um KI direkt zu nutzen. Der menschliche Prüfschritt ist nicht redundant; er ist der Ort, an dem Qualität und Verantwortung angewendet werden.');
    reasons.push('Dieses Modell liefert tendenziell bessere Ergebnisse als entweder "vollständig manuell" oder "vollständig automatisiert" — es erfasst Geschwindigkeit von KI und Qualität aus menschlichem Urteil.');
  } else if (maturity === 'AI co-pilot workflow') {
    reasons.push('Diese Stelle hat die strukturellen Bedingungen für echte KI-Zusammenarbeit: Aufgaben sind genug organisiert, damit KI sinnvoll helfen kann, und der menschliche Beitrag bleibt wichtig genug, dass vollständige Automatisierung etwas Reales verlieren würde. Das ist die produktivste Zone für KI-Augmentierung.');
  } else {
    reasons.push('Die Arbeit ist in ihrer aktuellen Form nicht stark automatisierbar, aber gezielte KI-Unterstützung bei spezifischen, strukturierten Teilaufgaben kann Zeit für minderwertige Arbeit reduzieren und die Konsistenz verbessern, wo das wichtig ist.');
  }

  return reasons.join('\n\n');
}

function buildRisks(d, F) {
  const risks = [];
  if (F.processGap) risks.push('Tooling auf undokumentierten Prozessen schafft fragile Automatisierung, die häufig und still scheitert. Erst dokumentieren, dann automatisieren.');
  if (F.complianceHeavy) risks.push('Regulatorische oder Compliance-Anforderungen müssen explizit abgebildet werden, bevor ein KI-Workflow eingesetzt wird. Ein KI-Fehler in einem sensiblen Bereich kann Audit-, Rechts- oder Reputationsfolgen haben, die den Effizienzgewinn überwiegen.');
  if (F.trustSensitive) risks.push('Kunden und Stakeholder können erkennen, wenn Interaktionen KI-generiert sind oder unpersönlich wirken. Bei dieser Stelle ist Vertrauen Teil des Produkts. KI sollte im Hintergrund unterstützen — nicht die menschliche Stimme der Beziehung ersetzen.');
  if (F.readinessGap && !F.processGap) risks.push('Geringe Teambereitschaft bedeutet hohes Einführungsrisiko. Tools, die ohne angemessene Vorbereitung eingesetzt werden, werden häufig schlecht genutzt, frühzeitig aufgegeben oder schaffen neue Koordinationsprobleme. Erst in KI-Kompetenz investieren, dann einsetzen.');
  if (F.errorCostly && !F.strongReview) risks.push('Angesichts der Fehlerkosten bei dieser Stelle sollte jeder KI-generierte Output einen definierten Prüfschritt vor der Verwendung haben — auch wenn die Antwort offensichtlich erscheint. Ein übersehener Fehler kann Wochen an Effizienzgewinnen überwiegen.');
  if (F.highAccountable) risks.push('Menschliche Verantwortungserwartungen bedeuten, dass KI hier nicht als Entscheidungsträger positioniert werden kann. Jeder wichtige Output sollte einen namentlichen menschlichen Eigentümer haben, der ihn überprüft hat. Gestalten Sie dies explizit in den Workflow ein, nicht als Nachgedanken.');
  if (risks.length === 0) risks.push('Für dieses Profil wurden keine kritischen Risiken identifiziert. Fahren Sie mit Standard-Change-Management-Praktiken fort: Pilot vor Skalierung, Prüfpunkte beibehalten und Output-Qualität in den ersten 30 Tagen überwachen.');
  return risks;
}

function buildTasks(d, F) {
  const role = (d.roleTitle || '').toLowerCase();

  const LIBRARY = {
    ai: {
      support:    ['Erstantworten auf Basis strukturierter Vorlagen entwerfen', 'Ticket-Triage und Prioritätszuweisung', 'FAQ-Generierung und Wissensdatenbank-Pflege', 'Stimmungsanalyse und Eskalationskennzeichnung', 'Schichtplanung und Workload-Verteilung', 'Gesprächsnotizen nach Interaktionen'],
      finance:    ['Finanzberichte generieren und formatieren', 'Datenabgleich und Anomalieerkennung', 'Varianzanalyse-Kommentare entwerfen', 'Rechnungs- und Zahlungsverarbeitung', 'Prognose-Szenariomodellierung', 'Regulatorische Meldungen vorbereiten'],
      hr:         ['Stellenbeschreibungen entwerfen und optimieren', 'Vorstellungsgespräche planen und koordinieren', 'Mitarbeiter-FAQ und Richtlinien-Q&A beantworten', 'Onboarding-Dokumente vorbereiten', 'Lern- und Entwicklungsinhalte zusammenfassen', 'Exit-Interview-Themen analysieren'],
      marketing:  ['Textentwürfe und Varianten generieren', 'Social-Media-Inhalte planen und umformatieren', 'Wettbewerbsanalysen zusammenfassen', 'Briefs und Kampagnen zusammenfassen', 'SEO-Keyword-Recherche unterstützen', 'Performance-Berichte generieren'],
      operations: ['Workflow- und SOP-Dokumentationsentwürfe erstellen', 'Statusberichte generieren', 'Lieferantenvergleiche und Ausschreibungsanalysen', 'Meeting-Zusammenfassungen und Aktionspunkte extrahieren', 'Kapazitäts- und Ressourcenplanungs-Datenvorbereitung', 'Leistungsdaten aggregieren'],
      recruiter:  ['Stellenausschreibungen entwerfen und optimieren', 'Lebenslauf-Screening-Zusammenfassungen erstellen', 'Outreach-Sequenzen entwerfen', 'Interviewfragen nach Kompetenzen generieren', 'Kandidaten-FAQ beantworten', 'Pipeline-Statusberichte erstellen'],
      default:    ['Strukturierte Dateneingabe und -validierung', 'Routineberichte und Zusammenfassungen generieren', 'Vorlagenbasierte Dokumentenentwürfe erstellen', 'Terminplanung und Koordinationslogistik', 'Informationsrecherche und -synthese', 'Erst-Entwürfe für Inhalte oder Kommunikation']
    },
    human: {
      support:    ['Komplexe Eskalationen und Beschwerdelösungen', 'Hochwertige Kundenbeziehungspflege', 'Team-Coaching und Qualitätskalibrierung', 'Richtlinienausnahmen und Grenzfallbehandlung', 'Interne Eskalationsentscheidungen', 'Vertrauenswiederherstellung mit Kunden'],
      finance:    ['Compliance-Abzeichnung und Prüfungsverantwortung', 'Stakeholder-Präsentationen und Vorstandsmaterialien', 'Strategische Planung und Szenariointerpretation', 'Risikoentscheidungen und Ausnahmegenehmigungen', 'Regulierungsbehörden-Beziehungsmanagement', 'Funktionsübergreifende Abstimmung bei Prognosen'],
      hr:         ['Sensible Mitarbeiterbeziehungen und Ermittlungen', 'Kultur- und Wertegespräche', 'Leistungs- und Disziplinarüberprüfungen', 'Organisationsdesign-Entscheidungen', 'Führungs-Coaching und -entwicklung', 'Komplexe Angebots-Verhandlungen und Kandidatenerlebnis'],
      marketing:  ['Markenstrategie und kreative Leitung', 'Stakeholder-Freigaben und Kampagnengenehmigung', 'Sensible Botschaften und Krisenkommunikation', 'Agentur- und Partnerbeziehungsmanagement', 'Senior-Stakeholder-Abstimmung', 'Zielgruppen-Einblick-Interpretation'],
      operations: ['Funktionsübergreifende Koordination und Eskalation', 'Lieferanten- und Partnerbeziehungsmanagement', 'Operative Krisenreaktion', 'Strategische Kapazitäts- und Priorisierungsentscheidungen', 'Prozessausnahmen behandeln', 'Change Management und Kommunikation'],
      recruiter:  ['Finale Einstellungsempfehlungen und -entscheidungen', 'Senior-Angebots-Verhandlungen und Kandidatenerlebnis', 'Sensible Absagegespräche', 'Stakeholder-Abstimmung zu Einstellungskriterien', 'Strategische Personalplanung', 'Kandidatenbeziehungen und Talentpipeline-Management'],
      default:    ['Urteilsentscheidungen und kontextuelles Denken', 'Stakeholder- und Beziehungsmanagement', 'Ethik-, Richtlinien- und Compliance-Entscheidungen', 'Strategische Planung und funktionsübergreifende Koordination', 'Ausnahmebehandlung und Grenzfälle', 'Verantwortung für Ergebnisse und Entscheidungen']
    }
  };

  function getCategory(role, type) {
    for (const key of ['support','finance','hr','marketing','operations','recruiter']) {
      if (role.includes(key.slice(0,5))) return LIBRARY[type][key];
    }
    if (role.includes('cust')) return LIBRARY[type]['support'];
    if (role.includes('recru')) return LIBRARY[type]['recruiter'];
    return LIBRARY[type]['default'];
  }

  const aiTasks    = getCategory(role, 'ai').slice(0, F.aiReady ? 5 : 4);
  const humanTasks = getCategory(role, 'human').slice(0, F.judgmentCritical ? 5 : 4);

  return { ai: aiTasks, human: humanTasks };
}

function buildPhases(d, F, maturity) {
  const phases = { p1: [], p2: [], p3: [] };

  if (F.processGap) {
    phases.p1.push('Die 3–5 volumenreichsten Workflows klar und schrittweise dokumentieren');
    phases.p1.push('Identifizieren, welche Dateneingaben unstrukturiert sind, und einen Standardisierungsansatz definieren');
    phases.p2.push('KI-Tooling an einem gut dokumentierten Workflow mit strukturierten Eingaben pilotieren');
    phases.p2.push('Teamvertrauen durch Schulung und strukturierte Auswertung der Pilot-Ergebnisse aufbauen');
    phases.p3.push('KI-Einführung auf weitere Workflows basierend auf Pilot-Erkenntnissen ausweiten');
    phases.p3.push('Rollen-KPIs neu gestalten, um die neue Aufgabenverteilung widerzuspiegeln');
  } else if (F.readinessGap) {
    phases.p1.push('Team-KI-Kompetenzsitzung durchführen — verfügbare Tools, was sie können und nicht können, wie gute Nutzung aussieht');
    phases.p1.push('Eine risikoarme, hochvolumige Aufgabe für einen ersten KI-Pilot identifizieren');
    phases.p2.push('Pilot-Qualität auswerten und Erkenntnisse dokumentieren; Prüfkriterien festlegen');
    phases.p2.push('Auf 2–3 weitere Aufgaben basierend auf Vertrauen und Ergebnissen ausweiten');
    phases.p3.push('Den KI-unterstützten Workflow formalisieren und Rollendokumentation entsprechend aktualisieren');
    phases.p3.push('Rollendesign überprüfen und Verantwortlichkeiten an die neue Aufgabenverteilung anpassen');
  } else {
    const now = getPhase1Actions(F, maturity);
    const soon = getPhase2Actions(F, maturity);
    const later = getPhase3Actions(F, maturity);
    phases.p1 = now; phases.p2 = soon; phases.p3 = later;
  }

  return phases;
}

function getPhase1Actions(F, maturity) {
  const actions = [];
  if (maturity === 'Repetitive workflow automation') {
    actions.push('Die 2–3 volumenreichsten, standardisiertesten Aufgaben identifizieren und eine für einen sofortigen Automatisierungs-Pilot auswählen');
    actions.push('Qualitätsakzeptanzkriterien für den automatisierten Output vor dem Einsatz definieren');
  } else if (maturity.includes('co-pilot') || maturity.includes('first-draft')) {
    actions.push('Eine hochvolumige, risikoärmere Aufgabe auswählen und als Pilot einen KI-unterstützten Workflow einführen');
    actions.push('Definieren, wie "guter Output" aussieht und wie das Team KI-generierte Entwürfe bewertet');
  } else {
    actions.push('1–2 administrative oder datenintensive Teilaufgaben identifizieren, bei denen KI-Unterstützung klar risikoarm ist');
    actions.push('Erwartungen mit dem Team setzen: KI ist hier ein Werkzeug, kein Ersatz für Urteilsvermögen');
  }
  if (F.complianceHeavy) actions.push('Compliance-Prüfanforderungen für jeden KI-unterstützten Output vor dem Einsatz dokumentieren');
  return actions.slice(0, 2);
}

function getPhase2Actions(F, maturity) {
  const actions = [];
  actions.push('Pilot-Qualitätsmetriken auswerten und Team-Feedback sammeln — was hat funktioniert, was musste korrigiert werden, was wurde übersehen');
  if (F.strongReview || F.errorCostly) {
    actions.push('Eine formale Prüf-Checkliste für KI-unterstützte Outputs erstellen; definieren, wer was und wann prüft');
  } else {
    actions.push('KI-Unterstützung auf 2–3 weitere Aufgaben basierend auf Pilot-Vertrauen ausweiten');
  }
  actions.push('Team-Workflows und Dokumentation aktualisieren, um die neuen Arbeitsmuster widerzuspiegeln');
  return actions.slice(0, 2);
}

function getPhase3Actions(F, maturity) {
  const actions = [];
  actions.push('Rollen-KPIs und Erfolgsmetriken neu gestalten, um den Wandel in der Arbeitsweise widerzuspiegeln');
  actions.push('Stellenbeschreibung und Verantwortlichkeiten aktualisieren, um die weiterentwickelte Rolle widerzuspiegeln');
  if (F.judgmentCritical || F.customerSensitive) {
    actions.push('Identifizieren, welche menschlich kritischen Aufgaben an Bedeutung gewonnen haben, und sicherstellen, dass die Stelle entsprechend ausgestattet ist');
  }
  return actions.slice(0, 2);
}

function buildAiTools(d) {
  const role = (d.roleTitle || '').toLowerCase();

  const TOOLS = {
    hr: [
      { name: 'Workday', category: 'HR-Plattform', use: 'Einstellungs-Workflows, Onboarding und Mitarbeiterlebenszyklusverwaltung optimieren' },
      { name: 'Greenhouse', category: 'Recruiting', use: 'KI-gestütztes Kandidaten-Screening, Vorstellungsgespräch-Planung und Pipeline-Analyse' },
      { name: 'Claude / ChatGPT', category: 'Schreib-KI', use: 'Stellenbeschreibungen, Richtliniendokumente und Mitarbeiterkommunikation in Sekunden entwerfen' },
      { name: 'Leena AI', category: 'HR-Chatbot', use: 'Erstantworten auf Mitarbeiter-FAQ-Anfragen ohne HR-Einbindung automatisieren' },
      { name: 'Lattice', category: 'Performance', use: 'Leistungsbeurteilungen mit KI-gestützten Vorlagen und Bewertungen strukturieren und analysieren' }
    ],
    finance: [
      { name: 'Workiva', category: 'Berichtswesen', use: 'Finanzberichtserstellung und regulatorische Meldungsvorbereitung im großen Maßstab automatisieren' },
      { name: 'Planful', category: 'FP&A', use: 'KI-gestützte Varianzanalyse, Prognosen und Szenarioplanung' },
      { name: 'Claude / ChatGPT', category: 'Schreib-KI', use: 'Vorstandskommentare, Varianzberichte und Compliance-Zusammenfassungen entwerfen' },
      { name: 'AppZen', category: 'Audit-KI', use: 'KI-gestützte Rechnungs- und Ausgabenprüfung — kennzeichnet Anomalien vor menschlicher Prüfung' },
      { name: 'Mosaic', category: 'Analytik', use: 'Echtzeit-Finanz-Dashboards mit automatisierter Datenaggregation und Benachrichtigung' }
    ],
    marketing: [
      { name: 'Jasper AI', category: 'Texterstellung', use: 'Anzeigentexte, Kampagnenbriefs und Inhaltsvarianten in Produktionsqualität generieren' },
      { name: 'Midjourney', category: 'Bild-KI', use: 'Kampagnenvisuals, Social-Assets und Konzeptbilder ohne Designer erstellen' },
      { name: 'Semrush AI', category: 'SEO-Recherche', use: 'KI-gestützte Keyword-Recherche, Wettbewerbsanalyse und Content-Brief-Generierung' },
      { name: 'HubSpot AI', category: 'CRM / E-Mail', use: 'KI-E-Mail-Sequenzen, Kampagnen-Performance-Analyse und Lead-Scoring' },
      { name: 'Zapier', category: 'Automatisierung', use: 'Tools verbinden und repetitive Marketing-Operationen ohne Code automatisieren' }
    ],
    support: [
      { name: 'Intercom Fin', category: 'Kunden-KI', use: 'Bis zu 50% der Support-Tickets automatisch mit KI-Erstantwort lösen' },
      { name: 'Zendesk AI', category: 'Support-Plattform', use: 'Automatische Ticket-Triage, Antwortvorschläge und Echtzeit-Stimmungsanalyse' },
      { name: 'Forethought', category: 'Lösungs-KI', use: 'Problemkategorien vorhersagen und relevante Wissensdatenbankartikel sofort anzeigen' },
      { name: 'Claude / ChatGPT', category: 'Schreib-KI', use: 'Antwortvorlagen, Eskalationszusammenfassungen und Wissensdatenbankartikel entwerfen' },
      { name: 'Assembled', category: 'Workforce', use: 'KI-gestützte Schichtplanung und Workload-Prognose für Support-Operationen' }
    ],
    recruiter: [
      { name: 'Ashby', category: 'ATS', use: 'KI-gestütztes Pipeline-Management, Outreach-Sequenzierung und Kandidatenanalytik' },
      { name: 'HireEZ', category: 'Sourcing-KI', use: 'KI-gestützte Kandidatensuche auf LinkedIn, GitHub und 30+ Jobbörsen' },
      { name: 'Metaview', category: 'Interview-KI', use: 'Vorstellungsgesprächsgespräche automatisch transkribieren und in strukturierte Notizen zusammenfassen' },
      { name: 'Claude / ChatGPT', category: 'Schreib-KI', use: 'Outreach-Nachrichten, Stellenausschreibungen und Interview-Fragenkataloge nach Kompetenzen entwerfen' },
      { name: 'Eightfold AI', category: 'Talent-Intelligenz', use: 'Kandidaten mit offenen Stellen auf Basis von Skills abgleichen — jenseits von Keyword-Matching' }
    ],
    operations: [
      { name: 'Notion AI', category: 'Wissensmanagement', use: 'SOP-Dokumentation, Meeting-Zusammenfassungen und Prozesslandkarten automatisch generieren' },
      { name: 'Process Street', category: 'Workflow-KI', use: 'KI-strukturierte Checklisten und automatisiertes Workflow-Ausführungs-Tracking' },
      { name: 'Zapier', category: 'Automatisierung', use: 'Operative Tools verbinden und mehrstufige Genehmigungs- und Benachrichtigungs-Workflows automatisieren' },
      { name: 'Claude / ChatGPT', category: 'Schreib-KI', use: 'Lieferantenbriefs, Statusberichte und Stakeholder-Kommunikation entwerfen' },
      { name: 'Monday.com AI', category: 'Projektmanagement', use: 'Automatische Aufgabenzuweisung, Deadline-Tracking und Projektstatusberichte' }
    ]
  };

  for (const key of ['support','finance','hr','marketing','operations','recruiter']) {
    if (role.includes(key.slice(0, 5)) || (key === 'hr' && role.includes('hr'))) return TOOLS[key];
  }
  if (role.includes('cust')) return TOOLS.support;
  if (role.includes('recru')) return TOOLS.recruiter;
  if (role.includes('market')) return TOOLS.marketing;
  if (role.includes('operat') || role.includes('oper')) return TOOLS.operations;

  return [
    { name: 'Claude / ChatGPT', category: 'Schreib-KI', use: 'Kommunikation, Berichte und strukturierte Dokumente für diese Stelle entwerfen' },
    { name: 'Notion AI', category: 'Wissensmanagement', use: 'Team-Wissensdatenbanken, SOPs und Prozessdokumentation aufbauen und pflegen' },
    { name: 'Microsoft Copilot', category: 'Produktivitäts-KI', use: 'KI-Unterstützung innerhalb von Office 365 für Entwürfe, Zusammenfassungen und Datenanalysen' },
    { name: 'Zapier', category: 'Automatisierung', use: 'Tools verbinden und repetitive Übergabe- und Benachrichtigungs-Workflows ohne Code automatisieren' },
    { name: 'Otter.ai', category: 'Meeting-KI', use: 'Meetings, Anrufe und Interviews automatisch transkribieren und zusammenfassen' }
  ];
}

function buildReadinessDesc(score, F) {
  if (F.processGap) return 'Prozessdokumentation und Datenstruktur müssen verbessert werden, bevor KI-Tooling zuverlässigen Wert liefert. Das ist lösbar — es ist eine Reihenfolge-Herausforderung, kein Blocker.';
  if (score < 35)   return 'Das aktuelle Umfeld ist noch nicht darauf ausgerichtet, dass KI-Einführung erfolgreich sein kann. Die Priorität ist Infrastruktur: Dokumentation, Datenstruktur und Team-Kompetenzen.';
  if (score < 55)   return 'Es gibt eine Grundlage, auf der man aufbauen kann, aber Bereitschaftslücken bedeuten, dass die KI-Einführung sorgfältig phasenweise erfolgen sollte. Erst mit risikoarmen Pilots beginnen, dann skalieren.';
  if (score < 75)   return 'Das Umfeld unterstützt einen strukturierten Rollout. Der Team- und Tool-Kontext ist vernünftig vorbereitet — der Fokus liegt jetzt auf der Auswahl der richtigen Aufgaben und der Etablierung guter Qualitätspraktiken.';
  return 'Starke Bereitschaft. Das Team und das Umfeld sind gut positioniert, um KI-Augmentierung effektiv einzuführen. Priorisieren Sie schnelles Handeln bei den wertvollsten Aufgaben.';
}

function buildGoalNote(goals, F) {
  const notes = {
    time:       'Die schnellsten Zeiteinsparungen kommen durch die Automatisierung der volumenreichsten, vorhersehbarsten Aufgaben zuerst — nicht der komplexesten.',
    admin:      F.processGap
      ? 'Administrative Automatisierung erfordert dokumentierte Prozesse, um zuverlässig zu funktionieren. Dokumentation ist hier die Voraussetzung.'
      : 'Die Automatisierung administrativer Aufgaben liefert typischerweise die schnellsten und sichtbarsten Zeiteinsparungen. Dort anfangen.',
    quality:    'KI verbessert Konsistenz, nicht Urteilsvermögen. Qualitätsgewinne entstehen durch den Einsatz von KI zur Reduzierung menschlicher Variation bei strukturierten Aufgaben — während menschliche Kontrolle bei allem erhalten bleibt, das Interpretation erfordert.',
    compliance: 'In einem compliance-orientierten Kontext ist die richtige Frage nicht "wie viel kann KI tun?", sondern "wie werden KI-Outputs geprüft, dokumentiert und auditiert?" Das Governance-Modell vor dem Tooling aufbauen.',
    speed:      'Zykluszeit-Reduzierung entsteht durch die Beseitigung von Übergaben und Wartezuständen. Identifizieren Sie, wo KI-Entwürfe oder -Triage den Schritt eliminieren können, der am längsten dauert — nicht nur den Schritt, der den größten menschlichen Aufwand erfordert.',
    focus:      'Menschen auf hochwertige Arbeit zu fokussieren bedeutet, zu definieren, was "hochwertig" in dieser Stelle tatsächlich bedeutet — dann darum herum neu zu gestalten, nicht nur Aufgaben zu subtrahieren.'
  };
  if (!goals || goals.length === 0) return '';
  return goals.map(g => notes[g]).filter(Boolean).join(' ');
}

// =============================================================================
// LOCAL STRUCTURED ALGORITHM — vollständig ohne API
// Erkennt Berufskategorie aus dem Rollentitel (Deutsch + Englisch),
// liefert rollenspezifische Aufgaben, Tools, Risiken und Manager-Summary.
// =============================================================================

// --- ROLLENERKENNUNG (Deutsch + Englisch) ------------------------------------

const ROLE_KEYWORDS = {
  support:     ['support', 'kundenservice', 'kundenbetreuer', 'kundendienst', 'helpdesk', 'customer service', 'servicemitarbeiter', 'call center', 'callcenter', 'serviceberater', 'kundencenter', 'kundenbetreuerin'],
  finance:     ['buchhalter', 'buchhaltung', 'controlling', 'controller', 'finanzanalyst', 'finanzbuchhalter', 'steuerberater', 'treasurer', 'accountant', 'revisor', 'bilanz', 'rechnungswesen', 'finance manager', 'finanzkontrolleur'],
  hr:          ['personalreferent', 'personalmanager', 'hr manager', 'hr business partner', 'personalwesen', 'human resources', 'personalbetreuung', 'personalentwicklung', 'personalreferentin'],
  marketing:   ['marketing manager', 'content manager', 'brand manager', 'social media manager', 'marketingmanager', 'werbeleiter', 'pr manager', 'kommunikationsmanager', 'digital marketing', 'marketingleiter'],
  operations:  ['operations manager', 'betriebsleiter', 'werkleiter', 'prozessmanager', 'qualitätsmanager', 'qualitätssicherung', 'supply chain manager', 'betriebsmanager', 'leiter operations'],
  recruiter:   ['recruiter', 'talent acquisition', 'personalvermittler', 'headhunter', 'personalberater', 'recruiterin'],
  education:   ['lehrer', 'lehrerin', 'teacher', 'dozent', 'dozentin', 'trainer', 'ausbilder', 'ausbilderin', 'pädagoge', 'pädagogin', 'schulleiter', 'schulleiterin', 'unterricht', 'lehrbeauftragte'],
  healthcare:  ['arzt', 'ärztin', 'pfleger', 'pflegerin', 'krankenpfleger', 'krankenschwester', 'nurse', 'therapeut', 'therapeutin', 'apotheker', 'apothekerin', 'sanitäter', 'medizinisch', 'klinik', 'pflegefachkraft'],
  legal:       ['anwalt', 'anwältin', 'rechtsanwalt', 'jurist', 'juristin', 'notar', 'notarin', 'compliance manager', 'rechtsbeistand', 'syndikus', 'rechtsreferent'],
  engineering: ['ingenieur', 'ingenieurin', 'engineer', 'entwickler', 'entwicklerin', 'software developer', 'programmierer', 'programmiererin', 'techniker', 'technikerin', 'devops', 'data scientist', 'it-leiter', 'softwareentwickler'],
  logistics:   ['lagerleiter', 'lagerist', 'logistiker', 'disponent', 'disponentin', 'speditionskaufmann', 'warehouse manager', 'transportleiter', 'logistikleiter'],
  sales:       ['vertriebsleiter', 'vertriebsmanager', 'account manager', 'außendienstmitarbeiter', 'handelsvertreter', 'kundenberater', 'sales manager', 'verkäufer', 'verkäuferin', 'vertriebsmitarbeiter'],
};

function detectRoleCategory(roleTitle) {
  const r = roleTitle.toLowerCase();
  for (const [cat, kws] of Object.entries(ROLE_KEYWORDS)) {
    if (kws.some(kw => r.includes(kw))) return cat;
  }
  // Breitere Fallbacks
  if (r.includes('kund'))                              return 'support';
  if (r.includes('finanz') || r.includes('konto'))    return 'finance';
  if (r.includes('person') || r.includes(' hr'))      return 'hr';
  if (r.includes('marke') || r.includes('werbung'))   return 'marketing';
  if (r.includes('vertriebs') || r.includes('verkauf'))return 'sales';
  if (r.includes('logistik') || r.includes('lager') || r.includes('transport')) return 'logistics';
  if (r.includes('schule') || r.includes('bildung') || r.includes('lern'))     return 'education';
  if (r.includes('gesundheit') || r.includes('medizin'))                        return 'healthcare';
  if (r.includes('recht') || r.includes('jura') || r.includes('legal'))        return 'legal';
  if (r.includes('software') || r.includes('code') || r.includes('tech') || r.includes(' it')) return 'engineering';
  return 'default';
}

// --- KATEGORIE-DATEN ---------------------------------------------------------

const CATEGORY_DATA = {
  support: {
    taskSplit: [
      { area: 'Erstanfragen & Ticket-Triage',     aiAssisted: true,  automatable: true,  humanLed: false, humanReview: false, description: 'KI klassifiziert und beantwortet Standardanfragen automatisch.' },
      { area: 'FAQ & Wissensdatenbank',            aiAssisted: true,  automatable: true,  humanLed: false, humanReview: true,  description: 'KI pflegt und aktualisiert Wissensdatenbankartikel — Freigabe durch Team.' },
      { area: 'Eskalationen & Beschwerden',        aiAssisted: true,  automatable: false, humanLed: true,  humanReview: false, description: 'Komplexe Fälle und emotionale Eskalationen bleiben rein menschlich.' },
      { area: 'Kundenbeziehungspflege',            aiAssisted: false, automatable: false, humanLed: true,  humanReview: false, description: 'Vertrauen und Beziehungsaufbau sind rein menschliche Aufgaben.' },
      { area: 'Stimmungsanalyse & Reporting',      aiAssisted: true,  automatable: true,  humanLed: false, humanReview: false, description: 'KI analysiert Stimmung und generiert Berichte automatisch.' },
    ],
    tools: [
      { name: 'Intercom Fin',    category: 'KI-Support-Agent',  reason: 'Bis zu 50% der Standardanfragen werden automatisch und korrekt beantwortet.',                       fitForRole: 'Entlastet das Team von repetitiven Anfragen — mehr Zeit für komplexe Fälle.' },
      { name: 'Zendesk AI',      category: 'Support-Plattform', reason: 'Automatische Ticket-Triage, Antwortvorschläge und Echtzeit-Stimmungsanalyse.',                       fitForRole: 'Direkte Integration in bestehende Workflows ohne Systemwechsel.' },
      { name: 'Claude / ChatGPT',category: 'Schreib-KI',        reason: 'Antwortvorlagen, Eskalationszusammenfassungen und Wissensdatenbankartikel schnell entwerfen.',       fitForRole: 'Spart 30–60 Minuten Schreibzeit pro Schicht.' },
      { name: 'Forethought',     category: 'Lösung-KI',         reason: 'Sagt Ticketkategorie voraus und zeigt sofort relevante Lösungsartikel.',                            fitForRole: 'Reduziert durchschnittliche Bearbeitungszeit signifikant.' },
      { name: 'Assembled',       category: 'Workforce-Planung', reason: 'KI-gestützte Schichtplanung und Workload-Prognose für Support-Teams.',                               fitForRole: 'Optimiert Personalplanung und reduziert Unter- bzw. Überbesetzung.' },
    ],
    managerSummary: F => [
      'KI kann 30–50% der eingehenden Anfragen autonom lösen — Teamkapazität wird für komplexe Fälle frei',
      'Eskalationen, Vertrauenssituationen und Ausnahmebehandlung bleiben vollständig menschlich',
      'Investition: KI-Support-Plattform + 2–4 Wochen Team-Onboarding',
      F.readinessGap ? 'Erste Priorität: Team-Schulung zu KI-Tools vor dem Einsatz' : 'Team ist bereit für strukturierten KI-Rollout',
      'Empfohlener Einstieg: Top-3 häufigste Anfragekategorien automatisieren',
    ],
  },

  finance: {
    taskSplit: [
      { area: 'Berichte & Auswertungen',      aiAssisted: true,  automatable: true,  humanLed: false, humanReview: true,  description: 'KI generiert Standardberichte — Freigabe durch Finanzfachkraft.' },
      { area: 'Buchungen & Abgleich',         aiAssisted: true,  automatable: true,  humanLed: false, humanReview: true,  description: 'Rechnungsverarbeitung und Kontenabgleich weitgehend automatisierbar.' },
      { area: 'Prognosen & Planung',          aiAssisted: true,  automatable: false, humanLed: true,  humanReview: false, description: 'KI modelliert Szenarien — strategische Interpretation bleibt beim Controller.' },
      { area: 'Compliance & Prüfung',         aiAssisted: true,  automatable: false, humanLed: true,  humanReview: true,  description: 'KI unterstützt Prüfvorbereitung — Abzeichnung und Verantwortung immer menschlich.' },
      { area: 'Stakeholder-Kommunikation',    aiAssisted: true,  automatable: false, humanLed: true,  humanReview: false, description: 'KI entwirft Präsentationsunterlagen — Vorstand-Beziehungen bleiben menschlich.' },
    ],
    tools: [
      { name: 'Workiva',         category: 'Berichtswesen',    reason: 'Finanzberichte und regulatorische Meldungen automatisch aufbereiten.',                     fitForRole: 'Spart Stunden pro Berichtszyklus bei gleichbleibender Compliance.' },
      { name: 'Planful',         category: 'FP&A-KI',          reason: 'KI-gestützte Varianzanalyse, Prognosen und Szenarioplanung.',                             fitForRole: 'Schnellere Reaktion auf Marktveränderungen ohne Mehraufwand.' },
      { name: 'AppZen',          category: 'Audit-KI',         reason: 'Automatische Rechnungs- und Ausgabenprüfung — kennzeichnet Anomalien vor Kontrolle.',      fitForRole: 'Reduziert manuelle Prüfaufwände und deckt Fehler früher auf.' },
      { name: 'Claude / ChatGPT',category: 'Schreib-KI',       reason: 'Vorstandskommentare, Varianzberichte und Compliance-Zusammenfassungen entwerfen.',         fitForRole: 'Entwürfe in Minuten statt Stunden — Finanzexperte prüft und verfeinert.' },
      { name: 'Mosaic',          category: 'Finanz-Analytik',  reason: 'Echtzeit-Dashboards mit automatisierter Datenaggregation.',                               fitForRole: 'Sofortiger KPI-Überblick ohne manuelle Datenaufbereitung.' },
    ],
    managerSummary: F => [
      'Buchungs- und Berichtsaufgaben haben das höchste Automatisierungspotenzial — 40–60% Zeitersparnis realistisch',
      'Compliance-Abzeichnung und strategische Finanzentscheidungen bleiben vollständig unter menschlicher Kontrolle',
      'Investition: FP&A-Tool + Integrations-Setup (4–8 Wochen) + Compliance-Review der Workflows',
      F.complianceHeavy ? 'Regulatorisches Umfeld erfordert dokumentierte Freigabeprozesse für alle KI-Outputs' : 'Compliance-Anforderungen moderat — Standardfreigabeprozesse ausreichend',
      'Risiko: KI-generierte Finanzberichte brauchen klare Review-Prozesse vor Weitergabe',
    ],
  },

  hr: {
    taskSplit: [
      { area: 'Stellenbeschreibungen',          aiAssisted: true,  automatable: false, humanLed: true,  humanReview: true,  description: 'KI erstellt Entwürfe — HR-Experte prüft Tonalität, Inklusion und Relevanz.' },
      { area: 'Bewerbungsscreening',            aiAssisted: true,  automatable: false, humanLed: true,  humanReview: true,  description: 'KI erstellt Zusammenfassungen — finale Vorauswahl immer durch HR-Fachkraft.' },
      { area: 'Mitarbeiter-FAQ & Richtlinien',  aiAssisted: true,  automatable: true,  humanLed: false, humanReview: false, description: 'Standardanfragen zu Urlaub und Benefits vollständig automatisierbar.' },
      { area: 'Sensible Gespräche',             aiAssisted: false, automatable: false, humanLed: true,  humanReview: false, description: 'Leistungsgespräche, Trennungsgespräche und Ermittlungen rein menschlich.' },
      { area: 'Onboarding & Dokumentation',     aiAssisted: true,  automatable: true,  humanLed: false, humanReview: false, description: 'Onboarding-Checklisten, Vertragsvorlagen und Begrüßungs-E-Mails automatisierbar.' },
    ],
    tools: [
      { name: 'Workday',         category: 'HR-Plattform',        reason: 'Einstellungs-Workflows, Onboarding und Mitarbeiterlebenszyklusverwaltung.',          fitForRole: 'Zentralisiert HR-Daten und automatisiert Routineaufgaben.' },
      { name: 'Leena AI',        category: 'HR-Chatbot',           reason: 'Beantwortet Mitarbeiter-FAQ zu HR-Themen ohne HR-Einbindung.',                      fitForRole: 'Reduziert eingehende Anfragen ans HR-Team um 30–50%.' },
      { name: 'Claude / ChatGPT',category: 'Schreib-KI',           reason: 'Stellenbeschreibungen, Richtliniendokumente und Mitarbeiterkommunikation entwerfen.', fitForRole: 'Qualitativ hochwertige Entwürfe in Minuten — HR verfeinert und gibt frei.' },
      { name: 'Lattice',         category: 'Performance-Mgmt.',    reason: 'Leistungsbeurteilungen strukturieren und mit KI-Vorlagen unterstützen.',             fitForRole: 'Spart Vorbereitungszeit bei Beurteilungszyklen.' },
      { name: 'Greenhouse',      category: 'Recruiting-Plattform', reason: 'KI-gestütztes Kandidaten-Screening, Planung und Pipeline-Analytik.',                fitForRole: 'Strukturiert den Recruiting-Prozess und reduziert Koordinationsaufwand.' },
    ],
    managerSummary: F => [
      'HR-Administration (FAQ, Onboarding, Stellenbeschreibungen) hat 50–70% Automatisierungspotenzial',
      'Sensible Personalentscheidungen, Ermittlungen und Trennungsgespräche bleiben rein menschlich',
      'KI im Recruiting unterstützt — finale Einstellungsentscheidungen liegen immer beim HR-Fachmann',
      'Investition: HR-Chatbot + Schreib-KI-Lizenz — ROI innerhalb von 3 Monaten realistisch',
      'Datenschutz: Mitarbeiterdaten niemals ungefiltert in öffentliche KI-Tools eingeben',
    ],
  },

  marketing: {
    taskSplit: [
      { area: 'Texterstellung & Varianten',     aiAssisted: true,  automatable: false, humanLed: true,  humanReview: true,  description: 'KI generiert Entwürfe — Markenstimme und Freigabe bleiben beim Team.' },
      { area: 'Content-Planung',                aiAssisted: true,  automatable: false, humanLed: true,  humanReview: false, description: 'KI schlägt Themen vor — strategische Planung bleibt menschlich.' },
      { area: 'Performance-Berichte',           aiAssisted: true,  automatable: true,  humanLed: false, humanReview: false, description: 'KI aggregiert Daten und erstellt Standardberichte automatisch.' },
      { area: 'Kreative Leitung & Strategie',   aiAssisted: false, automatable: false, humanLed: true,  humanReview: false, description: 'Markenpositionierung und Kampagnenstrategie rein menschlich.' },
      { area: 'Zielgruppenanalyse',             aiAssisted: true,  automatable: false, humanLed: true,  humanReview: false, description: 'KI analysiert Daten — strategische Schlüsse ziehen Menschen.' },
    ],
    tools: [
      { name: 'Jasper AI',       category: 'KI-Texterstellung', reason: 'Anzeigentexte, Kampagnenbriefs und Inhaltsvarianten in Produktionsqualität.',          fitForRole: 'Markenkonsistente Texte in Minuten — für hohe Content-Volumen.' },
      { name: 'Semrush AI',      category: 'SEO & Content',     reason: 'KI-gestützte Keyword-Recherche, Wettbewerbsanalyse und Content-Briefs.',               fitForRole: 'Spart Stunden bei SEO-Recherche — datenbasierte Empfehlungen.' },
      { name: 'HubSpot AI',      category: 'CRM & E-Mail',      reason: 'KI-E-Mail-Sequenzen, Kampagnenanalyse und Lead-Scoring.',                             fitForRole: 'Automatisiert Nurturing-Workflows und verbessert Conversion-Tracking.' },
      { name: 'Midjourney',      category: 'Bild-KI',           reason: 'Kampagnenvisuals und Social-Assets schnell erstellen.',                                fitForRole: 'Reduziert Abhängigkeit von Designressourcen für einfache Bilder.' },
      { name: 'Zapier',          category: 'Automatisierung',   reason: 'Marketing-Tools verbinden und repetitive Workflows automatisieren.',                   fitForRole: 'Eliminiert manuelle Datentransfers und Content-Distribution-Aufgaben.' },
    ],
    managerSummary: F => [
      'Content-Produktion kann mit KI 3–5× skaliert werden bei gleichem Personalaufwand',
      'Kreative Gesamtleitung, Markenstrategie und Stakeholder-Freigaben bleiben vollständig menschlich',
      'Qualitätssicherung: Alle KI-Texte erfordern redaktionelle Prüfung vor Veröffentlichung',
      'Empfohlener Start: KI-Texterstellung pilotieren für einen Content-Typ (z.B. Social Media)',
      'ROI: Sichtbar nach 4–8 Wochen durch reduzierten Zeitaufwand pro veröffentlichtem Inhalt',
    ],
  },

  operations: {
    taskSplit: [
      { area: 'Prozessdokumentation',           aiAssisted: true,  automatable: false, humanLed: true,  humanReview: true,  description: 'KI erstellt SOP-Entwürfe — Freigabe durch Prozessverantwortliche.' },
      { area: 'Statusberichte & KPIs',          aiAssisted: true,  automatable: true,  humanLed: false, humanReview: false, description: 'Operative Berichte und KPI-Dashboards automatisch generieren.' },
      { area: 'Lieferanten- & Partnerbeziehungen', aiAssisted: false, automatable: false, humanLed: true, humanReview: false, description: 'Verhandlungen und strategische Partnerschaften rein menschlich.' },
      { area: 'Ausnahmebehandlung',             aiAssisted: true,  automatable: false, humanLed: true,  humanReview: false, description: 'KI unterstützt Diagnose — Entscheidungen und Maßnahmen bleiben menschlich.' },
      { area: 'Kapazitäts- & Ressourcenplanung', aiAssisted: true, automatable: false, humanLed: true,  humanReview: false, description: 'KI modelliert Szenarien — strategische Entscheidungen beim Operations-Manager.' },
    ],
    tools: [
      { name: 'Notion AI',        category: 'Wissensmanagement', reason: 'SOP-Dokumentation, Meeting-Zusammenfassungen und Prozesslandkarten generieren.',      fitForRole: 'Hält Prozesswissen aktuell ohne hohen manuellen Aufwand.' },
      { name: 'Process Street',   category: 'Workflow-KI',       reason: 'KI-strukturierte Checklisten und automatisiertes Workflow-Tracking.',                 fitForRole: 'Standardisiert Abläufe und macht Ausnahmen sichtbar.' },
      { name: 'Zapier',           category: 'Automatisierung',   reason: 'Operative Tools verbinden und Genehmigungs-Workflows automatisieren.',                fitForRole: 'Eliminiert manuelle Übergaben zwischen Systemen.' },
      { name: 'Monday.com AI',    category: 'Projektmanagement', reason: 'Automatische Aufgabenzuweisung, Deadline-Tracking und Projektstatusberichte.',        fitForRole: 'Echtzeit-Überblick ohne manuelle Datenpflege.' },
      { name: 'Claude / ChatGPT', category: 'Schreib-KI',        reason: 'Lieferantenbriefs, Statusberichte und Stakeholder-Kommunikation entwerfen.',         fitForRole: 'Spart Zeit bei schriftlicher Kommunikation und Dokumentation.' },
    ],
    managerSummary: F => [
      'Reporting und Prozessdokumentation sind die größten Automatisierungsgewinne — 40–60% Zeitersparnis',
      'Lieferantenbeziehungen, Krisenreaktion und strategische Planung bleiben vollständig menschlich',
      F.processGap ? 'Achtung: Prozesse müssen erst dokumentiert werden, bevor Automatisierung zuverlässig funktioniert' : 'Bestehende Prozessdokumentation ist gute Grundlage für KI-Integration',
      'KI-Tools können operative Transparenz signifikant verbessern ohne Zusatzaufwand',
      'Empfohlener Einstieg: Automatisierung von Statusberichten und Meeting-Protokollen',
    ],
  },

  recruiter: {
    taskSplit: [
      { area: 'Stellenausschreibungen',         aiAssisted: true,  automatable: false, humanLed: true,  humanReview: true,  description: 'KI erstellt Entwürfe — Recruiter prüft Tonalität und Anforderungen.' },
      { area: 'Kandidaten-Sourcing',            aiAssisted: true,  automatable: false, humanLed: true,  humanReview: false, description: 'KI identifiziert Kandidaten — Recruiter bewertet und priorisiert.' },
      { area: 'Lebenslauf-Screening',           aiAssisted: true,  automatable: false, humanLed: true,  humanReview: true,  description: 'KI erstellt Zusammenfassungen — finale Auswahl immer durch den Recruiter.' },
      { area: 'Einstellungsentscheidungen',     aiAssisted: false, automatable: false, humanLed: true,  humanReview: false, description: 'Finale Einstellungsempfehlungen und Angebote sind rein menschliche Entscheidungen.' },
      { area: 'Kandidatenpflege & Beziehungen', aiAssisted: true,  automatable: false, humanLed: true,  humanReview: false, description: 'KI unterstützt Outreach — persönliche Beziehungen und Verhandlungen menschlich.' },
    ],
    tools: [
      { name: 'HireEZ',           category: 'Sourcing-KI',       reason: 'KI-gestützte Kandidatensuche auf LinkedIn, GitHub und 30+ Plattformen.',              fitForRole: 'Findet passende Kandidaten schneller und erweitert Sourcing-Radius.' },
      { name: 'Ashby',            category: 'ATS mit KI',        reason: 'KI-gestütztes Pipeline-Management, Outreach-Automatisierung und Kandidatenanalytik.',  fitForRole: 'Strukturiert Recruiting-Prozess und gibt Pipeline-Überblick in Echtzeit.' },
      { name: 'Metaview',         category: 'Interview-KI',      reason: 'Vorstellungsgespräche automatisch transkribieren und zusammenfassen.',                  fitForRole: 'Spart Dokumentationszeit und verbessert Entscheidungsqualität.' },
      { name: 'Claude / ChatGPT', category: 'Schreib-KI',        reason: 'Outreach-Nachrichten, Stellenausschreibungen und Interview-Leitfäden entwerfen.',      fitForRole: 'Personalisierte Nachrichten für jede Zielgruppe in Sekunden.' },
      { name: 'Eightfold AI',     category: 'Talent-Intelligenz',reason: 'Kandidaten mit Stellen auf Basis von Skills abgleichen — jenseits Keyword-Matching.',  fitForRole: 'Deckt versteckte Talente auf und reduziert Bias im Screening.' },
    ],
    managerSummary: F => [
      'Sourcing und Screening können mit KI 2–4× effizienter werden — mehr Kapazität für Beziehungsaufbau',
      'Einstellungsentscheidungen, Verhandlungen und Kandidatenerlebnis bleiben rein menschlich',
      'Wichtig: KI-Screening-Empfehlungen müssen auf Bias geprüft werden — menschliche Kontrolle ist Pflicht',
      'Investition: ATS mit KI + Sourcing-Tool — ROI typischerweise nach 2–3 Besetzungen sichtbar',
      'KI im Recruiting reduziert Time-to-Hire ohne Qualitätsverlust bei finalen Entscheidungen',
    ],
  },

  education: {
    taskSplit: [
      { area: 'Unterrichtsplanung & Materialien', aiAssisted: true,  automatable: false, humanLed: true,  humanReview: true,  description: 'KI erstellt Entwürfe — pädagogische Entscheidung und Klassenanpassung bleibt beim Lehrer.' },
      { area: 'Bewertung & Korrektur',            aiAssisted: true,  automatable: false, humanLed: true,  humanReview: true,  description: 'KI unterstützt bei strukturierten Aufgaben — Noten liegen bei der Lehrkraft.' },
      { area: 'Differenzierung & Förderung',      aiAssisted: true,  automatable: false, humanLed: true,  humanReview: false, description: 'KI schlägt Fördermaßnahmen vor — Umsetzung und Begleitung ist menschlich.' },
      { area: 'Elternkommunikation',              aiAssisted: true,  automatable: false, humanLed: true,  humanReview: false, description: 'KI entwirft Standardmitteilungen — sensible Gespräche rein menschlich.' },
      { area: 'Verwaltungsaufgaben',              aiAssisted: true,  automatable: true,  humanLed: false, humanReview: false, description: 'Terminplanung, Formulare und Standardberichte weitgehend automatisierbar.' },
    ],
    tools: [
      { name: 'Claude / ChatGPT',  category: 'Schreib-KI',       reason: 'Unterrichtsmaterialien, Arbeitsblätter und Aufgaben schnell und differenziert erstellen.', fitForRole: 'Spart Vorbereitungszeit erheblich bei gleichbleibender Qualität.' },
      { name: 'Khanmigo',          category: 'KI-Tutor',         reason: 'KI-gestütztes individuelles Lernen und Erklärungen für Schüler.',                         fitForRole: 'Unterstützt Binnendifferenzierung ohne erhöhten Lehreraufwand.' },
      { name: 'Curipod',           category: 'Unterrichts-KI',   reason: 'KI-generierte interaktive Lektionen, Quizze und Diskussionsimpulse.',                      fitForRole: 'Interaktiven Unterricht schnell aufbauen ohne stundenlange Vorbereitung.' },
      { name: 'LanguageTool',      category: 'Text-KI',          reason: 'Schüleraufsätze auf Sprachfehler prüfen und Feedback vorschlagen.',                        fitForRole: 'Unterstützt beim Korrekturprozess — schnelles Sprachfeedback für Schüler.' },
      { name: 'Canva AI',          category: 'Design-KI',        reason: 'Visuell ansprechende Lernmaterialien und Präsentationen erstellen.',                       fitForRole: 'Hochwertige Materialien ohne Designkenntnisse — in Minuten.' },
    ],
    managerSummary: F => [
      'Unterrichtsvorbereitung und administrative Aufgaben bieten 30–50% Zeitersparnis durch KI',
      'Pädagogisches Urteil, Beziehung zu Schülern und Elterngespräche bleiben vollständig menschlich',
      'Datenschutz: Schülerdaten dürfen nicht in öffentliche KI-Tools eingegeben werden (DSGVO)',
      'Empfohlener Einstieg: KI für Materialerstellung — kein Kontakt mit Schülerdaten',
      'Fortbildungsbedarf: Lehrkräfte brauchen ~4–8 Stunden Einführung in sinnvollen KI-Einsatz',
    ],
  },

  healthcare: {
    taskSplit: [
      { area: 'Dokumentation & Aufzeichnungen', aiAssisted: true,  automatable: false, humanLed: false, humanReview: true,  description: 'KI unterstützt Pflegedokumentation — klinische Einschätzungen durch Fachpersonal.' },
      { area: 'Terminplanung & Administration', aiAssisted: true,  automatable: true,  humanLed: false, humanReview: false, description: 'Terminvergabe, Erinnerungen und Standardverwaltung vollständig automatisierbar.' },
      { area: 'Patientenkommunikation',         aiAssisted: false, automatable: false, humanLed: true,  humanReview: false, description: 'Empathie, Aufklärung und Vertrauen in der Patienteninteraktion rein menschlich.' },
      { area: 'Diagnose & Klinische Entscheidungen', aiAssisted: true, automatable: false, humanLed: true, humanReview: true, description: 'KI unterstützt Mustererkennung — Diagnosen bleiben beim Fachpersonal.' },
      { area: 'Medikamentenverwaltung',         aiAssisted: true,  automatable: false, humanLed: true,  humanReview: true,  description: 'KI prüft Wechselwirkungen — Verabreichung und Freigabe immer durch Fachpersonal.' },
    ],
    tools: [
      { name: 'Nuance DAX',       category: 'Klinische Dokumentation', reason: 'Arztgespräche automatisch in strukturierte Dokumentation umwandeln.',              fitForRole: 'Spart 30–60 Minuten Dokumentationszeit pro Schicht.' },
      { name: 'Hyro',             category: 'Patientenkommunikation',  reason: 'KI beantwortet Standardfragen von Patienten (Termine, FAQ) automatisch.',          fitForRole: 'Entlastet Personal von Routineanfragen — mehr Zeit für Patienten.' },
      { name: 'Doximity',         category: 'Klinische KI',           reason: 'Vernetzung mit Fachkollegen und klinische Entscheidungsunterstützung.',              fitForRole: 'Schneller Austausch mit Spezialisten für komplexe Fälle.' },
      { name: 'Aidoc',            category: 'Bildgebungs-KI',         reason: 'KI analysiert Bildgebung und kennzeichnet dringende Befunde prioritär.',             fitForRole: 'Unterstützt Priorisierung — Befundung bleibt beim Radiologen.' },
      { name: 'Claude / ChatGPT', category: 'Schreib-KI',             reason: 'Patientenaufklärungsbögen, interne Berichte und Merkblätter entwerfen.',            fitForRole: 'Spart Schreibzeit — fachliche Prüfung immer durch Fachpersonal.' },
    ],
    managerSummary: F => [
      'Dokumentation und Administration haben das höchste Automatisierungspotenzial — bis zu 60 Min. pro Schicht',
      'Patienteninteraktion, klinische Entscheidungen und Diagnosen bleiben vollständig menschlich und unterliegen Haftung',
      'Datenschutz: DSGVO und Schweigepflicht setzen strikte Grenzen — nur zertifizierte Lösungen verwenden',
      'Empfohlener Einstieg: KI-gestützte Dokumentation — geringes Risiko, hoher Zeitgewinn',
      'Patientensicherheit hat Vorrang: Jede klinische KI-Empfehlung erfordert menschliche Validierung',
    ],
  },

  legal: {
    taskSplit: [
      { area: 'Vertragsprüfung & Recherche',    aiAssisted: true,  automatable: false, humanLed: true,  humanReview: true,  description: 'KI prüft Standardklauseln und recherchiert — Beurteilung immer durch den Juristen.' },
      { area: 'Dokumentenerstellung',           aiAssisted: true,  automatable: false, humanLed: true,  humanReview: true,  description: 'KI erstellt Entwürfe — juristische Prüfung und Anpassung ist Pflicht.' },
      { area: 'Mandantenkommunikation',         aiAssisted: true,  automatable: false, humanLed: true,  humanReview: false, description: 'KI entwirft Standardkommunikation — sensible Beratungsgespräche rein menschlich.' },
      { area: 'Rechtliche Beratung',            aiAssisted: false, automatable: false, humanLed: true,  humanReview: false, description: 'Rechtliche Einschätzungen und Haftungsfragen sind rein menschlich.' },
      { area: 'Administrative Verwaltung',      aiAssisted: true,  automatable: true,  humanLed: false, humanReview: false, description: 'Fristenverwaltung, Terminplanung und Standardformulare automatisierbar.' },
    ],
    tools: [
      { name: 'Harvey AI',        category: 'Legal-KI',            reason: 'Vertragsanalyse, Recherche und Dokumentenerstellung speziell für den Rechtsbereich.',  fitForRole: 'Spart Stunden bei Standardvertragsarbeit — juristische Prüfung bleibt beim Anwalt.' },
      { name: 'Clio Duo',         category: 'Kanzlei-Management',  reason: 'KI-gestütztes Kanzlei-Management mit automatischer Zeiterfassung.',                    fitForRole: 'Reduziert administrativen Aufwand und verbessert Rechnungsgenauigkeit.' },
      { name: 'Lexis AI',         category: 'Legal Research',      reason: 'KI-gestützte Rechtsprechungsrecherche und Fallanalyse.',                              fitForRole: 'Findet relevante Urteile erheblich schneller als manuelle Suche.' },
      { name: 'Claude / ChatGPT', category: 'Schreib-KI',          reason: 'Erste Vertragsentwürfe, Schriftsatz-Gliederungen und Mandantenschreiben vorbereiten.', fitForRole: 'Entwürfe in Minuten — Jurist prüft, verfeinert und unterzeichnet.' },
      { name: 'Docusign AI',      category: 'Vertragsverwaltung',  reason: 'Intelligente Vertragsanalyse, Fristenverfolgung und Signierprozess-Automatisierung.',  fitForRole: 'Hält Vertragsfristen im Blick und automatisiert Unterzeichnung.' },
    ],
    managerSummary: F => [
      'Recherche, Vertragsentwürfe und Administration können 30–50% effizienter werden mit KI',
      'Rechtliche Haftung, Mandantenberatung und Strategie bleiben vollständig beim Juristen',
      'Berufsrechtliche Pflichten (Verschwiegenheit, Sorgfalt) setzen klare Grenzen für KI-Tool-Nutzung',
      'Nur DSGVO-konforme Legal-Tech-Lösungen — keine öffentlichen KI-Tools mit Mandantendaten',
      'Empfohlener Einstieg: KI für Vertragsrecherche und erste Entwürfe — minimales Risiko, hoher Zeitgewinn',
    ],
  },

  engineering: {
    taskSplit: [
      { area: 'Code-Erstellung & Debugging',    aiAssisted: true,  automatable: false, humanLed: true,  humanReview: true,  description: 'KI schreibt Entwürfe und findet Bugs — Code-Review und Architektur bleibt beim Entwickler.' },
      { area: 'Technische Dokumentation',       aiAssisted: true,  automatable: false, humanLed: true,  humanReview: true,  description: 'KI erstellt Dokumentationsentwürfe — technische Korrektheit wird geprüft.' },
      { area: 'Architektur & Systemdesign',     aiAssisted: true,  automatable: false, humanLed: true,  humanReview: false, description: 'KI liefert Vorschläge — Architekturentscheidungen bleiben beim Ingenieur.' },
      { area: 'Tests & Qualitätssicherung',     aiAssisted: true,  automatable: true,  humanLed: false, humanReview: true,  description: 'Automatisierte Tests und Test-Generierung — Review der Abdeckung durch Entwickler.' },
      { area: 'Stakeholder-Kommunikation',      aiAssisted: true,  automatable: false, humanLed: true,  humanReview: false, description: 'KI hilft bei Anforderungsanalyse — Meetings und Entscheidungen menschlich.' },
    ],
    tools: [
      { name: 'GitHub Copilot',   category: 'KI-Code-Assistent', reason: 'Kontextsensitive Code-Vervollständigung direkt in der IDE.',                            fitForRole: 'Durchschnittlich 30–55% schnelleres Coden bei Routineaufgaben.' },
      { name: 'Cursor AI',        category: 'KI-Editor',         reason: 'KI-nativer Editor mit Konversations-Interface für Refactoring und Debugging.',           fitForRole: 'Beschleunigt Refactoring und erklärt komplexen Code on-demand.' },
      { name: 'Claude / ChatGPT', category: 'Technische KI',     reason: 'Architekturanfragen, Debugging-Hilfe und technische Dokumentationsentwürfe.',           fitForRole: 'Immer verfügbarer technischer Sparringspartner.' },
      { name: 'Tabnine',          category: 'Code-Completion',   reason: 'KI-Code-Vervollständigung mit Fokus auf Datenschutz — Code bleibt auf eigenem Server.', fitForRole: 'Ideal wenn IP-Schutz Code-Weitergabe an externe APIs einschränkt.' },
      { name: 'Swimm AI',         category: 'Code-Dokumentation',reason: 'Dokumentation automatisch aus Code generieren und bei Änderungen aktualisieren.',        fitForRole: 'Hält technische Dokumentation aktuell ohne manuellen Aufwand.' },
    ],
    managerSummary: F => [
      'Entwickler mit KI-Assistenten sind nachweislich 30–55% produktiver bei Coding-Routineaufgaben',
      'Systemdesign, Architekturentscheidungen und Code-Review bleiben menschliche Kernkompetenz',
      'Sicherheitsrisiko: KI-generierter Code kann Schwachstellen enthalten — Code-Review ist Pflicht',
      'IP-Schutz prüfen: Unternehmens-Code sollte nicht in öffentliche KI-Modelle eingegeben werden',
      'Empfohlener Einstieg: GitHub Copilot für das gesamte Team — schneller ROI, minimale Einführungshürde',
    ],
  },

  logistics: {
    taskSplit: [
      { area: 'Tourenplanung & Disposition',    aiAssisted: true,  automatable: true,  humanLed: false, humanReview: true,  description: 'KI optimiert Routen automatisch — Ausnahmen und Kundenwünsche durch Disponenten.' },
      { area: 'Bestandsverwaltung',             aiAssisted: true,  automatable: true,  humanLed: false, humanReview: false, description: 'Lagerbestandsprognosen und Nachbestellungen weitgehend automatisierbar.' },
      { area: 'Lieferantenmanagement',          aiAssisted: true,  automatable: false, humanLed: true,  humanReview: false, description: 'KI unterstützt bei Analysen — Verhandlungen und Beziehungen bleiben menschlich.' },
      { area: 'Qualitätsprüfung',               aiAssisted: true,  automatable: false, humanLed: true,  humanReview: true,  description: 'KI-Bildanalyse unterstützt — finale Qualitätsentscheidungen durch Fachpersonal.' },
      { area: 'Ausnahmen & Störungen',          aiAssisted: true,  automatable: false, humanLed: true,  humanReview: false, description: 'KI erkennt Abweichungen früh — Ursachenanalyse und Eskalation sind menschlich.' },
    ],
    tools: [
      { name: 'FourKites',        category: 'Supply-Chain-KI',    reason: 'Echtzeit-Sendungsverfolgung und KI-gestützte Lieferzeitprognosen.',                    fitForRole: 'Sofortige Transparenz über Sendungsstatus für Team und Kunden.' },
      { name: 'Coupa AI',         category: 'Beschaffungs-KI',    reason: 'KI-gestützte Lieferantenanalyse, Ausgabentransparenz und Vertragsoptimierung.',        fitForRole: 'Deckt Einsparpotenziale in der Beschaffung auf.' },
      { name: 'Zebra AI',         category: 'Warehouse-KI',       reason: 'KI-gestützte Lageroptimierung, Pick-Routen und Bestandsverwaltung.',                   fitForRole: 'Steigert Kommissioniergeschwindigkeit und reduziert Fehlerquote.' },
      { name: 'Claude / ChatGPT', category: 'Schreib-KI',         reason: 'Lieferantenanfragen, Statusberichte und Störungsmeldungen schnell formulieren.',       fitForRole: 'Spart Zeit bei schriftlicher Kommunikation in der Logistik.' },
      { name: 'Monday.com AI',    category: 'Projektmanagement',  reason: 'Operative Projekte, Deadlines und Ressourcen automatisch im Blick behalten.',          fitForRole: 'Gibt Logistikmanagern Echtzeit-Überblick ohne manuelle Datenpflege.' },
    ],
    managerSummary: F => [
      'Tourenplanung und Bestandsverwaltung haben das höchste Potenzial — 40–60% effizienter',
      'Lieferantenverhandlungen, Ausnahmemanagement und Kundenbeziehungen bleiben menschlich',
      'KI-Echtzeitverfolgung verbessert Kundenkommunikation ohne Mehraufwand',
      'Integration bestehender ERP- und WMS-Systeme ist kritischer Erfolgsfaktor für KI-Rollout',
      'Empfohlener Einstieg: Tourenoptimierung und Bestandsprognosen — messbare ROI-Kennzahlen sofort verfügbar',
    ],
  },

  sales: {
    taskSplit: [
      { area: 'Lead-Recherche & Qualifizierung', aiAssisted: true, automatable: true,  humanLed: false, humanReview: true,  description: 'KI identifiziert und qualifiziert Leads — finale Priorisierung durch Vertriebler.' },
      { area: 'CRM-Datenpflege',                aiAssisted: true,  automatable: true,  humanLed: false, humanReview: false, description: 'Gesprächsnotizen, Follow-ups und CRM-Updates automatisch generieren.' },
      { area: 'Kundengespräche & Verhandlungen', aiAssisted: false, automatable: false, humanLed: true, humanReview: false, description: 'Beziehungsaufbau, Überzeugung und Verhandlungen sind rein menschliche Stärken.' },
      { area: 'Angebotserstellung',             aiAssisted: true,  automatable: false, humanLed: true,  humanReview: true,  description: 'KI erstellt Angebotsentwürfe — Preisverhandlung und Anpassung bleiben beim Profi.' },
      { area: 'Pipeline-Prognosen',             aiAssisted: true,  automatable: true,  humanLed: false, humanReview: false, description: 'KI prognostiziert Abschlusswahrscheinlichkeiten und Pipeline-Wert automatisch.' },
    ],
    tools: [
      { name: 'Salesforce Einstein', category: 'CRM-KI',           reason: 'KI-gestütztes Lead-Scoring, Prognosen und Opportunity-Insights direkt im CRM.',      fitForRole: 'Priorisiert den Arbeitsalltag auf die vielversprechendsten Chancen.' },
      { name: 'Gong.io',            category: 'Revenue Intelligence',reason: 'KI analysiert Verkaufsgespräche und gibt Coaching-Feedback.',                       fitForRole: 'Verbessert Abschlussraten durch datenbasiertes Coaching.' },
      { name: 'Apollo.io',          category: 'Sales Intelligence', reason: 'KI-gestützte Lead-Generierung, Datenanreicherung und Outreach-Sequenzierung.',       fitForRole: 'Baut Prospecting-Pipeline automatisch auf.' },
      { name: 'Claude / ChatGPT',   category: 'Schreib-KI',        reason: 'Personalisierte Outreach-E-Mails, Angebotsbeschreibungen und Follow-ups entwerfen.', fitForRole: 'Hochwertige, personalisierte Kommunikation in Sekunden.' },
      { name: 'Clari',              category: 'Pipeline-Management',reason: 'KI-gestützte Pipeline-Forecasts und Deal-Risikoanalyse.',                            fitForRole: 'Klarer Blick auf erreichbare Quartalsziele für Vertriebsmanager.' },
    ],
    managerSummary: F => [
      'CRM-Pflege, Lead-Recherche und Angebotsentwürfe können 40–60% automatisiert werden',
      'Kundengespräche, Verhandlungen und Beziehungsaufbau bleiben der menschliche Wettbewerbsvorteil',
      'KI-Conversation Intelligence (Gong) verbessert Abschlussraten messbar',
      'Empfohlener Einstieg: CRM-Datenpflege automatisieren — sofortige Zeitersparnis ohne Risiko',
      'Datenschutz: Kundendaten sind sensibel — DSGVO-konforme Tools wählen',
    ],
  },
};

// Fallback-Daten für unbekannte Kategorien
const DEFAULT_TASK_SPLIT = [
  { area: 'Strukturierte Datenverarbeitung',  aiAssisted: true,  automatable: true,  humanLed: false, humanReview: true,  description: 'Repetitive, regelbasierte Datenaufgaben mit hohem Automatisierungspotenzial.' },
  { area: 'Berichte & Zusammenfassungen',     aiAssisted: true,  automatable: false, humanLed: true,  humanReview: true,  description: 'KI erstellt Entwürfe — fachliche Prüfung und Freigabe durch Fachkraft.' },
  { area: 'Stakeholder-Kommunikation',        aiAssisted: true,  automatable: false, humanLed: true,  humanReview: false, description: 'KI entwirft Texte — sensible Themen und persönliche Kommunikation menschlich.' },
  { area: 'Fachliche Kernentscheidungen',     aiAssisted: false, automatable: false, humanLed: true,  humanReview: false, description: 'Urteilsbasierte Entscheidungen, die Fachwissen erfordern, bleiben beim Menschen.' },
  { area: 'Koordination & Verwaltung',        aiAssisted: true,  automatable: true,  humanLed: false, humanReview: false, description: 'Terminplanung, Dokumentenverwaltung und Standardprozesse automatisierbar.' },
];

const DEFAULT_TOOLS = [
  { name: 'Claude / ChatGPT',  category: 'Schreib-KI',        reason: 'Kommunikation, Berichte und Dokumente entwerfen.',                           fitForRole: 'Spart Schreibzeit und verbessert Konsistenz in der Dokumentation.' },
  { name: 'Microsoft Copilot', category: 'Produktivitäts-KI', reason: 'KI-Unterstützung direkt in Word, Excel, Outlook und Teams.',                 fitForRole: 'Keine Tool-Umstellung — KI in der gewohnten Office-Umgebung.' },
  { name: 'Notion AI',         category: 'Wissensmanagement', reason: 'Team-Wissensdatenbanken, SOPs und Prozessdokumentation aufbauen.',            fitForRole: 'Hält Wissen zugänglich und reduziert Informationsverlust.' },
  { name: 'Otter.ai',          category: 'Meeting-KI',        reason: 'Meetings automatisch transkribieren und Aktionspunkte extrahieren.',          fitForRole: 'Spart Nachbereitungszeit und verbessert Meeting-Follow-up-Qualität.' },
  { name: 'Zapier',            category: 'Automatisierung',   reason: 'Repetitive Übergabe-Workflows zwischen Tools automatisieren.',                fitForRole: 'Eliminiert manuelle Datentransfers ohne Programmierkenntnisse.' },
];

// --- ROLLENSPEZIFISCHE AUFGABENLISTEN ----------------------------------------
// Ersetzt die generische buildTasks()-Ausgabe mit konkreten, berufsspezifischen Listen.

const CATEGORY_TASKS = {
  support: {
    ai:    ['Erstanfragen und Standardtickets automatisch klassifizieren und beantworten', 'Wissensdatenbank-Artikel und FAQs automatisch erstellen und aktualisieren', 'Kundenstimmung in Echtzeit analysieren und Eskalationen kennzeichnen', 'Schichtpläne und Workload-Verteilung optimieren', 'Gesprächsnotizen nach Interaktionen automatisch zusammenfassen'],
    human: ['Komplexe Eskalationen und emotionale Kundensituationen lösen', 'Hochwertige Kundenbeziehungen aufbauen und pflegen', 'Richtlinienausnahmen und Grenzfälle entscheiden', 'Team-Coaching und Qualitätskalibrierung durchführen', 'Vertrauenswiederherstellung bei unzufriedenen Kunden'],
  },
  finance: {
    ai:    ['Standardisierte Finanzberichte und Varianzanalysen generieren', 'Rechnungsverarbeitung und Kontenabgleich automatisieren', 'Anomalien und Abweichungen in Finanzdaten erkennen', 'Prognose-Szenarien modellieren und Datenvorbereitung übernehmen', 'Regulatorische Meldungen und Compliance-Dokumentation vorbereiten'],
    human: ['Compliance-Abzeichnung und Prüfungsverantwortung tragen', 'Strategische Finanzplanung und Szenario-Interpretation leiten', 'Stakeholder-Präsentationen und Vorstandsmaterialien vertreten', 'Regulierungsbehörden-Beziehungen und Prüfer-Kommunikation managen', 'Risikoentscheidungen und Ausnahmegenehmigungen verantworten'],
  },
  hr: {
    ai:    ['Stellenbeschreibungen entwerfen und für verschiedene Kanäle optimieren', 'Vorstellungsgespräche planen und Kandidaten-Screening zusammenfassen', 'Mitarbeiter-FAQ und Richtlinien-Q&A automatisch beantworten', 'Onboarding-Dokumente und Begrüßungsinhalte vorbereiten', 'Lern- und Entwicklungsinhalte recherchieren und zusammenfassen'],
    human: ['Sensible Mitarbeiterbeziehungen und Ermittlungen führen', 'Kultur- und Wertegespräche mit dem Team gestalten', 'Leistungs- und Disziplinarüberprüfungen verantworten', 'Organisationsdesign-Entscheidungen treffen', 'Komplexe Angebots-Verhandlungen und Mitarbeiterbindung steuern'],
  },
  marketing: {
    ai:    ['Textentwürfe und Kampagnenvarianten für verschiedene Kanäle generieren', 'Social-Media-Inhalte planen, umformatieren und terminieren', 'Performance-Berichte und Kampagnenauswertungen erstellen', 'SEO-Keyword-Recherche und Wettbewerbsanalysen durchführen', 'E-Mail-Sequenzen und Newsletter-Entwürfe erstellen'],
    human: ['Markenstrategie und kreative Gesamtleitung verantworten', 'Stakeholder-Freigaben und Kampagnengenehmigungen steuern', 'Sensible Botschaften und Krisenkommunikation gestalten', 'Agentur- und Partnerbeziehungen managen', 'Zielgruppen-Insights interpretieren und strategische Schlüsse ziehen'],
  },
  operations: {
    ai:    ['Workflow- und SOP-Dokumentationsentwürfe aus Beschreibungen erstellen', 'Statusberichte und KPI-Dashboards automatisch generieren', 'Lieferantenvergleiche und Ausschreibungsanalysen vorbereiten', 'Meeting-Zusammenfassungen und Aktionspunkte extrahieren', 'Kapazitäts- und Ressourcenplanungs-Daten aggregieren'],
    human: ['Lieferanten- und Partnerverhandlungen führen und Beziehungen pflegen', 'Operative Krisenreaktion und Eskalationsentscheidungen treffen', 'Strategische Kapazitäts- und Priorisierungsentscheidungen verantworten', 'Change Management und interne Kommunikation steuern', 'Prozessausnahmen und komplexe Grenzfälle behandeln'],
  },
  recruiter: {
    ai:    ['Stellenausschreibungen entwerfen und für Jobbörsen optimieren', 'Kandidaten auf Plattformen identifizieren und erste Zusammenfassungen erstellen', 'Outreach-Sequenzen und Erstkontakt-Nachrichten entwerfen', 'Interviewfragen nach Kompetenzen generieren', 'Pipeline-Statusberichte und Kandidaten-Übersichten erstellen'],
    human: ['Finale Einstellungsempfehlungen und Angebotsentscheidungen treffen', 'Senior-Verhandlungen und Gehaltsgespräche führen', 'Sensible Absagegespräche und Kandidatenfeedback geben', 'Stakeholder-Abstimmung zu Einstellungskriterien und Anforderungen', 'Langfristige Kandidatenbeziehungen und Talent-Pipeline aufbauen'],
  },
  education: {
    ai:    ['Unterrichtsmaterialien, Arbeitsblätter und Aufgaben schnell entwerfen', 'Differenzierte Fördermaterialien für verschiedene Leistungsniveaus erstellen', 'Standardisierte Eltern-Mitteilungen und Schulinformationen formulieren', 'Unterrichtsideen und Lernziele auf Basis des Lehrplans vorschlagen', 'Administrative Formulare, Berichte und Terminpläne vorbereiten'],
    human: ['Individuelle Schülerbeobachtung und pädagogische Beurteilung durchführen', 'Elterngespräche und sensible Beratungssituationen führen', 'Noten, Bewertungen und Leistungseinschätzungen verantworten', 'Klassenklima und soziale Dynamiken gestalten und begleiten', 'Pädagogische Kernentscheidungen zur Lernentwicklung treffen'],
  },
  healthcare: {
    ai:    ['Pflegedokumentation und Berichte strukturiert vorbereiten', 'Terminvergabe, Erinnerungen und Patientenadministration automatisieren', 'Medikamenten-Wechselwirkungen prüfen und Hinweise ausgeben', 'Patientenaufklärungsbögen und Informationsmaterialien entwerfen', 'Standardisierte FAQ und Patientenanfragen automatisch beantworten'],
    human: ['Diagnosen und klinische Entscheidungen verantworten', 'Direkte Patientenversorgung und Pflegemaßnahmen durchführen', 'Empathische Patientenaufklärung und Vertrauensgespräche führen', 'Interdisziplinäre Fallbesprechungen und Behandlungspläne abstimmen', 'Ethische Entscheidungen und kritische Einschätzungen treffen'],
  },
  legal: {
    ai:    ['Vertragsklauseln prüfen und Standardvertrags-Entwürfe erstellen', 'Rechtsprechungsrecherche und Fallanalysen vorbereiten', 'Mandantenkorrespondenz und Standardkommunikation entwerfen', 'Fristenverwaltung und Wiedervorlagen automatisch tracken', 'Schriftsatz-Gliederungen und erste Entwürfe vorbereiten'],
    human: ['Rechtliche Beurteilungen und Haftungsfragen verantworten', 'Mandantenberatung und strategische Rechtsempfehlungen geben', 'Verhandlungen, Anhörungen und Gerichtsauftritte führen', 'Mandatsbeziehungen aufbauen und langfristig pflegen', 'Berufsrechtliche Sorgfaltspflicht und Verschwiegenheit wahren'],
  },
  engineering: {
    ai:    ['Code-Entwürfe, Funktionen und Unit-Tests generieren', 'Bugs und Fehlerquellen analysieren und Lösungsvorschläge liefern', 'Technische Dokumentation aus bestehendem Code generieren', 'Boilerplate-Code und repetitive Implementierungen übernehmen', 'Code-Qualität prüfen und Refactoring-Vorschläge machen'],
    human: ['Architektur- und Systemdesign-Entscheidungen verantworten', 'Code-Reviews durchführen und Qualitätsstandards setzen', 'Technische Strategie und Technologieauswahl festlegen', 'Sicherheits- und Datenschutzanforderungen beurteilen', 'Stakeholder-Anforderungen aufnehmen und technisch umsetzen'],
  },
  logistics: {
    ai:    ['Touren und Routen automatisch optimieren', 'Lagerbestände prognostizieren und Nachbestellungen auslösen', 'Sendungsstatus und Lieferzeitprognosen in Echtzeit aktualisieren', 'Lieferantenvergleiche und Ausschreibungsunterlagen vorbereiten', 'Operative Berichte und KPI-Dashboards automatisch erstellen'],
    human: ['Lieferantenverhandlungen und strategische Einkaufsentscheidungen führen', 'Störungen, Ausnahmen und Krisenlagen lösen', 'Kundenbeziehungen und Reklamationen persönlich bearbeiten', 'Strategische Netzwerk- und Standortentscheidungen treffen', 'Team führen, schulen und Qualitätsstandards sicherstellen'],
  },
  sales: {
    ai:    ['Lead-Recherche und erste Qualifizierung automatisieren', 'CRM-Notizen, Follow-up-E-Mails und Pipeline-Updates generieren', 'Angebotsentwürfe und Produktpräsentationen vorbereiten', 'Pipeline-Prognosen und Abschlusswahrscheinlichkeiten berechnen', 'Outreach-Sequenzen und personalisierte Erstnachrichten entwerfen'],
    human: ['Kundengespräche, Verhandlungen und Abschlüsse persönlich führen', 'Langfristige Kundenbeziehungen und Account-Management betreuen', 'Strategische Einschätzungen zu Markt und Wettbewerb treffen', 'Komplexe Vertragsverhandlungen und Sonderkonditionen aushandeln', 'Interne Stakeholder für Deals und Ressourcen überzeugen'],
  },
  default: {
    ai:    ['Strukturierte Dateneingabe und -validierung übernehmen', 'Routine-Berichte und Zusammenfassungen generieren', 'Vorlagenbasierte Dokumentenentwürfe erstellen', 'Terminplanung und Koordinationsaufgaben automatisieren', 'Informationsrecherche und -synthese durchführen'],
    human: ['Urteilsentscheidungen und kontextuelles Denken verantworten', 'Stakeholder- und Beziehungsmanagement führen', 'Compliance- und Ethikentscheidungen treffen', 'Strategische Planung und funktionsübergreifende Koordination übernehmen', 'Verantwortung für Ergebnisse und Qualität tragen'],
  },
};

// --- ROLLENSPEZIFISCHE UMSETZUNGSPHASEN -------------------------------------

const CATEGORY_PHASES = {
  support: {
    p1: ['Top-3 häufigste Anfragekategorien identifizieren und KI-Antworten pilotieren', 'Qualitätskriterien für automatische Antworten festlegen (was ist akzeptabel, was geht in Review)', 'Team in Nutzung von KI-Schreibhilfe für Antwortvorlagen einführen'],
    p2: ['KI-Abdeckung auf weitere Ticketkategorien ausweiten basierend auf Pilotqualität', 'Eskalations-Routing automatisieren: KI erkennt, wann Mensch übernehmen muss', 'Wissendatenbank mit KI-Unterstützung systematisch aufbauen und aktualisieren'],
    p3: ['Stimmungsanalyse in Echtzeit für alle Kanäle einführen', 'KI-gestützte Schichtplanung und Workload-Prognose implementieren', 'Support-KPIs auf neue Arbeitsweise anpassen: Lösungsrate, Eskalationsrate, Teamzufriedenheit'],
  },
  finance: {
    p1: ['Standardisierte Finanzberichte als ersten Automatisierungsbereich pilotieren', 'Rechnungsverarbeitung und Kontenabgleich mit KI-Tool testen', 'Freigabe-Workflow für KI-generierte Reports definieren — wer prüft was'],
    p2: ['Varianzanalyse und Prognose-Modellierung mit KI-Tool ausweiten', 'Compliance-Prüfprozesse für KI-generierte Dokumente formal festhalten', 'Integration in ERP-System prüfen und Datenschnittstellen einrichten'],
    p3: ['Echtzeit-KPI-Dashboards vollständig automatisiert betreiben', 'KI-Prognosemodelle für Budget- und Planungszyklen einsetzen', 'Finanzabteilung auf höherwertige Analyse- und Beratungsleistungen fokussieren'],
  },
  hr: {
    p1: ['HR-FAQ-Chatbot für häufigste Mitarbeiteranfragen einrichten', 'Stellenbeschreibungsentwürfe mit KI pilotieren — HR prüft und gibt frei', 'Onboarding-Dokumentation automatisieren (Begrüßung, Checklisten, Erstinformationen)'],
    p2: ['Bewerbungsscreening-Prozess mit KI-Zusammenfassungen unterstützen', 'Leistungsbeurteilungs-Vorlagen und Beurteilungszyklen mit KI strukturieren', 'Datenschutzkonformer Umgang mit Personaldaten in KI-Tools sicherstellen'],
    p3: ['Personalentwicklungs-Empfehlungen auf Basis von Kompetenzdaten automatisieren', 'HR-Analytics für Fluktuation, Engagement und Entwicklungsbedarfe einführen', 'HR-Rolle neu ausrichten: weniger Administration, mehr strategische Personalarbeit'],
  },
  marketing: {
    p1: ['KI-Texterstellung für einen Content-Typ pilotieren (z.B. Social-Media-Posts)', 'Redaktionellen Freigabeprozess für KI-Inhalte festlegen', 'Performance-Reporting automatisieren — wöchentliche Berichte ohne manuelle Aufbereitung'],
    p2: ['KI-Texterstellung auf weitere Formate ausweiten: Newsletter, Anzeigen, Blogartikel', 'SEO-Recherche und Content-Briefing mit KI-Tool systematisieren', 'A/B-Tests für KI-generierte vs. manuell erstellte Texte aufsetzen'],
    p3: ['Content-Produktion vollständig KI-unterstützt skalieren', 'Personalisierung auf Basis von Kundendaten mit KI automatisieren', 'Marketing-Team auf strategische Kreativarbeit und Kampagnenleitung fokussieren'],
  },
  operations: {
    p1: ['Statusberichte und Meeting-Protokolle als ersten KI-Anwendungsfall einführen', 'SOP-Dokumentation für 2–3 Kernprozesse mit KI-Unterstützung aufbauen', 'Kapazitätsdaten automatisch aggregieren — manuelle Datenpflege reduzieren'],
    p2: ['Workflow-Automatisierung für Genehmigungsprozesse und Statusupdates einrichten', 'KI-Tool in bestehende Projektmanagement-Software integrieren', 'Prozessausnahmen und Eskalationsmuster mit KI früher erkennen'],
    p3: ['Vollständiges KPI-Dashboard ohne manuelle Eingaben betreiben', 'Lieferantenbewertungen und Ausschreibungen mit KI-Analyse unterstützen', 'Operations-Rolle auf strategische Prozessgestaltung ausrichten'],
  },
  recruiter: {
    p1: ['KI für Stellenausschreibungsentwürfe einsetzen — Recruiter gibt frei', 'Sourcing-Tool für eine offene Stelle pilotieren', 'Interview-Transkription für strukturierte Gesprächsnotizen einführen'],
    p2: ['KI-Sourcing auf alle aktiven Stellen ausweiten', 'Kandidaten-Outreach-Sequenzen mit KI automatisieren', 'Bias-Prüfung für KI-Screening-Empfehlungen einrichten — regelmäßige Qualitätskontrolle'],
    p3: ['Pipeline-Analytik und Forecasting für Personalplanung nutzen', 'Recruiting-Kennzahlen neu definieren: Time-to-Hire, Source Quality, Candidate Experience', 'Recruiter-Fokus auf Beziehungsaufbau, Verhandlungen und strategische Personalplanung'],
  },
  education: {
    p1: ['KI für Materialerstellung einer Unterrichtseinheit testen — keine Schülerdaten verwenden', 'Kollegen über datenschutzkonformen KI-Einsatz informieren (DSGVO-Grenzen)', 'Administrative Aufgaben (Formulare, Terminpläne) mit KI vereinfachen'],
    p2: ['KI-Materialerstellung systematisch in die Unterrichtsvorbereitung integrieren', 'Differenzierte Materialien für verschiedene Leistungsniveaus mit KI erstellen', 'KI-generierte Lernmaterialien auf pädagogische Qualität prüfen und verfeinern'],
    p3: ['KI-Nutzung als feste Ressource in der Schulentwicklung verankern', 'Fortbildungsangebote zu KI für das gesamte Kollegium aufbauen', 'Unterrichtszeit durch reduzierten Verwaltungsaufwand für Schülerinteraktion nutzen'],
  },
  healthcare: {
    p1: ['KI-gestützte Dokumentationsunterstützung für einen Bereich pilotieren (z.B. Berichte)', 'Zertifizierte, DSGVO-konforme KI-Tools evaluieren — keine öffentlichen Tools mit Patientendaten', 'Terminverwaltung und Standardanfragen automatisieren'],
    p2: ['KI-Dokumentation auf weitere Bereiche ausweiten — Zeitersparnis messen', 'Patientenaufklärungsmaterialien und FAQ mit KI-Unterstützung aktuell halten', 'Qualitätssicherungsprozess für KI-unterstützte Dokumentation einrichten'],
    p3: ['Klinische Entscheidungsunterstützung (nur zertifizierte Systeme) evaluieren', 'Verwaltungszeit nachhaltig reduzieren — gewonnene Zeit für Patientenversorgung nutzen', 'Team regelmäßig zu KI-Risiken und -Grenzen im klinischen Kontext schulen'],
  },
  legal: {
    p1: ['KI für Standardvertragsrecherche und erste Entwürfe testen', 'Fristenverwaltung und Wiedervorlagen automatisieren', 'Mandantenkommunikation für Standardthemen mit KI-Entwürfen beschleunigen'],
    p2: ['Legal Research Tool für alle relevanten Rechtsbereiche einführen', 'Vertragsprüfungs-Workflow mit KI-Unterstützung systematisieren', 'Qualitätssicherungsprozess: Jurist prüft jeden KI-Entwurf vor Versand oder Unterzeichnung'],
    p3: ['Kanzlei-Wissensmanagement mit KI strukturieren und durchsuchbar machen', 'Abrechnung und Zeiterfassung vollständig automatisieren', 'Juristenkapazität auf komplexe Mandate und strategische Beratung ausrichten'],
  },
  engineering: {
    p1: ['GitHub Copilot oder vergleichbaren KI-Assistenten für das Team einführen', 'Code-Review-Prozess für KI-generierten Code festlegen — Sicherheitscheck einbauen', 'KI für Dokumentationserstellung bei einem Modul oder Projekt pilotieren'],
    p2: ['KI-Codegenerierung für alle Routineentwicklungsaufgaben nutzen', 'Automatisierte Tests mit KI-Unterstützung erweitern — Testabdeckung erhöhen', 'IP-Schutzrichtlinie für KI-Tool-Nutzung mit Unternehmens-Code festlegen'],
    p3: ['Entwicklungsprozess vollständig auf KI-unterstütztes Arbeiten umstellen', 'KI für Architekturvorschläge und technische Konzepte einsetzen (mit menschlicher Entscheidung)', 'Entwicklerkapazität auf komplexe Problemlösung und Architekturarbeit fokussieren'],
  },
  logistics: {
    p1: ['Tourenoptimierungs-Tool für einen Bereich oder Standort pilotieren', 'Bestandsprognosen für die umsatzstärksten Artikel automatisieren', 'Sendungsverfolgung und Lieferstatus-Updates für Kunden automatisieren'],
    p2: ['Tourenoptimierung auf alle Bereiche ausweiten — Kosteneinsparung messen', 'Lagerbestandsverwaltung vollständig KI-gestützt betreiben', 'Lieferantenperformance-Berichte automatisch erstellen und auswerten'],
    p3: ['Predictive-Demand-Planung in ERP-System integrieren', 'Qualitätsprüfung mit KI-Bildanalyse unterstützen', 'Logistik-KPIs neu definieren: Liefertreue, Kosten pro Sendung, Bestandsreichweite'],
  },
  sales: {
    p1: ['CRM-Datenpflege automatisieren — Gesprächsnotizen und Follow-ups KI-generiert', 'Outreach-Sequenzen für Neukunden mit KI pilotieren', 'Pipeline-Prognose-Tool einführen und mit manuellem Forecast vergleichen'],
    p2: ['Lead-Qualifizierung vollständig KI-gestützt — Vertriebler fokussiert auf qualifizierte Leads', 'Angebotserstellung mit KI-Vorlagen beschleunigen', 'Conversation Intelligence (z.B. Gong) für Gesprächsanalyse einführen'],
    p3: ['Vertriebssteuerung datenbasiert: KI-Prognosen als Grundlage für Quotenplanung nutzen', 'Personalisierung im Outreach skalieren — jede Nachricht individuell, kein Mehraufwand', 'Vertriebsteam auf Beratung und Beziehungspflege ausrichten, Routine ist KI-Aufgabe'],
  },
};

// --- ROLLENSPEZIFISCHE RISIKEN & LEITPLANKEN ---------------------------------

const CATEGORY_RISKS = {
  support: [
    'Kunden erkennen KI-generierte Antworten — bei sensiblen Themen und Beschwerden immer menschlichen Agenten einsetzen, nie vollständig automatisieren.',
    'Qualitätsverlust bei zu hoher Automatisierungsrate: Regelmäßige Stichproben-Reviews von KI-Antworten einrichten, Qualitätsschwelle definieren.',
    'Datenschutz: Kundendaten und Gesprächsinhalte dürfen nicht ungefiltert in öffentliche KI-Tools eingegeben werden — DSGVO-konforme Lösung wählen.',
    'Team-Akzeptanz: KI darf nicht als Job-Bedrohung wahrgenommen werden — Kommunikation auf Entlastung fokussieren, nicht auf Ersatz.',
  ],
  finance: [
    'KI-generierte Finanzberichte können Fehler enthalten: Klare Freigabe-Checkliste für jeden Report vor Weitergabe an Stakeholder einführen.',
    'Compliance-Risiko: Regulatorisch relevante Dokumente müssen immer durch qualifizierte Fachkraft geprüft und abgezeichnet werden.',
    'Datensicherheit: Finanz- und Buchhaltungsdaten sind besonders schützenswert — nur geprüfte, DSGVO-konforme Tools mit Datenverschlüsselung einsetzen.',
    'Modell-Halluzinationen: KI kann plausibel klingende, aber falsche Zahlen produzieren — Vier-Augen-Prinzip für alle KI-generierten Zahlen ist Pflicht.',
  ],
  hr: [
    'Datenschutz: Personaldaten und Mitarbeiterinformationen dürfen nicht in öffentliche KI-Modelle eingegeben werden — nur DSGVO-konforme HR-Systeme nutzen.',
    'Bias im Recruiting: KI-Screening-Empfehlungen können systematische Vorurteile verstärken — regelmäßige Fairness-Prüfung und menschliche Kontrolle ist Pflicht.',
    'Sensible HR-Situationen niemals automatisieren: Trennungsgespräche, Disziplinarmaßnahmen und Ermittlungen erfordern immer persönliche Führung.',
    'Mitarbeitervertrauen: KI im HR-Bereich kann als Überwachung wahrgenommen werden — transparente Kommunikation über Einsatzbereich und Grenzen ist essenziell.',
  ],
  marketing: [
    'Markenstimme und Qualität: KI-Texte können generisch oder fehlerhaft sein — jeder Inhalt erfordert redaktionelle Prüfung vor Veröffentlichung.',
    'Urheberrecht: KI-generierte Bilder und Texte können urheberrechtlich problematisch sein — rechtliche Lage für den jeweiligen Use Case klären.',
    'Überproduktion: KI ermöglicht mehr Content, nicht unbedingt besseren — strategische Priorisierung wichtiger als schiere Volumensteigerung.',
    'Datenschutz bei Personalisierung: Kundendaten für KI-Personalisierung müssen DSGVO-konform verarbeitet werden — keine ungefilterte Weitergabe an externe KI-Dienste.',
  ],
  operations: [
    'Automatisierung auf undokumentierten Prozessen scheitert: Erst Prozesse klar dokumentieren, dann automatisieren — Reihenfolge ist entscheidend.',
    'Systemabhängigkeit: Wenn KI-Tools ausfallen, müssen manuelle Fallback-Prozesse bekannt und einsatzbereit sein.',
    'Schnittstellen-Risiko: KI-Tools müssen zuverlässig mit bestehenden ERP- und Workflow-Systemen integriert werden — technische Abhängigkeiten prüfen.',
    'Change-Resistenz im Team: Operations-Mitarbeiter brauchen frühe Einbindung und klare Kommunikation über den Mehrwert — sonst sinkt Akzeptanz und Nutzungsqualität.',
  ],
  recruiter: [
    'Diskriminierungsrisiko: KI-Screening kann strukturelle Bias aus historischen Daten reproduzieren — alle Empfehlungen auf Fairness überprüfen.',
    'Kandidatenerlebnis: Zu viel KI-Automatisierung im Recruiting wirkt unpersönlich — kritische Touchpoints (Absagen, Angebote) immer persönlich gestalten.',
    'Datenschutz: Bewerberdaten sind besonders sensibel — nur DSGVO-konforme ATS-Systeme mit klarer Datenlösch-Policy einsetzen.',
    'Fehleinstellungen durch Übervertrauen in KI: KI-Scores sind Hinweise, keine Entscheidungen — finale Einstellung immer menschlich verantworten.',
  ],
  education: [
    'Datenschutz ist nicht verhandelbar: Schüler- und Elterndaten dürfen niemals in öffentliche KI-Tools eingegeben werden — DSGVO und Schulrecht sind bindend.',
    'Pädagogische Qualität: KI-Materialien müssen auf Altersgemäßheit, Lehrplantreue und pädagogische Eignung geprüft werden — nicht blind übernehmen.',
    'Vorbildfunktion: Lehrkräfte müssen kritischen KI-Umgang vorleben und Schüler für KI-Fehler und -Grenzen sensibilisieren.',
    'Abhängigkeitsgefahr: Wenn KI-Tools die Vorbereitung übernehmen, können pädagogische Kernkompetenzen verkümmern — bewusste Balance halten.',
  ],
  healthcare: [
    'Patientensicherheit hat absoluten Vorrang: Jede klinische KI-Empfehlung muss durch qualifiziertes Fachpersonal validiert werden — kein Automatismus bei medizinischen Entscheidungen.',
    'Schweigepflicht und DSGVO: Patientendaten unterliegen strengstem Datenschutz — ausschließlich zertifizierte, gehostete Medizin-KI-Systeme einsetzen.',
    'Haftungsklarheit: KI-unterstützte Dokumentation und Entscheidungshilfen entbinden nicht von ärztlicher oder pflegerischer Haftung — Verantwortung bleibt beim Fachpersonal.',
    'Fehlerkaskaden: Ein KI-Fehler in der Medikationsempfehlung oder Dokumentation kann schwere Folgen haben — Vier-Augen-Prinzip bei klinisch relevanten Outputs.',
  ],
  legal: [
    'Anwaltliche Sorgfaltspflicht: KI-generierte Entwürfe entbinden nicht von der juristischen Prüfungspflicht — jedes Dokument muss vor Versand oder Unterzeichnung von einem Juristen geprüft werden.',
    'Verschwiegenheitspflicht: Mandantendaten und Fallinformationen dürfen nicht in öffentliche KI-Dienste eingegeben werden — nur geschlossene, datenschutzkonforme Legal-Tech-Systeme.',
    'Halluzinations-Risiko: KI kann Urteile und Gesetzestexte erfinden, die nicht existieren — alle Rechtsquellen aus KI-Outputs müssen in Originaldatenbanken verifiziert werden.',
    'Haftungsrisiko: KI-Fehler in rechtlichen Dokumenten können erhebliche Schäden verursachen — Fehlerverantwortung liegt immer beim Juristen, nie bei der KI.',
  ],
  engineering: [
    'Sicherheitslücken: KI-generierter Code kann Schwachstellen enthalten — Security-Review ist Pflicht, besonders für sicherheitskritische Funktionen.',
    'IP-Schutz: Unternehmenseigener Code sollte nicht in öffentliche KI-Modelle eingegeben werden — Nutzungsbedingungen der Tools prüfen, interne Richtlinien festlegen.',
    'Übervertrauen in KI-Code: KI-Vorschläge sind Startpunkte, kein fertiger Code — kritisches Code-Review bleibt unverzichtbar, nicht optional.',
    'Technische Schulden: KI kann schnell viel Code produzieren, der schwer wartbar ist — Code-Qualitätsstandards auch für KI-generierten Code durchsetzen.',
  ],
  logistics: [
    'System-Ausfallszenario: Wenn KI-Optimierungssysteme ausfallen, müssen manuelle Prozesse bekannt und einsatzbereit sein — Contingency-Plan ist Pflicht.',
    'Datenpflege: KI-Optimierung ist nur so gut wie die Eingangsdaten — schlechte Stammdaten (Adressen, Gewichte, Zeiten) führen zu schlechten Ergebnissen.',
    'Integration: KI-Tools müssen zuverlässig mit ERP, WMS und Carrier-Systemen kommunizieren — technische Integration frühzeitig und gründlich testen.',
    'Mitarbeiterqualifikation: Lageristen und Disponenten müssen verstehen, wie KI-Empfehlungen entstehen, um Fehler erkennen zu können — Schulung nicht überspringen.',
  ],
  sales: [
    'Kundendatenschutz: Kundendaten, Gesprächsinhalte und Angebotsinformationen sind vertraulich — nur DSGVO-konforme CRM- und Analyse-Tools einsetzen.',
    'Authentizitätsverlust: Zu automatisierter Outreach wirkt unpersönlich und schadet der Marke — KI-Texte immer personalisieren und prüfen vor dem Versand.',
    'Überabhängigkeit von KI-Scores: Lead-Scoring ist eine Orientierung, kein Urteil — Vertriebsmitarbeiter müssen eigenes Urteil behalten und einsetzen.',
    'Fehlprognosen: KI-Pipeline-Forecasts können die Vertriebsplanung verzerren, wenn Eingangsdaten schlecht gepflegt sind — CRM-Datenqualität hat direkte Auswirkung auf Forecast-Genauigkeit.',
  ],
};

// --- STRUCTURED RESULT BUILDER -----------------------------------------------

function computeStructuredResult(d) {
  const base    = computeResult(d);
  const cat     = detectRoleCategory(d.roleTitle || '');
  const role    = d.roleTitle || 'Diese Stelle';
  const catData = CATEGORY_DATA[cat];
  const F       = base._flags || {};

  const MODEL_NAMES = {
    'Foundation-first':                    { name: 'Erst die Grundlage legen',              headline: 'Prozesse dokumentieren bevor KI sinnvoll eingeführt werden kann' },
    'Human-led with targeted AI support':  { name: 'Menschlich geführt, KI-unterstützt',    headline: 'Menschen entscheiden — KI bereitet vor und entlastet' },
    'AI-assisted with mandatory review':   { name: 'KI-unterstützt mit Pflichtprüfung',     headline: 'KI beschleunigt — jeder Output wird menschlich freigegeben' },
    'Repetitive workflow automation':      { name: 'Workflow-Automatisierung',               headline: 'Repetitive Aufgaben automatisieren, Menschen für Wertarbeit freisetzen' },
    'AI first-draft, human review':        { name: 'KI-Entwurf, menschliche Prüfung',       headline: 'KI liefert Rohstoff — Menschen verfeinern und verantworten' },
    'AI co-pilot workflow':                { name: 'KI-Copilot Workflow',                    headline: 'Mensch und KI arbeiten gleichberechtigt zusammen' },
    'Selective AI augmentation':           { name: 'Selektive KI-Augmentierung',             headline: 'Gezielte KI-Unterstützung bei klar definierten Teilaufgaben' },
    'Human-led with selective AI support': { name: 'Menschlich geleitet, selektiver KI-Einsatz', headline: 'Menschliches Urteil im Zentrum — KI als Effizienzwerkzeug' },
  };

  const model        = MODEL_NAMES[base.maturity] || { name: base.maturity, headline: 'Analysiertes Kollaborationsmodell' };
  const rawTools     = catData ? catData.tools : DEFAULT_TOOLS;
  const mgrSummary   = catData ? catData.managerSummary(F) : [
    `${role} hat realistisches KI-Augmentierungspotenzial in strukturierten Teilaufgaben`,
    'Urteilsintensive und beziehungsbasierte Aufgaben bleiben menschlich geführt',
    base.readinessScore < 50 ? 'Schrittweiser Ansatz empfohlen — mit risikoarmen Pilots starten' : 'Strukturierter Rollout möglich — Team ist ausreichend vorbereitet',
    'Empfohlener Einstieg: Risikoarme, hochvolumige Aufgabe als Pilot wählen',
    'Change Management: Team früh einbeziehen und Quick Wins sichtbar machen',
  ];

  return {
    roleTitle:                  role,
    collaborationModelName:     model.name,
    collaborationModelHeadline: model.headline,
    collaborationModelSummary:  base.expertSummary,
    workDistribution: {
      automatable:    base.autoP,
      aiAssisted:     base.aiP,
      humanLed:       base.humanP,
      reviewRequired: base.reviewP,
    },
    taskSplit:             catData ? catData.taskSplit : DEFAULT_TASK_SPLIT,
    aiResponsibilities:    (CATEGORY_TASKS[cat] || CATEGORY_TASKS.default).ai,
    humanResponsibilities: (CATEGORY_TASKS[cat] || CATEGORY_TASKS.default).human,
    implementationPlan: {
      next30Days: (CATEGORY_PHASES[cat] || base.phases).p1,
      next90Days: (CATEGORY_PHASES[cat] || base.phases).p2,
      later:      (CATEGORY_PHASES[cat] || base.phases).p3,
    },
    recommendedTools:    rawTools.map(t => ({ name: t.name, category: t.category, reason: t.reason || t.use || '', fitForRole: t.fitForRole || '' })),
    risksAndSafeguards:  CATEGORY_RISKS[cat] || base.risks,
    managerSummary:      mgrSummary,
    readinessScore:      base.readinessScore,
    readinessDescription: base.readinessDesc,
  };
}

// =============================================================================
// RENDER
// =============================================================================

// Maturity label translations for display
const MATURITY_LABELS = {
  'Foundation-first':                      'Erst die Grundlage legen',
  'Human-led with targeted AI support':    'Menschlich geleitet, gezielter KI-Einsatz',
  'AI-assisted with mandatory review':     'KI-unterstützt, Pflichtprüfung',
  'Repetitive workflow automation':        'Automatisierung repetitiver Workflows',
  'AI first-draft, human review':          'KI-Entwurf, menschliche Prüfung',
  'AI co-pilot workflow':                  'KI-Copilot Workflow',
  'Selective AI augmentation':             'Selektive KI-Augmentierung',
  'Human-led with selective AI support':   'Menschlich geleitet, selektiver KI-Einsatz'
};

function maturityLabel(maturity) {
  return MATURITY_LABELS[maturity] || maturity;
}

function renderResult(r) {
  const res = document.getElementById('step-result');
  const role = esc(state.data.roleTitle || 'Stelle');

  res.innerHTML = `
<div class="result-wrap">

  ${r._localFallback ? `<div class="result-fallback-notice">Strukturierte lokale Analyse — KI-Modell vorübergehend nicht verfügbar</div>` : ''}

  <div class="result-hero">
    <div class="result-model-badge">${esc(maturityLabel(r.maturity))}</div>
    <h2 class="result-headline">${roleHeadline(r.maturity)}</h2>
    <p class="result-expert-summary">${esc(r.expertSummary)}</p>
    ${r.goalNote ? `<p class="result-expert-summary" style="margin-top:12px;color:var(--text-2);font-weight:500">${esc(r.goalNote)}</p>` : ''}
  </div>

  <div class="result-split-card">
    <div class="result-section-label">Arbeitsaufteilung — ${esc(role)}</div>
    <div class="result-bars">
      ${resultBar('Automatisierbar', r.autoP,  'auto')}
      ${resultBar('KI-unterstützt',  r.aiP,    'ai')}
      ${resultBar('Menschlich geleitet', r.humanP, 'human')}
      ${resultBar('Prüfung erforderlich', r.reviewP,'review')}
    </div>
  </div>

  <div class="result-why">
    <button class="result-why-toggle" aria-expanded="false">
      <span>Warum dieses Modell empfohlen wurde</span>
      <svg class="result-why-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 6l4 4 4-4"/></svg>
    </button>
    <div class="result-why-body">
      ${r.whyThisModel.split('\n\n').map(p => `<p>${esc(p)}</p>`).join('')}
    </div>
  </div>

  <div class="result-tasks-grid">
    <div class="result-task-col">
      <div class="result-task-col-title col-title-ai">Mit KI starten</div>
      <ul class="result-task-list">${r.tasks.ai.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
    </div>
    <div class="result-task-col">
      <div class="result-task-col-title col-title-human">Menschlich geleitet behalten</div>
      <ul class="result-task-list">${r.tasks.human.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
    </div>
  </div>

  ${r.aiTools && r.aiTools.length ? `
  <div class="result-ai-tools">
    <div class="result-section-label">KI-Tools für ${esc(role)}</div>
    <div class="result-tools-grid">
      ${r.aiTools.map(t => `
      <div class="result-tool-card">
        <div class="tool-card-top">
          <span class="tool-name">${esc(t.name)}</span>
          <span class="tool-category">${esc(t.category)}</span>
        </div>
        <p class="tool-use">${esc(t.use)}</p>
      </div>`).join('')}
    </div>
  </div>` : ''}

  <div class="result-readiness">
    <div class="readiness-score-block">
      <div class="readiness-number" id="readinessNum">0</div>
      <div class="readiness-label">Bereitschaft</div>
    </div>
    <div class="readiness-right">
      <div class="result-section-label" style="margin-bottom:10px">Implementierungsbereitschaft</div>
      <div class="readiness-track-wrap">
        <div class="readiness-track">
          <div class="readiness-fill ${r.readinessClass}" id="readinessFill" style="width:0"></div>
        </div>
      </div>
      <p class="readiness-desc">${esc(r.readinessDesc)}</p>
    </div>
  </div>

  <div class="result-phases">
    <div class="result-section-label">Implementierungsphasen</div>
    <div class="result-phase-grid">
      <div class="result-phase">
        <div class="rp-label">Diese Woche</div>
        <div class="rp-items">${r.phases.p1.map(a => `<div class="rp-item">${esc(a)}</div>`).join('')}</div>
      </div>
      <div class="result-phase">
        <div class="rp-label rp-label-2">30 Tage</div>
        <div class="rp-items">${r.phases.p2.map(a => `<div class="rp-item">${esc(a)}</div>`).join('')}</div>
      </div>
      <div class="result-phase">
        <div class="rp-label rp-label-3">90 Tage</div>
        <div class="rp-items">${r.phases.p3.map(a => `<div class="rp-item">${esc(a)}</div>`).join('')}</div>
      </div>
    </div>
  </div>

  ${r.risks.length ? `
  <div class="result-risks">
    <div class="result-section-label">Risiken &amp; Leitplanken</div>
    <div class="result-risk-list">
      ${r.risks.map(risk => `
      <div class="result-risk-item">
        <div class="risk-icon"></div>
        <p>${esc(risk)}</p>
      </div>`).join('')}
    </div>
  </div>` : ''}

  <div class="result-footer">
    <p class="result-disclaimer">Diese Analyse wird von einem strukturierten Entscheidungsmodell erstellt und ist als Ausgangspunkt für eine fundierte Teamdiskussion gedacht — keine Direktive. Menschliches Urteilsvermögen, organisatorischer Kontext und direkter Input der Menschen, die die Arbeit machen, sollten stets leiten, wie Stellen neu gestaltet werden.</p>
    <div class="result-actions">
      <button class="btn btn-ghost" id="restartBtn">Weitere Stelle analysieren</button>
      <a href="index.html" class="btn btn-primary">Zurück zu RoleShift</a>
    </div>
  </div>

</div>`;

  // Animate bars
  setTimeout(() => {
    document.querySelectorAll('[data-target]').forEach(el => { el.style.width = el.dataset.target + '%'; });
    // Readiness gauge
    const fill = document.getElementById('readinessFill');
    const num  = document.getElementById('readinessNum');
    if (fill) fill.style.width = r.readinessScore + '%';
    if (num)  animateCount(num, r.readinessScore, '%');
  }, 120);

  // Why toggle
  document.querySelector('.result-why-toggle')?.addEventListener('click', function() {
    const expanded = this.getAttribute('aria-expanded') === 'true';
    this.setAttribute('aria-expanded', String(!expanded));
    this.nextElementSibling?.classList.toggle('open', !expanded);
  });

  // Restart
  document.getElementById('restartBtn')?.addEventListener('click', restart);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resultBar(label, pct, type) {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  return `
  <div class="result-bar-row">
    <div class="result-bar-meta">
      <span class="result-bar-label">${esc(label)}</span>
      <span class="result-bar-pct pct-${type}">${p}%</span>
    </div>
    <div class="result-track">
      <div class="result-fill fill-${type}" data-target="${p}" style="width:0"></div>
    </div>
  </div>`;
}

function roleHeadline(maturity) {
  const headlines = {
    'Foundation-first':                      'Zuerst die Grundlage legen, dann KI einführen.',
    'Human-led with targeted AI support':    'Menschliches Urteil führt. KI reduziert die Last.',
    'AI-assisted with mandatory review':     'KI generiert. Menschen verantworten das Ergebnis.',
    'Repetitive workflow automation':        'Die Struktur ist stark. Automatisieren mit Zuversicht.',
    'AI first-draft, human review':          'KI entwirft. Menschen prüfen und entscheiden.',
    'AI co-pilot workflow':                  'KI und Mensch arbeiten parallel.',
    'Selective AI augmentation':             'Gezielter KI-Einsatz in definierten Bereichen.',
    'Human-led with selective AI support':   'Menschen zuerst. KI wo sie klar hilft.'
  };
  return headlines[maturity] || 'Ein strukturierter Weg zur KI-Augmentierung.';
}

// --- RESTART -----------------------------
function restart() {
  Object.assign(state.data, {
    roleTitle:'', roleTasks:'',
    repetitive:0, standardized:0, judgment:0, customerFacing:0,
    costOfMistakes:0, sensitivity:0, accountability:0, reviewNeeded:0,
    documentation:0, dataStructure:0, aiReadiness:0, toolsAdopted:0, goal:''
  });
  state.current = 1;

  document.getElementById('roleTitle').value  = '';
  document.getElementById('roleTasks').value  = '';
  document.querySelectorAll('.sq-opt.selected, .calc-chip.active, .calc-goal-card.selected')
    .forEach(el => el.classList.remove('selected', 'active'));
  if (generateBtn) generateBtn.disabled = true;

  const res = document.getElementById('step-result');
  res.classList.add('calc-step-hidden');
  const s1 = document.getElementById('step-1');
  s1.classList.remove('calc-step-hidden');
  s1.style.animation = 'none'; s1.offsetHeight; s1.style.animation = '';
  setProgress(1);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- UTILITIES ---------------------------
function avg(arr) {
  const v = arr.filter(x => x > 0);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 3;
}
function normalize(v)   { return clamp((v - 1) / 4, 0, 1); }
function normalizeRange(v, min, max) { return min + normalize(v) * (max - min); }
function normalize100(arr) {
  const total = arr.reduce((a, b) => a + b, 0);
  if (!total) return arr;
  let result = arr.map(v => Math.round(v / total * 100));
  const diff = 100 - result.reduce((a, b) => a + b, 0);
  result[2] += diff; // adjust human to make 100
  result[2] = Math.max(0, result[2]);
  return result;
}
function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// --- THEME TOGGLE -------------------------
document.getElementById('themeToggle')?.addEventListener('click', () => {
  const html = document.documentElement;
  const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('rs-theme', next);
});
function animateCount(el, target, suffix) {
  const dur = 1200; const start = performance.now();
  function step(now) {
    const p = Math.min((now - start) / dur, 1);
    const ease = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(ease * target) + suffix;
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}
