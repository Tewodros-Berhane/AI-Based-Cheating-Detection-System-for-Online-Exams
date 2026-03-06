import React from 'react';
import { connect } from 'react-redux';
import Alert from '../../common/alert';
import apis from '../../../services/Apis';
import { Post } from '../../../services/axiosCall';
import { Button, Row, Col, Checkbox, Modal, Popconfirm, Icon } from 'antd-compat';
import { switchQuestion, updateIsMarked, fetchTestdata } from '../../../actions/traineeAction';
import { MediaStreamContext } from '../../../contexts/MediaStreamContext';
import { endTraineeTest } from '../../../services/traineeSession';
import './singleQuestion.css';
import './portal.css';

class SingleQuestion extends React.Component {
  static contextType = MediaStreamContext;

  constructor(props) {
    super(props);
    this.state = {
      AnswerSelected: false,
      options: this.props.trainee.questions[this.props.trainee.activeQuestionIndex].options,
      answers: this.props.trainee.answers[this.props.trainee.activeQuestionIndex].chosenOption,
      ticked: 0,
      previewImage: '',
      previewTitle: ''
    };
  }

  componentDidMount() {
    this.setState((prevState) => {
      let ticked = 0;
      const options = prevState.options.map((option) => {
        const checked = prevState.answers.includes(option._id);
        if (checked) ticked += 1;
        return { ...option, checked };
      });

      return {
        ticked,
        options
      };
    });
  }

  saveToCloud = () => {
    return Post({
      url: `${apis.UPDATE_ANSWERS}`,
      data: {
        testid: this.props.trainee.testid,
        userid: this.props.trainee.traineeid,
        qid: this.props.trainee.questions[this.props.trainee.activeQuestionIndex]._id,
        newAnswer: this.state.answers
      }
    })
      .then((response) => {
        if (response.data.success) {
          const updatedAnswers = [...this.props.trainee.answers];
          updatedAnswers[this.props.trainee.activeQuestionIndex] = {
            ...updatedAnswers[this.props.trainee.activeQuestionIndex],
            chosenOption: this.state.answers,
            isAnswered: true
          };
          this.props.updateIsMarked(updatedAnswers);
          return true;
        }
        this.props.fetchTestdata(this.props.trainee.testid, this.props.trainee.traineeid);
        Alert('error', 'Error!', response.data.message);
        return false;
      })
      .catch(() => {
        Alert('error', 'Error!', 'Server Error');
        return false;
      });
  };

  endExam = async () => {
    const {
      controlChannel,
      mediaStream,
      screenStream,
      setMediaStream,
      setScreenStream,
      clearMediaResources
    } = this.context || {};
    const response = await endTraineeTest({
      traineeId: this.props.trainee.traineeid,
      testId: this.props.trainee.testid,
      controlChannel,
      mediaStream,
      screenStream,
      setMediaStream,
      setScreenStream,
      clearMediaResources,
      refreshTestState: this.props.fetchTestdata
    });

    if (!response.success) {
      Alert('error', 'Error!', response.message || 'Unable to end test.');
    }
  };

  confirmEndExam = async () => {
    if (this.state.AnswerSelected) {
      const saved = await this.saveToCloud();
      if (!saved) return;
    }
    await this.endExam();
  };

  previous = () => {
    if (this.props.trainee.activeQuestionIndex > 0) {
      this.props.switchQuestion(this.props.trainee.activeQuestionIndex - 1);
    }
  };

  next = () => {
    if (this.state.AnswerSelected) {
      this.saveToCloud();
    }
    if (this.props.trainee.activeQuestionIndex < this.props.trainee.questions.length - 1) {
      this.props.switchQuestion(this.props.trainee.activeQuestionIndex + 1);
    }
  };

  mark = () => {
    const answersCopy = [...this.props.trainee.answers];
    const currentAnswer = answersCopy[this.props.trainee.activeQuestionIndex];
    currentAnswer.isMarked = !this.props.trainee.answers[this.props.trainee.activeQuestionIndex].isMarked;
    answersCopy[this.props.trainee.activeQuestionIndex] = currentAnswer;
    this.props.updateIsMarked(answersCopy);
  };

  onAnswerChange = (optionIndex, checked, optionId) => {
    const ansCount = this.props.trainee.questions[this.props.trainee.activeQuestionIndex].anscount;
    if (checked) {
      if (this.state.ticked === ansCount) {
        return Alert('error', 'Error!', 'Clear selected options to select another option');
      }

      const options = [...this.state.options];
      options[optionIndex] = { ...options[optionIndex], checked: true };
      const answers = [...this.state.answers, optionId];
      this.setState((prevState) => ({
        AnswerSelected: prevState.ticked === ansCount - 1,
        ticked: prevState.ticked + 1,
        options,
        answers
      }));
      return undefined;
    }

    const options = [...this.state.options];
    options[optionIndex] = { ...options[optionIndex], checked: false };
    const answers = [...this.state.answers];
    const removeIndex = answers.indexOf(optionId);
    answers.splice(removeIndex, 1);
    this.setState((prevState) => ({
      AnswerSelected: false,
      ticked: prevState.ticked - 1,
      options,
      answers
    }));
    return undefined;
  };

