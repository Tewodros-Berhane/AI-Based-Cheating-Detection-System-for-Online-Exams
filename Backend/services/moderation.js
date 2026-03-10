const mongoose = require('mongoose');
const ModerationActionModel = require('../models/moderationAction');
const TestPaperModel = require('../models/testpaper');
const TraineeEnterModel = require('../models/trainee');
const AnswersheetModel = require('../models/answersheet');
const logger = require('./logger');
const proctorTimeline = require('./proctorTimeline');

const ACTION_TYPES = {
  NOTE: 'NOTE',
  WARN_CANDIDATE: 'WARN_CANDIDATE',
  EXTEND_TIME: 'EXTEND_TIME',
  FORCE_SUBMIT: 'FORCE_SUBMIT'
};

const CANDIDATE_STATES = {
  BEFORE_START: 'BEFORE_START',
  IN_PROGRESS: 'IN_PROGRESS',
  FINISHED: 'FINISHED',
  PUBLISHED: 'PUBLISHED'
};

const ACTION_RULES = {
  [CANDIDATE_STATES.BEFORE_START]: [ACTION_TYPES.NOTE, ACTION_TYPES.WARN_CANDIDATE],
  [CANDIDATE_STATES.IN_PROGRESS]: [ACTION_TYPES.NOTE, ACTION_TYPES.WARN_CANDIDATE, ACTION_TYPES.EXTEND_TIME, ACTION_TYPES.FORCE_SUBMIT],
  [CANDIDATE_STATES.FINISHED]: [ACTION_TYPES.NOTE],
  [CANDIDATE_STATES.PUBLISHED]: [ACTION_TYPES.NOTE]
};

const MODERATION_MESSAGES = {
  [ACTION_TYPES.NOTE]: 'Trainer note saved.',
  [ACTION_TYPES.WARN_CANDIDATE]: 'Trainer warning issued.',
  [ACTION_TYPES.EXTEND_TIME]: 'Trainer updated the exam time.',
  [ACTION_TYPES.FORCE_SUBMIT]: 'Trainer force submitted the session.'
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
  }
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

const serializeAction = (action) => {
  const plain = typeof action.toObject === 'function' ? action.toObject() : action;
  return {
    id: String(plain._id),
    testid: String(plain.testid),
    traineeid: String(plain.traineeid),
    trainerid: String(plain.trainerid),
    actionType: plain.actionType,
    reason: plain.reason,
    linkedEventId: plain.linkedEventId ? String(plain.linkedEventId) : null,
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
    const error = new Error('Invalid trainee id.');
    error.code = 'INVALID_TRAINEE';
    throw error;
  }

  return { test, trainee, answerSheet };
};

const ensureActionAllowed = ({ actionType, candidateState }) => {
  const allowedActions = ACTION_RULES[candidateState] || [];
  if (!allowedActions.includes(actionType)) {
    const error = new Error('This moderation action is not allowed for the candidate\'s current exam state.');
    error.code = 'ACTION_NOT_ALLOWED';
    throw error;
  }
};

const buildRuntimeDuration = ({ test, answerSheet }) => {
  if (answerSheet && Number.isFinite(Number(answerSheet.effectiveDurationMinutes)) && Number(answerSheet.effectiveDurationMinutes) > 0) {
    return Number(answerSheet.effectiveDurationMinutes);
  }
  return Number((test && test.duration) || 0);
};

const recordModerationTimelineEvent = async ({ testid, traineeid, actionType, trainerid, reason, payload = {} }) => {
  const definition = MODERATION_TIMELINE[actionType] || MODERATION_TIMELINE[ACTION_TYPES.NOTE];
  await proctorTimeline.recordSystemEvent({
    testid,
    traineeid,
    sessionId: proctorTimeline.buildSessionId(testid, traineeid),
    source: 'TRAINER',
    eventType: definition.eventType,
    message: reason || MODERATION_MESSAGES[actionType] || 'Trainer action recorded.',
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

const logModerationAction = async ({ testid, traineeid, trainerid, actionType, reason, linkedEventId = null, payload = {}, beforeState = null, afterState = null, visibleToCandidate = false }) => {
  const action = await ModerationActionModel.create({
    testid,
    traineeid,
    trainerid,
    actionType,
    reason,
    linkedEventId,
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
      linkedEventId: linkedEventId || null,
      moderationActionId: action._id,
      visibleToCandidate,
      ...payload
    }
  });

  return action;
};

const applyModerationAction = async ({ trainerid, testid, traineeid, actionType, reason, linkedEventId = null, payload = {} }) => {
  const { test, trainee, answerSheet } = await ensureTrainerScopedCandidate({ trainerid, testid, traineeid });
  const candidateState = deriveCandidateState({ test, answerSheet });
  ensureActionAllowed({ actionType, candidateState });

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
      answerSheet.moderationStatus = 'WARNED';
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
    answerSheet.moderationStatus = 'FORCE_SUBMITTED';
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
      message: 'Trainer force submitted the exam session.',
      payload: {
        trigger: 'trainer_force_submit'
      },
      explicitSeverityScore: 70,
      explicitSeverityLevel: 'HIGH_RISK',
      dedupeKey: `trainer-force-submit:${testid}:${traineeid}`
    });
  }

  const action = await logModerationAction({
    testid,
    traineeid,
    trainerid,
    actionType,
    reason,
    linkedEventId,
    payload: moderationPayload,
    beforeState,
    afterState,
    visibleToCandidate
  });

  return {
    test,
    trainee,
    answerSheet,
    action,
    candidateState,
    currentState: deriveCandidateState({ test, answerSheet })
  };
};

const handleModerationError = (res, error, context = {}) => {
  if (error && (
    error.code === 'INVALID_TEST' ||
    error.code === 'INVALID_TRAINEE' ||
    error.code === 'ACTION_NOT_ALLOWED' ||
    error.code === 'MISSING_ACTIVE_SESSION' ||
    error.code === 'INVALID_EXTENSION_MINUTES'
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
      ModerationActionModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
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
      message: 'Test id and trainee id are required.'
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
        message: 'Invalid test or trainee id.'
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
