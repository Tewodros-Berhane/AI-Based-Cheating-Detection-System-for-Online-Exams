import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Modal, Progress, Tag } from 'antd-compat';
import { Post } from '../../../services/axiosCall';
import apis from '../../../services/Apis';
import { MediaStreamContext } from '../../../contexts/MediaStreamContext';

const buildClientMeta = () => ({
  userAgent: navigator.userAgent || '',
  platform: navigator.platform || '',
  screenWidth: window.screen ? Number(window.screen.width || 0) : 0,
  screenHeight: window.screen ? Number(window.screen.height || 0) : 0,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || ''
});

const toCheck = (type, passed, reason, value = null) => ({
  checkType: type,
  passed: Boolean(passed),
  reason: reason || '',
  value
});

const checkLabel = {
  camera: 'Camera',
  microphone: 'Microphone',
  fullscreen: 'Fullscreen',
  screen_share: 'Screen sharing',
  face_reference: 'Profile photo',
  network: 'Internet connection'
};

function PreflightWizard({
  visible,
  testId,
  traineeId,
  cameraGranted,
  microphoneGranted,
  integrityPolicy,
  faceRecognitionEnabled,
  traineeFaceImageUrl,
  onClose,
  onPassed
}) {
  const { screenStream, setScreenStream } = useContext(MediaStreamContext);
  const [running, setRunning] = useState(false);
  const [runStatus, setRunStatus] = useState(null);
  const [checks, setChecks] = useState([]);
  const [errorText, setErrorText] = useState('');
  const [missingChecks, setMissingChecks] = useState([]);
  const [missingCheckLabels, setMissingCheckLabels] = useState([]);

  useEffect(() => {
    if (!visible) {
      setRunning(false);
      setRunStatus(null);
      setChecks([]);
      setErrorText('');
      setMissingChecks([]);
      setMissingCheckLabels([]);
    }
  }, [visible]);

  const safePolicy = useMemo(
    () => ({
      requireCamera: Boolean(integrityPolicy && integrityPolicy.requireCamera),
      requireMicrophone: Boolean(integrityPolicy && integrityPolicy.requireMicrophone),
      requireFullscreen: Boolean(integrityPolicy && integrityPolicy.requireFullscreen),
      requireScreenShare: Boolean(integrityPolicy && integrityPolicy.requireScreenShare),
      requireFaceVerification: Boolean(integrityPolicy && integrityPolicy.requireFaceVerification)
    }),
    [integrityPolicy]
  );

  const requiredCheckKeys = useMemo(() => {
    const required = [];
    if (safePolicy.requireCamera) required.push('camera');
    if (safePolicy.requireMicrophone) required.push('microphone');
    if (safePolicy.requireFullscreen) required.push('fullscreen');
    if (safePolicy.requireScreenShare) required.push('screen_share');
    if (safePolicy.requireFaceVerification && faceRecognitionEnabled) required.push('face_reference');
    return required;
  }, [safePolicy, faceRecognitionEnabled]);

  const progressPercent = requiredCheckKeys.length === 0
    ? 0
    : Math.round((checks.filter((item) => requiredCheckKeys.includes(item.checkType)).length / requiredCheckKeys.length) * 100);

  const postCheck = async (nextRunId, check) => {
    await Post({
      url: apis.TRAINEE_PREFLIGHT_CHECK,
      data: {
        runid: nextRunId,
        testid: testId,
        traineeid: traineeId,
        checkType: check.checkType,
        passed: check.passed,
        reason: check.reason,
        value: check.value
      }
    });
  };

  const ensureFullscreenIfRequired = async () => {
    if (!safePolicy.requireFullscreen) {
      return toCheck('fullscreen', true, 'Fullscreen is optional for this exam.');
    }

    try {
      if (document.fullscreenElement) {
        return toCheck('fullscreen', true, 'Fullscreen is already on.');
      }

      if (!document.documentElement || typeof document.documentElement.requestFullscreen !== 'function') {
        return toCheck('fullscreen', false, 'Fullscreen is not supported in this browser.');
      }

      await document.documentElement.requestFullscreen();
      const passed = Boolean(document.fullscreenElement);
      return toCheck(
        'fullscreen',
        passed,
        passed ? 'Fullscreen is on.' : 'Fullscreen permission was not granted.'
      );
    } catch (error) {
      return toCheck('fullscreen', false, 'Could not enable fullscreen.');
    }
  };

  const ensureScreenShareIfRequired = async () => {
    if (!safePolicy.requireScreenShare) {
      return toCheck('screen_share', true, 'Screen sharing is optional for this exam.');
    }

    try {
      const existingTrack = screenStream && typeof screenStream.getVideoTracks === 'function'
        ? screenStream.getVideoTracks().find((track) => track.readyState === 'live')
        : null;

      if (existingTrack) {
        return toCheck('screen_share', true, 'Screen sharing is already active.');
      }

      if (screenStream && typeof screenStream.getTracks === 'function') {
        screenStream.getTracks().forEach((track) => track.stop());
      }

      if (!navigator.mediaDevices || typeof navigator.mediaDevices.getDisplayMedia !== 'function') {
        return toCheck('screen_share', false, 'Screen sharing is not supported in this browser.');
      }

      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false
      });
      const hasVideoTrack = displayStream.getVideoTracks().some((track) => track.readyState === 'live');
      if (!hasVideoTrack) {
        displayStream.getTracks().forEach((track) => track.stop());
        return toCheck('screen_share', false, 'No screen was selected.');
      }

      setScreenStream(displayStream);
      return toCheck('screen_share', true, 'Screen sharing is active.');
    } catch (error) {
      return toCheck('screen_share', false, 'Screen sharing was not allowed.');
    }
  };

  const runPreflight = async () => {
    if (!testId || !traineeId) {
      setErrorText('Missing exam context. Please reload and try again.');
      return;
    }

    setRunning(true);
    setErrorText('');
    setChecks([]);
    setMissingChecks([]);
    setMissingCheckLabels([]);
    setRunStatus('PENDING');

    try {
      const startResponse = await Post({
        url: apis.TRAINEE_PREFLIGHT_START,
        data: {
          testid: testId,
          traineeid: traineeId,
          clientMeta: buildClientMeta()
        }
      });

      if (!startResponse.data || !startResponse.data.success) {
        throw new Error(
          (startResponse.data && startResponse.data.message) || 'Unable to start the system check.'
        );
      }

      const runData = startResponse.data.data || {};

      if (!runData.preflightEnabled) {
        setRunStatus('PASSED');
        if (typeof onPassed === 'function') {
          onPassed();
        }
        return;
      }

      const nextRunId = runData.runid;
      if (!nextRunId) {
        throw new Error('Missing check session id.');
      }

      const localChecks = [];
      if (safePolicy.requireCamera) {
        const cameraCheck = toCheck(
          'camera',
          cameraGranted,
          cameraGranted
            ? 'Camera stream is available.'
            : 'Camera permission is required.'
        );
        localChecks.push(cameraCheck);
        await postCheck(nextRunId, cameraCheck);
      }

      if (safePolicy.requireMicrophone) {
        const micCheck = toCheck(
          'microphone',
          microphoneGranted,
          microphoneGranted
            ? 'Microphone stream is available.'
            : 'Microphone permission is required.'
        );
        localChecks.push(micCheck);
        await postCheck(nextRunId, micCheck);
      }

      if (safePolicy.requireFullscreen) {
        const fullscreenCheck = await ensureFullscreenIfRequired();
        localChecks.push(fullscreenCheck);
        await postCheck(nextRunId, fullscreenCheck);
      }

      if (safePolicy.requireScreenShare) {
        const screenShareCheck = await ensureScreenShareIfRequired();
        localChecks.push(screenShareCheck);
        await postCheck(nextRunId, screenShareCheck);
      }

      const faceRequired = safePolicy.requireFaceVerification && faceRecognitionEnabled;
      if (faceRequired) {
        const faceReady = Boolean(traineeFaceImageUrl);
        const faceCheck = toCheck(
          'face_reference',
          faceReady,
          faceReady
            ? 'Registered face reference is available.'
            : 'Face verification is required but no registered face image was found.'
        );
        localChecks.push(faceCheck);
        await postCheck(nextRunId, faceCheck);
      }

      const networkOnline = typeof navigator.onLine === 'boolean' ? navigator.onLine : true;
      const networkCheck = toCheck(
        'network',
        networkOnline,
        networkOnline
          ? 'Network is reachable.'
          : 'Network appears offline.'
      );
      localChecks.push(networkCheck);
      await postCheck(nextRunId, networkCheck);

      setChecks(localChecks);

      const completeResponse = await Post({
        url: apis.TRAINEE_PREFLIGHT_COMPLETE,
        data: {
          runid: nextRunId,
          testid: testId,
          traineeid: traineeId
        }
      });

      if (!completeResponse.data || !completeResponse.data.success) {
        throw new Error(
          (completeResponse.data && completeResponse.data.message) || 'Unable to complete the system check.'
        );
      }

      const status = completeResponse.data.data && completeResponse.data.data.status;
      const unmet = (completeResponse.data.data && completeResponse.data.data.missingChecks) || [];
      const unmetLabels = (completeResponse.data.data && completeResponse.data.data.missingCheckLabels) || [];
      setMissingChecks(unmet);
      setMissingCheckLabels(unmetLabels);
      setRunStatus(status || 'FAILED');

      if (status === 'PASSED') {
        if (typeof onPassed === 'function') {
          onPassed();
        }
      }
    } catch (error) {
      setRunStatus('FAILED');
      setErrorText((error && error.message) || 'System check failed. Please try again.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <Modal
      visible={visible}
      onCancel={() => !running && typeof onClose === 'function' && onClose()}
      footer={null}
      width={680}
      title="System Check"
      centered
      maskClosable={!running}
      className="trainee-preflight-modal"
    >
      <div className="trainee-preflight-content">
        <div className="trainee-preflight-head">
          <div className="trainee-preflight-title-wrap">
            <h4>Before you start</h4>
            <p>We will quickly check your device setup before entering the exam.</p>
          </div>
          {runStatus ? (
            <Tag className={`trainee-preflight-status ${String(runStatus).toLowerCase()}`}>
              {runStatus}
            </Tag>
          ) : null}
        </div>

        <Progress percent={progressPercent} strokeColor="#3b82f6" trailColor="rgba(148, 163, 184, 0.24)" />

        <div className="trainee-preflight-required">
          {requiredCheckKeys.length === 0 ? (
            <span>No required checks for this mode.</span>
          ) : (
            requiredCheckKeys.map((key) => (
              <Tag key={key} className="trainee-preflight-required-tag">
                {checkLabel[key] || key}
              </Tag>
            ))
          )}
        </div>

        <div className="trainee-preflight-check-list">
          {checks.length === 0 ? (
            <div className="trainee-preflight-empty">No checks run yet.</div>
          ) : (
            checks.map((check, index) => (
              <div
                key={`${check.checkType}-${index}`}
                className={`trainee-preflight-check-item ${check.passed ? 'passed' : 'failed'}`}
              >
                <div className="trainee-preflight-check-main">
                  <strong>{checkLabel[check.checkType] || check.checkType}</strong>
                  <span>{check.passed ? 'Passed' : 'Failed'}</span>
                </div>
                <p>{check.reason}</p>
              </div>
            ))
          )}
        </div>

        {missingChecks.length > 0 ? (
          <Alert
            type="error"
            message={`Please complete: ${(missingCheckLabels.length ? missingCheckLabels : missingChecks.map((key) => checkLabel[key] || key)).join(', ')}`}
            showIcon
          />
        ) : null}

        {errorText ? (
          <Alert
            type="error"
            message={errorText}
            showIcon
          />
        ) : null}

        <div className="trainee-preflight-actions">
          <Button onClick={onClose} disabled={running}>
            Cancel
          </Button>
          <Button type="primary" onClick={runPreflight} loading={running}>
            Start Check
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default PreflightWizard;