  getOptionLabel = (index) => {
    const alphabetStart = 65;
    if (index < 26) return String.fromCharCode(alphabetStart + index);
    const first = String.fromCharCode(alphabetStart + Math.floor(index / 26) - 1);
    const second = String.fromCharCode(alphabetStart + (index % 26));
    return `${first}${second}`;
  };

  openImagePreview = (url, title) => {
    if (!url) return;
    this.setState({
      previewImage: url,
      previewTitle: title || 'Image preview'
    });
  };

  closeImagePreview = () => {
    this.setState({
      previewImage: '',
      previewTitle: ''
    });
  };

  render() {
    const activeQuestionIndex = this.props.trainee.activeQuestionIndex;
    const currentQuestion = this.props.trainee.questions[activeQuestionIndex];
    const totalQuestions = this.props.trainee.questions.length;
    const answerMeta = this.props.trainee.answers[activeQuestionIndex];
    const isLastQuestion = activeQuestionIndex === totalQuestions - 1;
    const isAnswered = answerMeta && (answerMeta.isAnswered || this.state.answers.length > 0);
    const { previewImage, previewTitle } = this.state;

    return (
      <div className="single-question-shell">
        <div className="exam-question-layout">
          <aside className="exam-question-info">
            <h4>{`Question ${activeQuestionIndex + 1}`}</h4>
            <p className="exam-question-info-status">{isAnswered ? 'Answered' : 'Not yet answered'}</p>
            <p className="exam-question-info-marks">{`Marked out of ${currentQuestion.weightage || '-'}`}</p>
            <button type="button" className={`question-flag-link ${answerMeta?.isMarked ? 'is-marked' : ''}`} onClick={this.mark}>
              <Icon type="flag" />
              <span>{answerMeta?.isMarked ? 'Unflag question' : 'Flag question'}</span>
            </button>
            {this.props.mode === 'mobile' && (
              <Button className="open-sidebar-button" onClick={this.props.triggerSidebar}>
                Open Navigator
              </Button>
            )}
          </aside>

          <section className="exam-question-content">
            <div className="question-panel">
              <div className="question-body">
                <h3 className="question-body-title">{currentQuestion.body}</h3>
                {currentQuestion.quesimg && (
                  <button
                    type="button"
                    className="question-image-trigger"
                    onClick={() => this.openImagePreview(currentQuestion.quesimg, 'Question image')}
                  >
                    <img alt="Question" src={currentQuestion.quesimg} className="question-image" />
                    <span className="question-image-trigger-label">Click to expand</span>
                  </button>
                )}
              </div>

              <div className="options">
                <Row gutter={[0, 6]}>
                  {this.state.options.map((option, index) => (
                    <Col span={24} key={option._id || index} className="option-col">
                      <label className={`option-row ${option.checked ? 'selected' : ''}`}>
                        <Checkbox
                          checked={option.checked}
                          onChange={(event) => this.onAnswerChange(index, event.target.checked, option._id)}
                          className="option-checkbox"
                        />
                        <span className="option-index">{`${this.getOptionLabel(index).toLowerCase()}.`}</span>
                        <span className="option-label">{option.optbody}</span>
                        {option.optimg && (
                          <button
                            type="button"
                            className="option-image-trigger"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              this.openImagePreview(option.optimg, `Option ${this.getOptionLabel(index)} image`);
                            }}
                          >
                            <img alt="Option" src={option.optimg} className="option-image" />
                            <span>View</span>
                          </button>
                        )}
                      </label>
                    </Col>
                  ))}
                </Row>
              </div>
            </div>
          </section>
        </div>

        <div className="control-buttons">
          <Button className="control-button previous-btn" onClick={this.previous} disabled={activeQuestionIndex === 0}>
            Previous
          </Button>

          {!isLastQuestion ? (
            <Button className="control-button next-btn" onClick={this.next}>
              {this.state.AnswerSelected ? 'Save & Next' : 'Next'}
            </Button>
          ) : (
            <Popconfirm
              title="Submit and end this exam session?"
              onConfirm={this.confirmEndExam}
              okText="End Exam"
              cancelText="Cancel"
              overlayClassName="trainee-popconfirm"
            >
              <Button className="control-button end-btn">
                {this.state.AnswerSelected ? 'Save & End Exam' : 'End Exam'}
              </Button>
            </Popconfirm>
          )}
        </div>

        <Modal
          title={previewTitle}
          open={Boolean(previewImage)}
          onCancel={this.closeImagePreview}
          footer={null}
          width={840}
          centered
          className="question-image-viewer-modal"
        >
          {previewImage && (
            <img alt={previewTitle} src={previewImage} className="question-image-preview" />
          )}
        </Modal>
      </div>
    );
  }
}

const mapStateToProps = (state) => ({
  trainee: state.trainee
});

export default connect(mapStateToProps, {
  switchQuestion,
  updateIsMarked,
  fetchTestdata
})(SingleQuestion);
