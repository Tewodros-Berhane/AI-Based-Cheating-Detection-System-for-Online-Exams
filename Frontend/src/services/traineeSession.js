import apis from './Apis';
import { Post } from './axiosCall';

let resultSocket = null;
let socketSessionKey = null;
let socketRefCount = 0;
let endingInProgress = false;

const RESULT_SOCKET_TIMEOUT_MS = 3000;

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

export const sendAiResult = async (traineeId, testId, behaviour) => {
  if (!traineeId || !behaviour) return false;

  const socket = ensureResultSocket(traineeId, testId);
  const ready = await waitForSocketOpen(socket);
  if (!ready || !socket || socket.readyState !== WebSocket.OPEN) {
    return false;
  }

  socket.send(JSON.stringify({ type: 'ai-result', traineeId, testId, behaviour }));
  return true;
};

export const endTraineeTest = async ({
  traineeId,
  testId,
  controlChannel,
  mediaStream,
  setMediaStream,
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

    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
      if (setMediaStream) setMediaStream(null);
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
