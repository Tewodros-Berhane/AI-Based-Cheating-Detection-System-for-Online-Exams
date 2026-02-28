const WebSocket = require('ws');

class RelayRouter {
  constructor({ maxParticipantsPerSession = 20, roleRoutes = {} } = {}) {
    this.maxParticipantsPerSession = maxParticipantsPerSession;
    this.roleRoutes = roleRoutes;
    this.sessions = new Map();
    this.totalConnections = 0;
  }

  ensureSession(sessionId) {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, new Map());
    }
    return this.sessions.get(sessionId);
  }

  sessionParticipantCount(sessionMap) {
    let count = 0;
    sessionMap.forEach((sockets) => {
      count += sockets.size;
    });
    return count;
  }

  registerConnection({ sessionId, role, ws }) {
    const sessionMap = this.ensureSession(sessionId);
    const participantCount = this.sessionParticipantCount(sessionMap);
    if (participantCount >= this.maxParticipantsPerSession) {
      return { ok: false, reason: 'Max participants per session reached' };
    }

    if (!sessionMap.has(role)) {
      sessionMap.set(role, new Set());
    }
    sessionMap.get(role).add(ws);
    this.totalConnections += 1;
    return { ok: true };
  }

  unregisterConnection({ sessionId, role, ws }) {
    const sessionMap = this.sessions.get(sessionId);
    if (!sessionMap) return;

    if (sessionMap.has(role)) {
      const roleSet = sessionMap.get(role);
      if (roleSet.delete(ws)) {
        this.totalConnections = Math.max(0, this.totalConnections - 1);
      }
      if (!roleSet.size) {
        sessionMap.delete(role);
      }
    }

    if (!sessionMap.size) {
      this.sessions.delete(sessionId);
    }
  }

  targetRoles(fromRole, explicitRoles) {
    if (Array.isArray(explicitRoles) && explicitRoles.length) {
      return explicitRoles;
    }
    return this.roleRoutes[fromRole] || [];
  }

  routePayload({ sessionId, fromRole, payload, explicitTargetRoles = null }) {
    const sessionMap = this.sessions.get(sessionId);
    if (!sessionMap) return 0;

    const targets = this.targetRoles(fromRole, explicitTargetRoles);
    let delivered = 0;

    targets.forEach((targetRole) => {
      const roleSet = sessionMap.get(targetRole);
      if (!roleSet) return;

      roleSet.forEach((socket) => {
        if (socket.readyState !== WebSocket.OPEN) return;
        socket.send(payload);
        delivered += 1;
      });
    });

    return delivered;
  }

  snapshot() {
    return {
      activeSessions: this.sessions.size,
      activeConnections: this.totalConnections
    };
  }
}

module.exports = RelayRouter;

