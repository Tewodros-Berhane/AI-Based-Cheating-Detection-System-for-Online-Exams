import React, { useEffect, useMemo, useState } from 'react';
import { Button, Empty, Select, Spin, message } from 'antd-compat';
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
  TRAINER_ESCALATE: 'Escalated by examiner'
};

const SOURCE_LABELS = {
  AI: 'AI detection',
  FACE: 'Face verification',
  SYSTEM: 'System',
  TRAINER: 'Examiner action'
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
  return item.message || 'Monitoring event recorded.';
};

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
  const [items, setItems] = useState([]);
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
      const response = await SecurePost({
        url: apis.GET_PROCTOR_EVENTS,
        data: {
          testid: testId,
          traineeid: candidateId,
          severity: filters.severity || undefined,
          eventType: filters.eventType || undefined,
          from: showTimeFilter ? timeWindowToFromDate(filters.window) : undefined,
          limit: 50
        }
      });

      if (!response.data || !response.data.success) {
        throw new Error((response.data && response.data.message) || 'Unable to load event timeline.');
      }

      const nextItems = response.data.data && Array.isArray(response.data.data.items)
        ? response.data.data.items
        : [];
      setItems(nextItems);
    } catch (error) {
      message.error((error && error.message) || 'Unable to load event timeline.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, candidateId, testId, filters.severity, filters.eventType, filters.window, showTimeFilter]);

  const eventTypeOptions = useMemo(() => (
    Object.keys(EVENT_LABELS).map((key) => ({
      label: EVENT_LABELS[key],
      value: key
    }))
  ), []);

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

  return (
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
            {items.map((item) => (
              <article className="proctor-timeline-card" key={item.eventId}>
                <div className="proctor-timeline-card-top">
                  <div className="proctor-timeline-card-head">
                    <h4>{getEventTitle(item)}</h4>
                    <span>{formatDateTime(item.createdAt)}</span>
                  </div>
                  <SeverityBadge state={item.severityLevel} score={item.severityScore} />
                </div>

                <p className="proctor-timeline-card-message">{getEventMessage(item)}</p>

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

                {item.eventType !== 'TRAINER_ACK' ? (
                  <div className="proctor-timeline-card-actions">
                    <Button
                      className="proctor-ack-btn"
                      disabled={item.acked}
                      loading={ackLoadingId === item.eventId}
                      onClick={() => acknowledgeEvent(item.eventId)}
                    >
                      {item.acked ? 'Acknowledged' : 'Acknowledge'}
                    </Button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </div>
    </AppModal>
  );
}
