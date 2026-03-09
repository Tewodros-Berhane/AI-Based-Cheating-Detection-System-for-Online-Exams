const config = require('config');

const DEFAULT_GRACE_WINDOW_MS = 120000;
const DEFAULT_HEARTBEAT_INTERVAL_MS = 10000;
const DEFAULT_HEARTBEAT_STALE_MS = 25000;

const getConfigNumber = (path, fallback) => {
  if (!config.has(path)) {
    return fallback;
  }

  const raw = Number(config.get(path));
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
};

const getGraceWindowMs = () => getConfigNumber('session.graceWindowMs', DEFAULT_GRACE_WINDOW_MS);
const getHeartbeatIntervalMs = () => getConfigNumber('session.heartbeatIntervalMs', DEFAULT_HEARTBEAT_INTERVAL_MS);
const getHeartbeatStaleMs = () => getConfigNumber('session.heartbeatStaleMs', DEFAULT_HEARTBEAT_STALE_MS);

const toTimestamp = (value) => {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) {
    return numeric;
  }
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const computeRemainingSeconds = ({ startTime, durationMinutes, now = Date.now() }) => {
  const startTimeMs = toTimestamp(startTime);
  const durationSeconds = Math.max(0, Number(durationMinutes || 0) * 60);

  if (!startTimeMs || durationSeconds <= 0) {
    return 0;
  }

  const elapsedSeconds = Math.max(0, (now - startTimeMs) / 1000);
  return Math.max(0, Math.floor(durationSeconds - elapsedSeconds));
};

const hasSessionTimedOut = ({ startTime, durationMinutes, now = Date.now() }) => {
  return computeRemainingSeconds({ startTime, durationMinutes, now }) <= 0;
};

const buildGraceWindowUntil = (now = Date.now()) => new Date(now + getGraceWindowMs());

const getHeartbeatAgeMs = (answerSheet, now = Date.now()) => {
  if (!answerSheet || !answerSheet.lastHeartbeatAt) {
    return null;
  }
  const heartbeatMs = toTimestamp(answerSheet.lastHeartbeatAt);
  if (!heartbeatMs) {
    return null;
  }
  return Math.max(0, now - heartbeatMs);
};

const hasGraceWindowExpired = (answerSheet, now = Date.now()) => {
  if (!answerSheet || answerSheet.completed) {
    return false;
  }

  const heartbeatAgeMs = getHeartbeatAgeMs(answerSheet, now);
  if (heartbeatAgeMs === null || heartbeatAgeMs <= getHeartbeatStaleMs()) {
    return false;
  }

  const graceWindowUntil = toTimestamp(answerSheet.graceWindowUntil);
  return graceWindowUntil > 0 && graceWindowUntil <= now;
};

const getSessionConnectionStatus = (answerSheet, now = Date.now()) => {
  if (!answerSheet) {
    return 'not_started';
  }

  if (answerSheet.completed) {
    return 'finished';
  }

  const heartbeatAgeMs = getHeartbeatAgeMs(answerSheet, now);
  if (heartbeatAgeMs === null || heartbeatAgeMs <= getHeartbeatStaleMs()) {
    return 'online';
  }

  const graceWindowUntil = toTimestamp(answerSheet.graceWindowUntil);
  if (graceWindowUntil > now) {
    return 'reconnecting';
  }

  return 'disconnected';
};

module.exports = {
  getGraceWindowMs,
  getHeartbeatIntervalMs,
  getHeartbeatStaleMs,
  toTimestamp,
  computeRemainingSeconds,
  hasSessionTimedOut,
  buildGraceWindowUntil,
  getHeartbeatAgeMs,
  hasGraceWindowExpired,
  getSessionConnectionStatus
};
