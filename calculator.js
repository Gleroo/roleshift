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
generateBtn?.addEventListener('click', async () => {
  state.data.roleTitle = document.getElementById('roleTitle')?.value?.trim() || 'Diese Stelle';
  state.data.roleTasks = document.getElementById('roleTasks')?.value?.trim() || '';
  showLoading();

  try {
    const markdown = await fetchGeminiMarkdown(state.data);
    renderMarkdownResult(markdown);
  } catch (err) {
    console.warn('[RoleShift] Gemini nicht erreichbar, lokales Modell wird verwendet:', err.message);
    try {
      const result = computeResult(state.data);
      result._localFallback = true;
      renderResult(result);
    } catch (localErr) {
      console.error('[RoleShift] Lokales Modell Fehler:', localErr);
      showApiError(localErr.message);
    }
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

// System instruction — sets the expert persona and reasoning behavior.
// Kept separate from the data prompt so Gemini treats it as standing guidance.
const SYSTEM_INSTRUCTION = `You are Gemini, acting as a senior expert in human–AI collaboration, workforce design, and organizational change.

Your core rule:
Every answer must be tailored to the SPECIFIC ROLE the user has entered.
You are NEVER allowed to answer with generic HR or office examples that do not clearly fit this role.

BEFORE YOU ANSWER

1. Internal reasoning
Before writing the final answer, think explicitly about:
- In which domain or industry does this role live? (e.g. education, healthcare, logistics, finance…)
- What are typical core tasks for THIS role in THIS domain?
- What constraints exist in this domain? (compliance, data privacy, human contact, etc.)

If the role title is vague, infer the most likely context (e.g. "Teacher" → school education; "Nurse" → clinical care). If you are unsure, pick one plausible context and stick to it consistently.

2. Domain consistency check
For EVERY concrete example, ask yourself:
- "Would a person with this role realistically do this task in their daily work?"
- "Would they realistically use this tool in their environment?"

If the answer is no, change the example or replace the tool.

ROLE-SPECIFIC OUTPUT REQUIREMENTS

Your answer must always be visibly anchored in the given role.
That means:
- The role title appears in the introduction.
- Every section includes examples and language from that profession.
- All described tasks match the domain.
- Recommended AI tools are appropriate for that profession and environment.

ANALYSIS AND PLAN

Analyse the questionnaire deeply and then produce a structured, role-specific plan.

1. Summarize the role in context — 1 short paragraph describing what this job looks like in practice in the given domain.

2. Decide a collaboration model JUST for this role — explain how humans and AI should work together; justify with the scores (e.g. high judgement + high error cost = keep humans in charge, AI as assistant).

3. Create a structured plan with concrete steps for THIS profession:
- "Diese Woche bis 30 Tage": 3–7 specific actions in the daily work of this role.
- "Nächste 90 Tage": 3–7 actions for deeper integration.
- "Langfristig": 3–7 actions for continuous improvement.

Each action must describe what exactly changes in this professional's workflow, what the human does, and what AI does.

TOOLS: ALWAYS ROLE-SPECIFIC

Before recommending tools, search the web for AI tools relevant to this profession and domain.
Then recommend 3–7 concrete tools that fit THIS job. Never recommend tools that obviously don't fit the role.

RESPONSIBLE AND HUMAN-CENTRIC TONE
- Do NOT frame AI as a way to justify layoffs.
- Emphasize that humans stay responsible for critical decisions, relationships, and accountability.
- Separate technical automation potential from organizational reality (skills, culture, regulation).
- Highlight where upskilling or role redesign is needed.

OUTPUT FORMAT AND LANGUAGE
- Write your entire answer in German (professional business German — Geschäftsdeutsch).
- All headings, body text, tables, and examples must be in German.
- Return structured Markdown optimized for a web dashboard.
- Use this exact structure:

# Kollaborationsmodell für <STELLENBEZEICHNUNG>
Kurze, stellenspezifische Zusammenfassung.

## Aufgabenverteilung in dieser Stelle
Kurze Erklärung + Tabelle:
Aufgabenbereich | KI-unterstützt | Automatisierbar | Menschlich geleitet | Menschliche Prüfung

## Was KI in dieser Stelle übernehmen sollte
Aufzählungspunkte mit konkreten Aufgaben in der Sprache dieser Berufsgruppe.

## Was Menschen behalten sollten
Aufzählungspunkte mit Aufgaben, die menschlich geleitet bleiben — mit Fachsprache des Berufsfelds.

## Umsetzungsplan für <STELLENBEZEICHNUNG>
Aufgeteilt in:
### Diese Woche bis 30 Tage
### Nächste 90 Tage
### Langfristig

## Empfohlene KI-Tools für dieses Berufsbild
Liste konkreter Tools, jedes klar an diese Stelle gebunden.

## Risiken und Schutzmaßnahmen in diesem Bereich
Bereichsspezifische Risiken und Gegenmaßnahmen.`;

function buildPrompt(d) {
  const scale = v => v === 1 ? 'sehr niedrig (1/5)' : v === 2 ? 'niedrig (2/5)' : v === 3 ? 'mittel (3/5)' : v === 4 ? 'hoch (4/5)' : 'sehr hoch (5/5)';
  const goalLabels = { time: 'Zeit sparen', admin: 'Verwaltung reduzieren', quality: 'Qualität verbessern', compliance: 'Compliance sicherstellen', speed: 'Durchlaufzeit verkürzen', focus: 'Menschen auf hochwertige Arbeit fokussieren' };
  const selectedGoals = (d.goals || []).map(g => goalLabels[g] || g).join(', ') || 'nicht angegeben';
  const role = d.roleTitle || 'Unbekannte Stelle';
  const tasks = d.roleTasks ? `\nBeschreibung der Tätigkeiten: ${d.roleTasks}` : '';

  return `Analysiere die folgende Rollenbewertung und erstelle eine stellenspezifische Empfehlung.

Stelle: ${role}${tasks}
Geschäftliche Prioritäten: ${selectedGoals}

Bewertungswerte (1 = sehr niedrig, 5 = sehr hoch):
- Repetitivität der Aufgaben: ${scale(d.repetitive)}
- Standardisierung der Prozesse: ${scale(d.standardized)}
- Erforderliches Urteilsvermögen: ${scale(d.judgment)}
- Kundenkontakt-Intensität: ${scale(d.customerFacing)}
- Fehlerkosten: ${scale(d.costOfMistakes)}
- Compliance / Datensensibilität: ${scale(d.sensitivity)}
- Verantwortungsebene: ${scale(d.accountability)}
- Prüfbedarf vor Verwendung von Ergebnissen: ${scale(d.reviewNeeded)}
- Qualität der Prozessdokumentation: ${scale(d.documentation)}
- Qualität der Datenstruktur: ${scale(d.dataStructure)}
- Offenheit des Teams für KI: ${scale(d.aiReadiness)}
- Bereits aktiv genutzte KI-Tools: ${scale(d.toolsAdopted)}

Erstelle jetzt die vollständige Analyse auf Deutsch gemäß den Vorgaben im System-Prompt.`;
}

async function fetchGeminiMarkdown(d) {
  const payload = {
    systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    contents: [{ parts: [{ text: buildPrompt(d) }] }],
    models: GEMINI_MODELS,
    generationConfig: { maxOutputTokens: 3200, temperature: 0.4 }
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
