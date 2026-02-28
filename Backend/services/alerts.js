const config = require('config');
const http = require('http');
const https = require('https');
const { URL } = require('url');

const logger = require('./logger');
const metrics = require('./metrics');

const alertWebhook =
  process.env.FAILURE_ALERT_WEBHOOK_URL ||
  (config.has('services.failureAlertWebhook') ? config.get('services.failureAlertWebhook') : '');

const dedupeWindowMs = Number(
  process.env.FAILURE_ALERT_DEDUPE_MS ||
    (config.has('services.failureAlertDedupeMs') ? config.get('services.failureAlertDedupeMs') : 60000)
);

const alertCache = new Map();

const postJson = (urlString, payload) =>
  new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const body = JSON.stringify(payload);
    const client = url.protocol === 'https:' ? https : http;

    const req = client.request(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        }
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const responseBody = Buffer.concat(chunks).toString('utf8');
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(responseBody);
          } else {
            reject(
              new Error(`Alert webhook failed (${res.statusCode}): ${responseBody || 'No response body'}`)
            );
          }
        });
      }
    );

    req.on('error', reject);
    req.write(body);
    req.end();
  });

const shouldSendAlert = (key) => {
  const now = Date.now();
  const lastSentAt = alertCache.get(key);
  if (!lastSentAt || now - lastSentAt > dedupeWindowMs) {
    alertCache.set(key, now);
    return true;
  }
  return false;
};

const sendFailureAlert = async ({
  source = 'backend',
  event = 'unknown_failure',
  severity = 'error',
  message = 'Unknown failure',
  details = {}
}) => {
  const key = `${source}:${event}:${message}`;
  metrics.incCounter(
    'failure_alerts_total',
    { source, event, severity },
    1,
    'Failure alerts emitted'
  );

  if (!shouldSendAlert(key)) {
    logger.warn('Failure alert suppressed by dedupe window', { source, event, severity, message });
    return;
  }

  const payload = {
    timestamp: new Date().toISOString(),
    source,
    event,
    severity,
    message,
    details
  };

  logger.error('Failure alert', payload);

  if (!alertWebhook) return;

  try {
    await postJson(alertWebhook, payload);
  } catch (error) {
    logger.error('Failed to deliver failure alert webhook', {
      source,
      event,
      webhook: alertWebhook,
      error: logger.normalizeError(error)
    });
  }
};

module.exports = {
  sendFailureAlert
};

