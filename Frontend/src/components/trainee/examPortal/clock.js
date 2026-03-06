import React, { useState, useEffect, useContext, useCallback } from 'react';
import { connect } from 'react-redux';
import { fetchTestdata } from '../../../actions/traineeAction';
import './portal.css';
import Alert from '../../common/alert';
import { MediaStreamContext } from '../../../contexts/MediaStreamContext';
import { endTraineeTest } from '../../../services/traineeSession';

const Clock = ({ trainee, fetchTestdata, variant = 'panel' }) => {
  const [remainingSeconds, setRemainingSeconds] = useState(trainee.m_left * 60 + trainee.s_left);
  const {
    controlChannel,
    mediaStream,
    screenStream,
    setMediaStream,
    setScreenStream,
    clearMediaResources
  } = useContext(MediaStreamContext);

  const endTest = useCallback(async () => {
    const response = await endTraineeTest({
      traineeId: trainee.traineeid,
      testId: trainee.testid,
      controlChannel,
      mediaStream,
      screenStream,
      setMediaStream,
      setScreenStream,
      clearMediaResources,
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
    screenStream,
    setMediaStream,
    setScreenStream,
    clearMediaResources,
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
  const localHours = Math.floor(remainingSeconds / 3600);
  const hh = localHours.toString().padStart(2, '0');
  const mm = Math.floor((remainingSeconds % 3600) / 60).toString().padStart(2, '0');
  const ss = localSeconds.toString().padStart(2, '0');
  const formatted = localHours > 0
    ? `${hh}:${mm}:${ss}`
    : `${localMinutes.toString().padStart(2, '0')}:${localSeconds.toString().padStart(2, '0')}`;
  const isCritical = remainingSeconds <= 300;
  const isWarning = !isCritical && remainingSeconds <= 900;

  if (variant === 'inline') {
    return (
      <div className={`clock-inline ${isCritical ? 'critical' : isWarning ? 'warning' : ''}`}>
        <span className="clock-inline-label">Time left</span>
        <strong className="clock-inline-value">{formatted}</strong>
      </div>
    );
  }

  return (
    <div className={`clock-wrapper ${isCritical ? 'critical' : isWarning ? 'warning' : ''}`}>
      <p className="clock-label">Time Remaining</p>
      <div className="clock-container">
        {formatted}
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
