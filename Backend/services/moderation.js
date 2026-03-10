const mongoose = require('mongoose');
const ModerationActionModel = require('../models/moderationAction');
const TestPaperModel = require('../models/testpaper');
const TraineeEnterModel = require('../models/trainee');
const AnswersheetModel = require('../models/answersheet');
const ProctorEventModel = require('../models/proctorEvent');
const logger = require('./logger');
const proctorTimeline = require('./proctorTimeline');
const sessionResilience = require('./sessionResilience');

const ACTION_TYPES = {
  NOTE: 'NOTE',
  WARN_CANDIDATE: 'WARN_CANDIDATE',
  EXTEND_TIME: 'EXTEND_TIME',
  FORCE_SUBMIT: 'FORCE_SUBMIT',
  CONFIRM_EVENT: 'CONFIRM_EVENT',
  EXCUSE_EVENT: 'EXCUSE_EVENT',
  REOPEN_SESSION: 'REOPEN_SESSION',
  DISQUALIFY: 'DISQUALIFY'
};

const CANDIDATE_STATES = {
  BEFORE_START: 'BEFORE_START',
  IN_PROGRESS: 'IN_PROGRESS',
  FINISHED: 'FINISHED',
  PUBLISHED: 'PUBLISHED'
};

const ACTION_RULES = {
  [CANDIDATE_STATES.BEFORE_START]: [ACTION_TYPES.NOTE, ACTION_TYPES.WARN_CANDIDATE],
  [CANDIDATE_STATES.IN_PROGRESS]: [
    ACTION_TYPES.NOTE,
    ACTION_TYPES.WARN_CANDIDATE,
    ACTION_TYPES.EXTEND_TIME,
    ACTION_TYPES.FORCE_SUBMIT,
    ACTION_TYPES.CONFIRM_EVENT,
    ACTION_TYPES.EXCUSE_EVENT
  ],
  [CANDIDATE_STATES.FINISHED]: [
    ACTION_TYPES.NOTE,
    ACTION_TYPES.CONFIRM_EVENT,
    ACTION_TYPES.EXCUSE_EVENT,
    ACTION_TYPES.REOPEN_SESSION,
    ACTION_TYPES.DISQUALIFY
  ],
  [CANDIDATE_STATES.PUBLISHED]: [ACTION_TYPES.NOTE]
};

const MODERATION_MESSAGES = {
  [ACTION_TYPES.NOTE]: 'Examiner note saved.',
  [ACTION_TYPES.WARN_CANDIDATE]: 'Examiner warning issued.',
  [ACTION_TYPES.EXTEND_TIME]: 'Examiner updated the exam time.',
  [ACTION_TYPES.FORCE_SUBMIT]: 'Examiner force submitted the session.',
  [ACTION_TYPES.CONFIRM_EVENT]: 'Incident marked for review.',
  [ACTION_TYPES.EXCUSE_EVENT]: 'Incident excused.',
  [ACTION_TYPES.REOPEN_SESSION]: 'Candidate session reopened.',
  [ACTION_TYPES.DISQUALIFY]: 'Candidate result marked as disqualified.'
};

const CANDIDATE_NOTICE_COPY = {
  [ACTION_TYPES.WARN_CANDIDATE]: {
    title: 'Examiner notice',
    tone: 'warning'
  },
  [ACTION_TYPES.EXTEND_TIME]: {
    title: 'Extra time added',
    tone: 'info'
  },
  [ACTION_TYPES.FORCE_SUBMIT]: {
    title: 'Exam session ended',
    tone: 'critical'
  },
  [ACTION_TYPES.NOTE]: {
    title: 'Session update',
    tone: 'info'
  }
};

const MODERATION_TIMELINE = {
  [ACTION_TYPES.NOTE]: {
    eventType: 'TRAINER_NOTE',
    severityLevel: 'NORMAL',
    severityScore: 5
  },
  [ACTION_TYPES.WARN_CANDIDATE]: {
    eventType: 'TRAINER_WARNING',
    severityLevel: 'SUSPICIOUS',
    severityScore: 35
  },
  [ACTION_TYPES.EXTEND_TIME]: {
    eventType: 'TRAINER_TIME_EXTENSION',
    severityLevel: 'NORMAL',
    severityScore: 5
  },
  [ACTION_TYPES.FORCE_SUBMIT]: {
    eventType: 'TRAINER_FORCE_SUBMIT',
    severityLevel: 'HIGH_RISK',
    severityScore: 70
  },
  [ACTION_TYPES.CONFIRM_EVENT]: {
    eventType: 'TRAINER_CONCERN_CONFIRMED',
    severityLevel: 'HIGH_RISK',
    severityScore: 65
  },
  [ACTION_TYPES.EXCUSE_EVENT]: {
    eventType: 'TRAINER_ALERT_EXCUSED',
    severityLevel: 'NORMAL',
    severityScore: 5
  },
  [ACTION_TYPES.REOPEN_SESSION]: {
    eventType: 'TRAINER_SESSION_REOPENED',
    severityLevel: 'NORMAL',
    severityScore: 15
  },
  [ACTION_TYPES.DISQUALIFY]: {
    eventType: 'TRAINER_RESULT_DISQUALIFIED',
    severityLevel: 'CHEATING',
    severityScore: 95
  }
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

const MODERATION_STATUS = {
  NORMAL: 'NORMAL',
  UNDER_REVIEW: 'UNDER_REVIEW',
  WARNED: 'WARNED',
  FORCE_SUBMITTED: 'FORCE_SUBMITTED',
  DISQUALIFIED: 'DISQUALIFIED',
  REOPENED: 'REOPENED'
};

const MAX_EXTENSION_MINUTES = 240;

const normalizeString = (value, fallback = '') => {
  if (typeof value !== 'string') {
    return fallback;
  }
  return value.trim();
};

const normalizePositiveMinutes = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  return Math.max(1, Math.min(Math.round(numeric), MAX_EXTENSION_MINUTES));
};

