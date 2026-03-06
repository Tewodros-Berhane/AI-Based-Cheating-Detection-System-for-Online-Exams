const crypto = require('crypto');

const logger = require('./logger');
const metrics = require('./metrics');
const ProctorEventModel = require('../models/proctorEvent');
const ProctorRiskSnapshotModel = require('../models/proctorRiskSnapshot');
const { scoreEvent, computeRollingRisk, EVENT_RULES } = require('./proctorSeverityEngine');
const { createSystemEvent, normalizeRelayMessage } = require('./proctorEventNormalizer');

const timelineLogger = logger.child({ component: 'proctor-timeline' });

const buildSessionId = (testid, traineeid) => `${testid}:${traineeid}`;

const toDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const serializeRelatedEvent = (event) => {
  if (!event) {
    return null;
  }

  return {
    id: String(event._id),
    eventId: event.eventId,
    eventType: event.eventType,
    source: event.source,
    severityScore: Number(event.severityScore || 0),
    severityLevel: event.severityLevel,
    message: event.message,
    createdAt: event.createdAt
  };
};

const serializeEvent = (event, relatedEvent = null) => ({
  id: String(event._id),
  eventId: event.eventId,
  testid: String(event.testid),
  traineeid: String(event.traineeid),
  sessionId: event.sessionId,
  eventType: event.eventType,
  source: event.source,
  severityScore: Number(event.severityScore || 0),
  severityLevel: event.severityLevel,
  confidence: typeof event.confidence === 'number' ? event.confidence : 1,
  message: event.message,
  payload: event.payload || {},
  createdAt: event.createdAt,
  acked: Boolean(event.acked),
  ackedBy: event.ackedBy ? String(event.ackedBy) : null,
  ackedAt: event.ackedAt || null,
  relatedEvent: serializeRelatedEvent(relatedEvent)
});

const serializeSnapshot = (snapshot) => ({
  id: String(snapshot._id),
  testid: String(snapshot.testid),
  traineeid: String(snapshot.traineeid),
  sessionId: snapshot.sessionId,
  rollingRiskScore: Number(snapshot.rollingRiskScore || 0),
  severityLevel: snapshot.severityLevel,
  lastEventType: snapshot.lastEventType || '',
  lastEventMessage: snapshot.lastEventMessage || '',
  lastEventAt: snapshot.lastEventAt || null,
  suspiciousCount: Number(snapshot.suspiciousCount || 0),
  highRiskCount: Number(snapshot.highRiskCount || 0),
  criticalCount: Number(snapshot.criticalCount || 0),
  isFinished: Boolean(snapshot.isFinished),
  updatedAt: snapshot.updatedAt || null
});

