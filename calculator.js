/* =========================================
   ROLESHIFT — CALCULATOR ENGINE v5
   Skill-based: roleshift-ki-analyse
   Lokal: Mock-Daten; Produktion: /api/role-analysis.php
   ========================================= */

'use strict';

// ==========================================
// STATE
// ==========================================
const state = {
  current: 1,
  data: {
    roleTitle: '',
    tasks: [],
    roleAssessment: { repetitive: 0, standardized: 0, judgment: 0 },
    goals: []
  }
};

// ==========================================
// HELPERS
// ==========================================
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function animateCount(el, target, suffix) {
  const dur = 1000;
  const begin = performance.now();
  (function step(now) {
    const p = Math.min((now - begin) / dur, 1);
    const ease = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(ease * target) + (suffix || '');
    if (p < 1) requestAnimationFrame(step);
  })(performance.now());
}

function animateBars() {
  requestAnimationFrame(() => {
    document.querySelectorAll('[data-bar-w]').forEach(el => {
      el.style.width = el.dataset.barW + '%';
    });
  });
}

// ==========================================
// STEPPER
// ==========================================
function setStep(step) {
  for (let i = 1; i <= 4; i++) {
    const el = document.getElementById('stp-' + i);
    if (!el) continue;
    el.classList.remove('active', 'done');
    el.removeAttribute('aria-current');
    if (i < step) {
      el.classList.add('done');
      // Checkmark in done circle
      el.querySelector('.stepper-circle').innerHTML =
        `<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 6l3 3 5-5"/></svg>`;
    } else if (i === step) {
      el.classList.add('active');
      el.setAttribute('aria-current', 'step');
      if (i < 4) el.querySelector('.stepper-circle').textContent = i;
    } else {
      if (i < 4) el.querySelector('.stepper-circle').textContent = i;
    }
  }
  // Connecting lines
  document.querySelectorAll('.stepper-line').forEach((line, idx) => {
    line.classList.toggle('done', idx + 1 < step);
  });
}

// ==========================================
// NAVIGATION
// ==========================================
function goTo(nextStep) {
  const cur  = document.getElementById('step-' + state.current) ||
               document.getElementById('step-result');
  const next = nextStep === 'result'
    ? document.getElementById('step-result')
    : document.getElementById('step-' + nextStep);
  if (!next) return;

  cur?.classList.add('leaving');
  setTimeout(() => {
    cur?.classList.add('calc-step-hidden');
    cur?.classList.remove('leaving');
    next.classList.remove('calc-step-hidden');
    // Reflow trigger for re-animation
    next.style.animation = 'none';
    next.offsetHeight; // eslint-disable-line
    next.style.animation = '';
    state.current = nextStep === 'result' ? 'result' : nextStep;
    setStep(nextStep === 'result' ? 4 : nextStep);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, 240);
}

// ==========================================
// SCHRITT 1 — TASK LIST
// ==========================================

// Chips → fill roleTitle
document.querySelectorAll('#roleChips .calc-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('#roleChips .calc-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    const inp = document.getElementById('roleTitle');
    if (inp) { inp.value = chip.dataset.val; inp.focus(); }
  });
});
document.getElementById('roleTitle')?.addEventListener('input', e => {
  document.querySelectorAll('#roleChips .calc-chip').forEach(c =>
    c.classList.toggle('active', c.dataset.val === e.target.value)
  );
});

// Step 1 → Step 2
document.getElementById('step1Next')?.addEventListener('click', () => {
  const title = document.getElementById('roleTitle')?.value?.trim();
  if (!title) {
    const inp = document.getElementById('roleTitle');
    inp?.focus();
    inp?.classList.add('input-error');
    setTimeout(() => inp?.classList.remove('input-error'), 1200);
    return;
  }

  const inputs = document.querySelectorAll('#taskList .task-input');
  const tasks = Array.from(inputs).map(i => i.value.trim()).filter(Boolean);

  state.data.roleTitle = title;
  state.data.tasks = tasks;
  state.data.roleAssessment = { repetitive: 0, standardized: 0, judgment: 0 };

  buildStep2();
  goTo(2);
});

