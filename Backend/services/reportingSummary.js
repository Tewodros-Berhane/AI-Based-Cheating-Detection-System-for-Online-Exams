const integrityPolicy = require('./integrityPolicy');

const ACTION_LABELS = {
  NOTE: 'trainer note',
  WARN_CANDIDATE: 'warning',
  EXTEND_TIME: 'time extension',
  FORCE_SUBMIT: 'force submit',
  CONFIRM_EVENT: 'confirmed concern',
  EXCUSE_EVENT: 'excused alert',
  REOPEN_SESSION: 'reopened session',
  DISQUALIFY: 'disqualification'
};

const COMPLETION_LABELS = {
  SUBMITTED: 'Completed normally',
  TIMEOUT: 'Timed out',
  FORCED_BY_TRAINER: 'Force submitted by examiner',
  AUTO_TERMINATED: 'Ended after extended disconnect'
};

const pluralize = (count, singular, plural = `${singular}s`) => `${count} ${count === 1 ? singular : plural}`;

const uniquePush = (items, value) => {
  if (!value || items.includes(value)) {
    return;
  }
  items.push(value);
};

const normalizeDateValue = (value) => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const buildBaseIntegrityPolicy = (test) => {
  const basePolicy = integrityPolicy.resolveIntegrityPolicy(
    integrityPolicy.normalizeIntegrityMode(test && test.integrityMode),
    test && test.integrityPolicy ? test.integrityPolicy : {}
  );

  if (!Boolean(test && test.faceRecognitionEnabled)) {
    basePolicy.requireFaceVerification = false;
  }

  return basePolicy;
};

const buildSupportItems = ({ test, answerSheet }) => {
  if (!answerSheet) {
    return [];
  }

  const items = [];
  const baseDuration = Number((test && test.duration) || 0);
  const effectiveDuration = Number(answerSheet.effectiveDurationMinutes || baseDuration || 0);
  const grantedExtraTime = Number(answerSheet.grantedExtraTimeMinutes || 0);
  const derivedExtraTime = grantedExtraTime > 0 ? grantedExtraTime : Math.max(0, effectiveDuration - baseDuration);

  if (derivedExtraTime > 0) {
    uniquePush(items, `+${derivedExtraTime} min extra time`);
  }

  const ui = answerSheet.effectiveUiAdjustments || {};
  if (ui.highContrastMode) uniquePush(items, 'High contrast view');
  if (ui.largeTextMode) uniquePush(items, 'Large text');
  if (ui.screenReaderAllowed) uniquePush(items, 'Assistive reader allowed');

  const basePolicy = buildBaseIntegrityPolicy(test);
  const effectivePolicy = answerSheet.effectiveIntegrityPolicy || {};

  if (basePolicy.requireFaceVerification && effectivePolicy.requireFaceVerification === false) {
    uniquePush(items, 'Face verification skipped');
  }
  if (basePolicy.requireMicrophone && effectivePolicy.requireMicrophone === false) {
    uniquePush(items, 'Microphone check skipped');
  }
  if (basePolicy.requireScreenShare && effectivePolicy.requireScreenShare === false) {
    uniquePush(items, 'Screen sharing skipped');
  }
  if (basePolicy.requireFullscreen && effectivePolicy.requireFullscreen === false) {
    uniquePush(items, 'Full-screen lock skipped');
  }

  return items;
};

const buildSupportSummary = ({ test, answerSheet }) => {
  const items = buildSupportItems({ test, answerSheet });
  return {
    hasAdjustments: items.length > 0,
    items,
    summaryLine: items.length ? items.join(', ') : 'Standard session rules'
  };
};

const buildActionCounts = (actions = []) => actions.reduce((accumulator, action) => {
  const key = String(action && action.actionType ? action.actionType : 'UNKNOWN');
  accumulator[key] = Number(accumulator[key] || 0) + 1;
  return accumulator;
}, {});

