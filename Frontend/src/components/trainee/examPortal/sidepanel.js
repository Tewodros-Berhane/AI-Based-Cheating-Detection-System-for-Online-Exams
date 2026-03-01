import React from 'react';
import { connect } from 'react-redux';
import './portal.css';
import Operations from './operations';

const Sidepanel = ({ mode, trainee }) => {
  const candidateName = trainee?.traineeDetails?.name || 'Candidate';
  return (
    <div className={`side-panel-in-exam-dashboard navigator-only ${mode === 'desktop' ? 'w-20' : 'w-100'}`}>
      <div className="navigator-candidate-name" title={candidateName}>
        {candidateName}
      </div>
      <Operations />
    </div>
  );
};

const mapStateToProps = (state) => ({
  trainee: state.trainee,
});

export default connect(mapStateToProps)(Sidepanel);
