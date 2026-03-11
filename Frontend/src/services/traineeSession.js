import apis from './Apis';
import { Post } from './axiosCall';

let resultSocket = null;
let socketSessionKey = null;
let socketRefCount = 0;
let endingInProgress = false;
const monitoringEventCache = new Map();

const RESULT_SOCKET_TIMEOUT_MS = 3000;
const TRAINEE_SESSION_EVENT = 'exam-shield:trainee-session';
const DRAFT_CACHE_PREFIX = 'exam-shield:answer-draft';

const buildSessionKey = (traineeId, testId) => `${testId || 'default'}:${traineeId}`;
const buildDraftStorageKey = (traineeId, testId) => `${DRAFT_CACHE_PREFIX}:${buildSessionKey(traineeId, testId)}`;
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

const normalizeAnswerIds = (values = []) => Array.from(new Set((Array.isArray(values) ? values : []).map((value) => String(value))));

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

export const loadAnswerDraft = (traineeId, testId) => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(buildDraftStorageKey(traineeId, testId));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (error) {
    return null;
  }
};

export const persistAnswerDraft = ({ traineeId, testId, answers = [], activeQuestionIndex = 0, sessionVersion = 0, lastSyncedAt = null }) => {
  if (typeof window === 'undefined' || !traineeId || !testId) {
    return;
  }

  const dirtyEntries = answers
    .filter((answer) => answer && answer.isDirty)
    .map((answer) => ({
      questionid: String(answer.questionid),
      chosenOption: normalizeAnswerIds(answer.chosenOption || []),
      updatedAt: answer.lastLocalUpdatedAt || Date.now()
    }));

  const payload = {
    saveVersion: Number(sessionVersion || 0),
    activeQuestionIndex: Number(activeQuestionIndex || 0),
    updatedAt: Date.now(),
    lastSyncedAt: lastSyncedAt || null,
    answers: dirtyEntries
  };

  try {
    if (dirtyEntries.length === 0) {
      window.localStorage.removeItem(buildDraftStorageKey(traineeId, testId));
      return;
    }
    window.localStorage.setItem(buildDraftStorageKey(traineeId, testId), JSON.stringify(payload));
  } catch (error) {
    console.error('Unable to persist answer draft cache:', error);
  }
};

export const clearAnswerDraft = (traineeId, testId) => {
  if (typeof window === 'undefined' || !traineeId || !testId) {
    return;
  }
  try {
    window.localStorage.removeItem(buildDraftStorageKey(traineeId, testId));
  } catch (error) {
    console.error('Unable to clear answer draft cache:', error);
  }
};

export const getDirtyAnswerEntries = (answers = []) =>
  answers
    .filter((answer) => answer && answer.isDirty)
    .map((answer) => ({
      qid: String(answer.questionid),
      newAnswer: normalizeAnswerIds(answer.chosenOption || [])
    }));

export const requestSessionHeartbeat = ({ traineeId, testId, activeQuestionIndex, sessionVersion, pendingChanges }) =>
  Post({
    url: apis.TRAINEE_SESSION_HEARTBEAT,
    data: {
      testid: testId,
      userid: traineeId,
      activeQuestionIndex,
      saveVersion: sessionVersion,
      pendingChanges
    }
  });

export const requestSessionResume = ({ traineeId, testId }) =>
  Post({
    url: apis.TRAINEE_SESSION_RESUME,
    data: {
      testid: testId,
      userid: traineeId
    }
  });

export const flushAnswerDrafts = async ({ traineeId, testId, answers = [], activeQuestionIndex = 0, sessionVersion = 0 }) => {
  const dirtyAnswers = getDirtyAnswerEntries(answers);
  if (!traineeId || !testId || dirtyAnswers.length === 0) {
    return {
      skipped: true,
      questionIds: []
    };
  }

  const response = await Post({
    url: apis.TRAINEE_BATCH_SAVE_ANSWERS,
    data: {
      testid: testId,
      userid: traineeId,
      answers: dirtyAnswers,
      saveVersion: sessionVersion,
      lastSavedQuestionIndex: activeQuestionIndex
    }
  });

  const payload = response && response.data ? response.data : { success: false, message: 'Unexpected response.' };
  return {
    ...payload,
    questionIds: dirtyAnswers.map((entry) => entry.qid)
  };
};

export const flushAnswerDraftsWithBeacon = ({ traineeId, testId, answers = [], activeQuestionIndex = 0, sessionVersion = 0 }) => {
  if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function' || !traineeId || !testId) {
    return false;
  }

  const dirtyAnswers = getDirtyAnswerEntries(answers);
  if (dirtyAnswers.length === 0) {
    return false;
  }

  const payload = {
    testid: testId,
    userid: traineeId,
    answers: dirtyAnswers,
    saveVersion: sessionVersion,
    lastSavedQuestionIndex: activeQuestionIndex
  };

  try {
    return navigator.sendBeacon(
      `${apis.BASE}${apis.TRAINEE_BATCH_SAVE_ANSWERS}`,
      new Blob([JSON.stringify(payload)], { type: 'application/json' })
    );
  } catch (error) {
    return false;
  }
};

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
    return { success: false, message: 'Missing examinee ID or exam ID.' };
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
    clearAnswerDraft(traineeId, testId);

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
    console.error('Unable to end examinee test:', error);
    return { success: false, message: 'Something went wrong while ending the exam. Please try again.' };
  } finally {
    endingInProgress = false;
  }
};
