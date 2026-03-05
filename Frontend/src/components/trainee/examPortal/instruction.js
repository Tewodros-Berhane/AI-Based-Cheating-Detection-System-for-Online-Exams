import React, { useContext, useEffect, useMemo, useState } from 'react';
import { connect } from 'react-redux';
import { Button, Icon, message, Tag } from 'antd-compat';
import { ProceedtoTest, fetchTestdata } from '../../../actions/traineeAction';
import { MediaStreamContext } from '../../../contexts/MediaStreamContext';
import PreflightWizard from './preflightWizard';
import './portal.css';

function Instruction(props) {
  const { mediaStream, setMediaStream } = useContext(MediaStreamContext);
  const [permissions, setPermissions] = useState({
    cameraGranted: false,
    microphoneGranted: false
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
    if (!mediaStream) {
      setPermissions({
        cameraGranted: false,
        microphoneGranted: false
      });
      return;
    }

    const hasVideoTrack = mediaStream.getVideoTracks().length > 0;
    const hasAudioTrack = mediaStream.getAudioTracks().length > 0;
    setPermissions({
      cameraGranted: hasVideoTrack || !safePolicy.requireCamera,
      microphoneGranted: hasAudioTrack || !safePolicy.requireMicrophone
    });
  }, [mediaStream, safePolicy.requireCamera, safePolicy.requireMicrophone]);

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

  const handleGivePermission = async () => {
    if (
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function'
    ) {
      const cameraResult = await verifyCameraAccess();
      const microphoneResult = await verifyMicrophoneAccess();

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

      setPermissions({
        cameraGranted: cameraResult.granted,
        microphoneGranted: microphoneResult.granted
      });

      const checksPassed =
        (!safePolicy.requireCamera || cameraResult.granted) &&
        (!safePolicy.requireMicrophone || microphoneResult.granted);

      if (checksPassed) {
        message.success(
          safePolicy.requireMicrophone
            ? 'Required camera and microphone checks passed.'
            : 'Required camera check passed.'
        );
      } else {
        message.error(
          safePolicy.requireMicrophone
            ? 'Required checks failed. Please allow camera and microphone access.'
            : 'Required camera check failed. Please allow camera access.'
        );
      }

      if (cameraResult.stream && !cameraResult.granted) {
        stopStream(cameraResult.stream);
      }
      if (microphoneResult.stream && !microphoneResult.granted) {
        stopStream(microphoneResult.stream);
      }
    } else {
      setPermissions({
        cameraGranted: false,
        microphoneGranted: false
      });
      message.error('This browser does not support camera/microphone access.');
    }
  };

  const requiredPermissionsSatisfied =
    (!safePolicy.requireCamera || permissions.cameraGranted) &&
    (!safePolicy.requireMicrophone || permissions.microphoneGranted);

  const handleProceed = async () => {
    if (!requiredPermissionsSatisfied) {
      message.error(
        safePolicy.requireMicrophone
          ? 'Verify required camera and microphone checks before entering the exam.'
          : 'Verify required camera check before entering the exam.'
      );
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
            {`Screen Sharing: ${safePolicy.requireScreenShare ? 'Required before start' : 'Optional'}`}
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

