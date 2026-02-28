import React, { Component } from 'react';
import apis from '../../../services/Apis';
import { SecurePost } from '../../../services/axiosCall';
import Alert from '../../common/alert';
import './conducttes.css';

export default class Questions extends Component {
  constructor(props) {
    super(props);
    this.state = {
      loading: false
    };
  }

  componentDidMount() {
    this.refreshquestionList();
  }

  refreshquestionList = () => {
    this.setState({
      loading: true
    });
    SecurePost({
      url: `${apis.GET_TEST_QUESTIONS}`,
      data: {
        id: this.props.id
      }
    })
      .then((response) => {
        if (response.data.success) {
          this.props.updateQuestiosnTest(response.data.data);
        } else {
          Alert('error', 'Error!', response.data.message);
        }
        this.setState({
          loading: false
        });
      })
      .catch((error) => {
        console.log(error);
        Alert('error', 'Error!', 'Server Error');
        this.setState({
          loading: false
        });
      });
  };

  render() {
    const labels = ['A', 'B', 'C', 'D', 'E'];
    const questions = this.props.questionsOfTest || [];

    return (
      <div className="testdetails-question-list">
        {this.state.loading ? (
          <div className="testdetails-empty">Loading questions...</div>
        ) : questions.length === 0 ? (
          <div className="testdetails-empty">No question records found for this exam.</div>
        ) : (
          questions.map((question, qIndex) => (
            <article className="testdetails-question-card" key={question._id || qIndex}>
              <header className="testdetails-question-head">
                <span className="testdetails-question-number">Question {qIndex + 1}</span>
                <span className="testdetails-question-marks">{question.weightage || 0} Marks</span>
              </header>

              <div className="testdetails-question-body">
                <p>{question.body || '-'}</p>
                {question.quesimg ? (
                  <img alt="Question" src={question.quesimg} className="testdetails-question-image" />
                ) : null}
              </div>

              <div className="testdetails-question-options-grid">
                {(question.options || []).map((option, oIndex) => (
                  <div
                    key={option._id || oIndex}
                    className={`testdetails-question-option${option.isAnswer ? ' is-answer' : ''}`}
                  >
                    <span className="testdetails-option-index">{labels[oIndex] || oIndex + 1}</span>
                    <div className="testdetails-option-content">
                      <p>{option.optbody || '-'}</p>
                      {option.optimg ? (
                        <img alt="Option" src={option.optimg} className="testdetails-option-image" />
                      ) : null}
                    </div>
                    {option.isAnswer ? (
                      <span className="testdetails-option-badge">Correct</span>
                    ) : null}
                  </div>
                ))}
              </div>
            </article>
          ))
        )}
      </div>
    );
  }
}
