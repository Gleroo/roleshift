/* =========================================
   ROLESHIFT — CALCULATOR ENGINE v3
   Skill-based: roleshift-ki-analyse
   ========================================= */

// --- THEME INIT (runs before paint) -------
(function () {
  const stored = localStorage.getItem('rs-theme');
  if (stored === 'dark' || stored === 'light') {
    document.documentElement.setAttribute('data-theme', stored);
  }
})();

// --- STATE --------------------------------
const state = {
  current: 1,
  data: {
    roleTitle: '',
    tasks: [],           // ['Aufgabe 1', 'Aufgabe 2', ...]
    taskAssessments: [], // [{repetitive:1..3, standardized:1..3, judgment:1..3}, ...]
    goals: []
  }
};

// --- HELPERS ------------------------------
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function animateCount(el, target, suffix) {
  let start = 0;
  const dur = 900;
  const begin = performance.now();
  function step(now) {
    const p = Math.min((now - begin) / dur, 1);
    const ease = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(ease * target) + (suffix || '');
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// --- PROGRESS BAR -------------------------
function setProgress(step) {
  const fill  = document.getElementById('progressFill');
  const label = document.getElementById('progressLabel');
  if (fill)  fill.style.width  = step <= 3 ? (step / 3 * 100) + '%' : '100%';
  if (label) label.textContent = step <= 3 ? `Schritt ${step} von 3` : 'Ihre Analyse';
}

// --- NAVIGATION ---------------------------
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

// --- THEME TOGGLE -------------------------
const themeToggle = document.getElementById('themeToggle');
themeToggle?.addEventListener('click', () => {
  const cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', cur);
  localStorage.setItem('rs-theme', cur);
});

// ==========================================
// SCHRITT 1 — TASK LIST
// ==========================================

const MAX_TASKS = 7;

function updateTaskNumbers() {
  document.querySelectorAll('#taskList .task-item').forEach((item, i) => {
    const num = item.querySelector('.task-num');
    if (num) num.textContent = i + 1;
  });
}

function makeTaskItem(placeholder) {
  const div = document.createElement('div');
  div.className = 'task-item';
  div.innerHTML = `
    <span class="task-num"></span>
    <input class="calc-input task-input" type="text" placeholder="${esc(placeholder)}" />
    <button class="task-remove-btn" aria-label="Aufgabe entfernen" tabindex="-1">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 4l8 8M12 4l-8 8"/></svg>
    </button>`;
  div.querySelector('.task-remove-btn').addEventListener('click', () => {
    if (document.querySelectorAll('#taskList .task-item').length > 1) {
      div.remove();
      updateTaskNumbers();
    }
  });
  return div;
}

document.querySelectorAll('#taskList .task-remove-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const item = btn.closest('.task-item');
    if (document.querySelectorAll('#taskList .task-item').length > 1) {
      item.remove();
      updateTaskNumbers();
    }
  });
});

document.getElementById('addTaskBtn')?.addEventListener('click', () => {
  const list = document.getElementById('taskList');
  if (!list) return;
  const count = list.querySelectorAll('.task-item').length;
  if (count >= MAX_TASKS) return;
  const placeholders = [
    'z.B. Daten pflegen und aktualisieren',
    'z.B. Meetings vorbereiten und nachbereiten',
    'z.B. Anfragen bearbeiten und weiterleiten',
    'z.B. Analysen erstellen und präsentieren',
  ];
  const item = makeTaskItem(placeholders[count % placeholders.length]);
  list.appendChild(item);
  updateTaskNumbers();
  item.querySelector('.task-input')?.focus();
  if (list.querySelectorAll('.task-item').length >= MAX_TASKS) {
    document.getElementById('addTaskBtn').style.display = 'none';
  }
});

// Chips → fill roleTitle
document.querySelectorAll('#roleChips .calc-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('#roleChips .calc-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    const inp = document.getElementById('roleTitle');
    if (inp) inp.value = chip.dataset.val;
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
  if (!title) { document.getElementById('roleTitle')?.focus(); return; }

  const inputs = document.querySelectorAll('#taskList .task-input');
  const tasks = Array.from(inputs)
    .map(i => i.value.trim())
    .filter(Boolean);

  if (tasks.length < 1) {
    inputs[0]?.focus();
    return;
  }

  state.data.roleTitle = title;
  state.data.tasks = tasks;
  state.data.taskAssessments = tasks.map(() => ({ repetitive: 0, standardized: 0, judgment: 0 }));

  buildStep2(tasks);
  goTo(2);
});

