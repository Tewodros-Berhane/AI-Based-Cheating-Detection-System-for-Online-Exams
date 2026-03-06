import React, { useMemo } from 'react';
import { Button } from 'antd-compat';
import { History } from 'lucide-react';
import SeverityBadge, { normalizeSeverityState } from './conducttest/SeverityBadge';

const formatRelativeTime = (value) => {
  if (!value) return 'No recent events';

  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return 'No recent events';

  const diffMs = Date.now() - time;
  if (diffMs < 60 * 1000) return 'Just now';

  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};

export default function TrainerResultPreview({
  snapshot = null,
  statusFallback = 'not_started',
  onOpenTimeline
}) {
  const state = useMemo(
    () => normalizeSeverityState({ snapshot, statusFallback }),
    [snapshot, statusFallback]
  );

  const score = snapshot && typeof snapshot.rollingRiskScore === 'number'
    ? snapshot.rollingRiskScore
    : null;

  const secondaryText = snapshot && snapshot.lastEventMessage
    ? snapshot.lastEventMessage
    : (state === 'MONITORING' ? 'Live monitoring active.' : 'No proctor events yet.');

  return (
    <div className="conduct-alert-summary">
      <div className="conduct-alert-summary-main">
        <SeverityBadge state={state} score={score} />
        <div className="conduct-alert-summary-meta">
          <div className="conduct-alert-summary-text">{secondaryText}</div>
          <div className="conduct-alert-summary-time">
            {formatRelativeTime(snapshot && snapshot.lastEventAt)}
          </div>
        </div>
      </div>
      <Button
        className="conduct-alert-timeline-btn"
        onClick={onOpenTimeline}
      >
        <History size={14} strokeWidth={2.2} />
        Timeline
      </Button>
    </div>
  );
}