const buildModerationSummaryLine = (actions = [], counts = {}) => {
  if (!actions.length) {
    return 'No trainer actions recorded';
  }

  const priorityOrder = ['DISQUALIFY', 'FORCE_SUBMIT', 'REOPEN_SESSION', 'CONFIRM_EVENT', 'EXCUSE_EVENT', 'WARN_CANDIDATE', 'EXTEND_TIME', 'NOTE'];
  const parts = priorityOrder
    .filter((key) => Number(counts[key] || 0) > 0)
    .map((key) => pluralize(Number(counts[key]), ACTION_LABELS[key] || key.toLowerCase()));

  return parts.join(', ');
};

const buildFinalDisposition = ({ answerSheet, actions = [] }) => {
  const counts = buildActionCounts(actions);
  const completionReason = String(answerSheet && answerSheet.completionReason ? answerSheet.completionReason : 'SUBMITTED');
  const moderationStatus = String(answerSheet && answerSheet.moderationStatus ? answerSheet.moderationStatus : 'NORMAL');

  if (counts.DISQUALIFY > 0 || moderationStatus === 'DISQUALIFIED') {
    return { label: 'Disqualified during review', tone: 'critical' };
  }

  if (counts.FORCE_SUBMIT > 0 || completionReason === 'FORCED_BY_TRAINER') {
    return { label: 'Force submitted by examiner', tone: 'critical' };
  }

  if (moderationStatus === 'UNDER_REVIEW' || counts.CONFIRM_EVENT > counts.EXCUSE_EVENT) {
    return { label: 'Under examiner review', tone: 'monitoring' };
  }

  if (moderationStatus === 'REOPENED' || counts.REOPEN_SESSION > 0) {
    return { label: 'Session reopened by examiner', tone: 'monitoring' };
  }

  if (completionReason === 'TIMEOUT') {
    return { label: COMPLETION_LABELS.TIMEOUT, tone: 'warning' };
  }

  if (completionReason === 'AUTO_TERMINATED') {
    return { label: COMPLETION_LABELS.AUTO_TERMINATED, tone: 'warning' };
  }

  if (counts.WARN_CANDIDATE > 0) {
    return { label: 'Completed after examiner warning', tone: 'warning' };
  }

  if (Number(counts.EXCUSE_EVENT || 0) > 0 && actions.length === (Number(counts.EXCUSE_EVENT || 0) + Number(counts.NOTE || 0))) {
    return { label: 'Alert reviewed and excused', tone: 'safe' };
  }

  if (actions.length > 0) {
    return { label: 'Completed with trainer review', tone: 'monitoring' };
  }

  return { label: COMPLETION_LABELS[completionReason] || 'Completed normally', tone: 'safe' };
};

const summarizeCandidateReporting = ({ test, answerSheet, actions = [] }) => {
  const sortedActions = [...actions].sort((left, right) => {
    const leftTime = normalizeDateValue(left && left.createdAt);
    const rightTime = normalizeDateValue(right && right.createdAt);
    return (rightTime ? rightTime.getTime() : 0) - (leftTime ? leftTime.getTime() : 0);
  });
  const counts = buildActionCounts(sortedActions);
  const lastAction = sortedActions[0] || null;
  const visibleNoticeCount = sortedActions.filter((item) => Boolean(item && item.visibleToCandidate)).length;
  const support = buildSupportSummary({ test, answerSheet });

  return {
    support,
    moderation: {
      actionCount: sortedActions.length,
      visibleNoticeCount,
      counts,
      lastActionAt: lastAction ? lastAction.createdAt || null : null,
      lastActionType: lastAction ? lastAction.actionType || '' : '',
      summaryLine: buildModerationSummaryLine(sortedActions, counts)
    },
    completionReason: answerSheet && answerSheet.completionReason ? answerSheet.completionReason : 'SUBMITTED',
    finalDisposition: buildFinalDisposition({ answerSheet, actions: sortedActions })
  };
};

module.exports = {
  buildSupportItems,
  buildSupportSummary,
  summarizeCandidateReporting
};
