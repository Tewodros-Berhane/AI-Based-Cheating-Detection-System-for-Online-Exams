import React, { useContext, useState } from 'react';
import { connect } from 'react-redux';
import Alert from '../../common/alert';
import { Button, Row, Col, Checkbox, Modal, Popconfirm, Icon } from 'antd-compat';
import { switchQuestion, updateIsMarked, updateTraineeAnswerLocal, markTraineeAnswersSynced, updateTraineeSessionMeta, fetchTestdata } from '../../../actions/traineeAction';
import { MediaStreamContext } from '../../../contexts/MediaStreamContext';
import { endTraineeTest, flushAnswerDrafts } from '../../../services/traineeSession';
import './singleQuestion.css';
import './portal.css';

function SingleQuestion(props) {
  const context = useContext(MediaStreamContext);
  const [previewImage, setPreviewImage] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');

  const activeQuestionIndex = props.trainee.activeQuestionIndex;
  const currentQuestion = props.trainee.questions[activeQuestionIndex];
  const totalQuestions = props.trainee.questions.length;
  const answerMeta = props.trainee.answers[activeQuestionIndex] || { chosenOption: [], isMarked: false };
  const selectedAnswerIds = Array.isArray(answerMeta.chosenOption) ? answerMeta.chosenOption.map((item) => String(item)) : [];
  const isLastQuestion = activeQuestionIndex === totalQuestions - 1;
  const isAnswered = selectedAnswerIds.length > 0;
  const optionList = currentQuestion.options || [];

  const ticked = selectedAnswerIds.length;
  const optionState = optionList.map((option) => ({
    ...option,
    checked: selectedAnswerIds.includes(String(option._id))
  }));

  const syncAnswersNow = async ({ silent = false } = {}) => {
    const result = await flushAnswerDrafts({
      traineeId: props.trainee.traineeid,
      testId: props.trainee.testid,
      answers: props.trainee.answers,
      activeQuestionIndex,
      sessionVersion: props.trainee.sessionVersion
    });

    if (result.skipped) {
      return true;
    }

    if (result.success && result.data) {
      props.markTraineeAnswersSynced({
        questionIds: result.questionIds || [],
        sessionVersion: Number(result.data.sessionVersion || props.trainee.sessionVersion || 0),
        lastSavedQuestionIndex: Number(result.data.lastSavedQuestionIndex || activeQuestionIndex),
        lastSyncedAt: result.data.lastClientSyncAt || new Date().toISOString()
      });
      props.updateTraineeSessionMeta({
        sessionVersion: Number(result.data.sessionVersion || props.trainee.sessionVersion || 0),
        lastSavedQuestionIndex: Number(result.data.lastSavedQuestionIndex || activeQuestionIndex),
        lastHeartbeatAt: result.data.lastHeartbeatAt || props.trainee.lastHeartbeatAt,
        lastSyncedAt: result.data.lastClientSyncAt || new Date().toISOString(),
        disconnectCount: Number(result.data.disconnectCount || props.trainee.disconnectCount || 0),
        graceWindowUntil: result.data.graceWindowUntil || props.trainee.graceWindowUntil,
        sessionConnectionStatus: result.data.sessionConnectionStatus || props.trainee.sessionConnectionStatus,
        m_left: typeof result.data.m_left === 'number' ? result.data.m_left : props.trainee.m_left,
        s_left: typeof result.data.s_left === 'number' ? result.data.s_left : props.trainee.s_left,
        completed: Boolean(result.data.completed)
      });
      return true;
    }

    if (!silent) {
      Alert('error', 'Error!', result.message || 'Unable to save your latest answer.');
    }
    return false;
  };

  const endExam = async () => {
    const response = await endTraineeTest({
      traineeId: props.trainee.traineeid,
      testId: props.trainee.testid,
      controlChannel: context && context.controlChannel,
      mediaStream: context && context.mediaStream,
      screenStream: context && context.screenStream,
      setMediaStream: context && context.setMediaStream,
      setScreenStream: context && context.setScreenStream,
      clearMediaResources: context && context.clearMediaResources,
      refreshTestState: props.fetchTestdata
    });

    if (!response.success) {
      Alert('error', 'Error!', response.message || 'Unable to end test.');
    }
  };

  const confirmEndExam = async () => {
    if (navigator.onLine === false) {
      Alert('error', 'Offline', 'Reconnect to the internet before submitting your exam.');
      return;
    }

    const saved = await syncAnswersNow();
    if (!saved) return;
    await endExam();
  };

  const previous = async () => {
    if (navigator.onLine !== false && props.trainee.answers.some((answer) => answer.isDirty)) {
      await syncAnswersNow({ silent: true });
    }
    if (activeQuestionIndex > 0) {
      props.switchQuestion(activeQuestionIndex - 1);
    }
  };

  const next = async () => {
    if (navigator.onLine !== false && props.trainee.answers.some((answer) => answer.isDirty)) {
      await syncAnswersNow({ silent: true });
    }
    if (activeQuestionIndex < props.trainee.questions.length - 1) {
      props.switchQuestion(activeQuestionIndex + 1);
    }
  };

  const mark = () => {
    const answersCopy = [...props.trainee.answers];
    const currentAnswer = answersCopy[activeQuestionIndex];
    answersCopy[activeQuestionIndex] = {
      ...currentAnswer,
      isMarked: !currentAnswer.isMarked
    };
    props.updateIsMarked(answersCopy);
  };

  const onAnswerChange = (optionIndex, checked, optionId) => {
    const ansCount = currentQuestion.anscount;
    const nextAnswers = [...selectedAnswerIds];

    if (checked) {
      if (ticked === ansCount) {
        Alert('error', 'Error!', 'Clear selected options to select another option');
        return;
      }
      if (!nextAnswers.includes(String(optionId))) {
        nextAnswers.push(String(optionId));
      }
    } else {
      const removeIndex = nextAnswers.indexOf(String(optionId));
      if (removeIndex >= 0) {
        nextAnswers.splice(removeIndex, 1);
      }
    }

    props.updateTraineeAnswerLocal({
      questionIndex: activeQuestionIndex,
      questionId: currentQuestion._id,
      chosenOption: nextAnswers
    });
  };

  const getOptionLabel = (index) => {
    const alphabetStart = 65;
    if (index < 26) return String.fromCharCode(alphabetStart + index);
    const first = String.fromCharCode(alphabetStart + Math.floor(index / 26) - 1);
    const second = String.fromCharCode(alphabetStart + (index % 26));
    return `${first}${second}`;
  };

  const openImagePreview = (url, title) => {
    if (!url) return;
    setPreviewImage(url);
    setPreviewTitle(title || 'Image preview');
  };

  const closeImagePreview = () => {
    setPreviewImage('');
    setPreviewTitle('');
  };

  return (
    <div className="single-question-shell">
      <div className="exam-question-layout">
        <aside className="exam-question-info">
          <h4>{`Question ${activeQuestionIndex + 1}`}</h4>
          <p className="exam-question-info-status">{isAnswered ? 'Answered' : 'Not yet answered'}</p>
          <p className="exam-question-info-marks">{`Marked out of ${currentQuestion.weightage || '-'}`}</p>
          <button type="button" className={`question-flag-link ${answerMeta?.isMarked ? 'is-marked' : ''}`} onClick={mark}>
            <Icon type="flag" />
            <span>{answerMeta?.isMarked ? 'Unflag question' : 'Flag question'}</span>
          </button>
          {props.mode === 'mobile' && (
            <Button className="open-sidebar-button" onClick={props.triggerSidebar}>
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
                  onClick={() => openImagePreview(currentQuestion.quesimg, 'Question image')}
                >
                  <img alt="Question" src={currentQuestion.quesimg} className="question-image" />
                  <span className="question-image-trigger-label">Click to expand</span>
                </button>
              )}
            </div>

            <div className="options">
              <Row gutter={[0, 6]}>
                {optionState.map((option, index) => (
                  <Col span={24} key={option._id || index} className="option-col">
                    <label className={`option-row ${option.checked ? 'selected' : ''}`}>
                      <Checkbox
                        checked={option.checked}
                        onChange={(event) => onAnswerChange(index, event.target.checked, option._id)}
                        className="option-checkbox"
                      />
                      <span className="option-index">{`${getOptionLabel(index).toLowerCase()}.`}</span>
                      <span className="option-label">{option.optbody}</span>
                      {option.optimg && (
                        <button
                          type="button"
                          className="option-image-trigger"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            openImagePreview(option.optimg, `Option ${getOptionLabel(index)} image`);
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
        <Button className="control-button previous-btn" onClick={previous} disabled={activeQuestionIndex === 0}>
          Previous
        </Button>

        {!isLastQuestion ? (
          <Button className="control-button next-btn" onClick={next}>
            {answerMeta?.isDirty ? 'Save & Next' : 'Next'}
          </Button>
        ) : (
          <Popconfirm
            title="Submit and end this exam session?"
            onConfirm={confirmEndExam}
            okText="End Exam"
            cancelText="Cancel"
            overlayClassName="trainee-popconfirm"
          >
            <Button className="control-button end-btn">
              {answerMeta?.isDirty ? 'Save & End Exam' : 'End Exam'}
            </Button>
          </Popconfirm>
        )}
      </div>

      <Modal
        title={previewTitle}
        open={Boolean(previewImage)}
        onCancel={closeImagePreview}
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

const mapStateToProps = (state) => ({
  trainee: state.trainee
});

export default connect(mapStateToProps, {
  switchQuestion,
  updateIsMarked,
  updateTraineeAnswerLocal,
  markTraineeAnswersSynced,
  updateTraineeSessionMeta,
  fetchTestdata
})(SingleQuestion);
