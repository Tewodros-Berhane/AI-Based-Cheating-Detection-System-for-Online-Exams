const config = require('config');
const os = require('os');

const LEVEL_PRIORITY = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

const configuredLevel = (
  process.env.LOG_LEVEL ||
  (config.has('services.logLevel') ? config.get('services.logLevel') : 'info')
).toLowerCase();

const serviceName =
  process.env.SERVICE_NAME ||
  (config.has('services.serviceName') ? config.get('services.serviceName') : 'exam-shield-backend');

const nodeId =
  process.env.NODE_ID ||
  (config.has('services.nodeId') ? config.get('services.nodeId') : os.hostname());

const shouldLog = (level) => {
  const currentPriority = LEVEL_PRIORITY[configuredLevel] || LEVEL_PRIORITY.info;
  const eventPriority = LEVEL_PRIORITY[level] || LEVEL_PRIORITY.info;
  return eventPriority >= currentPriority;
};

const normalizeError = (error) => {
  if (!error) return null;
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }
  return { message: String(error) };
};

const writeLog = (level, message, meta = {}) => {
  if (!shouldLog(level)) return;

  const entry = {
    ts: new Date().toISOString(),
    level,
    service: serviceName,
    nodeId,
    message,
    ...meta
  };

  const payload = JSON.stringify(entry);
  if (level === 'error') {
    console.error(payload);
    return;
  }
  if (level === 'warn') {
    console.warn(payload);
    return;
  }
  console.log(payload);
};

const child = (bindings = {}) => ({
  debug: (message, meta = {}) => writeLog('debug', message, { ...bindings, ...meta }),
  info: (message, meta = {}) => writeLog('info', message, { ...bindings, ...meta }),
  warn: (message, meta = {}) => writeLog('warn', message, { ...bindings, ...meta }),
  error: (message, meta = {}) => writeLog('error', message, { ...bindings, ...meta })
});

module.exports = {
  debug: (message, meta) => writeLog('debug', message, meta),
  info: (message, meta) => writeLog('info', message, meta),
  warn: (message, meta) => writeLog('warn', message, meta),
  error: (message, meta) => writeLog('error', message, meta),
  child,
  normalizeError
};

