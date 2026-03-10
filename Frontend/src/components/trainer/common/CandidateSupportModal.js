import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Input, Select, Switch, message } from 'antd-compat';
import { Accessibility, Clock3, FileWarning, Shield, SlidersHorizontal } from 'lucide-react';
import { SecurePost } from '../../../services/axiosCall';
import apis from '../../../services/Apis';
import AppModal from '../../common/AppModal';
import './candidate-support-modal.css';

const SUPPORT_TAB = 'support';
const ACTIONS_TAB = 'actions';

const ACTION_TYPE_OPTIONS = [
  { value: 'NOTE', label: 'Add note', availableInSupportPanel: true },
  { value: 'WARN_CANDIDATE', label: 'Send warning', availableInSupportPanel: true },
  { value: 'EXTEND_TIME', label: 'Add extra time', availableInSupportPanel: true, minutesLabel: 'Minutes to add', minMinutes: 1, defaultMinutes: 10 },
  { value: 'FORCE_SUBMIT', label: 'Force submit exam', availableInSupportPanel: true },
  { value: 'CONFIRM_EVENT', label: 'Confirm concern', availableInSupportPanel: false },
  { value: 'EXCUSE_EVENT', label: 'Excuse alert', availableInSupportPanel: false },
  { value: 'REOPEN_SESSION', label: 'Reopen session', availableInSupportPanel: true, minutesLabel: 'Extra minutes to add (optional)', minMinutes: 0, defaultMinutes: 0 },
  { value: 'DISQUALIFY', label: 'Disqualify result', availableInSupportPanel: true }
];

const DEFAULT_SUPPORT_FORM = {
  reason: '',
  notes: '',
  extraTimeMinutes: 0,
  effectiveFrom: '',
  effectiveUntil: '',
  customStartAt: '',
  customEndAt: '',
  highContrastMode: false,
  largeTextMode: false,
  screenReaderAllowed: false,
  faceVerificationExempt: false,
  microphoneExempt: false,
  screenShareExempt: false,
  fullscreenExempt: false
};

const DEFAULT_ACTION_FORM = {
  actionType: 'NOTE',
  reason: '',
  minutes: 10
};

const SUPPORT_TOGGLE_GROUPS = {
  accessibility: [
    { key: 'highContrastMode', label: 'High contrast view', help: 'Improve color contrast for readability.' },
    { key: 'largeTextMode', label: 'Larger text', help: 'Present larger interface text for this candidate.' },
    { key: 'screenReaderAllowed', label: 'Assistive reader allowed', help: 'Permit approved screen-reader use during the exam.' }
  ],
  integrity: [
    { key: 'faceVerificationExempt', label: 'Skip face verification', help: 'Do not require face comparison checks for this candidate.' },
    { key: 'microphoneExempt', label: 'Skip microphone check', help: 'Allow entry and participation without microphone access.' },
    { key: 'screenShareExempt', label: 'Skip screen sharing', help: 'Allow entry without sharing the screen when policy permits.' },
    { key: 'fullscreenExempt', label: 'Skip full-screen lock', help: 'Do not require this candidate to stay in full screen.' }
  ]
};

const formatDateTime = (value) => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleString();
};

const toInputDateTime = (value) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  const localTime = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000);
  return localTime.toISOString().slice(0, 16);
};

const toIsoDateTime = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

const toWholeMinutes = (value, fallback = 0) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.round(numeric));
};

const getCandidateStateLabel = (state) => {
  switch (String(state || '').toUpperCase()) {
    case 'BEFORE_START':
      return 'Before start';
    case 'IN_PROGRESS':
      return 'In progress';
    case 'FINISHED':
      return 'Finished';
    case 'PUBLISHED':
      return 'Result published';
    default:
      return 'Unknown';
  }
};

const ACTION_OPTIONS_BY_VALUE = ACTION_TYPE_OPTIONS.reduce((accumulator, item) => {
  accumulator[item.value] = item;
  return accumulator;
}, {});