// Back button on step 3
document.querySelectorAll('.calc-back').forEach(btn =>
  btn.addEventListener('click', () => goTo(+btn.dataset.back))
);

// ==========================================
// SCHRITT 2 — AUFGABEN BEWERTEN (dynamisch)
// ==========================================

const TASK_QUESTIONS = [
  {
    key: 'repetitive',
    label: 'Wie routinemäßig ist diese Aufgabe?',
    opts: [
      { val: 1, main: 'Immer ähnlich',      desc: 'Jede Ausführung ist fast gleich' },
      { val: 2, main: 'Manchmal variabel',  desc: 'Ähnliches Muster, aber Ausnahmen kommen vor' },
      { val: 3, main: 'Jeder Fall anders',  desc: 'Jede Situation braucht frisches Denken' },
    ]
  },
  {
    key: 'standardized',
    label: 'Gibt es klare Regeln oder Prozesse dafür?',
    opts: [
      { val: 1, main: 'Klare Regeln',       desc: 'Dokumentiert, regelbasiert, vorhersehbar' },
      { val: 2, main: 'Teils teils',         desc: 'Grobe Leitlinien, aber Interpretationsspielraum' },
      { val: 3, main: 'Viel Ermessen',       desc: 'Erfahrung und Kontext bestimmen das Vorgehen' },
    ]
  },
  {
    key: 'judgment',
    label: 'Ist menschliches Urteil oder Empathie entscheidend?',
    opts: [
      { val: 1, main: 'Kein Urteil nötig',  desc: 'Regelbasiert, kein Interpretationsbedarf' },
      { val: 2, main: 'Teilweise',           desc: 'Teils Regeln, teils menschliche Einschätzung' },
      { val: 3, main: 'Urteil ist zentral',  desc: 'Empathie, Beziehung oder Expertise unverzichtbar' },
    ]
  }
];

function buildStep2(tasks) {
  const card = document.getElementById('step2Card');
  if (!card) return;

  const blocks = tasks.map((task, i) => `
    <div class="task-assess-block" data-task-idx="${i}">
      <div class="task-assess-header">
        <span class="task-assess-num">${i + 1}</span>
        <span class="task-assess-name">${esc(task)}</span>
      </div>
      ${TASK_QUESTIONS.map(q => `
        <div class="task-question">
          <p class="tq-label">${esc(q.label)}</p>
          <div class="tq-opts">
            ${q.opts.map(o => `
              <button class="tq-opt" data-task="${i}" data-key="${q.key}" data-val="${o.val}" type="button">
                <span class="tq-opt-main">${esc(o.main)}</span>
                <span class="tq-opt-desc">${esc(o.desc)}</span>
              </button>`).join('')}
          </div>
        </div>`).join('')}
    </div>`).join('<div class="task-divider"></div>');

  card.innerHTML = `
    <div class="calc-eyebrow">Schritt 2 von 3 — Aufgaben bewerten</div>
    <h2 class="calc-q">Wie sind diese Aufgaben strukturiert?</h2>
    <p class="calc-hint">Drei kurze Fragen pro Aufgabe — wie ein Berater im Gespräch. Bewerten Sie, wie die Aufgabe typischerweise aussieht, nicht im Ausnahmefall.</p>
    <div class="task-assess-list">${blocks}</div>
    <div class="calc-actions" style="margin-top:40px">
      <button class="btn btn-ghost" id="step2Back" type="button">Zurück</button>
      <button class="btn btn-primary btn-lg" id="step2Next" type="button" disabled>
        Weiter <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 8h10M8 3l5 5-5 5"/></svg>
      </button>
    </div>`;

  // Register handlers
  card.querySelectorAll('.tq-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      const taskIdx = +btn.dataset.task;
      const key     = btn.dataset.key;
      const val     = +btn.dataset.val;

      // Deselect siblings in same question block
      const block = card.querySelector(`.task-assess-block[data-task-idx="${taskIdx}"]`);
      block.querySelectorAll(`.tq-opt[data-key="${key}"]`).forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');

      state.data.taskAssessments[taskIdx][key] = val;
      updateStep2Next();
    });
  });

  card.querySelector('#step2Back')?.addEventListener('click', () => goTo(1));
  card.querySelector('#step2Next')?.addEventListener('click', () => goTo(3));
}

