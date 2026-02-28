import React, { useState, useEffect, useContext, useCallback } from 'react';
import { connect } from 'react-redux';
import { fetchTestdata } from '../../../actions/traineeAction';
import './portal.css';
import Alert from '../../common/alert';
import { MediaStreamContext } from '../../../contexts/MediaStreamContext';
import { endTraineeTest } from '../../../services/traineeSession';

const Clock = ({ trainee, fetchTestdata }) => {
  const [remainingSeconds, setRemainingSeconds] = useState(trainee.m_left * 60 + trainee.s_left);
  const { controlChannel, mediaStream, setMediaStream } = useContext(MediaStreamContext);

  const endTest = useCallback(async () => {
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
  }, [
    trainee.traineeid,
    trainee.testid,
    controlChannel,
    mediaStream,
    setMediaStream,
    fetchTestdata
  ]);

  useEffect(() => {
    setRemainingSeconds(trainee.m_left * 60 + trainee.s_left);
  }, [trainee.m_left, trainee.s_left]);

  useEffect(() => {
    if (remainingSeconds <= 0) {
      endTest();
      return undefined;
    }

    const clockInterval = setInterval(() => {
      setRemainingSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(clockInterval);
  }, [remainingSeconds, endTest]);

  const localMinutes = Math.floor(remainingSeconds / 60);
  const localSeconds = remainingSeconds % 60;

  return (
    <div className="clock-wrapper">
      <p className="clock-label">Time Remaining</p>
      <div className="clock-container">
        {localMinutes.toString().padStart(2, '0')} :
        {localSeconds.toString().padStart(2, '0')}
      </div>
    </div>
  );
};

const mapStateToProps = state => ({
  trainee: state.trainee
});

export default connect(mapStateToProps, {
  fetchTestdata
})(Clock);
