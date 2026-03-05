import React from 'react';
import { connect } from 'react-redux';
import { Button, Empty } from 'antd-compat';
import { SecurePost } from '../../../services/axiosCall';
import apis from '../../../services/Apis';
import Alert from '../../common/alert';
import { Navigate } from 'react-router-dom';
import './newtest.css';

class FinalQuestionView extends React.Component {
    constructor(props){
        super(props);
        this.state = {
            testid: null
        };
    }

    createtest = ()=>{
        SecurePost({
            url: apis.CREATE_TEST,
            data: {
                type: this.props.test.newtestFormData.testType,
                title: this.props.test.newtestFormData.testTitle,
                questions: this.props.test.newtestFormData.testQuestions,
                duration: this.props.test.newtestFormData.testDuration,
                subjects: this.props.test.newtestFormData.testSubject,
                organisation: this.props.test.newtestFormData.OrganisationName,
                integrityMode: this.props.test.newtestFormData.integrityMode,
                preflightEnabled: Boolean(this.props.test.newtestFormData.preflightEnabled)
            }
        }).then((response)=>{
            if(response.data.success){
                Alert('success', 'Exam paper Created Successfully!', 'Please wait, you will automatically be redirected to conduct exam page.');
                setTimeout(()=>{
                    this.setState({
                        testid: response.data.testid
                    });
                }, 3000);
            }
            else{
                Alert('error', 'Error!', response.data.message);
            }
        }).catch(()=>{
            Alert('error', 'Error!', 'Server Error');
        });
    }

    render(){
        if(this.state.testid){
            return <Navigate to={`/user/conducttest?testid=${this.state.testid}`} replace />;
        }

        return (
            <section className="newtest-stage-card">
                <div className="newtest-stage-head">
                    <h4>Finalize</h4>
                    <p>Review selected questions before publishing your exam.</p>
                </div>

                <div className="newtest-final-list">
                    {this.props.test.newtestFormData.testQuestions.length === 0 ? (
                        <div className="newtest-empty-state">
                            <Empty description="No questions selected yet." />
                        </div>
                    ) : (
                        this.props.test.newtestFormData.testQuestions.map((d, i)=>(
                            <Q key={i + 1} _id={d} no={i + 1}/>
                        ))
                    )}
                </div>

                <div className="newtest-stage-actions">
                    <Button type="primary" className="admin-submit-btn newtest-primary-btn" onClick={this.createtest}>
                        Create Exam
                    </Button>
                </div>
            </section>
        );
    }
}

const mapStateToProps = state => ({
    test: state.test
});

export default connect(mapStateToProps, null)(FinalQuestionView);

function QuestionView(props) {
    var _id = props._id;
    var no = props.no;
    var obj = props.test.questionsAvailablebasedonSubject.filter((hero)=>{
        return hero._id === _id;
    });

    if (!obj.length) {
        return null;
    }

    var question = obj[0];
    var optionLabels = ['A', 'B', 'C', 'D', 'E'];

    return (
        <article className="newtest-question-card">
            <div className="newtest-question-head">
                <span className="newtest-question-number">Question {no}</span>
                <span className="newtest-question-marks">{question.weightage} Marks</span>
            </div>

            <div className="newtest-question-body">
                {question.body}
                {question.quesimg ? <img alt="Question" src={question.quesimg} className="newtest-question-image" /> : null}
            </div>

            <div className="newtest-question-options-grid">
                {(question.options || []).map((option, i)=>(
                    <div key={i} className={`newtest-question-option${option.isAnswer ? ' is-answer' : ''}`}>
                        <span className="newtest-question-option-index">{optionLabels[i] || i + 1})</span>
                        <div className="newtest-question-option-content">
                            <span>{option.optbody || '-'}</span>
                            {option.optimg ? <img alt="Option" src={option.optimg} className="newtest-question-option-image" /> : null}
                        </div>
                        {option.isAnswer ? <span className="newtest-question-option-badge">Correct</span> : null}
                    </div>
                ))}
            </div>
        </article>
    );
}

var Q = connect(mapStateToProps, null)(QuestionView);
