import React from 'react';
import { connect } from 'react-redux';
import './portal.css';
import user_icon from './user.png'

function Trainee(props) {
    const name = props.trainee.traineeDetails.name || 'Candidate';
    const candidateId = props.trainee.traineeid || '';
    const shortId = candidateId ? candidateId.slice(-6).toUpperCase() : '';
    return (
        <div className="loggedin-trainee-container">
            <div className="loggedin-trainee-inner">
                <img alt="User Icon" src={user_icon} className="loggedin-trainee-logo"/>
                <div className="loggedin-trainee-details-container">
                    <p className="trainee-name">{name}</p>
                    <span className="trainee-subtitle">
                        {shortId ? `Candidate #${shortId}` : 'Exam session in progress'}
                    </span>
                </div>
            </div>
        </div>
    )
}

const mapStateToProps = state => ({
    trainee : state.trainee
});




export default connect(mapStateToProps,null)(Trainee);
