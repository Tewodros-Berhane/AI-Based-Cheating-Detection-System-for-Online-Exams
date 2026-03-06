const os = require('os');
const config = require('config');
const WebSocket = require('ws');

const logger = require('../logger');
const metrics = require('../metrics');
const { sendFailureAlert } = require('../alerts');
const RelayRouter = require('./relayRouter');
const RelayBus = require('./relayBus');
const proctorTimeline = require('../proctorTimeline');

const defaultSessionBuilder = ({ traineeId, examId }) => (examId ? `${examId}:${traineeId}` : traineeId);

const toRawMessage = (message) => (typeof message === 'string' ? message : message.toString());

const createRelayServer = ({
  name,
  port,
  roleRoutes,
  allowedRoles = ['trainee', 'trainer', 'proctor'],
  buildSessionId = defaultSessionBuilder
}) => {
  const numericPort = Number(port);
  const relayConfig = config.has('services.relay') ? config.get('services.relay') : {};
  const nodeId = process.env.NODE_ID || relayConfig.nodeId || os.hostname();
  const maxParticipantsPerSession = Number(
    process.env.RELAY_MAX_PARTICIPANTS || relayConfig.maxParticipantsPerSession || 20
  );
  const heartbeatIntervalMs = Number(
    process.env.RELAY_HEARTBEAT_INTERVAL_MS || relayConfig.heartbeatIntervalMs || 30000
  );
  const redisUrl = process.env.RELAY_REDIS_URL || relayConfig.redisUrl || '';
  const channelPrefix = process.env.RELAY_CHANNEL_PREFIX || relayConfig.channelPrefix || 'exam-shield';

  const relayLogger = logger.child({ component: 'relay', relay: name, port: numericPort });
  const router = new RelayRouter({ maxParticipantsPerSession, roleRoutes });
  const bus = new RelayBus({ redisUrl, channelPrefix });
  const topic = `relay:${name}:events`;

  const wss = new WebSocket.Server({ port: numericPort });

  const updateGauges = () => {
    const snapshot = router.snapshot();
    metrics.setGauge(
      'ws_active_sessions',
      { relay: name },
      snapshot.activeSessions,
      'Active websocket relay sessions'
    );
    metrics.setGauge(
      'ws_active_connections',
      { relay: name },
      snapshot.activeConnections,
      'Active websocket relay connections'
    );
  };

  Promise.resolve(
    bus.subscribe(topic, (event) => {
      if (!event || event.nodeId === nodeId) return;
      const delivered = router.routePayload({
        sessionId: event.sessionId,
        fromRole: event.fromRole,
        payload: event.payload,
        explicitTargetRoles: event.targetRoles
      });
      if (delivered > 0) {
        metrics.incCounter(
          'ws_messages_routed_total',
          { relay: name, mode: 'cross_node', fromRole: event.fromRole },
          delivered,
          'Websocket relay routed messages'
        );
      }
    })
  ).catch((error) => {
    relayLogger.error('relay_bus_subscribe_failed', { error: logger.normalizeError(error) });
  });

  wss.on('connection', (ws, req) => {
    const urlParams = new URL(req.url, `http://${req.headers.host}`).searchParams;
    const role = (urlParams.get('role') || '').toLowerCase();
    const traineeId = urlParams.get('traineeid') || urlParams.get('traineeId');
    const examId = urlParams.get('examid') || urlParams.get('testid') || '';
    const sessionId = urlParams.get('sessionid') || buildSessionId({ traineeId, examId });

    if (!traineeId || !sessionId || !allowedRoles.includes(role)) {
      metrics.incCounter(
        'ws_connections_rejected_total',
        { relay: name, reason: 'invalid_handshake' },
        1,
        'Rejected websocket relay connection attempts'
      );
      ws.close(1008, 'Invalid websocket handshake');
      return;
    }

    const registration = router.registerConnection({ sessionId, role, ws });
    if (!registration.ok) {
      metrics.incCounter(
        'ws_connections_rejected_total',
        { relay: name, reason: 'capacity' },
        1
      );
      ws.close(1013, registration.reason);
      return;
    }

    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    metrics.incCounter(
      'ws_connections_opened_total',
      { relay: name, role },
      1,
      'Opened websocket relay connections'
    );
    updateGauges();
    relayLogger.info('relay_client_connected', { role, traineeId, sessionId });

    ws.on('message', async (message) => {
      const raw = toRawMessage(message);
      metrics.incCounter(
        'ws_messages_in_total',
        { relay: name, fromRole: role },
        1,
        'Incoming websocket relay messages'
      );

      let parsed = null;
      let targetRoles = null;
      try {
        parsed = JSON.parse(raw);
        if (Array.isArray(parsed.targetRoles) && parsed.targetRoles.length) {
          targetRoles = parsed.targetRoles;
        }
      } catch (error) {
        // Non-JSON payloads are still relayable.
      }

      if (name === 'result' && parsed) {
        try {
          await proctorTimeline.ingestRelayPayload({
            sessionId,
            traineeId,
            testId: examId,
            payload: parsed
          });
        } catch (error) {
          relayLogger.warn('relay_proctor_ingest_failed', {
            sessionId,
            traineeId,
            eventType: parsed.type || 'unknown',
            error: logger.normalizeError(error)
          });
        }
      }

      const deliveredLocal = router.routePayload({
        sessionId,
        fromRole: role,
        payload: raw,
        explicitTargetRoles: targetRoles
      });

      if (deliveredLocal > 0) {
        metrics.incCounter(
          'ws_messages_routed_total',
          { relay: name, mode: 'local', fromRole: role },
          deliveredLocal
        );
      }

      await bus.publish(topic, {
        nodeId,
        relay: name,
        sessionId,
        fromRole: role,
        targetRoles,
        payload: raw
      });
    });

    ws.on('close', () => {
      router.unregisterConnection({ sessionId, role, ws });
      updateGauges();
      relayLogger.info('relay_client_disconnected', { role, traineeId, sessionId });
    });

    ws.on('error', (error) => {
      relayLogger.warn('relay_socket_error', {
        role,
        traineeId,
        sessionId,
        error: logger.normalizeError(error)
      });
    });
  });

  const heartbeatTimer = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        ws.terminate();
        return;
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, heartbeatIntervalMs);

  wss.on('close', () => {
    clearInterval(heartbeatTimer);
  });

  wss.on('listening', () => {
    relayLogger.info('relay_server_started', {
      port: numericPort,
      mode: redisUrl ? 'cluster' : 'single-node',
      maxParticipantsPerSession,
      heartbeatIntervalMs
    });
  });

  wss.on('error', (error) => {
    relayLogger.error('relay_server_error', { error: logger.normalizeError(error) });
    sendFailureAlert({
      source: `ws-relay-${name}`,
      event: 'relay_server_error',
      severity: 'critical',
      message: error.message || 'Relay server failure',
      details: logger.normalizeError(error)
    });
  });

  return { wss, router };
};

module.exports = createRelayServer;
