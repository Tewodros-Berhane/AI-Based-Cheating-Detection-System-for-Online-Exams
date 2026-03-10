const EVENT_RULES = {
  AI_NORMAL: {
    baseScore: 5,
    message: 'Monitoring active.',
    defaultConfidence: 0.7
  },
  AI_SUSPICIOUS: {
    baseScore: 45,
    message: 'Suspicious behavior detected.',
    defaultConfidence: 0.82
  },
  AI_CHEATING: {
    baseScore: 85,
    message: 'High-risk cheating signal detected.',
    defaultConfidence: 0.95
  },
  NO_FACE: {
    baseScore: 35,
    message: 'Candidate face was not detected.',
    defaultConfidence: 0.92
  },
  MULTI_FACE: {
    baseScore: 70,
    message: 'Multiple faces were detected.',
    defaultConfidence: 0.96
  },
  FACE_MISMATCH: {
    baseScore: 75,
    message: 'Live face did not match the registered reference.',
    defaultConfidence: 0.97
  },
  LOOKING_AWAY: {
    baseScore: 25,
    message: 'Candidate appears to be looking away frequently.',
    defaultConfidence: 0.8
  },
  AUDIO_SUSPICIOUS: {
    baseScore: 40,
    message: 'Suspicious audio activity detected.',
    defaultConfidence: 0.82
  },
  AUDIO_MULTIPLE_VOICES: {
    baseScore: 65,
    message: 'Multiple voices detected in the environment.',
    defaultConfidence: 0.94
  },
  EXAM_STARTED: {
    baseScore: 5,
    message: 'Exam session started.',
    defaultConfidence: 1
  },
  EXAM_FINISHED: {
    baseScore: 5,
    message: 'Exam session finished.',
    defaultConfidence: 1,
    isFinished: true
  },
  NETWORK_DROP: {
    baseScore: 20,
    message: 'Connection interruption detected.',
    defaultConfidence: 0.9
  },
  RECONNECTED: {
    baseScore: 10,
    message: 'Connection restored.',
    defaultConfidence: 0.9
  },
  FULLSCREEN_EXIT: {
    baseScore: 60,
    message: 'Candidate exited fullscreen.',
    defaultConfidence: 0.95
  },
  TAB_SWITCH: {
    baseScore: 45,
    message: 'Candidate switched away from the exam view.',
    defaultConfidence: 0.95
  },
  TRAINER_ESCALATE: {
    baseScore: 80,
    message: 'Examiner escalated a proctoring event.',
    defaultConfidence: 1
  },
  TRAINER_ACK: {
    baseScore: 0,
    message: 'Examiner acknowledged an event.',
    defaultConfidence: 1
  }
};

