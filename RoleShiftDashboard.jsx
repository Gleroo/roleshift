/**
 * RoleShiftDashboard
 *
 * Props:
 *   resultData  — Analyseergebnis-Objekt (siehe dashboardExampleData.js)
 *
 * Dependencies:
 *   npm install recharts
 */

import React from 'react';
import {
  PieChart, Pie, Cell, Tooltip as ReTip, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import './RoleShiftDashboard.css';

/* ── Konstanten ─────────────────────────────────── */

const TEAL      = '#FC563C';
const TEAL_MID  = '#FC563C';
const TEAL_SOFT = '#FC563C';

const DIST_COLORS = {
  automatisierbar: '#FC563C',
  kiUnterstuetzt:  '#FC563C',
  pruefung:        '#F59E0B',
  menschlich:      '#94A3B8',
};

const DIST_LABELS = {
  automatisierbar: 'Automatisierbar',
  kiUnterstuetzt:  'KI-unterstützt',
  pruefung:        'Prüfung nötig',
  menschlich:      'Menschlich',
};

const RISK_CFG = {
  low:    { label: 'Geringes Risiko',  color: '#10B981', bg: 'rgba(16,185,129,.12)'  },
  medium: { label: 'Mittleres Risiko', color: '#F59E0B', bg: 'rgba(245,158,11,.12)'  },
  high:   { label: 'Hohes Risiko',     color: '#F87171', bg: 'rgba(248,113,113,.12)' },
};

const PRIO_CFG = {
  high:   { label: 'Hoch',    color: '#F87171' },
  medium: { label: 'Mittel',  color: '#F59E0B' },
  low:    { label: 'Niedrig', color: '#94A3B8' },
};

const TOOLTIP_STYLE = {
  background: 'rgba(7,13,22,.97)',
  border: '1px solid rgba(252,86,60,.3)',
  borderRadius: 10,
  fontSize: 12,
  fontFamily: 'Inter, sans-serif',
  boxShadow: '0 4px 24px rgba(0,0,0,.5)',
  color: '#E2E8F0',
};

/* ── Unterkomponenten ───────────────────────────── */

function ScoreRing({ score }) {
  const r      = 70;
  const circ   = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const stroke = score >= 70 ? TEAL : score >= 40 ? '#F59E0B' : '#F87171';

  return (
    <svg width="176" height="176" viewBox="0 0 176 176" className="rs-score-ring">
      <defs>
        <filter id="ring-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Track */}
      <circle cx="88" cy="88" r={r}
        fill="none" stroke="rgba(252,86,60,.12)" strokeWidth="7" />

      {/* Progress */}
      <circle cx="88" cy="88" r={r}
        fill="none"
        stroke={stroke}
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        transform="rotate(-90 88 88)"
        filter="url(#ring-glow)"
        style={{ transition: 'stroke-dashoffset 1.6s cubic-bezier(.22,1,.36,1)' }}
      />

      <text x="88" y="79" textAnchor="middle"
        fill="#F1F5F9" fontSize="40" fontWeight="800" fontFamily="Inter,sans-serif">
        {score}
      </text>
      <text x="88" y="100" textAnchor="middle"
        fill="rgba(148,163,184,.55)" fontSize="10"
        fontFamily="Inter,sans-serif" letterSpacing="2">
        KI-SCORE
      </text>
    </svg>
  );
}

function ConfidenceBar({ value }) {
  return (
    <div className="rs-confidence">
      <div className="rs-confidence-row">
        <span>Analysequalität</span>
        <span style={{ color: TEAL_MID, fontWeight: 700 }}>{value}%</span>
      </div>
      <div className="rs-track">
        <div className="rs-track-fill" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function RiskBadge({ level }) {
  const c = RISK_CFG[level] || RISK_CFG.medium;
  return (
    <span className="rs-badge"
      style={{ color: c.color, background: c.bg, borderColor: `${c.color}35` }}>
      <span className="rs-badge-dot" style={{ background: c.color }} />
      {c.label}
    </span>
  );
}

function KPICard({ label, value, delta, trend }) {
  return (
    <div className="rs-panel rs-kpi">
      <div className="rs-kpi-label">{label}</div>
      <div className="rs-kpi-value">{value}</div>
      {delta && (
        <div className={`rs-kpi-delta ${trend === 'up' ? 'up' : 'down'}`}>
          {trend === 'up' ? '▲' : '▼'} {delta}
        </div>
      )}
    </div>
  );
}

function FactorBar({ name, score, max = 5, inverted = false }) {
  const pct  = (score / max) * 100;
  const good = inverted ? score <= 2 : score >= 4;
  const mid  = score === 3;
  const color = good ? TEAL : mid ? '#F59E0B' : '#94A3B8';

  return (
    <div className="rs-factor">
      <div className="rs-factor-head">
        <span>{name}</span>
        <span style={{ color, fontWeight: 700 }}>{score}/{max}</span>
      </div>
      <div className="rs-track">
        <div className="rs-track-fill"
          style={{ width: `${pct}%`, background: color, boxShadow: `0 0 8px ${color}50` }} />
      </div>
    </div>
  );
}

function RecCard({ item }) {
  const c = PRIO_CFG[item.priority] || PRIO_CFG.low;
  return (
    <div className="rs-panel rs-rec-card" style={{ borderTopColor: c.color }}>
      <div className="rs-rec-prio" style={{ color: c.color }}>
        ● {c.label}
      </div>
      <div className="rs-rec-title">{item.title}</div>
      <div className="rs-rec-desc">{item.description}</div>
      {item.tool && <div className="rs-rec-tool">{item.tool}</div>}
    </div>
  );
}

/* ── Haupt-Komponente ───────────────────────────── */

export default function RoleShiftDashboard({ resultData }) {
  const {
    role           = {},
    score          = 0,
    confidence     = 0,
    riskLevel      = 'medium',
    status         = '',
    distribution   = {},
    kpis           = [],
    trendData      = [],
    factors        = [],
    recommendations = [],
    einleitung     = '',
  } = resultData;

  const donutData = Object.entries(distribution).map(([key, value]) => ({
    name:  DIST_LABELS[key] || key,
    value,
    color: DIST_COLORS[key] || '#64748B',
  }));

  const scoreColor = score >= 70 ? TEAL : score >= 40 ? '#F59E0B' : '#F87171';

  return (
    <div className="rs-dashboard">

      {/* ─── HERO ──────────────────────────────────── */}
      <div className="rs-panel rs-hero">
        <div className="rs-hero-left">
          <ScoreRing score={score} />
          <div className="rs-hero-info">
            <div className="rs-hero-status" style={{ color: scoreColor }}>
              {status}
            </div>
            <h2 className="rs-hero-title">{role.title || '—'}</h2>
            {role.department && <div className="rs-hero-dept">{role.department}</div>}
            <RiskBadge level={riskLevel} />
          </div>
        </div>
        <div className="rs-hero-right">
          <ConfidenceBar value={confidence} />
          {einleitung && (
            <p className="rs-hero-intro">
              {einleitung.length > 200
                ? einleitung.slice(0, 200) + '…'
                : einleitung}
            </p>
          )}
        </div>
      </div>

      {/* ─── KPI GRID ──────────────────────────────── */}
      {kpis.length > 0 && (
        <div className="rs-kpi-grid">
          {kpis.map(kpi => (
            <KPICard key={kpi.id || kpi.label} {...kpi} />
          ))}
        </div>
      )}

      {/* ─── MIDDLE ROW: Donut + Faktoren ──────────── */}
      <div className="rs-mid-row">

        {/* Donut */}
        <div className="rs-panel">
          <div className="rs-section-label">Aufgabenverteilung</div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={donutData}
                cx="50%" cy="50%"
                innerRadius={56} outerRadius={86}
                paddingAngle={3}
                dataKey="value"
                stroke="none"
              >
                {donutData.map((d, i) => (
                  <Cell key={i} fill={d.color}
                    style={{ filter: `drop-shadow(0 0 6px ${d.color}55)` }} />
                ))}
              </Pie>
              <ReTip
                contentStyle={TOOLTIP_STYLE}
                formatter={v => [`${v}%`]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="rs-legend">
            {donutData.map((d, i) => (
              <div className="rs-legend-row" key={i}>
                <span className="rs-legend-dot" style={{ background: d.color }} />
                <span className="rs-legend-name">{d.name}</span>
                <span className="rs-legend-val" style={{ color: d.color }}>{d.value}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Faktoren */}
        <div className="rs-panel">
          <div className="rs-section-label">Faktoren-Analyse</div>
          <div className="rs-factors-list">
            {factors.map((f, i) => <FactorBar key={i} {...f} />)}
          </div>
        </div>

      </div>

      {/* ─── TREND ─────────────────────────────────── */}
      {trendData.length > 0 && (
        <div className="rs-panel rs-trend-panel">
          <div className="rs-panel-head">
            <span className="rs-section-label">Entwicklungstrend</span>
            <div className="rs-trend-legend">
              <span style={{ color: TEAL }}>● Automatisierung</span>
              <span style={{ color: TEAL_SOFT }}>● KI-Assistenz</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={170}>
            <AreaChart data={trendData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="ga" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={TEAL}      stopOpacity={0.25} />
                  <stop offset="95%" stopColor={TEAL}      stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gb" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={TEAL_SOFT} stopOpacity={0.18} />
                  <stop offset="95%" stopColor={TEAL_SOFT} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,.04)" strokeDasharray="4 4" vertical={false} />
              <XAxis dataKey="period"
                tick={{ fill: '#475569', fontSize: 11, fontFamily: 'Inter' }}
                axisLine={false} tickLine={false} />
              <YAxis unit="%" domain={[0, 100]}
                tick={{ fill: '#475569', fontSize: 11, fontFamily: 'Inter' }}
                axisLine={false} tickLine={false} />
              <ReTip
                contentStyle={TOOLTIP_STYLE}
                formatter={(v, n) => [
                  `${v}%`,
                  n === 'automation' ? 'Automatisierung' : 'KI-Assistenz',
                ]}
              />
              <Area type="monotone" dataKey="automation"
                stroke={TEAL}      strokeWidth={2} fill="url(#ga)" dot={false} />
              <Area type="monotone" dataKey="aiAssist"
                stroke={TEAL_SOFT} strokeWidth={2} fill="url(#gb)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ─── EMPFEHLUNGEN ──────────────────────────── */}
      {recommendations.length > 0 && (
        <div className="rs-recs-section">
          <div className="rs-section-label rs-recs-label">Empfehlungen</div>
          <div className="rs-rec-grid">
            {recommendations.map((rec, i) => <RecCard key={i} item={rec} />)}
          </div>
        </div>
      )}

    </div>
  );
}