// Back buttons (static)
document.querySelectorAll('.calc-back').forEach(btn =>
  btn.addEventListener('click', () => goTo(+btn.dataset.back))
);

// ==========================================
// SCHRITT 2 — ROLLENPROFIL (globale 1-5 Skala)
// ==========================================
const ROLE_QUESTIONS = [
  {
    key: 'repetitive',
    label: 'Wie abwechslungsreich ist die tägliche Arbeit?',
    labelLeft: 'Sehr abwechslungsreich',
    labelRight: 'Sehr routinemäßig',
  },
  {
    key: 'standardized',
    label: 'Wie stark sind Abläufe und Regeln vorgegeben?',
    labelLeft: 'Kaum vorgegeben',
    labelRight: 'Stark standardisiert',
  },
  {
    key: 'judgment',
    label: 'Wie viel eigenständige Einschätzung erfordert die Tätigkeit?',
    labelLeft: 'Wenig Einschätzung',
    labelRight: 'Viel Einschätzung',
  },
];

function buildStep2() {
  const card = document.getElementById('step2Card');
  if (!card) return;

  const questions = ROLE_QUESTIONS.map(q => `
    <div class="scale-question">
      <p class="scale-question-label">${esc(q.label)}</p>
      <div class="scale-edge-labels">
        <span>${esc(q.labelLeft)}</span>
        <span>${esc(q.labelRight)}</span>
      </div>
      <div class="scale-btns">
        ${[1,2,3,4,5].map(v => `<button class="scale-btn" data-key="${q.key}" data-val="${v}" type="button">${v}</button>`).join('')}
      </div>
    </div>`).join('');

  card.innerHTML = `
    <div class="calc-eyebrow">Schritt 2 von 4 — Arbeitsstruktur</div>
    <h2 class="calc-q">Wie sieht die Arbeit tatsächlich aus?</h2>
    <div class="scale-questions">${questions}</div>
    <div class="calc-actions" style="margin-top:40px">
      <button class="btn btn-ghost" id="step2Back" type="button">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13 8H3M8 3l-5 5 5 5"/></svg>
        Zurück
      </button>
      <button class="btn btn-primary btn-lg" id="step2Next" type="button" disabled>
        Weiter
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 8h10M8 3l5 5-5 5"/></svg>
      </button>
    </div>`;

  card.querySelectorAll('.scale-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.key;
      const val = +btn.dataset.val;
      card.querySelectorAll(`.scale-btn[data-key="${key}"]`).forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.data.roleAssessment[key] = val;
      checkStep2Complete();
    });
  });

  card.querySelector('#step2Back')?.addEventListener('click', () => goTo(1));
  card.querySelector('#step2Next')?.addEventListener('click', () => goTo(3));
}

function checkStep2Complete() {
  const btn = document.getElementById('step2Next');
  if (!btn) return;
  const a = state.data.roleAssessment;
  btn.disabled = !(a.repetitive > 0 && a.standardized > 0 && a.judgment > 0);
}

// ==========================================
// SCHRITT 3 — PRIORITÄTEN
// ==========================================
const generateBtn = document.getElementById('generateBtn');

document.querySelectorAll('.calc-goal-card').forEach(card => {
  card.addEventListener('click', () => {
    const val = card.dataset.val;
    const idx = state.data.goals.indexOf(val);
    if (idx === -1) { state.data.goals.push(val); card.classList.add('selected'); }
    else            { state.data.goals.splice(idx, 1); card.classList.remove('selected'); }
    if (generateBtn) generateBtn.disabled = state.data.goals.length === 0;
  });
});

generateBtn?.addEventListener('click', async () => {
  showLoading();
  try {
    const result = await fetchAnalysis(state.data);
    renderResult(result);
  } catch (err) {
    console.error('[RoleShift] Analyse-Fehler:', err);
    showError(err.message || 'Die Analyse konnte nicht durchgeführt werden.');
  }
});