const normalizeOptionalMinutes = (value) => {
  if (value === undefined || value === null || value === '') {
    return 0;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  return Math.max(0, Math.min(Math.round(numeric), MAX_EXTENSION_MINUTES));
};

const isValidObjectId = (value) => Boolean(value) && mongoose.Types.ObjectId.isValid(value);

const isTrainerRequest = (req) => req.user && req.user.type === 'TRAINER';

const deriveCandidateState = ({ test, answerSheet }) => {
  if (test && test.isResultgenerated) {
    return CANDIDATE_STATES.PUBLISHED;
  }
  if (!answerSheet) {
    return CANDIDATE_STATES.BEFORE_START;
  }
  if (answerSheet.completed) {
    return CANDIDATE_STATES.FINISHED;
  }
  return CANDIDATE_STATES.IN_PROGRESS;
};

const snapshotAnswerSheetState = ({ test, answerSheet }) => ({
  startedWriting: Boolean(answerSheet),
  completed: Boolean(answerSheet && answerSheet.completed),
  completionReason: answerSheet && answerSheet.completionReason ? answerSheet.completionReason : null,
  moderationStatus: answerSheet && answerSheet.moderationStatus ? answerSheet.moderationStatus : 'NORMAL',
  effectiveDurationMinutes: Number((answerSheet && answerSheet.effectiveDurationMinutes) || (test && test.duration) || 0),
  grantedExtraTimeMinutes: Number((answerSheet && answerSheet.grantedExtraTimeMinutes) || 0),
  lastModerationActionAt: answerSheet && answerSheet.lastModerationActionAt ? answerSheet.lastModerationActionAt : null,
  testconducted: Boolean(test && test.testconducted),
  isResultgenerated: Boolean(test && test.isResultgenerated)
});

const serializeLinkedEvent = (event) => {
  if (!event || !event._id) {
    return null;
  }

  return {
    id: String(event._id),
    eventId: event.eventId || '',
    eventType: event.eventType || '',
    message: event.message || '',
    createdAt: event.createdAt || null,
    resolutionStatus: event.resolutionStatus || 'UNRESOLVED'
  };
};

const serializeAction = (action) => {
  const plain = typeof action.toObject === 'function' ? action.toObject() : action;
  const linkedEvent = plain.linkedEventId && plain.linkedEventId._id ? plain.linkedEventId : null;

  return {
    id: String(plain._id),
    testid: String(plain.testid),
    traineeid: String(plain.traineeid),
    trainerid: String(plain.trainerid),
    actionType: plain.actionType,
    reason: plain.reason,
    linkedEventId: linkedEvent ? String(linkedEvent._id) : (plain.linkedEventId ? String(plain.linkedEventId) : null),
    linkedEvent: serializeLinkedEvent(linkedEvent),
    payload: plain.payload || {},
    beforeState: plain.beforeState || null,
    afterState: plain.afterState || null,
    visibleToCandidate: Boolean(plain.visibleToCandidate),
    createdAt: plain.createdAt || null
  };
};

const buildCandidateNoticeMessage = (plain) => {
  const reason = normalizeString(plain && plain.reason);
  if (reason) {
    return reason;
  }

  if (plain && plain.actionType === ACTION_TYPES.EXTEND_TIME) {
    const minutes = Number(plain.payload && plain.payload.minutes);
    if (Number.isFinite(minutes) && minutes > 0) {
      return `Your exam time was extended by ${minutes} minute${minutes === 1 ? '' : 's'}.`;
    }
    return 'Your exam time was extended.';
  }

  if (plain && plain.actionType === ACTION_TYPES.FORCE_SUBMIT) {
    return 'Your exam session was submitted by the examiner.';
  }

  if (plain && plain.actionType === ACTION_TYPES.WARN_CANDIDATE) {
    return 'Please review the examiner notice and continue carefully.';
  }

  return 'There is an update from the examiner for this session.';
};

const serializeCandidateNotice = (action) => {
  const plain = typeof action.toObject === 'function' ? action.toObject() : action;
  const definition = CANDIDATE_NOTICE_COPY[plain.actionType] || CANDIDATE_NOTICE_COPY[ACTION_TYPES.NOTE];
  return {
    id: String(plain._id),
    actionType: plain.actionType,
    title: definition.title,
    tone: definition.tone,
    message: buildCandidateNoticeMessage(plain),
    createdAt: plain.createdAt || null,
    visibleToCandidate: Boolean(plain.visibleToCandidate),
    payload: plain.payload || {}
  };
};

const listVisibleCandidateNotices = async ({ testid, traineeid, limit = 6 }) => {
  const items = await ModerationActionModel.find({
    testid,
    traineeid,
    visibleToCandidate: true
  })
    .sort({ createdAt: -1 })
    .limit(Math.max(1, Math.min(Number(limit) || 6, 12)))
    .lean();

  return items.map(serializeCandidateNotice);
};

const ensureTrainerScopedCandidate = async ({ trainerid, testid, traineeid }) => {
  const [test, trainee, answerSheet] = await Promise.all([
    TestPaperModel.findOne({ _id: testid, createdBy: trainerid }, {
      _id: 1,
      title: 1,
      examID: 1,
      duration: 1,
      createdBy: 1,
      testbegins: 1,
      testconducted: 1,
      isResultgenerated: 1,
      integrityMode: 1,
      integrityPolicy: 1,
      preflightEnabled: 1,
      faceRecognitionEnabled: 1
    }),
    TraineeEnterModel.findOne({ _id: traineeid, testid }, {
      _id: 1,
      traineeID: 1,
      name: 1,
      emailid: 1,
      organisation: 1
    }),
    AnswersheetModel.findOne({ testid, userid: traineeid })
  ]);

  if (!test) {
    const error = new Error('Invalid test id.');
    error.code = 'INVALID_TEST';
    throw error;
  }

  if (!trainee) {
    const error = new Error('Invalid examinee id.');
    error.code = 'INVALID_TRAINEE';
    throw error;
  }

  return { test, trainee, answerSheet };
};

const buildRuntimeDuration = ({ test, answerSheet }) => {
  if (answerSheet && Number.isFinite(Number(answerSheet.effectiveDurationMinutes)) && Number(answerSheet.effectiveDurationMinutes) > 0) {
    return Number(answerSheet.effectiveDurationMinutes);
  }
  return Number((test && test.duration) || 0);
};

const isExamLiveForReopen = (test) => Boolean(test && test.testbegins) && !Boolean(test && test.testconducted) && !Boolean(test && test.isResultgenerated);

const getAllowedActionTypes = ({ test, answerSheet, candidateState }) => {
  const base = [...(ACTION_RULES[candidateState] || [])];

  return base.filter((actionType) => {
    if (actionType === ACTION_TYPES.EXTEND_TIME || actionType === ACTION_TYPES.FORCE_SUBMIT) {
      return Boolean(answerSheet) && !Boolean(answerSheet.completed);
    }

    if (actionType === ACTION_TYPES.REOPEN_SESSION) {
      return Boolean(answerSheet && answerSheet.completed) && isExamLiveForReopen(test);
    }

    if (actionType === ACTION_TYPES.DISQUALIFY) {
      return Boolean(answerSheet && answerSheet.completed);
    }

    if (actionType === ACTION_TYPES.CONFIRM_EVENT || actionType === ACTION_TYPES.EXCUSE_EVENT) {
      return Boolean(answerSheet);
    }

    return true;
  });
};

const ensureActionAllowed = ({ actionType, candidateState, test, answerSheet }) => {
  const allowedActions = getAllowedActionTypes({ test, answerSheet, candidateState });
  if (!allowedActions.includes(actionType)) {
    const error = new Error('This moderation action is not allowed for the candidate\'s current exam state.');
    error.code = 'ACTION_NOT_ALLOWED';
    throw error;
  }
  return allowedActions;
};

const ensureReviewableEvent = (linkedEvent) => {
  if (!linkedEvent) {
    const error = new Error('Please choose the incident you want to review.');
    error.code = 'INVALID_LINKED_EVENT';
    throw error;
  }

  if (!REVIEWABLE_EVENT_TYPES.has(String(linkedEvent.eventType || '').toUpperCase())) {
    const error = new Error('This incident cannot be reviewed with confirm or excuse actions.');
    error.code = 'INVALID_LINKED_EVENT';
    throw error;
  }
};

const loadLinkedEvent = async ({ testid, traineeid, linkedEventId }) => {
  if (!linkedEventId) {
    return null;
  }

  const event = await ProctorEventModel.findOne({
    _id: linkedEventId,
    testid,
    traineeid
  });

  if (!event) {
    const error = new Error('The selected incident could not be found for this candidate.');
    error.code = 'INVALID_LINKED_EVENT';
    throw error;
  }

  return event;
};

const recordModerationTimelineEvent = async ({ testid, traineeid, actionType, trainerid, reason, payload = {} }) => {
  const definition = MODERATION_TIMELINE[actionType] || MODERATION_TIMELINE[ACTION_TYPES.NOTE];
  await proctorTimeline.recordSystemEvent({
    testid,
    traineeid,
    sessionId: proctorTimeline.buildSessionId(testid, traineeid),
    source: 'TRAINER',
    eventType: definition.eventType,
    message: reason || MODERATION_MESSAGES[actionType] || 'Examiner action recorded.',
    payload: {
      trainerid,
      actionType,
      ...payload
    },
    explicitSeverityScore: definition.severityScore,
    explicitSeverityLevel: definition.severityLevel,
    dedupeKey: null
  });
};

const updateLinkedEventResolution = async ({ linkedEvent, trainerid, action, resolutionStatus, reason }) => {
  if (!linkedEvent) {
    return null;
  }

  linkedEvent.resolutionStatus = resolutionStatus;
  linkedEvent.resolvedBy = trainerid;
  linkedEvent.resolvedAt = new Date();
  linkedEvent.resolutionReason = reason;
  linkedEvent.resolutionActionId = action._id;
  linkedEvent.acked = true;
  linkedEvent.ackedBy = linkedEvent.ackedBy || trainerid;
  linkedEvent.ackedAt = linkedEvent.ackedAt || new Date();
  await linkedEvent.save();
  return linkedEvent;
};

const logModerationAction = async ({
  testid,
  traineeid,
  trainerid,
  actionType,
  reason,
  linkedEvent = null,
  payload = {},
  beforeState = null,
  afterState = null,
  visibleToCandidate = false
}) => {
  const action = await ModerationActionModel.create({
    testid,
    traineeid,
    trainerid,
    actionType,
    reason,
    linkedEventId: linkedEvent ? linkedEvent._id : null,
    payload,
    beforeState,
    afterState,
    visibleToCandidate
  });

  await recordModerationTimelineEvent({
    testid,
    traineeid,
    trainerid,
    actionType,
    reason,
    payload: {
      linkedEventId: linkedEvent ? String(linkedEvent._id) : null,
      relatedEventId: linkedEvent ? linkedEvent.eventId : null,
      moderationActionId: String(action._id),
      visibleToCandidate,
      ...payload
    }
  });

  return action;
};

const restoreStatusAfterExcuse = async ({ currentStatus, testid, traineeid, linkedEvent }) => {
  if (currentStatus !== MODERATION_STATUS.UNDER_REVIEW || !linkedEvent) {
    return currentStatus;
  }

  const remainingConfirmedCount = await ProctorEventModel.countDocuments({
    testid,
    traineeid,
    resolutionStatus: 'CONFIRMED',
    _id: { $ne: linkedEvent._id }
  });

  if (remainingConfirmedCount > 0) {
    return MODERATION_STATUS.UNDER_REVIEW;
  }

  const confirmedAction = await ModerationActionModel.findOne({
    testid,
    traineeid,
    linkedEventId: linkedEvent._id,
    actionType: ACTION_TYPES.CONFIRM_EVENT
  })
    .sort({ createdAt: -1 })
    .lean();

  const previousStatus = confirmedAction && confirmedAction.payload && confirmedAction.payload.previousModerationStatus
    ? String(confirmedAction.payload.previousModerationStatus)
    : MODERATION_STATUS.NORMAL;

  return previousStatus === MODERATION_STATUS.UNDER_REVIEW
    ? MODERATION_STATUS.NORMAL
    : previousStatus;
};

const applyWarningStatus = (status) => {
  if (status === MODERATION_STATUS.DISQUALIFIED || status === MODERATION_STATUS.FORCE_SUBMITTED || status === MODERATION_STATUS.UNDER_REVIEW) {
    return status;
  }
  return MODERATION_STATUS.WARNED;
};

const applyModerationAction = async ({ trainerid, testid, traineeid, actionType, reason, linkedEventId = null, payload = {} }) => {
  const { test, trainee, answerSheet } = await ensureTrainerScopedCandidate({ trainerid, testid, traineeid });
  const candidateState = deriveCandidateState({ test, answerSheet });
  ensureActionAllowed({ actionType, candidateState, test, answerSheet });
  const linkedEvent = await loadLinkedEvent({ testid, traineeid, linkedEventId });

  if (actionType === ACTION_TYPES.CONFIRM_EVENT || actionType === ACTION_TYPES.EXCUSE_EVENT) {
    ensureReviewableEvent(linkedEvent);
  }

  const beforeState = snapshotAnswerSheetState({ test, answerSheet });
  const now = new Date();
  let afterState = beforeState;
  let moderationPayload = payload || {};
  let visibleToCandidate = false;

  if (actionType === ACTION_TYPES.NOTE) {
    afterState = beforeState;
  }

  if (actionType === ACTION_TYPES.WARN_CANDIDATE) {
    visibleToCandidate = true;
    if (answerSheet) {
      answerSheet.moderationStatus = applyWarningStatus(answerSheet.moderationStatus || MODERATION_STATUS.NORMAL);
      answerSheet.lastModerationActionAt = now;
      await answerSheet.save();
    }
    afterState = snapshotAnswerSheetState({ test, answerSheet });
  }

  if (actionType === ACTION_TYPES.EXTEND_TIME) {
    if (!answerSheet || answerSheet.completed) {
      const error = new Error('Extra time can only be granted while the candidate is actively taking the exam.');
      error.code = 'MISSING_ACTIVE_SESSION';
      throw error;
    }

    const minutes = normalizePositiveMinutes(payload.minutes);
    if (!minutes) {
      const error = new Error('A valid number of extension minutes is required.');
      error.code = 'INVALID_EXTENSION_MINUTES';
      throw error;
    }

    const currentDuration = buildRuntimeDuration({ test, answerSheet });
    const currentExtra = Number(answerSheet.grantedExtraTimeMinutes || 0);
    answerSheet.effectiveDurationMinutes = currentDuration + minutes;
    answerSheet.grantedExtraTimeMinutes = currentExtra + minutes;
    answerSheet.lastModerationActionAt = now;
    await answerSheet.save();

    visibleToCandidate = true;
    moderationPayload = {
      ...payload,
      minutes,
      previousEffectiveDurationMinutes: currentDuration,
      nextEffectiveDurationMinutes: Number(answerSheet.effectiveDurationMinutes || 0),
      previousGrantedExtraTimeMinutes: currentExtra,
      nextGrantedExtraTimeMinutes: Number(answerSheet.grantedExtraTimeMinutes || 0)
    };
    afterState = snapshotAnswerSheetState({ test, answerSheet });
  }

  if (actionType === ACTION_TYPES.FORCE_SUBMIT) {
    if (!answerSheet || answerSheet.completed) {
      const error = new Error('Force submit is only available while the candidate is actively taking the exam.');
      error.code = 'MISSING_ACTIVE_SESSION';
      throw error;
    }

    answerSheet.completed = true;
    answerSheet.completionReason = 'FORCED_BY_TRAINER';
    answerSheet.moderationStatus = MODERATION_STATUS.FORCE_SUBMITTED;
    answerSheet.lastModerationActionAt = now;
    answerSheet.lastHeartbeatAt = now;
    await answerSheet.save();

    visibleToCandidate = true;
    moderationPayload = {
      ...payload,
      completionReason: 'FORCED_BY_TRAINER'
    };
    afterState = snapshotAnswerSheetState({ test, answerSheet });

    await proctorTimeline.recordSystemEvent({
      testid,
      traineeid,
      sessionId: proctorTimeline.buildSessionId(testid, traineeid),
      source: 'TRAINER',
      eventType: 'EXAM_FINISHED',
      message: 'Examiner force submitted the exam session.',
      payload: {
        trigger: 'trainer_force_submit'
      },
      explicitSeverityScore: 70,
      explicitSeverityLevel: 'HIGH_RISK',
      dedupeKey: 'trainer-force-submit:' + testid + ':' + traineeid
    });
  }

  if (actionType === ACTION_TYPES.CONFIRM_EVENT) {
    if (!answerSheet) {
      const error = new Error('The candidate has not started the exam yet.');
      error.code = 'MISSING_ACTIVE_SESSION';
      throw error;
    }

    const previousModerationStatus = String(answerSheet.moderationStatus || MODERATION_STATUS.NORMAL);
    if (previousModerationStatus !== MODERATION_STATUS.DISQUALIFIED && previousModerationStatus !== MODERATION_STATUS.FORCE_SUBMITTED) {
      answerSheet.moderationStatus = MODERATION_STATUS.UNDER_REVIEW;
    }
    answerSheet.lastModerationActionAt = now;
    await answerSheet.save();

    moderationPayload = {
      ...payload,
      previousModerationStatus,
      nextModerationStatus: answerSheet.moderationStatus,
      linkedEventId: linkedEvent ? String(linkedEvent._id) : null,
      relatedEventId: linkedEvent ? linkedEvent.eventId : null
    };
    afterState = snapshotAnswerSheetState({ test, answerSheet });
  }

  if (actionType === ACTION_TYPES.EXCUSE_EVENT) {
    if (!answerSheet) {
      const error = new Error('The candidate has not started the exam yet.');
      error.code = 'MISSING_ACTIVE_SESSION';
      throw error;
    }

    const previousModerationStatus = String(answerSheet.moderationStatus || MODERATION_STATUS.NORMAL);
    answerSheet.moderationStatus = await restoreStatusAfterExcuse({
      currentStatus: previousModerationStatus,
      testid,
      traineeid,
      linkedEvent
    });
    answerSheet.lastModerationActionAt = now;
    await answerSheet.save();

    moderationPayload = {
      ...payload,
      previousModerationStatus,
      nextModerationStatus: answerSheet.moderationStatus,
      linkedEventId: String(linkedEvent._id),
      relatedEventId: linkedEvent.eventId
    };
    afterState = snapshotAnswerSheetState({ test, answerSheet });
  }

  if (actionType === ACTION_TYPES.DISQUALIFY) {
    if (!answerSheet || !answerSheet.completed) {
      const error = new Error('Disqualify is only available after the candidate has finished the exam and before results are published.');
      error.code = 'ACTION_NOT_ALLOWED';
      throw error;
    }

    const previousModerationStatus = String(answerSheet.moderationStatus || MODERATION_STATUS.NORMAL);
    answerSheet.moderationStatus = MODERATION_STATUS.DISQUALIFIED;
    answerSheet.lastModerationActionAt = now;
    await answerSheet.save();

    moderationPayload = {
      ...payload,
      previousModerationStatus,
      nextModerationStatus: answerSheet.moderationStatus,
      completionReason: answerSheet.completionReason || null
    };
    afterState = snapshotAnswerSheetState({ test, answerSheet });
  }

  if (actionType === ACTION_TYPES.REOPEN_SESSION) {
    if (!answerSheet || !answerSheet.completed || !isExamLiveForReopen(test)) {
      const error = new Error('This session can only be reopened while the exam is still running and before results are published.');
      error.code = 'REOPEN_NOT_ALLOWED';
      throw error;
    }

    const addedMinutes = normalizeOptionalMinutes(payload.minutes);
    if (addedMinutes === null) {
      const error = new Error('Enter valid extra minutes for the reopened session.');
      error.code = 'INVALID_REOPEN_MINUTES';
      throw error;
    }

    const currentDuration = buildRuntimeDuration({ test, answerSheet });
    const remainingSeconds = sessionResilience.computeRemainingSeconds({
      startTime: answerSheet.startTime,
      durationMinutes: currentDuration,
      now: now.getTime()
    });

    if (remainingSeconds <= 0 && addedMinutes <= 0) {
      const error = new Error('Add extra time before reopening a session that has already run out of time.');
      error.code = 'REOPEN_EXTENSION_REQUIRED';
      throw error;
    }

    const previousModerationStatus = String(answerSheet.moderationStatus || MODERATION_STATUS.NORMAL);
    const currentExtra = Number(answerSheet.grantedExtraTimeMinutes || 0);
    const nextDuration = currentDuration + addedMinutes;
    const nextExtra = currentExtra + addedMinutes;
    const nextSessionVersion = Number(answerSheet.sessionVersion || 0) + 1;
    const nextGraceWindow = sessionResilience.buildGraceWindowUntil(now.getTime());

    await AnswersheetModel.updateOne(
      { _id: answerSheet._id },
      {
        $set: {
          completed: false,
          moderationStatus: MODERATION_STATUS.REOPENED,
          lastModerationActionAt: now,
          lastHeartbeatAt: now,
          graceWindowUntil: nextGraceWindow,
          sessionVersion: nextSessionVersion,
          effectiveDurationMinutes: nextDuration,
          grantedExtraTimeMinutes: nextExtra
        },
        $unset: {
          completionReason: 1
        }
      }
    );

    answerSheet.completed = false;
    answerSheet.completionReason = undefined;
    answerSheet.moderationStatus = MODERATION_STATUS.REOPENED;
    answerSheet.lastModerationActionAt = now;
    answerSheet.lastHeartbeatAt = now;
    answerSheet.graceWindowUntil = nextGraceWindow;
    answerSheet.sessionVersion = nextSessionVersion;
    answerSheet.effectiveDurationMinutes = nextDuration;
    answerSheet.grantedExtraTimeMinutes = nextExtra;

    moderationPayload = {
      ...payload,
      minutes: addedMinutes,
      previousCompletionReason: beforeState.completionReason,
      previousModerationStatus,
      nextModerationStatus: answerSheet.moderationStatus,
      previousEffectiveDurationMinutes: currentDuration,
      nextEffectiveDurationMinutes: nextDuration,
      previousGrantedExtraTimeMinutes: currentExtra,
      nextGrantedExtraTimeMinutes: nextExtra,
      remainingSecondsBeforeReopen: remainingSeconds
    };
    afterState = snapshotAnswerSheetState({ test, answerSheet });
  }

  const action = await logModerationAction({
    testid,
    traineeid,
    trainerid,
    actionType,
    reason,
    linkedEvent,
    payload: moderationPayload,
    beforeState,
    afterState,
    visibleToCandidate
  });

  if (actionType === ACTION_TYPES.CONFIRM_EVENT) {
    await updateLinkedEventResolution({
      linkedEvent,
      trainerid,
      action,
      resolutionStatus: 'CONFIRMED',
      reason
    });
  }

  if (actionType === ACTION_TYPES.EXCUSE_EVENT) {
    await updateLinkedEventResolution({
      linkedEvent,
      trainerid,
      action,
      resolutionStatus: 'EXCUSED',
      reason
    });
  }

  return {
    test,
    trainee,
    answerSheet,
    action,
    candidateState,
    currentState: deriveCandidateState({ test, answerSheet }),
    availableActions: getAllowedActionTypes({
      test,
      answerSheet,
      candidateState: deriveCandidateState({ test, answerSheet })
    })
  };
};
const handleModerationError = (res, error, context = {}) => {
  if (error && (
    error.code === 'INVALID_TEST' ||
    error.code === 'INVALID_TRAINEE' ||
    error.code === 'ACTION_NOT_ALLOWED' ||
    error.code === 'MISSING_ACTIVE_SESSION' ||
    error.code === 'INVALID_EXTENSION_MINUTES' ||
    error.code === 'INVALID_LINKED_EVENT' ||
    error.code === 'REOPEN_NOT_ALLOWED' ||
    error.code === 'INVALID_REOPEN_MINUTES' ||
    error.code === 'REOPEN_EXTENSION_REQUIRED'
  )) {
    return res.json({
      success: false,
      message: error.message
    });
  }

  logger.error('moderation_request_failed', {
    ...context,
    error: logger.normalizeError(error)
  });
  return res.status(500).json({
    success: false,
    message: 'Unable to process moderation request.'
  });
};

const moderationAction = async (req, res) => {
  if (!isTrainerRequest(req)) {
    return res.status(401).json({
      success: false,
      message: 'Permissions not granted!'
    });
  }

  const testid = req.body.testid;
  const traineeid = req.body.traineeid;
  const actionType = normalizeString(req.body.actionType).toUpperCase();
  const reason = normalizeString(req.body.reason);
  const linkedEventId = isValidObjectId(req.body.linkedEventId) ? req.body.linkedEventId : null;

  if (!ACTION_TYPES[actionType]) {
    return res.json({
      success: false,
      message: 'Unsupported moderation action.'
    });
  }

  if (!reason) {
    return res.json({
      success: false,
      message: 'Reason is required.'
    });
  }

  try {
    const result = await applyModerationAction({
      trainerid: req.user._id,
      testid,
      traineeid,
      actionType,
      reason,
      linkedEventId,
      payload: req.body.payload || {}
    });

    return res.json({
      success: true,
      message: MODERATION_MESSAGES[actionType] || 'Moderation action saved.',
      data: {
        candidateState: result.currentState,
        availableActions: result.availableActions,
        action: serializeAction(result.action),
        answerSheet: snapshotAnswerSheetState({ test: result.test, answerSheet: result.answerSheet }),
        trainee: {
          _id: String(result.trainee._id),
          traineeID: result.trainee.traineeID || '',
          name: result.trainee.name || '',
          emailid: result.trainee.emailid || ''
        }
      }
    });
  } catch (error) {
    return handleModerationError(res, error, {
      trainerId: req.user && req.user._id,
      testId: testid,
      traineeId: traineeid,
      actionType
    });
  }
};

const moderationHistory = async (req, res) => {
  if (!isTrainerRequest(req)) {
    return res.status(401).json({
      success: false,
      message: 'Permissions not granted!'
    });
  }

  const testid = req.body.testid;
  const traineeid = req.body.traineeid;
  const page = Math.max(1, Number(req.body.page || 1));
  const limit = Math.min(100, Math.max(1, Number(req.body.limit || 25)));

  try {
    const { test, trainee, answerSheet } = await ensureTrainerScopedCandidate({ trainerid: req.user._id, testid, traineeid });
    const skip = (page - 1) * limit;
    const query = { testid, traineeid };
    const [items, total] = await Promise.all([
      ModerationActionModel.find(query).populate('linkedEventId', 'eventId eventType message createdAt resolutionStatus').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      ModerationActionModel.countDocuments(query)
    ]);

    return res.json({
      success: true,
      message: 'Moderation history.',
      data: {
        test: {
          _id: String(test._id),
          title: test.title || '',
          examID: test.examID || ''
        },
        trainee: {
          _id: String(trainee._id),
          traineeID: trainee.traineeID || '',
          name: trainee.name || '',
          emailid: trainee.emailid || ''
        },
        candidateState: deriveCandidateState({ test, answerSheet }),
        availableActions: getAllowedActionTypes({ test, answerSheet, candidateState: deriveCandidateState({ test, answerSheet }) }),
        answerSheet: snapshotAnswerSheetState({ test, answerSheet }),
        items: items.map(serializeAction),
        total,
        page,
        limit
      }
    });
  } catch (error) {
    return handleModerationError(res, error, {
      trainerId: req.user && req.user._id,
      testId: testid,
      traineeId: traineeid
    });
  }
};

const candidateNotices = async (req, res) => {
  const testid = req.body.testid;
  const traineeid = req.body.traineeid || req.body.userid;

  if (!testid || !traineeid) {
    return res.json({
      success: false,
      message: 'Test id and examinee id are required.'
    });
  }

  try {
    const [test, trainee, items] = await Promise.all([
      TestPaperModel.findById(testid, { _id: 1, title: 1, examID: 1 }),
      TraineeEnterModel.findOne({ _id: traineeid, testid }, { _id: 1, traineeID: 1, name: 1, emailid: 1 }),
      listVisibleCandidateNotices({ testid, traineeid, limit: req.body.limit || 6 })
    ]);

    if (!test || !trainee) {
      return res.json({
        success: false,
        message: 'Invalid test or examinee id.'
      });
    }

    return res.json({
      success: true,
      message: 'Candidate notices.',
      data: {
        test: {
          _id: String(test._id),
          title: test.title || '',
          examID: test.examID || ''
        },
        trainee: {
          _id: String(trainee._id),
          traineeID: trainee.traineeID || '',
          name: trainee.name || '',
          emailid: trainee.emailid || ''
        },
        items
      }
    });
  } catch (error) {
    return handleModerationError(res, error, {
      testId: testid,
      traineeId: traineeid
    });
  }
};

const moderationSummary = async (req, res) => {
  if (!isTrainerRequest(req)) {
    return res.status(401).json({
      success: false,
      message: 'Permissions not granted!'
    });
  }

  const testid = req.body.testid;

  try {
    const test = await TestPaperModel.findOne({ _id: testid, createdBy: req.user._id }, { _id: 1, title: 1, examID: 1, isResultgenerated: 1 });
    if (!test) {
      return res.json({
        success: false,
        message: 'Invalid test id.'
      });
    }

    const [actions, answerSheets, trainees] = await Promise.all([
      ModerationActionModel.find({ testid }).sort({ createdAt: -1 }).lean(),
      AnswersheetModel.find({ testid }, { userid: 1, completed: 1, moderationStatus: 1, completionReason: 1, lastModerationActionAt: 1 }).lean(),
      TraineeEnterModel.find({ testid }, { _id: 1, traineeID: 1, name: 1, emailid: 1 }).lean()
    ]);

    const actionCounts = actions.reduce((accumulator, action) => {
      accumulator[action.actionType] = Number(accumulator[action.actionType] || 0) + 1;
      return accumulator;
    }, {});

    const sheetByTrainee = answerSheets.reduce((accumulator, sheet) => {
      accumulator[String(sheet.userid)] = sheet;
      return accumulator;
    }, {});

    const actionSummaryByTrainee = actions.reduce((accumulator, action) => {
      const key = String(action.traineeid);
      if (!accumulator[key]) {
        accumulator[key] = {
          totalActions: 0,
          lastActionAt: action.createdAt,
          lastActionType: action.actionType,
          counts: {}
        };
      }

      accumulator[key].totalActions += 1;
      accumulator[key].counts[action.actionType] = Number(accumulator[key].counts[action.actionType] || 0) + 1;
      if (!accumulator[key].lastActionAt || new Date(action.createdAt).getTime() > new Date(accumulator[key].lastActionAt).getTime()) {
        accumulator[key].lastActionAt = action.createdAt;
        accumulator[key].lastActionType = action.actionType;
      }
      return accumulator;
    }, {});

    const items = trainees.map((trainee) => {
      const key = String(trainee._id);
      const sheet = sheetByTrainee[key] || null;
      const moderation = actionSummaryByTrainee[key] || { totalActions: 0, lastActionAt: null, lastActionType: '', counts: {} };
      return {
        trainee: {
          _id: key,
          traineeID: trainee.traineeID || '',
          name: trainee.name || '',
          emailid: trainee.emailid || ''
        },
        candidateState: deriveCandidateState({ test, answerSheet: sheet }),
        availableActions: getAllowedActionTypes({ test, answerSheet: sheet, candidateState: deriveCandidateState({ test, answerSheet: sheet }) }),
        moderationStatus: sheet && sheet.moderationStatus ? sheet.moderationStatus : 'NORMAL',
        completionReason: sheet && sheet.completionReason ? sheet.completionReason : null,
        totalActions: moderation.totalActions,
        lastActionAt: moderation.lastActionAt || null,
        lastActionType: moderation.lastActionType || '',
        counts: moderation.counts || {}
      };
    });

    return res.json({
      success: true,
      message: 'Moderation summary.',
      data: {
        test: {
          _id: String(test._id),
          title: test.title || '',
          examID: test.examID || ''
        },
        totals: {
          actionCount: actions.length,
          candidateCount: trainees.length,
          actionCounts
        },
        items
      }
    });
  } catch (error) {
    return handleModerationError(res, error, {
      trainerId: req.user && req.user._id,
      testId: testid
    });
  }
};

module.exports = {
  ACTION_TYPES,
  CANDIDATE_STATES,
  serializeCandidateNotice,
  listVisibleCandidateNotices,
  moderationAction,
  moderationHistory,
  candidateNotices,
  moderationSummary
};

