import React from 'react';
import { Icon, Tag } from 'antd-compat';

const toneMeta = {
  warning: {
    icon: 'warning',
    label: 'Examiner notice'
  },
  critical: {
    icon: 'close-circle',
    label: 'Urgent update'
  },
  info: {
    icon: 'info-circle',
    label: 'Session update'
  }
};

const formatNoticeTime = (value) => {
  if (!value) {
    return '';
  }

  try {
    return new Date(value).toLocaleString();
  } catch (error) {
    return '';
  }
};

export default function CandidateSupportPanel({ supportSummary, candidateNotices = [], compact = false }) {
  const activeItems = supportSummary && Array.isArray(supportSummary.items) ? supportSummary.items : [];
  const hasSupport = Boolean(supportSummary && supportSummary.active && activeItems.length > 0);
  const notices = Array.isArray(candidateNotices) ? candidateNotices : [];
  const hasNotices = notices.length > 0;

  if (!hasSupport && !hasNotices) {
    return null;
  }

  return (
    <div className={`candidate-support-panel ${compact ? 'is-compact' : ''}`}>
      {hasSupport ? (
        <section className="candidate-support-card">
          <div className="candidate-support-card-head">
            <div>
              <span className="candidate-support-kicker">Support settings</span>
              <h3>{supportSummary.headline || 'Support settings are active for this exam.'}</h3>
            </div>
            {supportSummary.extraTimeMinutes > 0 ? (
              <Tag className="candidate-support-tag">{`+${supportSummary.extraTimeMinutes} min`}</Tag>
            ) : null}
          </div>
          <div className="candidate-support-chip-list">
            {activeItems.map((item) => (
              <span className="candidate-support-chip" key={item.key || item.label}>
                {item.label}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {hasNotices ? (
        <section className="candidate-notices-card">
          <div className="candidate-support-card-head candidate-notices-head">
            <div>
              <span className="candidate-support-kicker">Examiner updates</span>
              <h3>Review these session updates</h3>
            </div>
          </div>
          <div className="candidate-notice-list">
            {notices.map((notice) => {
              const meta = toneMeta[notice.tone] || toneMeta.info;
              return (
                <article className={`candidate-notice-item is-${notice.tone || 'info'}`} key={notice.id || `${notice.actionType}-${notice.createdAt}`}>
                  <div className="candidate-notice-icon">
                    <Icon type={meta.icon} />
                  </div>
                  <div className="candidate-notice-body">
                    <div className="candidate-notice-title-row">
                      <strong>{notice.title || meta.label}</strong>
                      {notice.createdAt ? <span>{formatNoticeTime(notice.createdAt)}</span> : null}
                    </div>
                    <p>{notice.message || meta.label}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
