import React, { useEffect, useMemo, useState } from 'react';
import { Button, Empty, Input, Select, Spin, message } from 'antd-compat';
import { SecurePost } from '../../../services/axiosCall';
import apis from '../../../services/Apis';
import AppModal from '../../common/AppModal';
import SeverityBadge from './SeverityBadge';

const EVENT_LABELS = {
  AI_SUSPICIOUS: 'Suspicious behavior',
  AI_CHEATING: 'Cheating signal',
  AI_NORMAL: 'Monitoring active',
  NO_FACE: 'No face detected',
  MULTI_FACE: 'Multiple faces detected',
  FACE_MISMATCH: 'Face mismatch',
  LOOKING_AWAY: 'Looking away',
  AUDIO_SUSPICIOUS: 'Suspicious audio',
  AUDIO_MULTIPLE_VOICES: 'Multiple voices detected',
  EXAM_STARTED: 'Exam started',
  EXAM_FINISHED: 'Exam finished',
  NETWORK_DROP: 'Connection interruption',
  RECONNECTED: 'Connection restored',
  FULLSCREEN_EXIT: 'Fullscreen exited',
  TAB_SWITCH: 'Exam view changed',
  TRAINER_ACK: 'Acknowledged by examiner',
  TRAINER_ESCALATE: 'Escalated by examiner',
  TRAINER_NOTE: 'Examiner note added',
  TRAINER_WARNING: 'Warning sent by examiner',
  TRAINER_TIME_EXTENSION: 'Extra time granted',
  TRAINER_FORCE_SUBMIT: 'Session force submitted',
  TRAINER_CONCERN_CONFIRMED: 'Concern confirmed for review',
  TRAINER_ALERT_EXCUSED: 'Alert excused by examiner',
  TRAINER_SESSION_REOPENED: 'Session reopened',
  TRAINER_RESULT_DISQUALIFIED: 'Result disqualified'
};

const SOURCE_LABELS = {
  AI: 'AI detection',
  FACE: 'Face verification',
  SYSTEM: 'System',
  TRAINER: 'Examiner action'
};

const REVIEWABLE_EVENT_TYPES = new Set([
  'AI_SUSPICIOUS',
  'AI_CHEATING',
  'NO_FACE',
  'MULTI_FACE',
  'FACE_MISMATCH',
  'LOOKING_AWAY',
  'AUDIO_SUSPICIOUS',
  'AUDIO_MULTIPLE_VOICES',
  'NETWORK_DROP',
  'FULLSCREEN_EXIT',
  'TAB_SWITCH'
]);

const REVIEW_ACTION_COPY = {
  CONFIRM_EVENT: {
    title: 'Confirm concern',
    actionLabel: 'Confirm concern',
    helperText: 'Record that this incident needs examiner review and should count against the candidate.'
  },
  EXCUSE_EVENT: {
    title: 'Excuse alert',
    actionLabel: 'Excuse alert',
    helperText: 'Record that this incident was reviewed and should not count against the candidate.'
  }
};

const RESOLUTION_META = {
  UNRESOLVED: {
    label: 'Open incident',
    tone: 'open',
    summary: 'This incident has not been reviewed with a final outcome yet.'
  },
  CONFIRMED: {
    label: 'Confirmed for review',
    tone: 'confirmed',
    summary: 'This incident was confirmed by the examiner and is counted in the review trail.'
  },
  EXCUSED: {
    label: 'Excused',
    tone: 'excused',
    summary: 'This incident was reviewed and marked as excused by the examiner.'
  }
};

const timeWindowToFromDate = (windowKey) => {
  if (windowKey === 'full') return null;
  const minutes = Number(windowKey);
  if (!minutes) return null;
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
};

const formatDateTime = (value) => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleString();
};

const getEventLabel = (item) => {
  if (!item) return 'Monitoring event';
  if (item.relatedEvent && item.relatedEvent.eventType) {
    return EVENT_LABELS[item.relatedEvent.eventType] || item.relatedEvent.message || 'Monitoring event';
  }
  return EVENT_LABELS[item.eventType] || item.message || 'Monitoring event';
};

const getEventTitle = (item) => {
  if (!item) return 'Monitoring event';
  if (item.eventType === 'TRAINER_ACK') {
    return `Acknowledged: ${getEventLabel(item)}`;
  }
  if (item.eventType === 'TRAINER_ESCALATE') {
    return `Escalated: ${getEventLabel(item)}`;
  }
  return EVENT_LABELS[item.eventType] || item.message || 'Monitoring event';
};

