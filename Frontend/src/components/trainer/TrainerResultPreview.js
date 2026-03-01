import React, { useEffect, useMemo, useRef, useState } from 'react';
import apis from '../../services/Apis';

const ALERT_LOOKUP = {
  cheating: { label: 'Cheating', tone: 'critical', pulse: true },
  suspicious: { label: 'Suspicious', tone: 'warning', pulse: true },
  normal: { label: 'Normal', tone: 'safe', pulse: false },
  finished: { label: 'Finished', tone: 'finished', pulse: false },
  monitoring: { label: 'Monitoring', tone: 'monitoring', pulse: true },
  in_progress: { label: 'In progress', tone: 'monitoring', pulse: false },
  not_started: { label: 'Not started', tone: 'idle', pulse: false },
  unknown: { label: 'No signal', tone: 'idle', pulse: false }
};

const normalizeStatus = (value) => {
  if (!value) return null;
  const normalized = String(value).toLowerCase();
  return ALERT_LOOKUP[normalized] ? normalized : 'unknown';
};

export default function TrainerResultPreview({ traineeId, testId, statusFallback = 'not_started' }) {
  const [result, setResult] = useState(null);
  const [socketOpen, setSocketOpen] = useState(false);
  const wsRef = useRef(null);

  useEffect(() => {
    if (!traineeId) return undefined;

    const params = new URLSearchParams({
      role: 'trainer',
      traineeid: traineeId
    });

    if (testId) {
      params.set('testid', testId);
      params.set('sessionid', `${testId}:${traineeId}`);
    }

    wsRef.current = new WebSocket(`${apis.WS_RESULT_URL}/?${params.toString()}`);

    wsRef.current.onopen = () => {
      setSocketOpen(true);
    };

    wsRef.current.onmessage = async (event) => {
      const payload = event.data instanceof Blob ? await event.data.text() : event.data;
      let message;
      try {
        message = JSON.parse(payload);
      } catch (error) {
        return;
      }

      if (message.type === 'ai-result' && message.behaviour) {
        setResult(normalizeStatus(message.behaviour));
      }
    };

    wsRef.current.onerror = () => {
      setSocketOpen(false);
    };

    wsRef.current.onclose = () => {
      setSocketOpen(false);
    };

    return () => {
      setSocketOpen(false);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [traineeId, testId]);

  const activeState = useMemo(() => {
    const liveState = normalizeStatus(result);
    if (liveState) return liveState;

    const fallback = normalizeStatus(statusFallback) || 'not_started';
    if (fallback === 'in_progress' && socketOpen) {
      return 'monitoring';
    }

    return fallback;
  }, [result, socketOpen, statusFallback]);

  const view = ALERT_LOOKUP[activeState] || ALERT_LOOKUP.unknown;

  return (
    <span
      className={`conduct-alert-pill ${view.tone}`}
      title={view.label}
      data-alert-state={activeState}
    >
      <span className={`conduct-alert-dot ${view.pulse ? 'pulse' : ''}`} />
      <span className="conduct-alert-text">{view.label}</span>
    </span>
  );
}