const listRecentEvents = async ({ testid, traineeid, minutes = 15, limit = 50 }) => {
  const from = new Date(Date.now() - minutes * 60 * 1000);
  return ProctorEventModel.find({
    testid,
    traineeid,
    createdAt: { $gte: from }
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

const findLatestRiskEvent = (events) =>
  events.find((event) => event.eventType !== 'TRAINER_ACK') || events[0] || null;

const refreshSnapshotForSession = async ({ testid, traineeid, sessionId }) => {
  const [recentEvents, allEvents] = await Promise.all([
    listRecentEvents({ testid, traineeid }),
    ProctorEventModel.find({ testid, traineeid }).sort({ createdAt: -1 }).lean()
  ]);

  const latestRiskEvent = findLatestRiskEvent(allEvents);
  const risk = computeRollingRisk({ recentEvents, latestEvent: latestRiskEvent });

  const suspiciousCount = allEvents.filter((event) => event.severityLevel === 'SUSPICIOUS').length;
  const highRiskCount = allEvents.filter((event) => event.severityLevel === 'HIGH_RISK').length;
  const criticalCount = allEvents.filter((event) => event.severityLevel === 'CHEATING').length;

  const snapshot = await ProctorRiskSnapshotModel.findOneAndUpdate(
    { testid, traineeid },
    {
      $set: {
        sessionId,
        rollingRiskScore: risk.rollingRiskScore,
        severityLevel: risk.severityLevel,
        lastEventType: latestRiskEvent ? latestRiskEvent.eventType : '',
        lastEventMessage: latestRiskEvent ? latestRiskEvent.message : '',
        lastEventAt: latestRiskEvent ? latestRiskEvent.createdAt : null,
        suspiciousCount,
        highRiskCount,
        criticalCount,
        isFinished: Boolean(risk.isFinished),
        updatedAt: new Date()
      }
    },
    {
      returnDocument: 'after',
      upsert: true,
      setDefaultsOnInsert: true
    }
  );

  metrics.setGauge(
    'proctor_risk_score',
    { testid: String(testid), traineeid: String(traineeid) },
    risk.rollingRiskScore,
    'Latest rolling proctor risk score per candidate'
  );

  return snapshot;
};

const ingestNormalizedEvent = async (normalizedEvent) => {
  if (!normalizedEvent || !normalizedEvent.testid || !normalizedEvent.traineeid || !normalizedEvent.sessionId) {
    return null;
  }

  const dedupeWindowMs = Number(normalizedEvent.dedupeWindowMs || 0);
  if (normalizedEvent.dedupeKey && dedupeWindowMs > 0) {
    const existing = await ProctorEventModel.findOne({
      testid: normalizedEvent.testid,
      traineeid: normalizedEvent.traineeid,
      dedupeKey: normalizedEvent.dedupeKey,
      createdAt: { $gte: new Date(Date.now() - dedupeWindowMs) }
    }).sort({ createdAt: -1 });

    if (existing) {
      const snapshot = await refreshSnapshotForSession({
        testid: normalizedEvent.testid,
        traineeid: normalizedEvent.traineeid,
        sessionId: normalizedEvent.sessionId
      });
      return {
        event: existing,
        snapshot,
        deduped: true
      };
    }
  }

  const recentEvents = await listRecentEvents({
    testid: normalizedEvent.testid,
    traineeid: normalizedEvent.traineeid
  });

  const scoring = scoreEvent({
    eventType: normalizedEvent.eventType,
    source: normalizedEvent.source,
    confidence: normalizedEvent.confidence,
    recentEvents,
    explicitSeverityScore: normalizedEvent.explicitSeverityScore,
    explicitSeverityLevel: normalizedEvent.explicitSeverityLevel,
    isFinished: normalizedEvent.isFinished
  });

  const event = await ProctorEventModel.create({
    testid: normalizedEvent.testid,
    traineeid: normalizedEvent.traineeid,
    sessionId: normalizedEvent.sessionId,
    eventId: crypto.randomUUID(),
    eventType: normalizedEvent.eventType,
    source: normalizedEvent.source,
    severityScore: scoring.severityScore,
    severityLevel: scoring.severityLevel,
    confidence: typeof normalizedEvent.confidence === 'number'
      ? normalizedEvent.confidence
      : (EVENT_RULES[normalizedEvent.eventType]?.defaultConfidence || 1),
    message: normalizedEvent.message || scoring.rule.message,
    payload: normalizedEvent.payload || {},
    dedupeKey: normalizedEvent.dedupeKey || null
  });

  metrics.incCounter(
    'proctor_events_total',
    {
      eventType: normalizedEvent.eventType,
      severityLevel: scoring.severityLevel,
      source: normalizedEvent.source
    },
    1,
    'Persisted proctor events'
  );

  timelineLogger.info('proctor_event_ingested', {
    sessionId: normalizedEvent.sessionId,
    traineeId: normalizedEvent.traineeid,
    testId: normalizedEvent.testid,
    eventType: normalizedEvent.eventType,
    severityLevel: scoring.severityLevel,
    severityScore: scoring.severityScore
  });

  const snapshot = await refreshSnapshotForSession({
    testid: normalizedEvent.testid,
    traineeid: normalizedEvent.traineeid,
    sessionId: normalizedEvent.sessionId
  });

  return {
    event,
    snapshot,
    deduped: false
  };
};

const ingestRelayPayload = async ({ sessionId, traineeId, testId, payload }) => {
  const normalized = normalizeRelayMessage({ sessionId, traineeId, testId, payload });
  if (!normalized) {
    return null;
  }
  return ingestNormalizedEvent(normalized);
};

const recordSystemEvent = async (input) => ingestNormalizedEvent(createSystemEvent(input));

const listSummary = async ({ testid, traineeIds = [] }) => {
  const query = { testid };
  if (Array.isArray(traineeIds) && traineeIds.length > 0) {
    query.traineeid = { $in: traineeIds };
  }

  const snapshots = await ProctorRiskSnapshotModel.find(query).sort({ updatedAt: -1 }).lean();
  return snapshots.map(serializeSnapshot);
};

const listEvents = async ({
  testid,
  traineeid,
  from,
  to,
  severity,
  eventType,
  page = 1,
  limit = 20
}) => {
  const query = { testid };
  if (traineeid) query.traineeid = traineeid;
  if (severity) query.severityLevel = severity;
  if (eventType) {
    query.eventType = eventType;
  } else {
    query.eventType = { $ne: 'TRAINER_ACK' };
  }
  if (from || to) {
    query.createdAt = {};
    if (from) query.createdAt.$gte = from;
    if (to) query.createdAt.$lte = to;
  }

  const safeLimit = Math.max(1, Math.min(Number(limit || 20), 100));
  const safePage = Math.max(1, Number(page || 1));
  const skip = (safePage - 1) * safeLimit;

  const [items, total] = await Promise.all([
    ProctorEventModel.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean(),
    ProctorEventModel.countDocuments(query)
  ]);

  const relatedEventIds = Array.from(new Set(items
    .map((item) => item && item.payload && item.payload.relatedEventId)
    .filter(Boolean)));

  const relatedEvents = relatedEventIds.length > 0
    ? await ProctorEventModel.find({ eventId: { $in: relatedEventIds } }).lean()
    : [];

  const relatedEventMap = relatedEvents.reduce((accumulator, event) => {
    accumulator[event.eventId] = event;
    return accumulator;
  }, {});

  return {
    items: items.map((item) => serializeEvent(
      item,
      item && item.payload ? relatedEventMap[item.payload.relatedEventId] || null : null
    )),
    total,
    page: safePage,
    limit: safeLimit
  };
};

const acknowledgeEvent = async ({ eventId, ackedBy, note }) => {
  const event = await ProctorEventModel.findOneAndUpdate(
    { eventId },
    {
      $set: {
        acked: true,
        ackedBy,
        ackedAt: new Date()
      }
    },
    { returnDocument: 'after' }
  );

  if (!event) {
    return null;
  }

  await recordSystemEvent({
    testid: event.testid,
    traineeid: event.traineeid,
    sessionId: event.sessionId,
    source: 'TRAINER',
    eventType: 'TRAINER_ACK',
    message: note || 'Trainer acknowledged this event.',
    payload: {
      relatedEventId: event.eventId,
      note: note || ''
    },
    dedupeKey: null
  });

  return event;
};

const escalateEvent = async ({ eventId, escalatedBy, severityLevel, note }) => {
  const event = await ProctorEventModel.findOne({ eventId });
  if (!event) {
    return null;
  }

  const severityScoreMap = {
    NORMAL: 10,
    SUSPICIOUS: 40,
    HIGH_RISK: 65,
    CHEATING: 90,
    FINISHED: 5
  };

  await recordSystemEvent({
    testid: event.testid,
    traineeid: event.traineeid,
    sessionId: event.sessionId,
    source: 'TRAINER',
    eventType: 'TRAINER_ESCALATE',
    message: note || `Trainer escalated event to ${severityLevel || 'HIGH_RISK'}.`,
    payload: {
      relatedEventId: event.eventId,
      escalatedBy,
      note: note || '',
      targetSeverityLevel: severityLevel || 'HIGH_RISK'
    },
    explicitSeverityScore: severityScoreMap[severityLevel] || 65,
    explicitSeverityLevel: severityLevel || 'HIGH_RISK'
  });

  return event;
};

module.exports = {
  buildSessionId,
  toDate,
  serializeEvent,
  serializeSnapshot,
  ingestRelayPayload,
  recordSystemEvent,
  listSummary,
  listEvents,
  acknowledgeEvent,
  escalateEvent,
  refreshSnapshotForSession
};