const getEventMessage = (item) => {
  if (!item) return 'Monitoring event recorded.';

  if (item.eventType === 'TRAINER_ACK') {
    const relatedMessage = item.relatedEvent && item.relatedEvent.message
      ? item.relatedEvent.message
      : '';
    if (relatedMessage) {
      return `The examiner reviewed this incident: ${relatedMessage}`;
    }
    return `The examiner reviewed this incident: ${getEventLabel(item)}.`;
  }

  if (item.eventType === 'TRAINER_ESCALATE') {
    const target = item.payload && item.payload.targetSeverityLevel
      ? String(item.payload.targetSeverityLevel).replace('_', ' ').toLowerCase()
      : 'higher review';
    return item.message || `The examiner escalated this incident to ${target}.`;
  }

  if (item.eventType === 'TRAINER_CONCERN_CONFIRMED') {
    return item.message || 'The examiner confirmed this incident for formal review.';
  }

  if (item.eventType === 'TRAINER_ALERT_EXCUSED') {
    return item.message || 'The examiner reviewed this incident and marked it as excused.';
  }

  if (item.eventType === 'TRAINER_RESULT_DISQUALIFIED') {
    return item.message || 'The examiner marked this result as disqualified.';
  }

  return item.message || 'Monitoring event recorded.';
};

const getResolutionMeta = (item) => {
  if (!item || !REVIEWABLE_EVENT_TYPES.has(String(item.eventType || '').toUpperCase())) {
    return null;
  }
  return RESOLUTION_META[item.resolutionStatus] || RESOLUTION_META.UNRESOLVED;
};

const buildResolutionSummary = (item) => {
  const meta = getResolutionMeta(item);
  if (!meta) {
    return null;
  }

  if (item.resolutionStatus === 'CONFIRMED') {
    return item.resolutionReason
      ? `Confirmed: ${item.resolutionReason}`
      : 'Confirmed for examiner review.';
  }

  if (item.resolutionStatus === 'EXCUSED') {
    return item.resolutionReason
      ? `Excused: ${item.resolutionReason}`
      : 'Excused by the examiner.';
  }

  return meta.summary;
};

const canAcknowledgeEvent = (item) => Boolean(item) && item.eventType !== 'TRAINER_ACK' && item.source !== 'TRAINER';