const SOURCE_WEIGHT = {
  AI: 1,
  FACE: 1.1,
  SYSTEM: 1,
  TRAINER: 1
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const toSeverityLevel = (score, isFinished = false) => {
  if (isFinished) return 'FINISHED';
  if (score >= 75) return 'CHEATING';
  if (score >= 50) return 'HIGH_RISK';
  if (score >= 25) return 'SUSPICIOUS';
  return 'NORMAL';
};

const getRule = (eventType) => EVENT_RULES[eventType] || {
  baseScore: 15,
  message: 'Monitoring event recorded.',
  defaultConfidence: 0.8
};

const countRecentEvents = (events, eventType, windowMs, now) =>
  events.filter((event) => {
    if (event.eventType !== eventType) return false;
    const ts = new Date(event.createdAt).getTime();
    return now - ts <= windowMs;
  }).length;

const deriveRepeatMultiplier = ({ eventType, recentEvents, now }) => {
  const sameTypeCount = countRecentEvents(recentEvents, eventType, 2 * 60 * 1000, now);
  return 1 + Math.min(sameTypeCount, 4) * 0.18;
};

const deriveForcedLevel = ({ eventType, recentEvents, now }) => {
  if (eventType === 'AI_CHEATING') {
    return 'CHEATING';
  }

  if (eventType === 'TAB_SWITCH') {
    const recentCount = countRecentEvents(recentEvents, eventType, 2 * 60 * 1000, now) + 1;
    if (recentCount >= 3) {
      return 'HIGH_RISK';
    }
  }

  if (eventType === 'AI_SUSPICIOUS') {
    const recentCount = countRecentEvents(recentEvents, eventType, 2 * 60 * 1000, now) + 1;
    if (recentCount >= 3) {
      return 'HIGH_RISK';
    }
  }

  if (eventType === 'MULTI_FACE') {
    const recentCount = countRecentEvents(recentEvents, eventType, 3 * 60 * 1000, now) + 1;
    if (recentCount >= 2) {
      return 'CHEATING';
    }
  }

  return null;
};

const scoreEvent = ({
  eventType,
  source,
  confidence,
  recentEvents = [],
  explicitSeverityScore = null,
  explicitSeverityLevel = null,
  isFinished = false
}) => {
  const rule = getRule(eventType);
  const now = Date.now();
  const normalizedConfidence = clamp(
    typeof confidence === 'number' ? confidence : rule.defaultConfidence,
    0.2,
    1
  );
  const confidenceWeight = 0.6 + normalizedConfidence * 0.4;
  const sourceWeight = SOURCE_WEIGHT[source] || 1;
  const repeatMultiplier = deriveRepeatMultiplier({ eventType, recentEvents, now });

  let severityScore = explicitSeverityScore;
  if (typeof severityScore !== 'number') {
    severityScore = clamp(
      Math.round(rule.baseScore * sourceWeight * confidenceWeight * repeatMultiplier),
      0,
      100
    );
  }

  let severityLevel = explicitSeverityLevel || toSeverityLevel(severityScore, isFinished || rule.isFinished);
  const forcedLevel = deriveForcedLevel({ eventType, recentEvents, now });
  if (forcedLevel && ['NORMAL', 'SUSPICIOUS', 'HIGH_RISK', 'CHEATING'].indexOf(forcedLevel) > ['NORMAL', 'SUSPICIOUS', 'HIGH_RISK', 'CHEATING'].indexOf(severityLevel)) {
    severityLevel = forcedLevel;
    if (forcedLevel === 'HIGH_RISK') {
      severityScore = Math.max(severityScore, 60);
    }
    if (forcedLevel === 'CHEATING') {
      severityScore = Math.max(severityScore, 85);
    }
  }

  const recentTypes = recentEvents
    .filter((event) => {
      const ts = new Date(event.createdAt).getTime();
      return now - ts <= 60 * 1000;
    })
    .map((event) => event.eventType);

  if (
    eventType === 'FACE_MISMATCH' &&
    recentTypes.includes('AUDIO_MULTIPLE_VOICES')
  ) {
    severityLevel = 'CHEATING';
    severityScore = Math.max(severityScore, 85);
  }

  if (
    eventType === 'AUDIO_MULTIPLE_VOICES' &&
    recentTypes.includes('FACE_MISMATCH')
  ) {
    severityLevel = 'CHEATING';
    severityScore = Math.max(severityScore, 85);
  }

  return {
    rule,
    severityScore,
    severityLevel
  };
};

const computeRollingRisk = ({ recentEvents = [], latestEvent }) => {
  if (!latestEvent) {
    return {
      rollingRiskScore: 0,
      severityLevel: 'NORMAL',
      isFinished: false
    };
  }

  if (latestEvent.eventType === 'EXAM_FINISHED' || latestEvent.severityLevel === 'FINISHED') {
    return {
      rollingRiskScore: latestEvent.severityScore,
      severityLevel: 'FINISHED',
      isFinished: true
    };
  }

  const now = Date.now();
  const relevantEvents = recentEvents.filter((event) => {
    if (event.eventType === 'TRAINER_ACK') return false;
    const ts = new Date(event.createdAt).getTime();
    return now - ts <= 15 * 60 * 1000;
  });

  if (!relevantEvents.length) {
    return {
      rollingRiskScore: latestEvent.severityScore,
      severityLevel: toSeverityLevel(latestEvent.severityScore),
      isFinished: false
    };
  }

  let weightedSum = 0;
  let totalWeight = 0;
  relevantEvents.forEach((event) => {
    const ageMinutes = (now - new Date(event.createdAt).getTime()) / 60000;
    const weight = clamp(1 - ageMinutes / 15, 0.2, 1);
    weightedSum += Number(event.severityScore || 0) * weight;
    totalWeight += weight;
  });

  let rollingRiskScore = totalWeight > 0 ? weightedSum / totalWeight : 0;
  rollingRiskScore = Math.max(rollingRiskScore, Number(latestEvent.severityScore || 0));

  const lastSuspiciousEvent = relevantEvents.find((event) => Number(event.severityScore || 0) >= 25);
  if (lastSuspiciousEvent) {
    const silenceMs = now - new Date(lastSuspiciousEvent.createdAt).getTime();
    if (silenceMs > 5 * 60 * 1000) {
      rollingRiskScore = Math.max(0, rollingRiskScore - 10);
    }
  }

  const roundedScore = clamp(Math.round(rollingRiskScore), 0, 100);
  return {
    rollingRiskScore: roundedScore,
    severityLevel: toSeverityLevel(roundedScore),
    isFinished: false
  };
};

module.exports = {
  EVENT_RULES,
  toSeverityLevel,
  getRule,
  scoreEvent,
  computeRollingRisk
};
