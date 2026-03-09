import { useCallback, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  hydrateTraineeSession,
  markTraineeAnswersSynced,
  setTraineeSessionConnection,
  updateTraineeSessionMeta
} from '../../actions/traineeAction';
import {
  acquireResultSocket,
  clearAnswerDraft,
  flushAnswerDrafts,
  flushAnswerDraftsWithBeacon,
  loadAnswerDraft,
  persistAnswerDraft,
  releaseResultSocket,
  requestSessionHeartbeat,
  requestSessionResume
} from '../../services/traineeSession';

const resolveSessionStatus = (data, fallback = 'online') => {
  if (data && typeof data.sessionConnectionStatus === 'string' && data.sessionConnectionStatus) {
    return data.sessionConnectionStatus;
  }

  if (data && data.completed) {
    return 'finished';
  }

  return fallback;
};

const buildMergedAnswers = ({ serverAnswers = [], existingAnswers = [], draft = null, serverSessionVersion = 0, lastSyncedAt = null }) => {
  const existingByQuestionId = existingAnswers.reduce((acc, answer) => {
    if (answer && answer.questionid) {
      acc[String(answer.questionid)] = answer;
    }
    return acc;
  }, {});

  const draftByQuestionId = Array.isArray(draft && draft.answers)
    ? draft.answers.reduce((acc, entry) => {
        if (entry && entry.questionid) {
          acc[String(entry.questionid)] = entry;
        }
        return acc;
      }, {})
    : {};

  const useDraft = Boolean(
    draft &&
    Array.isArray(draft.answers) &&
    draft.answers.length > 0 &&
    Number(draft.saveVersion || 0) > Number(serverSessionVersion || 0)
  );

  const mergedAnswers = (serverAnswers || []).map((answer) => {
    const questionId = String(answer.questionid);
    const existing = existingByQuestionId[questionId] || {};
    const draftEntry = useDraft ? draftByQuestionId[questionId] : null;
    const chosenOption = draftEntry && Array.isArray(draftEntry.chosenOption)
      ? draftEntry.chosenOption.map((item) => String(item))
      : Array.isArray(answer.chosenOption)
        ? answer.chosenOption.map((item) => String(item))
        : [];

    return {
      ...answer,
      chosenOption,
      isMarked: Boolean(existing.isMarked),
      isAnswered: chosenOption.length > 0,
      isDirty: Boolean(draftEntry),
      lastLocalUpdatedAt: draftEntry ? draftEntry.updatedAt || Date.now() : existing.lastLocalUpdatedAt || null,
      lastSyncedAt: lastSyncedAt || existing.lastSyncedAt || null
    };
  });

  return {
    mergedAnswers,
    useDraft
  };
};

