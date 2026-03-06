import React, { useContext, useEffect, useMemo, useState } from 'react';
import { connect } from 'react-redux';
import { Button, Icon, message, Tag } from 'antd-compat';
import { ProceedtoTest, fetchTestdata } from '../../../actions/traineeAction';
import { MediaStreamContext } from '../../../contexts/MediaStreamContext';
import PreflightWizard from './preflightWizard';
import './portal.css';

function Instruction(props) {
  const { mediaStream, setMediaStream, screenStream, setScreenStream } = useContext(MediaStreamContext);
  const [permissions, setPermissions] = useState({
    cameraGranted: false,
    microphoneGranted: false,
    screenShareGranted: false
  });
  const [preflightVisible, setPreflightVisible] = useState(false);

  const safePolicy = useMemo(() => {
    const policy = (props.trainee.examMeta && props.trainee.examMeta.integrityPolicy) || {};
    return {
      requireCamera: policy.requireCamera !== false,
      requireMicrophone: Boolean(policy.requireMicrophone),
      requireScreenShare: Boolean(policy.requireScreenShare)
    };
  }, [props.trainee.examMeta]);

  useEffect(() => {
    const hasVideoTrack =
      Boolean(mediaStream) &&
      typeof mediaStream.getVideoTracks === 'function' &&
      mediaStream.getVideoTracks().length > 0;
    const hasAudioTrack =
      Boolean(mediaStream) &&
      typeof mediaStream.getAudioTracks === 'function' &&
      mediaStream.getAudioTracks().length > 0;
    const hasScreenTrack =
      Boolean(screenStream) &&
      typeof screenStream.getVideoTracks === 'function' &&
      screenStream.getVideoTracks().some((track) => track.readyState === 'live');
    setPermissions({
      cameraGranted: hasVideoTrack || !safePolicy.requireCamera,
      microphoneGranted: hasAudioTrack || !safePolicy.requireMicrophone,
      screenShareGranted: hasScreenTrack || !safePolicy.requireScreenShare
    });
  }, [mediaStream, safePolicy.requireCamera, safePolicy.requireMicrophone, safePolicy.requireScreenShare, screenStream]);

  const stopStream = (stream) => {
    if (!stream) return;
    stream.getTracks().forEach((track) => track.stop());
  };

  const verifyCameraAccess = async () => {
    if (!safePolicy.requireCamera) {
      return { granted: true, stream: null };
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      return { granted: stream.getVideoTracks().length > 0, stream };
    } catch (error) {
      return { granted: false, stream: null };
    }
  };

  const verifyMicrophoneAccess = async () => {
    if (!safePolicy.requireMicrophone) {
      return { granted: true, stream: null };
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
      return { granted: stream.getAudioTracks().length > 0, stream };
    } catch (error) {
      return { granted: false, stream: null };
    }
  };

  const verifyScreenShareAccess = async () => {
    if (!safePolicy.requireScreenShare) {
      return { granted: true, stream: screenStream || null };
    }

    const existingTrack =
      screenStream &&
      typeof screenStream.getVideoTracks === 'function' &&
      screenStream.getVideoTracks().find((track) => track.readyState === 'live');

    if (existingTrack) {
      return { granted: true, stream: screenStream };
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const granted = stream.getVideoTracks().some((track) => track.readyState === 'live');
      return { granted, stream: granted ? stream : null };
    } catch (error) {
      return { granted: false, stream: null };
    }
  };

  const formatRequiredChecks = () => {
    const labels = [];
    if (safePolicy.requireCamera) labels.push('camera');
    if (safePolicy.requireMicrophone) labels.push('microphone');
    if (safePolicy.requireScreenShare) labels.push('screen sharing');

    if (labels.length === 0) {
      return 'device';
    }
    if (labels.length === 1) {
      return labels[0];
    }
    if (labels.length === 2) {
      return `${labels[0]} and ${labels[1]}`;
    }
    return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`;
  };

  const handleGivePermission = async () => {
    if (
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function'
    ) {
      const cameraResult = await verifyCameraAccess();
      const microphoneResult = await verifyMicrophoneAccess();
      const screenShareResult = await verifyScreenShareAccess();

      const tracks = [];
      if (cameraResult.stream) {
        tracks.push(...cameraResult.stream.getVideoTracks());
      }
      if (microphoneResult.stream) {
        tracks.push(...microphoneResult.stream.getAudioTracks());
      }

      if (tracks.length > 0) {
        stopStream(mediaStream);
        setMediaStream(new MediaStream(tracks));
      }

      if (screenShareResult.stream && screenShareResult.stream !== screenStream) {
        if (screenStream && typeof screenStream.getTracks === 'function') {
          screenStream.getTracks().forEach((track) => track.stop());
        }
        screenShareResult.stream.getVideoTracks().forEach((track) => {
          track.onended = () => {
            setPermissions((prev) => ({
              ...prev,
              screenShareGranted: false
            }));
            setScreenStream(null);
          };
        });
        setScreenStream(screenShareResult.stream);
      }

      setPermissions({
        cameraGranted: cameraResult.granted,
        microphoneGranted: microphoneResult.granted,
        screenShareGranted: screenShareResult.granted
      });

      const checksPassed =
        (!safePolicy.requireCamera || cameraResult.granted) &&
        (!safePolicy.requireMicrophone || microphoneResult.granted) &&
        (!safePolicy.requireScreenShare || screenShareResult.granted);

      if (checksPassed) {
        message.success(`Required ${formatRequiredChecks()} checks passed.`);
      } else {
        message.error(`Required ${formatRequiredChecks()} checks failed. Please allow access and try again.`);
      }

      if (cameraResult.stream && !cameraResult.granted) {
        stopStream(cameraResult.stream);
      }
      if (microphoneResult.stream && !microphoneResult.granted) {
        stopStream(microphoneResult.stream);
      }
      if (screenShareResult.stream && !screenShareResult.granted) {
        stopStream(screenShareResult.stream);
      }
    } else {
      setPermissions({
        cameraGranted: false,
        microphoneGranted: false,
        screenShareGranted: false
      });
      message.error('This browser does not support camera/microphone access.');
    }
  };

  const requiredPermissionsSatisfied =
    (!safePolicy.requireCamera || permissions.cameraGranted) &&
    (!safePolicy.requireMicrophone || permissions.microphoneGranted) &&
    (!safePolicy.requireScreenShare || permissions.screenShareGranted);

  const handleProceed = async () => {
    if (!requiredPermissionsSatisfied) {
      message.error(`Verify required ${formatRequiredChecks()} checks before entering the exam.`);
      return;
    }
    setPreflightVisible(true);
  };

  const proceedIntoExam = () => {
    setPreflightVisible(false);
    props.ProceedtoTest(props.trainee.testid, props.trainee.traineeid, () => {
      props.fetchTestdata(props.trainee.testid, props.trainee.traineeid);
    });
  };

  return (
    <div className="instruction-page-wrapper">
      <div className="instruction-page-inner">
        <div className="instruction-header">
          <h2>Exam Readiness Checklist</h2>
          <p>Complete these checks before entering your testing room.</p>
        <div className="instruction-meta">
          <Tag className="instruction-meta-chip">Quiet Environment</Tag>
          <Tag className="instruction-meta-chip">Camera On</Tag>
          <Tag className="instruction-meta-chip">Stable Connection</Tag>
        </div>
      </div>
        <div className="instruction-grid">
          <section className="instruction-block">
            <h3>Identity & Environment</h3>
            <ul>
              {props.trainee.faceRecognitionEnabled ? (
                <li>Your live camera image must match your registered face image.</li>
              ) : null}
              {safePolicy.requireScreenShare ? (
                <li>You must keep screen sharing active throughout the exam.</li>
              ) : null}
              <li>Keep your face visible and centered for the entire session.</li>
              <li>Stay in a quiet room and avoid side conversations.</li>
              <li>Do not refresh or close the page once the test begins.</li>
            </ul>
          </section>
          <section className="instruction-block">
            <h3>Exam Rules</h3>
            <ul>
              <li>All questions are compulsory unless marked otherwise.</li>
              <li>You can flag questions and return to them at any time.</li>
              <li>You may update answers until submission or timeout.</li>
              <li>The timer is always visible and auto-submits at zero.</li>
            </ul>
          </section>
        </div>
        <div className={`permission-badge ${requiredPermissionsSatisfied ? 'granted' : 'pending'}`}>
          <Icon type={requiredPermissionsSatisfied ? 'check-circle' : 'warning'} />
          <span>
            {requiredPermissionsSatisfied
              ? 'Required device checks are ready.'
              : 'Required device checks are pending.'}
          </span>
        </div>
        <div className="instruction-meta">
          <Tag className="instruction-meta-chip">
            {`Camera: ${permissions.cameraGranted ? 'Ready' : (safePolicy.requireCamera ? 'Required' : 'Optional')}`}
          </Tag>
          <Tag className="instruction-meta-chip">
            {`Microphone: ${permissions.microphoneGranted ? 'Ready' : (safePolicy.requireMicrophone ? 'Required' : 'Optional')}`}
          </Tag>
          <Tag className="instruction-meta-chip">
            {`Screen Sharing: ${permissions.screenShareGranted ? 'Ready' : (safePolicy.requireScreenShare ? 'Required' : 'Optional')}`}
          </Tag>
        </div>

        <div className="instruction-actions">
          <Button type="default" onClick={handleGivePermission} className="permission-button">
            <Icon type="camera" className="instruction-action-icon" />
            <span>Verify Required Checks</span>
          </Button>
          <Button
            type="primary"
            onClick={handleProceed}
            loading={props.trainee.proceedingToTest}
            className="instruction-enter-button"
          >
            {!props.trainee.proceedingToTest && <Icon type="caret-right" className="instruction-action-icon" />}
            <span>Enter Exam Workspace</span>
          </Button>
        </div>
        <h2 className="instruction-goodluck">Stay focused. You are ready to begin.</h2>
      </div>

      <PreflightWizard
        visible={preflightVisible}
        onClose={() => setPreflightVisible(false)}
        onPassed={proceedIntoExam}
        testId={props.trainee.testid}
        traineeId={props.trainee.traineeid}
        cameraGranted={permissions.cameraGranted}
        microphoneGranted={permissions.microphoneGranted}
        screenShareGranted={permissions.screenShareGranted}
        integrityPolicy={props.trainee.examMeta.integrityPolicy}
        faceRecognitionEnabled={props.trainee.faceRecognitionEnabled}
        traineeFaceImageUrl={props.trainee.traineeDetails.faceImageUrl}
      />
    </div>
  );
}

const mapStateToProps = (state) => ({
  trainee: state.trainee,
});

export default connect(mapStateToProps, {
  ProceedtoTest,
  fetchTestdata,
})(Instruction);

