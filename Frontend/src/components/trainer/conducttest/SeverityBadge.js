import React from 'react';

const LOOKUP = {
  NORMAL: { label: 'Normal', tone: 'safe', pulse: false },
  SUSPICIOUS: { label: 'Suspicious', tone: 'warning', pulse: true },
  HIGH_RISK: { label: 'High Risk', tone: 'high', pulse: true },
  CHEATING: { label: 'Cheating', tone: 'critical', pulse: true },
  FINISHED: { label: 'Finished', tone: 'finished', pulse: false },
  MONITORING: { label: 'Monitoring', tone: 'monitoring', pulse: false },
  NOT_STARTED: { label: 'Not started', tone: 'idle', pulse: false },
  UNKNOWN: { label: 'No signal', tone: 'idle', pulse: false }
};

export const normalizeSeverityState = ({ snapshot, statusFallback }) => {
  if (snapshot && snapshot.isFinished) {
    return 'FINISHED';
  }

  if (snapshot && snapshot.severityLevel && LOOKUP[snapshot.severityLevel]) {
    return snapshot.severityLevel;
  }

  const fallback = String(statusFallback || '').toLowerCase();
  if (fallback === 'finished') return 'FINISHED';
  if (fallback === 'in_progress') return 'MONITORING';
  if (fallback === 'not_started') return 'NOT_STARTED';
  return 'UNKNOWN';
};

export default function SeverityBadge({ state, score = null }) {
  const view = LOOKUP[state] || LOOKUP.UNKNOWN;

  return (
    <span
      className={`conduct-alert-pill ${view.tone}`}
      title={view.label}
      data-alert-state={String(state || '').toLowerCase()}
    >
      <span className={`conduct-alert-dot ${view.pulse ? 'pulse' : ''}`} />
      <span className="conduct-alert-text">{view.label}</span>
      {typeof score === 'number' ? (
        <span className="conduct-alert-score">{Math.round(score)}</span>
      ) : null}
    </span>
  );
}