function updateStep2Next() {
  const btn = document.getElementById('step2Next');
  if (!btn) return;
  const allAnswered = state.data.taskAssessments.every(
    a => a.repetitive > 0 && a.standardized > 0 && a.judgment > 0
  );
  btn.disabled = !allAnswered;
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
    const result = await fetchSkillAnalysis(state.data);
    renderSkillResult(result);
  } catch (err) {
    console.error('[RoleShift] Analyse-Fehler:', err);
    showApiError(err.message || 'Die Analyse konnte nicht durchgeführt werden.');
  }
});

// ==========================================
// SKILL CLASSIFICATION (lokal, intern)
// Klassifiziert jede Aufgabe in eine der 4 Kategorien
// ==========================================

function classifyTask(rep, std, judg) {
  // Urteil zentral → immer menschlich geleitet
  if (judg === 3) return { key: 'menschlich', emoji: '👤', label: 'Menschlich geleitet', cls: 'cat-human' };
  // Urteil teilweise + viel Ermessen → menschlich geleitet
  if (judg === 2 && std === 3) return { key: 'menschlich', emoji: '👤', label: 'Menschlich geleitet', cls: 'cat-human' };

  // Vollständig automatisierbar: routinemäßig + klare Regeln + kein Urteil
  if (rep === 1 && std === 1 && judg === 1) return { key: 'automatisierbar', emoji: '🤖', label: 'Automatisierbar', cls: 'cat-auto' };

  // Prüfung erforderlich: gemischte Signale
  if (judg === 2 && std === 2 && rep >= 2) return { key: 'pruefung', emoji: '🔍', label: 'Prüfung erforderlich', cls: 'cat-review' };
  if (rep === 1 && std === 1 && judg === 2) return { key: 'pruefung', emoji: '🔍', label: 'Prüfung erforderlich', cls: 'cat-review' };

  // Standard: KI-unterstützt
  return { key: 'ki-unterstuetzt', emoji: '🤝', label: 'KI-unterstützt', cls: 'cat-ai' };
}

// ==========================================
// API — /api/role-analysis.php
// ==========================================