export default function ProctorTimelineModal({
  open,
  candidate,
  testId,
  onClose,
  onChanged,
  showTimeFilter = true
}) {
  const [loading, setLoading] = useState(false);
  const [ackLoadingId, setAckLoadingId] = useState(null);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [items, setItems] = useState([]);
  const [availableActions, setAvailableActions] = useState([]);
  const [reviewAction, setReviewAction] = useState(null);
  const [reviewReason, setReviewReason] = useState('');
  const [filters, setFilters] = useState({
    severity: '',
    eventType: '',
    window: '30'
  });

  const candidateId = candidate && candidate._id ? candidate._id : null;

  const popupContainer = (triggerNode) => {
    if (triggerNode && triggerNode.ownerDocument && triggerNode.ownerDocument.body) {
      return triggerNode.ownerDocument.body;
    }
    return document.body;
  };

  const fetchEvents = async () => {
    if (!open || !candidateId || !testId) return;

    setLoading(true);
    try {
      const [eventsResponse, moderationResponse] = await Promise.all([
        SecurePost({
          url: apis.GET_PROCTOR_EVENTS,
          data: {
            testid: testId,
            traineeid: candidateId,
            severity: filters.severity || undefined,
            eventType: filters.eventType || undefined,
            from: showTimeFilter ? timeWindowToFromDate(filters.window) : undefined,
            limit: 50
          }
        }),
        SecurePost({
          url: apis.GET_MODERATION_HISTORY,
          data: {
            testid: testId,
            traineeid: candidateId,
            limit: 1,
            page: 1
          }
        })
      ]);

      if (!eventsResponse.data || !eventsResponse.data.success) {
        throw new Error((eventsResponse.data && eventsResponse.data.message) || 'Unable to load event timeline.');
      }

      const nextItems = eventsResponse.data.data && Array.isArray(eventsResponse.data.data.items)
        ? eventsResponse.data.data.items
        : [];
      setItems(nextItems);

      if (moderationResponse.data && moderationResponse.data.success) {
        const nextActions = moderationResponse.data.data && Array.isArray(moderationResponse.data.data.availableActions)
          ? moderationResponse.data.data.availableActions
          : [];
        setAvailableActions(nextActions);
      } else {
        setAvailableActions([]);
      }
    } catch (error) {
      message.error((error && error.message) || 'Unable to load event timeline.');
      setItems([]);
      setAvailableActions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, candidateId, testId, filters.severity, filters.eventType, filters.window, showTimeFilter]);

  useEffect(() => {
    if (!open) {
      setReviewAction(null);
      setReviewReason('');
    }
  }, [open]);

  const eventTypeOptions = useMemo(() => (
    Object.keys(EVENT_LABELS).map((key) => ({
      label: EVENT_LABELS[key],
      value: key
    }))
  ), []);

  const canApplyReviewAction = (item, actionType) => {
    if (!item || !REVIEWABLE_EVENT_TYPES.has(String(item.eventType || '').toUpperCase())) {
      return false;
    }

    if (!availableActions.includes(actionType)) {
      return false;
    }

    if (actionType === 'CONFIRM_EVENT' && item.resolutionStatus === 'CONFIRMED') {
      return false;
    }

    if (actionType === 'EXCUSE_EVENT' && item.resolutionStatus === 'EXCUSED') {
      return false;
    }

    return true;
  };

  const openReviewAction = (item, actionType) => {
    setReviewAction({ item, actionType });
    setReviewReason('');
  };

  const closeReviewAction = () => {
    setReviewAction(null);
    setReviewReason('');
  };

  const acknowledgeEvent = async (eventId) => {
    if (!eventId) return;

    setAckLoadingId(eventId);
    try {
      const response = await SecurePost({
        url: apis.ACK_PROCTOR_EVENT,
        data: {
          eventId
        }
      });

      if (!response.data || !response.data.success) {
        throw new Error((response.data && response.data.message) || 'Unable to acknowledge event.');
      }

      message.success('Event acknowledged.');
      await fetchEvents();
      if (typeof onChanged === 'function') {
        onChanged();
      }
    } catch (error) {
      message.error((error && error.message) || 'Unable to acknowledge event.');
    } finally {
      setAckLoadingId(null);
    }
  };

  const submitReviewAction = async () => {
    if (!reviewAction || !reviewAction.item) {
      return;
    }

    if (!reviewReason.trim()) {
      message.error('Please add a short reason for this review decision.');
      return;
    }

    setReviewSubmitting(true);
    try {
      const response = await SecurePost({
        url: apis.SUBMIT_MODERATION_ACTION,
        data: {
          testid: testId,
          traineeid: candidateId,
          actionType: reviewAction.actionType,
          reason: reviewReason.trim(),
          linkedEventId: reviewAction.item.id,
          payload: {}
        }
      });

      if (!response.data || !response.data.success) {
        throw new Error((response.data && response.data.message) || 'Unable to save review decision.');
      }

      message.success(response.data.message || 'Review decision saved.');
      closeReviewAction();
      await fetchEvents();
      if (typeof onChanged === 'function') {
        onChanged();
      }
    } catch (error) {
      message.error((error && error.message) || 'Unable to save review decision.');
    } finally {
      setReviewSubmitting(false);
    }
  };

  const reviewActionCopy = reviewAction ? REVIEW_ACTION_COPY[reviewAction.actionType] : null;

  return (
    <>
      <AppModal
        open={open}
        onClose={onClose}
        width={860}
        title="Proctor Timeline"
        subtitle={
          candidate
            ? `${candidate.name || 'Candidate'}${candidate.emailid ? `  |  ${candidate.emailid}` : ''}`
            : 'Candidate monitoring history'
        }
      >
        <div className="proctor-timeline-shell">
          <div className="proctor-timeline-filters">
            {showTimeFilter ? (
              <Select
                className="proctor-filter-select"
                value={filters.window}
                onChange={(value) => setFilters((prev) => ({ ...prev, window: value }))}
                dropdownClassName="proctor-filter-dropdown"
                getPopupContainer={popupContainer}
              >
                <Select.Option value="5">Last 5 min</Select.Option>
                <Select.Option value="15">Last 15 min</Select.Option>
                <Select.Option value="30">Last 30 min</Select.Option>
                <Select.Option value="full">Full session</Select.Option>
              </Select>
            ) : null}

            <Select
              className="proctor-filter-select"
              value={filters.severity}
              onChange={(value) => setFilters((prev) => ({ ...prev, severity: value }))}
              dropdownClassName="proctor-filter-dropdown"
              getPopupContainer={popupContainer}
            >
              <Select.Option value="">All severities</Select.Option>
              <Select.Option value="NORMAL">Normal</Select.Option>
              <Select.Option value="SUSPICIOUS">Suspicious</Select.Option>
              <Select.Option value="HIGH_RISK">High Risk</Select.Option>
              <Select.Option value="CHEATING">Cheating</Select.Option>
              <Select.Option value="FINISHED">Finished</Select.Option>
            </Select>

            <Select
              className="proctor-filter-select"
              value={filters.eventType}
              onChange={(value) => setFilters((prev) => ({ ...prev, eventType: value }))}
              dropdownClassName="proctor-filter-dropdown"
              getPopupContainer={popupContainer}
            >
              <Select.Option value="">All event types</Select.Option>
              {eventTypeOptions.map((option) => (
                <Select.Option key={option.value} value={option.value}>
                  {option.label}
                </Select.Option>
              ))}
            </Select>
          </div>

          {loading ? (
            <div className="proctor-timeline-loading">
              <Spin />
            </div>
          ) : items.length === 0 ? (
            <div className="proctor-timeline-empty">
              <Empty description="No proctor events matched the current filters." />
            </div>
          ) : (
            <div className="proctor-timeline-list">
              {items.map((item) => {
                const resolutionMeta = getResolutionMeta(item);
                const canConfirm = canApplyReviewAction(item, 'CONFIRM_EVENT');
                const canExcuse = canApplyReviewAction(item, 'EXCUSE_EVENT');
                return (
                  <article className="proctor-timeline-card" key={item.eventId}>
                    <div className="proctor-timeline-card-top">
                      <div className="proctor-timeline-card-head">
                        <h4>{getEventTitle(item)}</h4>
                        <span>{formatDateTime(item.createdAt)}</span>
                      </div>
                      <SeverityBadge state={item.severityLevel} score={item.severityScore} />
                    </div>

                    <p className="proctor-timeline-card-message">{getEventMessage(item)}</p>

                    {resolutionMeta ? (
                      <div className="proctor-timeline-resolution">
                        <div className={`proctor-resolution-pill ${resolutionMeta.tone}`}>{resolutionMeta.label}</div>
                        <div className="proctor-timeline-resolution-copy">
                          <span>{buildResolutionSummary(item)}</span>
                          {item.resolvedAt ? <small>Updated {formatDateTime(item.resolvedAt)}</small> : null}
                        </div>
                      </div>
                    ) : null}

                    {item.relatedEvent ? (
                      <div className="proctor-timeline-related">
                        <span className="proctor-timeline-related-label">Related incident</span>
                        <span className="proctor-timeline-related-value">
                          {EVENT_LABELS[item.relatedEvent.eventType] || item.relatedEvent.message || 'Monitoring event'}
                        </span>
                        <span className="proctor-timeline-related-time">
                          {formatDateTime(item.relatedEvent.createdAt)}
                        </span>
                      </div>
                    ) : null}

                    <div className="proctor-timeline-card-meta">
                      <span>{SOURCE_LABELS[item.source] || item.source}</span>
                      <span>Confidence {Math.round((Number(item.confidence || 0)) * 100)}%</span>
                      <span>{item.acked ? 'Acknowledged' : 'Unacknowledged'}</span>
                      {item.ackedAt ? <span>Reviewed {formatDateTime(item.ackedAt)}</span> : null}
                    </div>

                    {(canAcknowledgeEvent(item) || canConfirm || canExcuse) ? (
                      <div className="proctor-timeline-card-actions">
                        {canAcknowledgeEvent(item) ? (
                          <Button
                            className="proctor-ack-btn"
                            disabled={item.acked}
                            loading={ackLoadingId === item.eventId}
                            onClick={() => acknowledgeEvent(item.eventId)}
                          >
                            {item.acked ? 'Acknowledged' : 'Acknowledge'}
                          </Button>
                        ) : null}

                        {canConfirm ? (
                          <Button
                            className="proctor-review-btn confirm"
                            onClick={() => openReviewAction(item, 'CONFIRM_EVENT')}
                          >
                            Confirm concern
                          </Button>
                        ) : null}

                        {canExcuse ? (
                          <Button
                            className="proctor-review-btn excuse"
                            onClick={() => openReviewAction(item, 'EXCUSE_EVENT')}
                          >
                            Excuse alert
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </AppModal>

      <AppModal
        open={Boolean(reviewAction)}
        onClose={closeReviewAction}
        width={560}
        title={reviewActionCopy ? reviewActionCopy.title : 'Review incident'}
        subtitle={reviewAction ? getEventTitle(reviewAction.item) : 'Add your review note'}
      >
        <div className="proctor-review-modal">
          <p className="proctor-review-modal-copy">
            {reviewActionCopy ? reviewActionCopy.helperText : 'Add a review note for this incident.'}
          </p>
          <Input.TextArea
            value={reviewReason}
            onChange={(event) => setReviewReason(event.target.value)}
            autoSize={{ minRows: 4, maxRows: 6 }}
            placeholder="Explain why this incident should be confirmed or excused"
          />
          <div className="proctor-review-modal-actions">
            <Button className="proctor-review-cancel-btn" onClick={closeReviewAction} disabled={reviewSubmitting}>
              Cancel
            </Button>
            <Button className="proctor-review-submit-btn" onClick={submitReviewAction} loading={reviewSubmitting}>
              {reviewActionCopy ? reviewActionCopy.actionLabel : 'Save review'}
            </Button>
          </div>
        </div>
      </AppModal>
    </>
  );
}
