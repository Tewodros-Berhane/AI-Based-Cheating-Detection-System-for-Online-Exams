import React, { Component } from 'react'
import { connect } from 'react-redux';
import './portal.css';
import SingleQuestion from './singleQuestion';
import Clock from './clock';
import { fetchTraineeTestQuestions } from '../../../actions/traineeAction'

class Question extends Component {

    componentDidMount(){
        this.props.fetchTraineeTestQuestions(this.props.trainee.testid);
    }
    render() {
        const hasExamData = this.props.trainee.answers.length>0 && this.props.trainee.questions.length>0;
        const examMeta = this.props.trainee.examMeta || {};
        const examTitle = examMeta.title || 'Exam Session';

        return (
            <div className="question-holder">
                <div className="exam-session-header">
                    <h2 className="exam-session-title">{examTitle}</h2>
                    <Clock variant="inline" />
                </div>
                <div className="single-question-container">
                    {hasExamData ? (
                        <SingleQuestion mode={this.props.mode} triggerSidebar={this.props.triggerSidebar}  key={this.props.trainee.activeQuestionIndex} />
                    ) : (
                        <div className="exam-loading-state">
                            <h3>Preparing your exam workspace...</h3>
                            <p>Loading questions and saved answers.</p>
                        </div>
                    )}
                </div>
            </div>
        )
    }
}


const mapStateToProps = state => ({
    trainee : state.trainee
});

export default connect(mapStateToProps,{
    fetchTraineeTestQuestions
})(Question);
