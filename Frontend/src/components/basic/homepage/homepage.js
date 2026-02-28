import React from 'react';
import './homepage.css'; 
import { connect } from 'react-redux';
import Login from '../login/login';
import auth from '../../../services/AuthServices';
import { Navigate } from 'react-router-dom';


function Homepage(props) {
  if(auth.retriveToken() && auth.retriveToken()!=='undefined'){
    console.log('Logged In');
    return <Navigate to='/user/home' replace />
  }
  else{
    console.log('Not Logged In');
    return (
      <div className="homepage-shell">
        <div className="homepage-container">
          <section className="homepage-panel">
            <p className="homepage-eyebrow">Modern Exam Operations</p>
            <h1 className="homepage-title">Run secure online exams with real-time intelligence.</h1>
            <p className="homepage-description">
              Manage question banks, control exam sessions, and monitor candidate behavior from one streamlined workspace.
            </p>
            <div className="homepage-highlights">
              <div className="homepage-highlight">Live proctoring signals for suspicious behavior patterns</div>
              <div className="homepage-highlight">Role-based tools for admins, examiners, and candidates</div>
              <div className="homepage-highlight">Fast exam lifecycle: registration, launch, submission, and scoring</div>
            </div>
          </section>
          <section className="homepage-login-panel">
            <Login />
          </section>
        </div>
      </div>
    );
  }
}

const mapStateToProps = state => ({
  user : state.user
});

export default connect(mapStateToProps,{
  
})(Homepage);