const SUPPORT_PANEL_ACTIONS = ACTION_TYPE_OPTIONS.filter((item) => item.availableInSupportPanel);

const getActionLabel = (value) => {
  const match = ACTION_OPTIONS_BY_VALUE[value];
  return match ? match.label : value;
};

const getModerationStatusMeta = (status) => {
  switch (String(status || '').toUpperCase()) {
    case 'UNDER_REVIEW':
      return { label: 'Under review', tone: 'monitoring', summary: 'The session has at least one confirmed concern waiting for examiner review.' };
    case 'WARNED':
      return { label: 'Warning sent', tone: 'warning', summary: 'The candidate has been warned during this session.' };
    case 'FORCE_SUBMITTED':
      return { label: 'Force submitted', tone: 'critical', summary: 'The examiner ended this candidate session.' };
    case 'DISQUALIFIED':
      return { label: 'Disqualified', tone: 'critical', summary: 'The result is marked as disqualified pending reporting and export.' };
    case 'REOPENED':
      return { label: 'Reopened', tone: 'monitoring', summary: 'The session was reopened after an earlier finish state.' };
    default:
      return { label: 'Normal', tone: 'safe', summary: 'No active examiner review status is set on this session.' };
  }
};

const getSupportStatus = (profile) => {
  if (!profile) return { label: 'Not set', tone: 'idle' };
  const now = Date.now();
  const from = profile.effectiveFrom ? new Date(profile.effectiveFrom).getTime() : null;
  const until = profile.effectiveUntil ? new Date(profile.effectiveUntil).getTime() : null;

  if (from && from > now) {
    return { label: 'Scheduled', tone: 'monitoring' };
  }

  if (until && until <= now) {
    return { label: 'Expired', tone: 'warning' };
  }

  return { label: 'Active', tone: 'safe' };
};

const buildSupportHighlights = (resolved) => {
  if (!resolved) return ['Standard session rules apply.'];

  const highlights = [];
  const extraTime = Number(resolved.timeAdjustments && resolved.timeAdjustments.extraTimeMinutes) || 0;
  if (extraTime > 0) {
    highlights.push(`Extra time: +${extraTime} min`);
  }

  const ui = resolved.effectiveUiAdjustments || {};
  if (ui.highContrastMode) highlights.push('High contrast view');
  if (ui.largeTextMode) highlights.push('Large text');
  if (ui.screenReaderAllowed) highlights.push('Assistive reader allowed');

  const integrity = resolved.accommodationProfile && resolved.accommodationProfile.integrityOverrides
    ? resolved.accommodationProfile.integrityOverrides
    : {};
  if (integrity.faceVerificationExempt) highlights.push('Face verification skipped');
  if (integrity.microphoneExempt) highlights.push('Microphone check skipped');
  if (integrity.screenShareExempt) highlights.push('Screen sharing skipped');
  if (integrity.fullscreenExempt) highlights.push('Full-screen lock skipped');

  return highlights.length ? highlights : ['Standard session rules apply.'];
};

const summarizeActionPayload = (action) => {
  if (!action || !action.payload) return '';

  if (action.actionType === 'EXTEND_TIME' && Number(action.payload.minutes || 0) > 0) {
    return `Added ${action.payload.minutes} min. Total time is now ${action.payload.nextEffectiveDurationMinutes || '-'} min.`;
  }

  if (action.actionType === 'REOPEN_SESSION') {
    const minutes = Number(action.payload.minutes || 0);
    if (minutes > 0) {
      return `Session reopened with ${minutes} extra min. Total time is now ${action.payload.nextEffectiveDurationMinutes || '-'} min.`;
    }
    return 'Session reopened without changing the total exam time.';
  }

  if (action.actionType === 'FORCE_SUBMIT') {
    return 'Exam session was closed by the examiner.';
  }

  if (action.actionType === 'DISQUALIFY') {
    return 'The candidate result was marked as disqualified for reporting.';
  }

  if ((action.actionType === 'CONFIRM_EVENT' || action.actionType === 'EXCUSE_EVENT') && action.linkedEvent) {
    return `Related incident: ${action.linkedEvent.message || getActionLabel(action.linkedEvent.eventType)}`;
  }

  return '';
};

