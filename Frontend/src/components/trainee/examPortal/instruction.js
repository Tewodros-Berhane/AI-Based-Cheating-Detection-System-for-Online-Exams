import React, { useContext, useState } from 'react';
import { connect } from 'react-redux';
import { Button, Icon, message, Tag } from 'antd-compat';
import { ProceedtoTest, fetchTestdata } from '../../../actions/traineeAction';
import { MediaStreamContext } from '../../../contexts/MediaStreamContext';
import './portal.css';

function Instruction(props) {
  const { mediaStream, setMediaStream } = useContext(MediaStreamContext);
  const [permissionGranted, setPermissionGranted] = useState(!!mediaStream);

  const handleGivePermission = () => {
    if (
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function'
    ) {
      navigator.mediaDevices
        .getUserMedia({ video: true, audio: true })
        .then((stream) => {
          setMediaStream(stream);
          setPermissionGranted(true);
          message.success('Camera and microphone permission granted.');
        })
        .catch(() => {
          setPermissionGranted(false);
          message.error('Permission denied. Please allow camera and microphone access.');
        });
    } else {
      setPermissionGranted(false);
      message.error('This browser does not support camera/microphone access.');
    }
  };

  const handleProceed = async () => {
    if (!permissionGranted) {
      message.error('Grant camera and microphone access before entering the exam.');
      return;
    }
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
              <li>Your live camera image must match your registered face image.</li>
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
        <div className={`permission-badge ${permissionGranted ? 'granted' : 'pending'}`}>
          <Icon type={permissionGranted ? 'check-circle' : 'warning'} />
          <span>{permissionGranted ? 'Camera and microphone access granted' : 'Camera and microphone access pending'}</span>
        </div>

        <div className="instruction-actions">
          <Button type="default" onClick={handleGivePermission} className="permission-button">
            <Icon type="camera" className="instruction-action-icon" />
            <span>Verify Camera & Mic</span>
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