// ==========================================
// KLASSIFIZIERUNG (global, 1-5 Skala)
// rep: 1=abwechslungsreich … 5=routinemäßig
// std: 1=kaum Regeln … 5=klar dokumentiert
// judg: 1=kaum nötig … 5=zentral
// ==========================================
function classifyRole(rep, std, judg) {
  if (judg >= 4)                          return { key: 'menschlich',      label: 'Menschlich geleitet', cls: 'cat-human'  };
  if (rep >= 4 && std >= 4 && judg <= 2)  return { key: 'automatisierbar', label: 'Automatisierbar',     cls: 'cat-auto'   };
  if (judg === 3 || std <= 2)             return { key: 'pruefung',        label: 'KI-unterstützt',      cls: 'cat-review' };
  return                                         { key: 'ki-unterstuetzt', label: 'KI-unterstützt',      cls: 'cat-ai'     };
}

// ==========================================
// API — lokal: Mock / Produktion: PHP
// ==========================================
const IS_LOCAL = ['localhost', '127.0.0.1', ''].includes(window.location.hostname);

function buildMockResult(d) {
  const roleTitle = d.roleTitle || 'Diese Stelle';
  const tasks     = d.tasks;
  const goals     = d.goals;
  const ra        = d.roleAssessment || { repetitive: 3, standardized: 3, judgment: 3 };
  const roleClass = classifyRole(ra.repetitive, ra.standardized, ra.judgment);

  // Aufgaben anhand des globalen Rollenprofils klassifizieren
  const categoryPool = {
    automatisierbar:  ['automatisierbar', 'ki-unterstuetzt', 'ki-unterstuetzt'],
    'ki-unterstuetzt':['ki-unterstuetzt', 'ki-unterstuetzt', 'menschlich'],
    pruefung:         ['ki-unterstuetzt', 'pruefung',        'menschlich'],
    menschlich:       ['ki-unterstuetzt', 'menschlich',      'menschlich'],
  }[roleClass.key] || ['ki-unterstuetzt', 'ki-unterstuetzt', 'menschlich'];

  const taskAnalysis = tasks.map((name, i) => {
    const catKey = categoryPool[i % categoryPool.length];
    const cat = { key: catKey };
    const toolMap = {
      automatisierbar:  { name: 'Microsoft Copilot',  reason: 'Automatisiert diese Aufgabe regelbasiert und direkt in Ihrem bestehenden Office-Ökosystem.' },
      'ki-unterstuetzt':{ name: 'ChatGPT (Plus)',      reason: 'Erstellt strukturierte Entwürfe als Ausgangspunkt — Freigabe bleibt beim Fachexperten.' },
      pruefung:         { name: 'Microsoft Copilot',  reason: 'Guter Einstiegspunkt für einen kontrollierten Pilot mit messbarer Zeitersparnis.' },
      menschlich:       { name: null,                  reason: null },
    };
    const tool = toolMap[cat.key] || toolMap['ki-unterstuetzt'];
    const reasonMap = {
      automatisierbar:   `„${name}" ist gleichförmig und folgt klaren Regeln — ein Profil, das direkt für vollständige Automatisierung qualifiziert. Die freigewordene Zeit lässt sich in strategisch wertvollere Tätigkeiten investieren.`,
      'ki-unterstuetzt': `„${name}" hat einen klar strukturierbaren Anteil, der sich gut an KI delegieren lässt. KI liefert den Ausgangspunkt, Sie die Qualitätssicherung — ein Paradebeispiel für Mensch-KI-Kollaboration.`,
      pruefung:          `„${name}" zeigt gemischte Signale. Das KI-Potenzial ist vorhanden, aber die Umsetzung erfordert Sorgfalt. Starten Sie mit einem kontrollierten Pilot und messen Sie Qualität und Aufwand.`,
      menschlich:        `„${name}" lebt von Qualitäten, die KI nicht replizieren kann. Empathie, Beziehungsgestaltung und situatives Urteilsvermögen machen diese Aufgabe zum unersetzlichen menschlichen Kern der Stelle.`,
    };
    return {
      taskName:   name,
      category:   cat.key,
      reasoning:  reasonMap[cat.key] || reasonMap['ki-unterstuetzt'],
      toolName:   tool.name,
      toolReason: tool.reason,
    };
  });

  // Wenn keine Aufgaben eingegeben, Platzhalter
  const effectiveTasks = taskAnalysis.length > 0 ? taskAnalysis : [
    { taskName: 'Routinekorrespondenz',        category: 'automatisierbar',  reasoning: 'Gleichförmig und regelbasiert — ideal für vollständige Automatisierung.', toolName: 'Microsoft Copilot (Outlook)', toolReason: 'Erstellt und beantwortet Mails regelbasiert.' },
    { taskName: 'Reporting und Auswertungen',  category: 'ki-unterstuetzt',  reasoning: 'KI übernimmt Datenaufbereitung und Visualisierung; inhaltliche Bewertung bleibt beim Menschen.', toolName: 'Power BI mit Copilot', toolReason: 'Automatisiert Berichterstellung aus verbundenen Quellen.' },
    { taskName: 'Stakeholder-Kommunikation',   category: 'menschlich',       reasoning: 'Beziehungsgestaltung und situatives Verhandlungsgeschick sind originär menschliche Kernkompetenzen.', toolName: null, toolReason: null },
  ];

  const total  = effectiveTasks.length;
  const autoCnt  = effectiveTasks.filter(t => t.category === 'automatisierbar').length;
  const kiCnt    = effectiveTasks.filter(t => ['ki-unterstuetzt','pruefung'].includes(t.category)).length;
  const humanCnt = effectiveTasks.filter(t => t.category === 'menschlich').length;

  const goalContext = goals.includes('time')    ? 'mit dem Fokus auf Zeitersparnis'
    : goals.includes('quality')                 ? 'mit Blick auf Qualitätssteigerung'
    : goals.includes('admin')                   ? 'mit dem Ziel, den Verwaltungsaufwand zu senken'
    : goals.includes('decisions')               ? 'zur Verbesserung der Entscheidungsgrundlagen'
    : 'im Bereich Mensch-KI-Kollaboration';

  const firstActionTask = effectiveTasks.find(t => t.category === 'automatisierbar' || t.category === 'ki-unterstuetzt');

  return {
    roleTitle,
    einleitung: `Für die Stelle ${roleTitle} ergibt die Analyse ein klares Bild ${goalContext}: Von ${total} untersuchten Kernaufgaben eignen sich ${autoCnt} für vollständige Automatisierung, ${kiCnt} profitieren von KI-Unterstützung und ${humanCnt} bleiben bewusst menschlich geleitet — eine Aufteilung, die sowohl Effizienz als auch Qualität sichert.`,
    taskAnalysis: effectiveTasks,
    kollaborationsmodell: `Das ideale Kollaborationsmodell für ${roleTitle} kombiniert automatisierte Hintergrundprozesse mit einem klaren Human-in-the-loop-Ansatz: KI übernimmt strukturierbare, regelbasierte Anteile, während strategische Entscheidungen, Beziehungsgestaltung und Qualitätskontrolle beim Menschen verbleiben. Diese Aufgabenteilung ist kein Kompromiss — sie ist die konsequente Weiterentwicklung einer leistungsstarken Rolle.`,
    umsetzungsplan: {
      phase1: {
        label: 'Phase 1 – Quick Wins',
        intro: 'Erste KI-Tools dort einführen, wo Einrichtungsaufwand minimal und Wirkung maximal ist.',
        items: [
          firstActionTask?.toolName ? `${firstActionTask.toolName} für „${firstActionTask.taskName}" einrichten — messbare Zeitersparnis innerhalb der ersten Woche.` : 'Microsoft 365 auf bereits enthaltene KI-Features prüfen — viele sind bereits lizenziert, aber nicht aktiviert.',
          'Qualitätsstandards und Freigabe-Workflow für KI-Ausgaben klar definieren.',
          'Zeitmessung starten: Wie lange dauern Pilotaufgaben vor und nach KI-Einsatz?',
          'Ergebnisse der ersten zwei Wochen dokumentieren und mit dem Team besprechen.',
        ]
      },
      phase2: {
        label: 'Phase 2 – Integration',
        intro: 'Erfolgreiche Piloten in den Regelbetrieb überführen und weitere Aufgaben erschließen.',
        items: [
          'Automatisierungen aus Phase 1 in den Regelbetrieb überführen.',
          'Ausnahme-Handling definieren: Was tut KI bei unbekannten Fällen?',
          '3-Monats-Review: Zeiteinsparung, Fehlerquote und Nutzung auswerten.',
          'Weitere KI-unterstützte Aufgaben schrittweise integrieren.',
        ]
      },
      phase3: {
        label: 'Phase 3 – Transformation',
        intro: 'KI-Nutzung evaluieren, skalieren und zur dauerhaften Arbeitsweise machen.',
        items: [
          'Lessons Learned dokumentieren: Was funktioniert, was wurde angepasst?',
          'KI-Kompetenz im Team verbreitern — internes Schulungsformat entwickeln.',
          'Nächste Automatisierungswelle identifizieren.',
          'Qualitäts-Audit: KI-Outputs systematisch gegen definierte Standards prüfen.',
        ]
      }
    },
    abschluss: firstActionTask?.toolName
      ? `Der empfohlene Einstieg: ${firstActionTask.toolName} für „${firstActionTask.taskName}" einrichten. Die Lernkurve ist flach, die Wirkung ist innerhalb weniger Tage messbar — dieser erste Schritt schafft das Vertrauen für alle weiteren KI-Integrationen.`
      : 'Starten Sie mit einem strukturierten Zwei-Wochen-Pilot: Wählen Sie eine Aufgabe, setzen Sie ein KI-Tool ein und messen Sie den Unterschied. Diese erste Erfahrung ist wertvoller als jede Theorie.',
    freeInsights: [
      `${Math.round((autoCnt + kiCnt) / total * 100)} % der analysierten Aufgaben bieten konkretes KI-Potenzial — ein realistisches Verhältnis, das einen gezielten Einstieg ohne Überforderung erlaubt.`,
      firstActionTask
        ? `Der stärkste Einstiegspunkt ist „${firstActionTask.taskName}": ${firstActionTask.category === 'automatisierbar' ? 'vollständig automatisierbar' : 'KI-unterstützt'} — messbare Zeitersparnis ist innerhalb der ersten Woche realistisch.`
        : 'KI-Einführung entfaltet den größten Nutzen, wenn sie schrittweise und messbar erfolgt.',
      `Für ${effectiveTasks.filter(t => t.toolName).length} von ${total} Aufgaben wurden konkrete KI-Tools identifiziert — die technische Hürde ist niedrig.`,
    ]
  };
}