export default function CandidateSupportModal({ open, candidate, testId, onClose, onChanged }) {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(SUPPORT_TAB);
  const [supportForm, setSupportForm] = useState(DEFAULT_SUPPORT_FORM);
  const [supportData, setSupportData] = useState(null);
  const [supportSaving, setSupportSaving] = useState(false);
  const [supportRevoking, setSupportRevoking] = useState(false);
  const [actionForm, setActionForm] = useState(DEFAULT_ACTION_FORM);
  const [actionSaving, setActionSaving] = useState(false);
  const [moderationData, setModerationData] = useState(null);
  const supportReasonInputRef = useRef(null);

  const candidateId = candidate && candidate._id ? String(candidate._id) : '';
  const candidateName = candidate && candidate.name ? candidate.name : 'Candidate';

  const hydrateSupportForm = (resolved) => {
    const profile = resolved && resolved.accommodationProfile ? resolved.accommodationProfile : null;
    const uiAdjustments = profile && profile.uiAdjustments ? profile.uiAdjustments : {};
    const integrityOverrides = profile && profile.integrityOverrides ? profile.integrityOverrides : {};
    const timeAdjustments = profile && profile.timeAdjustments ? profile.timeAdjustments : {};

    setSupportForm({
      reason: profile && profile.reason ? profile.reason : '',
      notes: profile && profile.notes ? profile.notes : '',
      extraTimeMinutes: Number(timeAdjustments.extraTimeMinutes || 0),
      effectiveFrom: toInputDateTime(profile && profile.effectiveFrom),
      effectiveUntil: toInputDateTime(profile && profile.effectiveUntil),
      customStartAt: toInputDateTime(timeAdjustments.customStartAt),
      customEndAt: toInputDateTime(timeAdjustments.customEndAt),
      highContrastMode: Boolean(uiAdjustments.highContrastMode),
      largeTextMode: Boolean(uiAdjustments.largeTextMode),
      screenReaderAllowed: Boolean(uiAdjustments.screenReaderAllowed),
      faceVerificationExempt: Boolean(integrityOverrides.faceVerificationExempt),
      microphoneExempt: Boolean(integrityOverrides.microphoneExempt),
      screenShareExempt: Boolean(integrityOverrides.screenShareExempt),
      fullscreenExempt: Boolean(integrityOverrides.fullscreenExempt)
    });
  };

  const loadData = async () => {
    if (!open || !candidateId || !testId) return;

    setLoading(true);
    try {
      const [supportResponse, moderationResponse] = await Promise.all([
        SecurePost({
          url: apis.GET_CANDIDATE_ACCOMMODATION,
          data: { testid: testId, traineeid: candidateId }
        }),
        SecurePost({
          url: apis.GET_MODERATION_HISTORY,
          data: { testid: testId, traineeid: candidateId, limit: 25, page: 1 }
        })
      ]);

      if (!supportResponse.data || !supportResponse.data.success) {
        throw new Error((supportResponse.data && supportResponse.data.message) || 'Unable to load support settings.');
      }
      if (!moderationResponse.data || !moderationResponse.data.success) {
        throw new Error((moderationResponse.data && moderationResponse.data.message) || 'Unable to load examiner actions.');
      }

      setSupportData(supportResponse.data.data || null);
      hydrateSupportForm(supportResponse.data.data && supportResponse.data.data.resolved ? supportResponse.data.data.resolved : null);

      const moderationPayload = moderationResponse.data.data || {};
      setModerationData(moderationPayload);
      const allowedActionValues = Array.isArray(moderationPayload.availableActions) && moderationPayload.availableActions.length
        ? moderationPayload.availableActions
        : ['NOTE'];
      const supportActionValues = SUPPORT_PANEL_ACTIONS
        .map((item) => item.value)
        .filter((value) => allowedActionValues.includes(value));
      const fallbackAction = supportActionValues[0] || 'NOTE';
      setActionForm((prev) => ({
        ...prev,
        actionType: supportActionValues.includes(prev.actionType) ? prev.actionType : fallbackAction,
        reason: '',
        minutes: ACTION_OPTIONS_BY_VALUE[supportActionValues.includes(prev.actionType) ? prev.actionType : fallbackAction]?.defaultMinutes ?? prev.minutes
      }));
    } catch (error) {
      message.error((error && error.message) || 'Unable to load candidate support data.');
      setSupportData(null);
      setModerationData(null);
      setSupportForm(DEFAULT_SUPPORT_FORM);
      setActionForm(DEFAULT_ACTION_FORM);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, candidateId, testId]);

  const allowedActions = useMemo(() => {
    const availableActionValues = Array.isArray(moderationData && moderationData.availableActions)
      ? moderationData.availableActions
      : ['NOTE'];

    return SUPPORT_PANEL_ACTIONS.filter((item) => availableActionValues.includes(item.value));
  }, [moderationData]);

  const supportStatus = useMemo(() => getSupportStatus(supportData && supportData.resolved && supportData.resolved.accommodationProfile), [supportData]);
  const supportHighlights = useMemo(() => buildSupportHighlights(supportData && supportData.resolved), [supportData]);

  const onSupportFieldChange = (key, value) => {
    setSupportForm((prev) => ({ ...prev, [key]: value }));
  };

  const focusSupportReason = () => {
    const textareaNode = supportReasonInputRef.current && supportReasonInputRef.current.resizableTextArea
      ? supportReasonInputRef.current.resizableTextArea.textArea
      : null;
    const focusTarget = textareaNode
      || (supportReasonInputRef.current && supportReasonInputRef.current.input)
      || supportReasonInputRef.current;

    if (focusTarget && typeof focusTarget.scrollIntoView === 'function') {
      focusTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    if (supportReasonInputRef.current && typeof supportReasonInputRef.current.focus === 'function') {
      supportReasonInputRef.current.focus();
    }
  };

  const saveSupport = async () => {
    if (!supportForm.reason.trim()) {
      message.error('Add a short reason in the "Support plan reason" section before saving.');
      focusSupportReason();
      return;
    }

    setSupportSaving(true);
    try {
      const response = await SecurePost({
        url: apis.UPSERT_CANDIDATE_ACCOMMODATION,
        data: {
          testid: testId,
          traineeid: candidateId,
          reason: supportForm.reason.trim(),
          notes: supportForm.notes.trim(),
          extraTimeMinutes: toWholeMinutes(supportForm.extraTimeMinutes, 0),
          effectiveFrom: toIsoDateTime(supportForm.effectiveFrom),
          effectiveUntil: toIsoDateTime(supportForm.effectiveUntil),
          customStartAt: toIsoDateTime(supportForm.customStartAt),
          customEndAt: toIsoDateTime(supportForm.customEndAt),
          highContrastMode: supportForm.highContrastMode,
          largeTextMode: supportForm.largeTextMode,
          screenReaderAllowed: supportForm.screenReaderAllowed,
          faceVerificationExempt: supportForm.faceVerificationExempt,
          microphoneExempt: supportForm.microphoneExempt,
          screenShareExempt: supportForm.screenShareExempt,
          fullscreenExempt: supportForm.fullscreenExempt
        }
      });

      if (!response.data || !response.data.success) {
        throw new Error((response.data && response.data.message) || 'Unable to save support settings.');
      }

      message.success(response.data.message || 'Support settings saved.');
      await loadData();
      onChanged?.();
    } catch (error) {
      message.error((error && error.message) || 'Unable to save support settings.');
    } finally {
      setSupportSaving(false);
    }
  };

  const revokeSupport = async () => {
    if (!supportData || !supportData.resolved || !supportData.resolved.accommodationProfile) {
      return;
    }

    setSupportRevoking(true);
    try {
      const response = await SecurePost({
        url: apis.REVOKE_CANDIDATE_ACCOMMODATION,
        data: {
          testid: testId,
          traineeid: candidateId,
          reason: supportForm.reason.trim() || 'Support plan no longer required.'
        }
      });

      if (!response.data || !response.data.success) {
        throw new Error((response.data && response.data.message) || 'Unable to remove support settings.');
      }

      message.success(response.data.message || 'Support settings removed.');
      await loadData();
      onChanged?.();
    } catch (error) {
      message.error((error && error.message) || 'Unable to remove support settings.');
    } finally {
      setSupportRevoking(false);
    }
  };

  const submitAction = async () => {
    if (!actionForm.reason.trim()) {
      message.error('Please explain why this examiner action is being applied.');
      return;
    }

    const selectedActionMeta = ACTION_OPTIONS_BY_VALUE[actionForm.actionType] || null;
    if (actionForm.actionType === 'EXTEND_TIME' && toWholeMinutes(actionForm.minutes, 0) < 1) {
      message.error('Please enter valid extension minutes.');
      return;
    }

    if (actionForm.actionType === 'REOPEN_SESSION' && toWholeMinutes(actionForm.minutes, 0) < 0) {
      message.error('Please enter valid extra minutes for the reopened session.');
      return;
    }

    setActionSaving(true);
    try {
      const response = await SecurePost({
        url: apis.SUBMIT_MODERATION_ACTION,
        data: {
          testid: testId,
          traineeid: candidateId,
          actionType: actionForm.actionType,
          reason: actionForm.reason.trim(),
          payload: actionForm.actionType === 'EXTEND_TIME'
            ? { minutes: toWholeMinutes(actionForm.minutes, 10) }
            : (actionForm.actionType === 'REOPEN_SESSION'
              ? { minutes: toWholeMinutes(actionForm.minutes, 0) }
              : {})
        }
      });

      if (!response.data || !response.data.success) {
        throw new Error((response.data && response.data.message) || 'Unable to save examiner action.');
      }

      message.success(response.data.message || 'Examiner action saved.');
      setActionForm((prev) => ({
        ...prev,
        reason: '',
        minutes: selectedActionMeta && typeof selectedActionMeta.defaultMinutes === 'number'
          ? selectedActionMeta.defaultMinutes
          : prev.minutes
      }));
      await loadData();
      onChanged?.();
    } catch (error) {
      message.error((error && error.message) || 'Unable to save examiner action.');
    } finally {
      setActionSaving(false);
    }
  };

  const renderedHistory = moderationData && Array.isArray(moderationData.items) ? moderationData.items : [];
  const resolved = supportData && supportData.resolved ? supportData.resolved : null;
  const currentDuration = resolved ? Number(resolved.effectiveDurationMinutes || 0) : 0;
  const baseDuration = resolved ? Number(resolved.baseDurationMinutes || 0) : 0;
  const moderationStatus = moderationData && moderationData.answerSheet ? moderationData.answerSheet.moderationStatus : 'NORMAL';
  const moderationStatusMeta = getModerationStatusMeta(moderationStatus);
  const lastModerationAt = moderationData && moderationData.answerSheet ? moderationData.answerSheet.lastModerationActionAt : null;
  const selectedActionMeta = ACTION_OPTIONS_BY_VALUE[actionForm.actionType] || ACTION_OPTIONS_BY_VALUE.NOTE;

  return (
    <AppModal
      open={open}
      onClose={onClose}
      width={980}
      title="Candidate support and review"
      subtitle={`${candidateName}${candidate && candidate.emailid ? `  |  ${candidate.emailid}` : ''}`}
    >
      <div className="candidate-support-shell">
        <div className="candidate-support-summary-grid">
          <article className="candidate-support-summary-card">
            <span className="candidate-support-summary-label">Support plan</span>
            <div className={`candidate-support-status ${supportStatus.tone}`}>{supportStatus.label}</div>
            <p>{supportHighlights[0]}</p>
          </article>
          <article className="candidate-support-summary-card">
            <span className="candidate-support-summary-label">Exam time</span>
            <strong>{currentDuration || baseDuration || 0} min</strong>
            <p>{baseDuration === currentDuration ? 'No time adjustment applied.' : `Base time ${baseDuration} min.`}</p>
          </article>
          <article className="candidate-support-summary-card">
            <span className="candidate-support-summary-label">Exam progress</span>
            <strong>{getCandidateStateLabel(moderationData && moderationData.candidateState)}</strong>
            <div className={`candidate-support-status ${moderationStatusMeta.tone}`}>{moderationStatusMeta.label}</div>
            <p>{moderationStatusMeta.summary}</p>
          </article>
        </div>

        <div className="candidate-support-tabs">
          <button
            type="button"
            className={`candidate-support-tab ${activeTab === SUPPORT_TAB ? 'active' : ''}`}
            onClick={() => setActiveTab(SUPPORT_TAB)}
          >
            <SlidersHorizontal size={15} strokeWidth={2.3} />
            Support settings
          </button>
          <button
            type="button"
            className={`candidate-support-tab ${activeTab === ACTIONS_TAB ? 'active' : ''}`}
            onClick={() => setActiveTab(ACTIONS_TAB)}
          >
            <FileWarning size={15} strokeWidth={2.3} />
            Examiner actions
          </button>
        </div>

        {loading ? (
          <div className="candidate-support-loading">Loading candidate details...</div>
        ) : activeTab === SUPPORT_TAB ? (
          <div className="candidate-support-panel">
            <section className="candidate-support-card">
              <div className="candidate-support-card-head">
                <SlidersHorizontal size={16} strokeWidth={2.2} />
                <div>
                  <h4>Support plan reason</h4>
                  <p>State why this candidate needs these adjustments. This is required and becomes part of the audit trail.</p>
                </div>
              </div>
              <div className="candidate-support-form-grid">
                <label className="candidate-support-field candidate-support-field-wide">
                  <span>Reason (required)</span>
                  <Input.TextArea
                    ref={supportReasonInputRef}
                    rows={3}
                    value={supportForm.reason}
                    onChange={(event) => onSupportFieldChange('reason', event.target.value)}
                    placeholder="Example: approved exception for full-screen lock due to an accessibility accommodation"
                  />
                </label>
              </div>
            </section>

            <div className="candidate-support-panel-grid">
              <section className="candidate-support-card">
                <div className="candidate-support-card-head">
                  <Clock3 size={16} strokeWidth={2.2} />
                  <div>
                    <h4>Time and scheduling</h4>
                    <p>Use this section when a candidate needs more time or a custom exam window.</p>
                  </div>
                </div>
                <div className="candidate-support-form-grid">
                  <label className="candidate-support-field">
                    <span>Extra time (minutes)</span>
                    <Input
                      type="number"
                      min={0}
                      value={supportForm.extraTimeMinutes}
                      onChange={(event) => onSupportFieldChange('extraTimeMinutes', event.target.value)}
                      placeholder="0"
                    />
                  </label>
                  <label className="candidate-support-field">
                    <span>Start from</span>
                    <input
                      className="candidate-support-native-input"
                      type="datetime-local"
                      value={supportForm.effectiveFrom}
                      onChange={(event) => onSupportFieldChange('effectiveFrom', event.target.value)}
                    />
                  </label>
                  <label className="candidate-support-field">
                    <span>End at</span>
                    <input
                      className="candidate-support-native-input"
                      type="datetime-local"
                      value={supportForm.effectiveUntil}
                      onChange={(event) => onSupportFieldChange('effectiveUntil', event.target.value)}
                    />
                  </label>
                  <label className="candidate-support-field">
                    <span>Custom session start</span>
                    <input
                      className="candidate-support-native-input"
                      type="datetime-local"
                      value={supportForm.customStartAt}
                      onChange={(event) => onSupportFieldChange('customStartAt', event.target.value)}
                    />
                  </label>
                  <label className="candidate-support-field">
                    <span>Custom session end</span>
                    <input
                      className="candidate-support-native-input"
                      type="datetime-local"
                      value={supportForm.customEndAt}
                      onChange={(event) => onSupportFieldChange('customEndAt', event.target.value)}
                    />
                  </label>
                  <label className="candidate-support-field candidate-support-field-wide">
                    <span>Notes</span>
                    <Input.TextArea
                      rows={4}
                      value={supportForm.notes}
                      onChange={(event) => onSupportFieldChange('notes', event.target.value)}
                      placeholder="Add any examiner notes or approval references for this support plan."
                    />
                  </label>
                </div>
              </section>

              <section className="candidate-support-card">
                <div className="candidate-support-card-head">
                  <Accessibility size={16} strokeWidth={2.2} />
                  <div>
                    <h4>Accessibility options</h4>
                    <p>Turn on interface adjustments that help the candidate complete the exam.</p>
                  </div>
                </div>
                <div className="candidate-support-toggle-list">
                  {SUPPORT_TOGGLE_GROUPS.accessibility.map((item) => (
                    <div className="candidate-support-toggle-row" key={item.key}>
                      <div>
                        <strong>{item.label}</strong>
                        <span>{item.help}</span>
                      </div>
                      <Switch
                        checked={Boolean(supportForm[item.key])}
                        onChange={(checked) => onSupportFieldChange(item.key, checked)}
                      />
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <section className="candidate-support-card">
              <div className="candidate-support-card-head">
                <Shield size={16} strokeWidth={2.2} />
                <div>
                  <h4>Monitoring exceptions</h4>
                  <p>Only use these when a candidate has an approved exception to the standard exam checks.</p>
                </div>
              </div>
              <div className="candidate-support-toggle-list candidate-support-toggle-list-grid">
                {SUPPORT_TOGGLE_GROUPS.integrity.map((item) => (
                  <div className="candidate-support-toggle-row" key={item.key}>
                    <div>
                      <strong>{item.label}</strong>
                      <span>{item.help}</span>
                    </div>
                    <Switch
                      checked={Boolean(supportForm[item.key])}
                      onChange={(checked) => onSupportFieldChange(item.key, checked)}
                    />
                  </div>
                ))}
              </div>
            </section>

            <div className="candidate-support-actions-row">
              <span className="candidate-support-required-note">Reason is required before support settings can be saved.</span>
              <Button
                className="candidate-support-primary-btn"
                loading={supportSaving}
                onClick={saveSupport}
              >
                Save support settings
              </Button>
              <Button
                className="candidate-support-secondary-btn"
                disabled={!resolved || !resolved.accommodationProfile}
                loading={supportRevoking}
                onClick={revokeSupport}
              >
                Remove support plan
              </Button>
            </div>
          </div>
        ) : (
          <div className="candidate-support-panel">
            <section className="candidate-support-card">
              <div className="candidate-support-card-head">
                <FileWarning size={16} strokeWidth={2.2} />
                <div>
                  <h4>Apply examiner action</h4>
                  <p>Use this panel for session-level decisions. Confirming or excusing a specific alert is handled from the behavior audit timeline.</p>
                </div>
              </div>
              <div className="candidate-support-form-grid candidate-support-moderation-grid">
                <label className="candidate-support-field">
                  <span>Action</span>
                  <Select
                    value={actionForm.actionType}
                    onChange={(value) => setActionForm((prev) => ({
                      ...prev,
                      actionType: value,
                      minutes: typeof ACTION_OPTIONS_BY_VALUE[value]?.defaultMinutes === 'number'
                        ? ACTION_OPTIONS_BY_VALUE[value].defaultMinutes
                        : prev.minutes
                    }))}
                    className="candidate-support-select"
                    dropdownClassName="proctor-filter-dropdown"
                    getPopupContainer={(triggerNode) => (triggerNode && triggerNode.ownerDocument ? triggerNode.ownerDocument.body : document.body)}
                  >
                    {allowedActions.map((item) => (
                      <Select.Option key={item.value} value={item.value}>
                        {item.label}
                      </Select.Option>
                    ))}
                  </Select>
                </label>
                {selectedActionMeta && typeof selectedActionMeta.defaultMinutes === 'number' ? (
                  <label className="candidate-support-field">
                    <span>{selectedActionMeta.minutesLabel || 'Minutes'}</span>
                    <Input
                      type="number"
                      min={selectedActionMeta.minMinutes ?? 0}
                      value={actionForm.minutes}
                      onChange={(event) => setActionForm((prev) => ({ ...prev, minutes: event.target.value }))}
                    />
                  </label>
                ) : null}
                <label className="candidate-support-field candidate-support-field-wide">
                  <span>Reason (required)</span>
                  <Input.TextArea
                    rows={4}
                    value={actionForm.reason}
                    onChange={(event) => setActionForm((prev) => ({ ...prev, reason: event.target.value }))}
                    placeholder="Explain why this action is needed. This note becomes part of the audit trail."
                  />
                </label>
              </div>
              <div className="candidate-support-actions-row">
                <Button
                  className="candidate-support-primary-btn"
                  loading={actionSaving}
                  onClick={submitAction}
                >
                  Save examiner action
                </Button>
              </div>
            </section>

            <section className="candidate-support-card">
              <div className="candidate-support-card-head">
                <FileWarning size={16} strokeWidth={2.2} />
                <div>
                  <h4>Action history</h4>
                  <p>Review what was applied to this candidate and when it happened.</p>
                </div>
              </div>
              {renderedHistory.length === 0 ? (
                <div className="candidate-support-empty">No examiner actions have been recorded for this candidate.</div>
              ) : (
                <div className="candidate-support-history-list">
                  {renderedHistory.map((item) => (
                    <article className="candidate-support-history-card" key={item.id}>
                      <div className="candidate-support-history-top">
                        <div>
                          <strong>{getActionLabel(item.actionType)}</strong>
                          <span>{formatDateTime(item.createdAt)}</span>
                        </div>
                        <div className={`candidate-support-status ${item.visibleToCandidate ? 'safe' : 'idle'}`}>
                          {item.visibleToCandidate ? 'Visible to candidate' : 'Internal note'}
                        </div>
                      </div>
                      <p>{item.reason}</p>
                      {item.linkedEvent ? (
                        <div className="candidate-support-linked-event">
                          <span>Related incident</span>
                          <strong>{item.linkedEvent.message || getActionLabel(item.linkedEvent.eventType)}</strong>
                        </div>
                      ) : null}
                      {summarizeActionPayload(item) ? <small>{summarizeActionPayload(item)}</small> : null}
                    </article>
                  ))}
                </div>
              )}

              <div className="candidate-support-history-meta">
                <span>Current session state: {getCandidateStateLabel(moderationData && moderationData.candidateState)}</span>
                <span>Last examiner update: {formatDateTime(lastModerationAt)}</span>
              </div>
            </section>
          </div>
        )}
      </div>
    </AppModal>
  );
}




