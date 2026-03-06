const { EVENT_RULES } = require('./proctorSeverityEngine');

const HUMAN_MESSAGES = {
  normal: 'Monitoring active.',
  suspicious: 'Suspicious behavior detected.',
  cheating: 'High-risk cheating signal detected.',
  finished: 'Exam session finished.'
};

const CLIENT_EVENT_TYPES = new Set([
  'NO_FACE',
  'MULTI_FACE',
  'FACE_MISMATCH',
  'LOOKING_AWAY',
  'AUDIO_SUSPICIOUS',
  'AUDIO_MULTIPLE_VOICES',
  'NETWORK_DROP',
  'RECONNECTED',
  'FULLSCREEN_EXIT',
  'TAB_SWITCH'
]);

const CLIENT_EVENT_SOURCES = new Set(['SYSTEM', 'FACE']);

const EVENT_DEDUPE_WINDOWS_MS = {
  NO_FACE: 15000,
  MULTI_FACE: 15000,
  FACE_MISMATCH: 15000,
  LOOKING_AWAY: 10000,
  AUDIO_SUSPICIOUS: 10000,
  AUDIO_MULTIPLE_VOICES: 10000,
  NETWORK_DROP: 10000,
  RECONNECTED: 10000,
  FULLSCREEN_EXIT: 10000,
  TAB_SWITCH: 10000
};

const mapBehaviourToEventType = (behaviour) => {
  const normalized = String(behaviour || '').toLowerCase();
  if (normalized === 'cheating') return 'AI_CHEATING';
  if (normalized === 'suspicious') return 'AI_SUSPICIOUS';
  if (normalized === 'finished') return 'EXAM_FINISHED';
  return 'AI_NORMAL';
};

const normalizeClientEvent = ({ sessionId, traineeId, testId, payload }) => {
  const eventType = String(payload.eventType || '').toUpperCase();
  if (!CLIENT_EVENT_TYPES.has(eventType)) {
    return null;
  }

  const source = String(payload.source || 'SYSTEM').toUpperCase();
  if (!CLIENT_EVENT_SOURCES.has(source)) {
    return null;
  }

  const dedupeWindowMs = EVENT_DEDUPE_WINDOWS_MS[eventType] || 5000;
  const bucket = Math.floor(Date.now() / dedupeWindowMs);
  const confidence = typeof payload.confidence === 'number' ? payload.confidence : undefined;
  const message = typeof payload.message === 'string' && payload.message.trim()
    ? payload.message.trim()
    : (EVENT_RULES[eventType]?.message || 'Monitoring event recorded.');

  return {
    testid: payload.testId || testId,
    traineeid: payload.traineeId || traineeId,
    sessionId,
    source,
    eventType,
    confidence,
    message,
    payload: {
      ...((payload.payload && typeof payload.payload === 'object') ? payload.payload : {}),
      clientType: payload.type
    },
    dedupeKey: `${sessionId}:${eventType}:${bucket}`,
    dedupeWindowMs,
    isFinished: false
  };
};

const normalizeRelayMessage = ({ sessionId, traineeId, testId, payload }) => {
  if (!payload || !payload.type) {
    return null;
  }

  if (payload.type === 'proctor-event') {
    return normalizeClientEvent({ sessionId, traineeId, testId, payload });
  }

  if (payload.type !== 'ai-result') {
    return null;
  }

  const normalizedBehaviour = String(payload.behaviour || '').toLowerCase() || 'normal';
  if (normalizedBehaviour === 'normal' || normalizedBehaviour === 'finished') {
    return null;
  }

  const eventType = mapBehaviourToEventType(payload.behaviour);
  const nowBucket = Math.floor(Date.now() / 3000);

  return {
    testid: payload.testId || testId,
    traineeid: payload.traineeId || traineeId,
    sessionId,
    source: 'AI',
    eventType,
    confidence: typeof payload.confidence === 'number' ? payload.confidence : undefined,
    message: HUMAN_MESSAGES[normalizedBehaviour] || EVENT_RULES[eventType]?.message || 'Monitoring event recorded.',
    payload: {
      behaviour: normalizedBehaviour,
      signalType: payload.signalType || 'inference'
    },
    dedupeKey: `${sessionId}:${eventType}:${nowBucket}`,
    dedupeWindowMs: 3000,
    isFinished: eventType === 'EXAM_FINISHED'
  };
};

const createSystemEvent = ({
  testid,
  traineeid,
  sessionId,
  eventType,
  source = 'SYSTEM',
  message,
  payload = {},
  confidence = 1,
  dedupeKey = null,
  dedupeWindowMs = 10000,
  explicitSeverityScore = null,
  explicitSeverityLevel = null
}) => ({
  testid,
  traineeid,
  sessionId,
  source,
  eventType,
  confidence,
  message: message || EVENT_RULES[eventType]?.message || 'System event recorded.',
  payload,
  dedupeKey,
  dedupeWindowMs,
  explicitSeverityScore,
  explicitSeverityLevel,
  isFinished: eventType === 'EXAM_FINISHED'
});

module.exports = {
  mapBehaviourToEventType,
  normalizeRelayMessage,
  createSystemEvent
};
