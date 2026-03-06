import apis from './Apis';
import { Post } from './axiosCall';

let resultSocket = null;
let socketSessionKey = null;
let socketRefCount = 0;
let endingInProgress = false;
const monitoringEventCache = new Map();

const RESULT_SOCKET_TIMEOUT_MS = 3000;
const TRAINEE_SESSION_EVENT = 'exam-shield:trainee-session';

const buildSessionKey = (traineeId, testId) => `${testId || 'default'}:${traineeId}`;
const buildResultSocketUrl = (traineeId, testId) => {
  const params = new URLSearchParams({
    role: 'trainee',
    traineeid: traineeId
  });

  if (testId) {
    params.set('testid', testId);
    params.set('sessionid', buildSessionKey(traineeId, testId));
  }

  return `${apis.WS_RESULT_URL}/?${params.toString()}`;
};

const emitSessionSignal = (sessionKey, payload) => {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(TRAINEE_SESSION_EVENT, {
      detail: {
        sessionKey,
        payload
      }
    })
  );
};

const closeResultSocket = () => {
  if (resultSocket) {
    try {
      resultSocket.close();
    } catch (error) {
      console.error('Failed to close result websocket:', error);
    }
  }
  resultSocket = null;
  socketSessionKey = null;
};

const ensureResultSocket = (traineeId, testId) => {
  if (!traineeId) return null;
  const nextSessionKey = buildSessionKey(traineeId, testId);

  if (socketSessionKey && socketSessionKey !== nextSessionKey) {
    closeResultSocket();
  }

  if (!resultSocket || resultSocket.readyState === WebSocket.CLOSED) {
    resultSocket = new WebSocket(buildResultSocketUrl(traineeId, testId));
    socketSessionKey = nextSessionKey;
    resultSocket.onmessage = async (event) => {
      const raw = event.data instanceof Blob ? await event.data.text() : event.data;
      try {
        emitSessionSignal(socketSessionKey, JSON.parse(raw));
      } catch (error) {
        // Ignore non-JSON relay payloads on the trainee socket.
      }
    };
  }

  return resultSocket;
};

const waitForSocketOpen = (socket, timeoutMs = RESULT_SOCKET_TIMEOUT_MS) =>
  new Promise((resolve) => {
    if (!socket) {
      resolve(false);
      return;
    }

    if (socket.readyState === WebSocket.OPEN) {
      resolve(true);
      return;
    }

    const timeout = setTimeout(() => {
      socket.removeEventListener('open', onOpen);
      socket.removeEventListener('error', onError);
      resolve(false);
    }, timeoutMs);

    const onOpen = () => {
      clearTimeout(timeout);
      socket.removeEventListener('error', onError);
      resolve(true);
    };

    const onError = () => {
      clearTimeout(timeout);
      socket.removeEventListener('open', onOpen);
      resolve(false);
    };

    socket.addEventListener('open', onOpen, { once: true });
    socket.addEventListener('error', onError, { once: true });
  });

export const acquireResultSocket = (traineeId, testId) => {
  socketRefCount += 1;
  ensureResultSocket(traineeId, testId);
};

export const releaseResultSocket = () => {
  socketRefCount = Math.max(0, socketRefCount - 1);
  if (socketRefCount === 0) {
    closeResultSocket();
  }
};

export const traineeSessionEventName = TRAINEE_SESSION_EVENT;

export const sendAiResult = async (traineeId, testId, behaviour, options = {}) => {
  if (!traineeId || !behaviour) return false;

  const socket = ensureResultSocket(traineeId, testId);
  const ready = await waitForSocketOpen(socket);
  if (!ready || !socket || socket.readyState !== WebSocket.OPEN) {
    return false;
  }

  socket.send(JSON.stringify({
    type: 'ai-result',
    traineeId,
    testId,
    behaviour,
    confidence: options.confidence,
    signalType: options.signalType,
    message: options.message
  }));
  return true;
};

export const sendMonitoringEvent = async ({
  traineeId,
  testId,
  eventType,
  source = 'SYSTEM',
  message,
  confidence,
  payload = {},
  cooldownMs = 5000
}) => {
  if (!traineeId || !testId || !eventType) {
    return false;
  }

  const cacheKey = `${testId}:${traineeId}:${eventType}`;
  const now = Date.now();
  const lastSentAt = monitoringEventCache.get(cacheKey) || 0;
  if (cooldownMs > 0 && now - lastSentAt < cooldownMs) {
    return false;
  }

  const socket = ensureResultSocket(traineeId, testId);
  const ready = await waitForSocketOpen(socket);
  if (!ready || !socket || socket.readyState !== WebSocket.OPEN) {
    return false;
  }

  monitoringEventCache.set(cacheKey, now);
  socket.send(JSON.stringify({
    type: 'proctor-event',
    traineeId,
    testId,
    eventType,
    source,
    message,
    confidence,
    payload
  }));
  return true;
};

export const endTraineeTest = async ({
  traineeId,
  testId,
  controlChannel,
  mediaStream,
  screenStream,
  setMediaStream,
  setScreenStream,
  clearMediaResources,
  refreshTestState
}) => {
  if (!traineeId || !testId) {
    return { success: false, message: 'Missing trainee id or test id.' };
  }

  if (endingInProgress) {
    return { success: false, message: 'Test end request already in progress.' };
  }

  endingInProgress = true;
  try {
    const response = await Post({
      url: apis.END_TEST,
      data: {
        testid: testId,
        userid: traineeId
      }
    });

    const payload = response?.data || { success: false, message: 'Unexpected response.' };
    if (!payload.success) return payload;

    if (controlChannel && controlChannel.readyState === 'open') {
      controlChannel.send(JSON.stringify({ action: 'endTest' }));
    }

    await sendAiResult(traineeId, testId, 'finished');

    if (typeof clearMediaResources === 'function') {
      clearMediaResources();
    } else {
      if (controlChannel && typeof controlChannel.close === 'function' && controlChannel.readyState !== 'closed') {
        controlChannel.close();
      }

      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
        if (setMediaStream) setMediaStream(null);
      }

      if (screenStream) {
        screenStream.getTracks().forEach((track) => track.stop());
        if (setScreenStream) setScreenStream(null);
      }
    }

    if (typeof refreshTestState === 'function') {
      refreshTestState(testId, traineeId);
    }

    return payload;
  } catch (error) {
    console.error('Unable to end trainee test:', error);
    return { success: false, message: 'Server error while ending test.' };
  } finally {
    endingInProgress = false;
  }
};