export default function TraineeSessionManager({ traineeId, testId }) {
  const dispatch = useDispatch();
  const trainee = useSelector((state) => state.trainee);
  const latestStateRef = useRef(trainee);
  const syncingRef = useRef(false);

  useEffect(() => {
    latestStateRef.current = trainee;
  }, [trainee]);

  const resumeLatest = useCallback(async () => {
    if (!traineeId || !testId) {
      return { success: false };
    }

    dispatch(setTraineeSessionConnection({
      status: navigator.onLine === false ? 'disconnected' : 'reconnecting',
      restorePending: true,
      syncing: syncingRef.current,
      hasOfflineChanges: latestStateRef.current.hasOfflineChanges,
      message: navigator.onLine === false ? 'Offline. Your latest answers are kept locally.' : 'Reconnecting to restore your session.'
    }));

    try {
      const response = await requestSessionResume({ traineeId, testId });
      const payload = response && response.data ? response.data : { success: false, message: 'Unexpected response.' };
      if (!payload.success || !payload.data) {
        dispatch(setTraineeSessionConnection({
          status: 'reconnecting',
          restorePending: false,
          syncing: syncingRef.current,
          hasOfflineChanges: latestStateRef.current.hasOfflineChanges,
          message: payload.message || 'Unable to restore your session.'
        }));
        return payload;
      }

      const draft = loadAnswerDraft(traineeId, testId);
      const { mergedAnswers, useDraft } = buildMergedAnswers({
        serverAnswers: payload.data.answers || [],
        existingAnswers: latestStateRef.current.answers || [],
        draft,
        serverSessionVersion: payload.data.sessionVersion,
        lastSyncedAt: payload.data.lastClientSyncAt || null
      });
      const restoredQuestionIndex = useDraft && Number.isInteger(Number(draft && draft.activeQuestionIndex))
        ? Number(draft.activeQuestionIndex)
        : Number(payload.data.lastSavedQuestionIndex || 0);

      dispatch(hydrateTraineeSession({
        answers: mergedAnswers,
        activeQuestionIndex: restoredQuestionIndex,
        session: {
          ...payload.data,
          hasOfflineChanges: useDraft,
          lastSyncedAt: payload.data.lastClientSyncAt || null
        }
      }));
      dispatch(setTraineeSessionConnection({
        status: resolveSessionStatus(payload.data, 'online'),
        restorePending: false,
        syncing: syncingRef.current,
        hasOfflineChanges: useDraft,
        message: payload.data.completed
          ? 'This exam session has ended.'
          : (payload.data.resumedAfterDisconnect ? 'Connection restored. Your session is active again.' : '')
      }));

      if (!useDraft) {
        clearAnswerDraft(traineeId, testId);
      }

      return {
        ...payload,
        usedDraft: useDraft
      };
    } catch (error) {
      dispatch(setTraineeSessionConnection({
        status: navigator.onLine === false ? 'disconnected' : 'reconnecting',
        restorePending: false,
        syncing: syncingRef.current,
        hasOfflineChanges: latestStateRef.current.hasOfflineChanges,
        message: navigator.onLine === false
          ? 'Offline. Your latest answers are kept locally.'
          : 'Unable to restore your session right now.'
      }));
      return { success: false, message: 'Unable to restore your session right now.' };
    }
  }, [dispatch, testId, traineeId]);

  const flushPendingAnswers = useCallback(async ({ silent = false } = {}) => {
    const currentState = latestStateRef.current;
    if (!traineeId || !testId) {
      return { skipped: true };
    }

    if (syncingRef.current) {
      return { skipped: true };
    }

    syncingRef.current = true;
    dispatch(setTraineeSessionConnection({
      status: navigator.onLine === false ? 'disconnected' : currentState.sessionConnectionStatus || 'online',
      syncing: true,
      restorePending: currentState.sessionRestorePending,
      hasOfflineChanges: currentState.hasOfflineChanges,
      message: silent ? currentState.sessionStatusMessage : 'Saving your latest answers.'
    }));

    try {
      const result = await flushAnswerDrafts({
        traineeId,
        testId,
        answers: currentState.answers || [],
        activeQuestionIndex: currentState.activeQuestionIndex || 0,
        sessionVersion: currentState.sessionVersion || 0
      });

      if (result.skipped) {
        dispatch(setTraineeSessionConnection({
          status: navigator.onLine === false ? 'disconnected' : 'online',
          syncing: false,
          restorePending: currentState.sessionRestorePending,
          hasOfflineChanges: currentState.answers.some((answer) => answer.isDirty),
          message: currentState.sessionStatusMessage
        }));
        return result;
      }

      if (result.success && result.data) {
        dispatch(markTraineeAnswersSynced({
          questionIds: result.questionIds || [],
          sessionVersion: Number(result.data.sessionVersion || currentState.sessionVersion || 0),
          lastSavedQuestionIndex: Number(result.data.lastSavedQuestionIndex || currentState.activeQuestionIndex || 0),
          lastSyncedAt: result.data.lastClientSyncAt || new Date().toISOString()
        }));
        dispatch(updateTraineeSessionMeta({
          sessionVersion: Number(result.data.sessionVersion || currentState.sessionVersion || 0),
          disconnectCount: Number(result.data.disconnectCount || currentState.disconnectCount || 0),
          graceWindowUntil: result.data.graceWindowUntil || currentState.graceWindowUntil,
          completionReason: result.data.completionReason || currentState.completionReason,
          lastSavedQuestionIndex: Number(result.data.lastSavedQuestionIndex || currentState.activeQuestionIndex || 0),
          lastHeartbeatAt: result.data.lastHeartbeatAt || currentState.lastHeartbeatAt,
          sessionConnectionStatus: result.data.sessionConnectionStatus || 'online',
          heartbeatIntervalMs: Number(result.data.heartbeatIntervalMs || currentState.heartbeatIntervalMs || 10000),
          graceWindowMs: Number(result.data.graceWindowMs || currentState.graceWindowMs || 120000),
          lastSyncedAt: result.data.lastClientSyncAt || new Date().toISOString(),
          m_left: typeof result.data.m_left === 'number' ? result.data.m_left : currentState.m_left,
          s_left: typeof result.data.s_left === 'number' ? result.data.s_left : currentState.s_left,
          completed: Boolean(result.data.completed),
          startedWriting: typeof result.data.startedWriting === 'boolean' ? result.data.startedWriting : currentState.startedWriting,
          testconducted: typeof result.data.testconducted === 'boolean' ? result.data.testconducted : currentState.testconducted
        }));
        dispatch(setTraineeSessionConnection({
          status: resolveSessionStatus(result.data, 'online'),
          syncing: false,
          restorePending: currentState.sessionRestorePending,
          hasOfflineChanges: false,
          message: result.data.completed ? 'This exam session has ended.' : (silent ? '' : 'All changes saved.')
        }));
        clearAnswerDraft(traineeId, testId);
        return result;
      }

      if (result.staleUpdate) {
        await resumeLatest();
        return result;
      }

      dispatch(setTraineeSessionConnection({
        status: navigator.onLine === false ? 'disconnected' : 'reconnecting',
        syncing: false,
        restorePending: currentState.sessionRestorePending,
        hasOfflineChanges: true,
        message: result.message || 'Unable to save right now. Your changes remain stored locally.'
      }));
      return result;
    } catch (error) {
      dispatch(setTraineeSessionConnection({
        status: navigator.onLine === false ? 'disconnected' : 'reconnecting',
        syncing: false,
        restorePending: currentState.sessionRestorePending,
        hasOfflineChanges: true,
        message: 'Unable to save right now. Your changes remain stored locally.'
      }));
      return { success: false, message: 'Unable to save right now. Your changes remain stored locally.' };
    } finally {
      syncingRef.current = false;
    }
  }, [dispatch, resumeLatest, testId, traineeId]);

  useEffect(() => {
    if (!traineeId) return undefined;

    acquireResultSocket(traineeId, testId);
    return () => {
      releaseResultSocket();
    };
  }, [traineeId, testId]);

  useEffect(() => {
    if (!traineeId || !testId) {
      return undefined;
    }
    resumeLatest();
    return undefined;
  }, [resumeLatest, testId, traineeId]);

  useEffect(() => {
    if (!traineeId || !testId) {
      return undefined;
    }

    persistAnswerDraft({
      traineeId,
      testId,
      answers: trainee.answers || [],
      activeQuestionIndex: trainee.activeQuestionIndex || 0,
      sessionVersion: trainee.sessionVersion || 0,
      lastSyncedAt: trainee.lastSyncedAt || null
    });

    return undefined;
  }, [trainee.activeQuestionIndex, trainee.answers, trainee.lastSyncedAt, trainee.sessionVersion, testId, traineeId]);

  useEffect(() => {
    if (!traineeId || !testId || !trainee.startedWriting || trainee.LocaltestDone || trainee.testconducted) {
      return undefined;
    }

    const intervalMs = Math.max(8000, Number(trainee.heartbeatIntervalMs || 10000));
    const interval = window.setInterval(async () => {
      const currentState = latestStateRef.current;
      if (navigator.onLine === false) {
        dispatch(setTraineeSessionConnection({
          status: 'disconnected',
          syncing: syncingRef.current,
          restorePending: currentState.sessionRestorePending,
          hasOfflineChanges: currentState.answers.some((answer) => answer.isDirty),
          message: 'Offline. Your latest answers are kept locally.'
        }));
        return;
      }

      try {
        const response = await requestSessionHeartbeat({
          traineeId,
          testId,
          activeQuestionIndex: currentState.activeQuestionIndex || 0,
          sessionVersion: currentState.sessionVersion || 0,
          pendingChanges: currentState.answers.some((answer) => answer.isDirty)
        });
        const payload = response && response.data ? response.data : { success: false };
        if (payload.data) {
          dispatch(updateTraineeSessionMeta({
            sessionVersion: Number(payload.data.sessionVersion || currentState.sessionVersion || 0),
            disconnectCount: Number(payload.data.disconnectCount || currentState.disconnectCount || 0),
            graceWindowUntil: payload.data.graceWindowUntil || currentState.graceWindowUntil,
            completionReason: payload.data.completionReason || currentState.completionReason,
            lastSavedQuestionIndex: Number(payload.data.lastSavedQuestionIndex || currentState.lastSavedQuestionIndex || 0),
            lastHeartbeatAt: payload.data.lastHeartbeatAt || currentState.lastHeartbeatAt,
            sessionConnectionStatus: payload.data.sessionConnectionStatus || 'online',
            heartbeatIntervalMs: Number(payload.data.heartbeatIntervalMs || currentState.heartbeatIntervalMs || 10000),
            graceWindowMs: Number(payload.data.graceWindowMs || currentState.graceWindowMs || 120000),
            m_left: typeof payload.data.m_left === 'number' ? payload.data.m_left : currentState.m_left,
            s_left: typeof payload.data.s_left === 'number' ? payload.data.s_left : currentState.s_left,
            completed: typeof payload.data.completed === 'boolean' ? payload.data.completed : currentState.LocaltestDone
          }));
        }

        dispatch(setTraineeSessionConnection({
          status: payload.success
            ? resolveSessionStatus(payload.data, 'online')
            : (payload.data && payload.data.completed ? 'finished' : 'reconnecting'),
          syncing: syncingRef.current,
          restorePending: currentState.sessionRestorePending,
          hasOfflineChanges: currentState.answers.some((answer) => answer.isDirty),
          message: payload.success
            ? (payload.data && payload.data.completed
              ? 'This exam session has ended.'
              : (payload.data && payload.data.resumedAfterDisconnect ? 'Connection restored. Your session is active again.' : ''))
            : (payload.message || 'Unable to confirm session status.')
        }));
      } catch (error) {
        dispatch(setTraineeSessionConnection({
          status: navigator.onLine === false ? 'disconnected' : 'reconnecting',
          syncing: syncingRef.current,
          restorePending: currentState.sessionRestorePending,
          hasOfflineChanges: currentState.answers.some((answer) => answer.isDirty),
          message: navigator.onLine === false ? 'Offline. Your latest answers are kept locally.' : 'Trying to reconnect to the exam session.'
        }));
      }
    }, intervalMs);

    return () => window.clearInterval(interval);
  }, [dispatch, testId, trainee.LocaltestDone, trainee.heartbeatIntervalMs, trainee.startedWriting, trainee.testconducted, traineeId]);

  useEffect(() => {
    if (!traineeId || !testId || !trainee.startedWriting || trainee.LocaltestDone || trainee.testconducted) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      const currentState = latestStateRef.current;
      const hasDirtyAnswers = currentState.answers.some((answer) => answer.isDirty);
      if (!hasDirtyAnswers || navigator.onLine === false) {
        return;
      }
      flushPendingAnswers({ silent: true });
    }, 12000);

    return () => window.clearInterval(interval);
  }, [flushPendingAnswers, testId, trainee.LocaltestDone, trainee.startedWriting, trainee.testconducted, traineeId]);

  useEffect(() => {
    const handleOnline = async () => {
      await resumeLatest();
      await flushPendingAnswers({ silent: true });
    };

    const handleOffline = () => {
      const currentState = latestStateRef.current;
      dispatch(setTraineeSessionConnection({
        status: 'disconnected',
        syncing: syncingRef.current,
        restorePending: currentState.sessionRestorePending,
        hasOfflineChanges: currentState.answers.some((answer) => answer.isDirty),
        message: 'Offline. Your latest answers are kept locally.'
      }));
    };

    const handlePageHide = () => {
      const currentState = latestStateRef.current;
      persistAnswerDraft({
        traineeId,
        testId,
        answers: currentState.answers || [],
        activeQuestionIndex: currentState.activeQuestionIndex || 0,
        sessionVersion: currentState.sessionVersion || 0,
        lastSyncedAt: currentState.lastSyncedAt || null
      });
      flushAnswerDraftsWithBeacon({
        traineeId,
        testId,
        answers: currentState.answers || [],
        activeQuestionIndex: currentState.activeQuestionIndex || 0,
        sessionVersion: currentState.sessionVersion || 0
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handlePageHide);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handlePageHide);
    };
  }, [dispatch, flushPendingAnswers, resumeLatest, testId, traineeId]);

  return null;
}