async function fetchAnalysis(d) {
  if (IS_LOCAL) {
    // Simuliere Latenz für realistische UX
    await new Promise(res => setTimeout(res, 1400));
    return buildMockResult(d);
  }

  // Produktion: echter API-Aufruf
  const ra = d.roleAssessment || { repetitive: 3, standardized: 3, judgment: 3 };
  const roleClass = classifyRole(ra.repetitive, ra.standardized, ra.judgment);
  const roleConfig = {
    roleTitle: d.roleTitle,
    tasks: d.tasks.map(name => ({ name })),
    roleAssessment: ra,
    goals: d.goals,
    roleClassification: roleClass.key,
  };

  const response = await fetch('/api/role-analysis.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roleConfig })
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

// ==========================================
// LOADING + ERROR
// ==========================================
function showLoading() {
  const cur = document.getElementById('step-' + state.current);
  cur?.classList.add('calc-step-hidden');

  const res = document.getElementById('step-result');
  res.classList.remove('calc-step-hidden');
  res.innerHTML = `
    <div class="result-loading">
      <div class="loading-dots">
        <div class="loading-dot"></div>
        <div class="loading-dot"></div>
        <div class="loading-dot"></div>
      </div>
      <div class="loading-text">Analyse wird erstellt</div>
      <div class="loading-subtext">Der KI-Berater wertet jede Aufgabe einzeln aus und erstellt Ihren persönlichen Umsetzungsplan.</div>
    </div>`;

  setStep(4);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showError(msg) {
  const res = document.getElementById('step-result');
  res.innerHTML = `
    <div class="res-error">
      <div class="res-error-badge">Fehler</div>
      <div class="res-error-title">Analyse konnte nicht durchgeführt werden</div>
      <p class="res-error-msg">${esc(msg)}</p>
      <button class="btn btn-ghost" onclick="location.reload()">Neu starten</button>
    </div>`;
}

// ==========================================
// ERGEBNIS-RENDERER
// ==========================================
const CAT_MAP = {
  automatisierbar:   { label: 'Automatisierbar',      cls: 'cat-auto'   },
  'ki-unterstuetzt': { label: 'KI-unterstützt',       cls: 'cat-ai'     },
  menschlich:        { label: 'Menschlich geleitet',   cls: 'cat-human'  },
  pruefung:          { label: 'KI-unterstützt',        cls: 'cat-review' },
};

function computeDistribution(tasks) {
  const count = { auto: 0, ai: 0, human: 0 };
  tasks.forEach(t => {
    if (t.category === 'automatisierbar')  count.auto++;
    else if (t.category === 'menschlich') count.human++;
    else                                   count.ai++;
  });
  const total = tasks.length || 1;
  return {
    auto:  Math.round(count.auto  / total * 100),
    ai:    Math.round(count.ai    / total * 100),
    human: Math.round(count.human / total * 100),
    count,
    total,
  };
}

function renderTaskList(tasks) {
  if (!tasks || tasks.length === 0) return '<p style="color:var(--text-3);font-size:.85rem">Keine Aufgabendaten verfügbar.</p>';
  return tasks.map(t => {
    const c = CAT_MAP[t.category] || CAT_MAP['ki-unterstuetzt'];
    return `<div class="res-task-item">
      <div class="res-task-head">
        <span class="res-task-name">${esc(t.taskName || '')}</span>
        <span class="res-task-cat ${c.cls}">${c.label}</span>
      </div>
      ${t.reasoning ? `<p class="res-task-reasoning">${esc(t.reasoning)}</p>` : ''}
      ${t.toolName  ? `<div class="res-task-tool">
        <span class="tool-pill">${esc(t.toolName)}</span>
        ${t.toolReason ? `<span class="tool-pill-reason">${esc(t.toolReason)}</span>` : ''}
      </div>` : ''}
    </div>`;
  }).join('');
}

function renderPhases(plan) {
  if (!plan) return '';
  const phases = [
    { data: plan.phase1, n: 1 },
    { data: plan.phase2, n: 2 },
    { data: plan.phase3, n: 3 },
  ].filter(p => p.data);

  return phases.map(ph => `
    <div class="res-phase-card" data-phase="${ph.n}">
      <div class="res-phase-head">
        <span class="res-phase-badge">Phase ${ph.n}</span>
      </div>
      <div class="res-phase-title">${esc(ph.data.label || '')}</div>
      ${ph.data.intro ? `<p class="res-phase-intro">${esc(ph.data.intro)}</p>` : ''}
      <div class="res-phase-items">
        ${(ph.data.items || []).slice(0, 5).map(it =>
          `<div class="res-phase-item"><span class="res-phase-bullet"></span>${esc(it)}</div>`
        ).join('')}
      </div>
    </div>`).join('');
}

function renderInsights(insights) {
  if (!insights || insights.length === 0) return '';
  const checkIcon = `<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 6l3 3 5-5"/></svg>`;
  return insights.map(text => `
    <div class="res-insight-item">
      <div class="res-insight-icon">${checkIcon}</div>
      <p class="res-insight-text">${esc(text)}</p>
    </div>`).join('');
}

function renderResult(data) {
  const res  = document.getElementById('step-result');
  const role = esc(data.roleTitle || state.data.roleTitle || 'Ihre Stelle');
  const tasks = data.taskAnalysis || [];
  const dist  = computeDistribution(tasks);
  const plan  = data.umsetzungsplan || {};
  const hasPlan = plan.phase1 || plan.phase2 || plan.phase3;
  const insights = data.freeInsights || [];
  const hasCollab  = !!data.kollaborationsmodell;
  const hasAbschluss = !!data.abschluss;

  res.innerHTML = `
<div class="result-wrap">

  <!-- A) HERO BANNER -->
  <div class="res-hero">
    <div class="res-hero-top">
      <div class="res-role-name">${role}</div>
      <div class="res-done-badge">Analyse abgeschlossen</div>
    </div>
    <div class="res-kpi-row">
      <div class="res-kpi-card" style="--kpi-color:#FC563C">
        <div class="res-kpi-label">Automatisierbar</div>
        <div class="res-kpi-value" id="kpi-auto">0%</div>
        <div class="res-kpi-sub">${dist.count.auto} von ${dist.total} Aufgaben</div>
        <div class="res-kpi-accent"></div>
      </div>
      <div class="res-kpi-card" style="--kpi-color:#fc8272">
        <div class="res-kpi-label">KI-unterstützt</div>
        <div class="res-kpi-value" id="kpi-ai">0%</div>
        <div class="res-kpi-sub">${dist.count.ai} von ${dist.total} Aufgaben</div>
        <div class="res-kpi-accent"></div>
      </div>
      <div class="res-kpi-card" style="--kpi-color:#94A3B8">
        <div class="res-kpi-label">Menschlich geleitet</div>
        <div class="res-kpi-value" id="kpi-human">0%</div>
        <div class="res-kpi-sub">${dist.count.human} von ${dist.total} Aufgaben</div>
        <div class="res-kpi-accent"></div>
      </div>
    </div>
  </div>

  <!-- B) ZUSAMMENFASSUNG -->
  ${data.einleitung ? `
  <div class="res-summary">
    <div class="res-summary-label">Kernaussage</div>
    <p class="res-summary-text">${esc(data.einleitung)}</p>
  </div>` : ''}

  <!-- C) VISUELLE VERTEILUNG + D) AUFGABEN -->
  <div class="res-visual-row">
    <div class="res-chart-panel">
      <span class="res-panel-label">Aufgabenverteilung</span>
      <div class="res-hbars">
        <div class="res-hbar-row">
          <div class="res-hbar-meta">
            <span class="res-hbar-name">Automatisierbar</span>
            <span class="res-hbar-pct clr-auto">${dist.auto}%</span>
          </div>
          <div class="res-hbar-track">
            <div class="res-hbar-fill res-hbar-auto" data-bar-w="${dist.auto}"></div>
          </div>
        </div>
        <div class="res-hbar-row">
          <div class="res-hbar-meta">
            <span class="res-hbar-name">KI-unterstützt</span>
            <span class="res-hbar-pct clr-ai">${dist.ai}%</span>
          </div>
          <div class="res-hbar-track">
            <div class="res-hbar-fill res-hbar-ai" data-bar-w="${dist.ai}"></div>
          </div>
        </div>
        <div class="res-hbar-row">
          <div class="res-hbar-meta">
            <span class="res-hbar-name">Menschlich geleitet</span>
            <span class="res-hbar-pct clr-human">${dist.human}%</span>
          </div>
          <div class="res-hbar-track">
            <div class="res-hbar-fill res-hbar-human" data-bar-w="${dist.human}"></div>
          </div>
        </div>
      </div>
      <div class="res-legend">
        <div class="res-legend-item">
          <div class="res-legend-dot" style="background:#FC563C"></div>
          Automatisierbar
        </div>
        <div class="res-legend-item">
          <div class="res-legend-dot" style="background:#fc8272"></div>
          KI-unterstützt
        </div>
        <div class="res-legend-item">
          <div class="res-legend-dot" style="background:#fdc8bf"></div>
          Menschlich geleitet
        </div>
      </div>
    </div>

    ${tasks.length > 0 ? `
    <div class="res-tasks-panel">
      <span class="res-panel-label">Aufgabenanalyse</span>
      <div class="res-task-list">${renderTaskList(tasks)}</div>
    </div>` : ''}
  </div>

  <!-- E) KI-EMPFEHLUNGSPLAN -->
  ${hasPlan ? `
  <div class="res-phases-panel">
    <span class="res-panel-label">KI-Empfehlungsplan in 3 Phasen</span>
    <div class="res-phases-grid">
      ${renderPhases(plan)}
    </div>
  </div>` : ''}

  <!-- F) INSIGHTS -->
  ${insights.length > 0 ? `
  <div class="res-insights-panel">
    <span class="res-panel-label">Erkenntnisse</span>
    <div class="res-insights-list">
      ${renderInsights(insights)}
    </div>
  </div>` : ''}

  <!-- KOLLABORATIONSMODELL + ABSCHLUSS -->
  ${(hasCollab || hasAbschluss) ? `
  <div class="res-collab-row">
    ${hasCollab ? `
    <div class="res-collab-panel">
      <span class="res-panel-label">Das große Bild</span>
      <p class="res-collab-text">${esc(data.kollaborationsmodell)}</p>
    </div>` : ''}
    ${hasAbschluss ? `
    <div class="res-closing-panel">
      <div class="res-closing-arrow">&#8594;</div>
      <p class="res-closing-text">${esc(data.abschluss)}</p>
    </div>` : ''}
  </div>` : ''}

  <!-- G) CTA FOOTER -->
  <div class="res-footer">
    <p class="res-disclaimer">Diese Analyse wurde auf Grundlage des RoleShift KI-Analyse-Skills erstellt${IS_LOCAL ? ' (lokaler Modus — Mock-Daten)' : ''}. Sie dient als Ausgangspunkt für eine fundierte Teamdiskussion — keine Direktive. Menschliches Urteilsvermögen und der direkte Input der betroffenen Mitarbeitenden sollten stets leiten, wie Stellen neu gestaltet werden.</p>
    <div class="res-actions">
      <button class="btn btn-ghost" id="restartBtn" type="button">Neue Analyse starten</button>
      <a href="index.html" class="btn btn-primary">Zurück zu RoleShift</a>
    </div>
  </div>

</div>`;

  // Animate KPI counts
  setTimeout(() => {
    const elAuto  = document.getElementById('kpi-auto');
    const elAi    = document.getElementById('kpi-ai');
    const elHuman = document.getElementById('kpi-human');
    if (elAuto)  animateCount(elAuto,  dist.auto,  '%');
    if (elAi)    animateCount(elAi,    dist.ai,    '%');
    if (elHuman) animateCount(elHuman, dist.human, '%');
  }, 80);

  // Animate bars
  setTimeout(() => {
    animateBars();
  }, 120);

  document.getElementById('restartBtn')?.addEventListener('click', restart);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==========================================
// RESTART
// ==========================================
function restart() {
  state.current = 1;
  state.data = { roleTitle: '', tasks: [], roleAssessment: { repetitive: 0, standardized: 0, judgment: 0 }, goals: [] };

  // Reset inputs
  const titleInput = document.getElementById('roleTitle');
  if (titleInput) titleInput.value = '';
  document.querySelectorAll('#roleChips .calc-chip').forEach(c => c.classList.remove('active'));
  document.querySelectorAll('.calc-goal-card').forEach(c => c.classList.remove('selected'));
  if (generateBtn) generateBtn.disabled = true;

  // Reset task inputs
  document.querySelectorAll('#taskList .task-input').forEach(inp => { inp.value = ''; });

  // Reset result pane
  const res = document.getElementById('step-result');
  res.classList.add('calc-step-hidden');
  res.innerHTML = '';

  // Show step 1
  const step1 = document.getElementById('step-1');
  step1.classList.remove('calc-step-hidden');
  step1.style.animation = 'none';
  step1.offsetHeight; // eslint-disable-line
  step1.style.animation = '';

  setStep(1);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==========================================
// INIT
// ==========================================
setStep(1);
