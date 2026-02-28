import React, { Component } from 'react'
import { connect } from 'react-redux';
import './portal.css';
import SingleQuestion from './singleQuestion';
import { fetchTraineeTestQuestions,fetchTraineeTestAnswerSheet } from '../../../actions/traineeAction'

class Question extends Component {

    componentDidMount(){
        this.props.fetchTraineeTestQuestions(this.props.trainee.testid);
        this.props.fetchTraineeTestAnswerSheet(this.props.trainee.testid,this.props.trainee.traineeid)
    }
    render() {
        const hasExamData = this.props.trainee.answers.length>0 && this.props.trainee.questions.length>0;
        return (
            <div className="question-holder">
                <div className="single-question-container">
                    {hasExamData ? (
                        <SingleQuestion mode={this.props.mode} triggerSidebar={this.props.triggerSidebar}  key={this.props.trainee.activeQuestionIndex} />
                    ) : (
                        <div className="exam-loading-state">
                            <h3>Preparing your exam workspace...</h3>
                            <p>Loading questions and answer sheet.</p>
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
    fetchTraineeTestQuestions,
    fetchTraineeTestAnswerSheet
})(Question);
