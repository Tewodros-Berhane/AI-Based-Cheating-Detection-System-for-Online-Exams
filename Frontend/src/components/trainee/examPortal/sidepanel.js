import React, { useContext } from 'react';
import { connect } from 'react-redux';
import './portal.css';
import Trainee from './user';
import { Button, Popconfirm } from 'antd-compat';
import Operations from './operations';
import Clock from './clock';
import Alert from '../../common/alert';
import { fetchTestdata } from '../../../actions/traineeAction';
import { MediaStreamContext } from '../../../contexts/MediaStreamContext';
import { endTraineeTest } from '../../../services/traineeSession';

const Sidepanel = ({ mode, trainee, fetchTestdata }) => {
  const { controlChannel, mediaStream, setMediaStream } = useContext(MediaStreamContext);
  const totalQuestions = trainee.answers.length || 0;
  const answeredCount = trainee.answers.filter((item) => item.isAnswered).length;
  const flaggedCount = trainee.answers.filter((item) => item.isMarked).length;

  const endTest = async () => {
    const response = await endTraineeTest({
      traineeId: trainee.traineeid,
      testId: trainee.testid,
      controlChannel,
      mediaStream,
      setMediaStream,
      refreshTestState: fetchTestdata
    });

    if (!response.success) {
      Alert('error', 'Error!', response.message || 'Unable to end test.');
    }
  };

  return (
    <div className={`side-panel-in-exam-dashboard ${mode === 'desktop' ? 'w-20' : 'w-100'}`}>
      <Trainee />
      <Clock />
      <div className="exam-progress-card">
        <div className="exam-progress-row">
          <span>Total</span>
          <strong>{totalQuestions}</strong>
        </div>
        <div className="exam-progress-row">
          <span>Answered</span>
          <strong>{answeredCount}</strong>
        </div>
        <div className="exam-progress-row">
          <span>Flagged</span>
          <strong>{flaggedCount}</strong>
        </div>
      </div>
      <Operations />
      <div className="End-test-container">
        <Popconfirm
          title="Submit and end this exam session?"
          onConfirm={endTest}
          okText="Submit"
          cancelText="Cancel"
        >
          <Button type="default" className="end-exam-button">End Exam</Button>
        </Popconfirm>
      </div>
    </div>
  );
};

const mapStateToProps = state => ({
  trainee: state.trainee
});

export default connect(mapStateToProps, {
  fetchTestdata
})(Sidepanel);