async function fetchSkillAnalysis(d) {
  const roleConfig = {
    roleTitle: d.roleTitle,
    tasks: d.tasks.map((name, i) => ({
      name,
      repetitive:   d.taskAssessments[i]?.repetitive   || 2,
      standardized: d.taskAssessments[i]?.standardized || 2,
      judgment:     d.taskAssessments[i]?.judgment     || 2,
    })),
    goals: d.goals,
    // Pre-classify locally so Gemini can build on it
    localClassifications: d.tasks.map((name, i) => {
      const a = d.taskAssessments[i] || {};
      return {
        name,
        category: classifyTask(a.repetitive, a.standardized, a.judgment).key
      };
    })
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
// LOADING / ERROR
// ==========================================

function showLoading() {
  const cur = document.getElementById(`step-${state.current}`);
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
      <div class="loading-text">Ihre Stelle wird analysiert…</div>
      <div class="loading-subtext">Der KI-Berater wertet jede Aufgabe einzeln aus.</div>
    </div>`;
  setProgress(4);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showApiError(msg) {
  const res = document.getElementById('step-result');
  res.innerHTML = `
    <div class="result-wrap">
      <div class="result-hero" style="text-align:center;padding:48px 24px">
        <div class="result-model-badge" style="background:#fee2e2;color:#b91c1c;border-color:#fca5a5">Fehler</div>
        <h2 class="result-headline" style="margin-top:16px;font-size:1.3rem">Analyse konnte nicht durchgeführt werden</h2>
        <p style="color:var(--text-3);margin-top:12px;font-size:.9rem;max-width:480px;margin-inline:auto">${esc(msg)}</p>
        <div style="margin-top:32px">
          <button class="btn btn-ghost" onclick="location.reload()">Neu starten</button>
        </div>
      </div>
    </div>`;
}

// ==========================================
// CHART HELPERS
// ==========================================

function polarToXY(cx, cy, r, deg) {
  const rad = (deg - 90) * Math.PI / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx, cy, ro, ri, startDeg, endDeg) {
  const p1 = polarToXY(cx, cy, ro, startDeg);
  const p2 = polarToXY(cx, cy, ro, endDeg);
  const p3 = polarToXY(cx, cy, ri, endDeg);
  const p4 = polarToXY(cx, cy, ri, startDeg);
  const large = (endDeg - startDeg) > 180 ? 1 : 0;
  return [
    `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`,
    `A ${ro} ${ro} 0 ${large} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`,
    `L ${p3.x.toFixed(2)} ${p3.y.toFixed(2)}`,
    `A ${ri} ${ri} 0 ${large} 0 ${p4.x.toFixed(2)} ${p4.y.toFixed(2)}`,
    'Z'
  ].join(' ');
}

function buildDonutSvg(segments, centerCount, centerLabel) {
  const cx = 100, cy = 100, ro = 80, ri = 52;
  const totalPct = segments.reduce((s, d) => s + d.pct, 0) || 1;
  const gap = 2;
  let angle = 0;
  const paths = segments.map(seg => {
    if (seg.pct <= 0) return '';
    const sweep = (seg.pct / totalPct) * 360 - gap;
    if (sweep <= 0) return '';
    const startA = angle + gap / 2;
    const endA   = startA + sweep;
    const d = arcPath(cx, cy, ro, ri, startA, endA);
    angle += (seg.pct / totalPct) * 360;
    return `<path d="${d}" fill="${seg.color}" style="filter:drop-shadow(0 0 6px ${seg.color}60)"/>`;
  }).join('');
  return `<svg viewBox="0 0 200 200" width="180" height="180" class="dash-donut-svg" aria-hidden="true">
  <circle cx="${cx}" cy="${cy}" r="${ro}" fill="none" stroke="rgba(255,255,255,.04)" stroke-width="1.5"/>
  ${paths}
  <text x="${cx}" y="${cy - 6}" text-anchor="middle" fill="#F1F5F9" font-size="30" font-weight="800" font-family="Inter,sans-serif">${centerCount}</text>
  <text x="${cx}" y="${cy + 14}" text-anchor="middle" fill="rgba(148,163,184,.55)" font-size="9" font-family="Inter,sans-serif" letter-spacing="2">${centerLabel.toUpperCase()}</text>
</svg>`;
}

function buildPhaseMindmap(plan) {
  const defs = [
    { data: plan.phase1, color: '#0D9488', bg: 'rgba(13,148,136,.15)', badge: 'Phase 1' },
    { data: plan.phase2, color: '#14B8A6', bg: 'rgba(20,184,166,.12)', badge: 'Phase 2' },
    { data: plan.phase3, color: '#818cf8', bg: 'rgba(129,140,248,.12)', badge: 'Phase 3' },
  ].filter(p => p.data);

  return `<div class="dash-phase-flow">${defs.map((ph, i) => `
<div class="dash-phase-node" style="border-top-color:${ph.color}">
  <div class="dash-phase-node-head">
    <span class="dash-phase-badge" style="background:${ph.bg};color:${ph.color}">${ph.badge}</span>
  </div>
  <div class="dash-phase-label">${esc(ph.data.label || '')}</div>
  ${ph.data.intro ? `<p class="dash-phase-intro">${esc(ph.data.intro)}</p>` : ''}
  <div class="dash-phase-items">${(ph.data.items || []).slice(0, 4).map(it =>
    `<div class="dash-phase-item"><span class="dash-phase-bullet" style="background:${ph.color}"></span>${esc(it)}</div>`
  ).join('')}</div>
</div>
${i < defs.length - 1 ? `<div class="dash-phase-connector">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
</div>` : ''}`
  ).join('')}</div>`;
}

// ==========================================
// ERGEBNIS RENDERER — Full Dashboard
// ==========================================

function renderSkillResult(data) {
  const res  = document.getElementById('step-result');
  res.classList.add('dash-full');

  const role = esc(data.roleTitle || state.data.roleTitle || 'Stelle');
  const localCats = state.data.tasks.map((_, i) => {
    const a = state.data.taskAssessments[i] || {};
    return classifyTask(a.repetitive, a.standardized, a.judgment);
  });

  // Build distribution counts — pruefung merges into ki-unterstuetzt
  const tasks = data.taskAnalysis || [];
  const distCount = { automatisierbar: 0, 'ki-unterstuetzt': 0, menschlich: 0 };
  tasks.forEach((t, i) => {
    const cat = t.category || (localCats[i] ? localCats[i].key : 'ki-unterstuetzt');
    if (cat === 'automatisierbar')      distCount.automatisierbar++;
    else if (cat === 'menschlich')      distCount.menschlich++;
    else                                distCount['ki-unterstuetzt']++; // pruefung → ki-unterstuetzt
  });
  const total = tasks.length || 1;
  const pct = {
    auto:  Math.round(distCount.automatisierbar / total * 100),
    ai:    Math.round(distCount['ki-unterstuetzt'] / total * 100),
    human: Math.round(distCount.menschlich / total * 100),
  };

  // SVG donut — 3 segments, matching bar colors
  const donutSvg = buildDonutSvg([
    { pct: pct.auto,  color: '#0D9488' },
    { pct: pct.ai,    color: '#14B8A6' },
    { pct: pct.human, color: '#64748B' },
  ], total, 'Aufgaben');

  // Task cards — no emojis
  const catMap = {
    automatisierbar:   { label: 'Automatisierbar',      cls: 'cat-auto' },
    'ki-unterstuetzt': { label: 'KI-unterstützt',       cls: 'cat-ai' },
    menschlich:        { label: 'Menschlich',           cls: 'cat-human' },
    pruefung:          { label: 'KI-unterstützt',       cls: 'cat-ai' },
  };
  const taskCards = tasks.map((t, i) => {
    const c = catMap[t.category || (localCats[i] ? localCats[i].key : 'ki-unterstuetzt')] || catMap['ki-unterstuetzt'];
    return `<div class="dash-task-card">
  <div class="dash-task-head">
    <span class="dash-task-name">${esc(t.taskName || '')}</span>
    <span class="report-task-cat ${c.cls}">${c.label}</span>
  </div>
  <p class="dash-task-reason">${esc(t.reasoning || '')}</p>
  ${t.toolName ? `<div class="dash-task-tool"><span class="tool-pill">${esc(t.toolName)}</span>${t.toolReason ? `<span class="tool-pill-reason">${esc(t.toolReason)}</span>` : ''}</div>` : ''}
</div>`;
  }).join('');

  // Phase mindmap
  const plan = data.umsetzungsplan || {};
  const hasPlan = plan.phase1 || plan.phase2 || plan.phase3;
  const hasBottom = data.kollaborationsmodell || data.abschluss;
  const bothBottom = data.kollaborationsmodell && data.abschluss;

  res.innerHTML = `
<div class="dash-result">

  <!-- INTRO -->
  <div class="dash-glass dash-intro-panel">
    <span class="dash-role-badge">${role}</span>
    <p class="dash-intro-text">${esc(data.einleitung || '')}</p>
  </div>

  <!-- ROW 1: Bar distribution + Task analysis -->
  <div class="dash-row-2">
    <div class="dash-glass dash-dist-panel">
      <span class="dash-panel-label">Aufgabenverteilung</span>
      <div class="hv-bars">
        <div class="hv-bar-row">
          <span>Automatisierbar</span>
          <div class="hv-track"><div class="hv-fill hv-fill-auto" data-w="${pct.auto}"></div></div>
          <span class="hv-pct pct-auto-h">${pct.auto}%</span>
        </div>
        <div class="hv-bar-row">
          <span>KI-unterstützt</span>
          <div class="hv-track"><div class="hv-fill hv-fill-ai" data-w="${pct.ai}"></div></div>
          <span class="hv-pct pct-ai-h">${pct.ai}%</span>
        </div>
        <div class="hv-bar-row">
          <span>Menschlich geleitet</span>
          <div class="hv-track"><div class="hv-fill hv-fill-human" data-w="${pct.human}"></div></div>
          <span class="hv-pct pct-human-h">${pct.human}%</span>
        </div>
      </div>
    </div>
    <div class="dash-glass dash-tasks-panel">
      <span class="dash-panel-label">Aufgabenanalyse</span>
      <div class="dash-task-list">${taskCards || '<p style="color:var(--text-3);font-size:.85rem">Keine Aufgabendaten verfügbar.</p>'}</div>
    </div>
  </div>

  <!-- PHASE MINDMAP -->
  ${hasPlan ? `<div class="dash-glass dash-phase-panel">
    <span class="dash-panel-label">Phasenweiser Umsetzungsplan</span>
    ${buildPhaseMindmap(plan)}
  </div>` : ''}

  <!-- BOTTOM ROW -->
  ${hasBottom ? `<div class="${bothBottom ? 'dash-row-2' : ''}">
    ${data.kollaborationsmodell ? `<div class="dash-glass">
      <span class="dash-panel-label">Das große Bild</span>
      <p class="dash-collab-text">${esc(data.kollaborationsmodell)}</p>
    </div>` : ''}
    ${data.abschluss ? `<div class="dash-glass dash-closing">
      <div class="dash-closing-arrow">→</div>
      <p class="dash-closing-text">${esc(data.abschluss)}</p>
    </div>` : ''}
  </div>` : ''}

  <!-- FOOTER -->
  <div class="dash-footer">
    <p class="result-disclaimer">Diese Analyse wurde von einem KI-Modell auf Grundlage des RoleShift KI-Analyse-Skills erstellt. Sie dient als Ausgangspunkt für eine fundierte Teamdiskussion — keine Direktive. Menschliches Urteilsvermögen und der direkte Input der betroffenen Mitarbeitenden sollten stets leiten, wie Stellen neu gestaltet werden.</p>
    <div class="result-actions">
      <button class="btn btn-ghost" id="restartBtn">Weitere Stelle analysieren</button>
      <a href="index.html" class="btn btn-primary">Zurück zu RoleShift</a>
    </div>
  </div>

</div>`;

  requestAnimationFrame(() => {
    res.querySelectorAll('.hv-fill[data-w]').forEach(el => {
      el.style.width = el.dataset.w + '%';
    });
  });

  document.getElementById('restartBtn')?.addEventListener('click', restart);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==========================================
// RESTART
// ==========================================

function restart() {
  state.current = 1;
  state.data = { roleTitle: '', tasks: [], taskAssessments: [], goals: [] };

  // Reset form
  const titleInput = document.getElementById('roleTitle');
  if (titleInput) titleInput.value = '';
  document.querySelectorAll('#roleChips .calc-chip').forEach(c => c.classList.remove('active'));
  document.querySelectorAll('.calc-goal-card').forEach(c => c.classList.remove('selected'));
  if (generateBtn) generateBtn.disabled = true;

  // Reset task list to 3 blank items
  const taskList = document.getElementById('taskList');
  if (taskList) {
    taskList.innerHTML = '';
    const placeholders = [
      'z.B. Eingehende E-Mails beantworten und priorisieren',
      'z.B. Wöchentliche Berichte erstellen',
      'z.B. Kundengespräche führen und dokumentieren',
    ];
    placeholders.forEach(ph => {
      const item = makeTaskItem(ph);
      taskList.appendChild(item);
    });
    updateTaskNumbers();
  }

  const addBtn = document.getElementById('addTaskBtn');
  if (addBtn) addBtn.style.display = '';

  const res = document.getElementById('step-result');
  res.classList.add('calc-step-hidden');
  res.innerHTML = '';

  const step1 = document.getElementById('step-1');
  step1.classList.remove('calc-step-hidden');
  step1.style.animation = 'none';
  step1.offsetHeight;
  step1.style.animation = '';

  setProgress(1);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
