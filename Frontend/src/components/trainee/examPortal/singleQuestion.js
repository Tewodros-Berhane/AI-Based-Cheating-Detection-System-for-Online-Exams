import React from 'react';
import { connect } from 'react-redux';
import Alert from '../../common/alert';
import apis from '../../../services/Apis';
import { Post } from '../../../services/axiosCall';
import { Icon, Button, Row, Col, Radio, Checkbox } from 'antd';
import { switchQuestion, updateIsMarked, fetchTestdata } from '../../../actions/traineeAction';
import './singleQuestion.css';
import './portal.css';

class SingleQuestion extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      AnswerSelected: false,
      options: this.props.trainee.questions[this.props.trainee.activeQuestionIndex].options,
      answers: this.props.trainee.answers[this.props.trainee.activeQuestionIndex].chosenOption,
      ticked: 0
    };
  }

  componentWillMount() {
    this.setState((prevState) => {
      let t = 0;
      const s = prevState.options.map((d) => {
        for (let ii = 0; ii < prevState.answers.length; ii++) {
          if (prevState.answers[ii] === d._id) {
            t += 1;
            return { ...d, checked: true };
          }
        }
        return { ...d, checked: false };
      });
      return {
        ticked: t,
        options: s
      };
    });
  }

  SaveTocloud = () => {
    Post({
      url: `${apis.UPDATE_ANSWERS}`,
      data: {
        testid: this.props.trainee.testid,
        userid: this.props.trainee.traineeid,
        qid: this.props.trainee.questions[this.props.trainee.activeQuestionIndex]._id,
        newAnswer: this.state.answers
      }
    }).then((response) => {
      if (response.data.success) {
        let t = [...this.props.trainee.answers];
        t[this.props.trainee.activeQuestionIndex] = {
          ...t[this.props.trainee.activeQuestionIndex],
          chosenOption: this.state.answers,
          isAnswered: true
        };
        this.props.updateIsMarked(t);
      } else {
        this.props.fetchTestdata(this.props.trainee.testid, this.props.trainee.traineeid);
        return Alert('error', 'Error!', response.data.message);
      }
    }).catch((err) => {
      return Alert('error', 'Error!', 'Server Error');
    });
  };

  previous = () => {
    if (this.props.trainee.activeQuestionIndex > 0) {
      this.props.switchQuestion(this.props.trainee.activeQuestionIndex - 1);
    }
  };

  next = () => {
    if (this.state.AnswerSelected) {
      this.SaveTocloud();
      if (this.props.trainee.activeQuestionIndex < this.props.trainee.questions.length - 1) {
        this.props.switchQuestion(this.props.trainee.activeQuestionIndex + 1);
      }
    } else {
      if (this.props.trainee.activeQuestionIndex < this.props.trainee.questions.length - 1) {
        this.props.switchQuestion(this.props.trainee.activeQuestionIndex + 1);
      }
    }
  };

  mark = () => {
    let answersCopy = [...this.props.trainee.answers];
    let currentAnswer = answersCopy[this.props.trainee.activeQuestionIndex];
    currentAnswer.isMarked = !this.props.trainee.answers[this.props.trainee.activeQuestionIndex].isMarked;
    answersCopy[this.props.trainee.activeQuestionIndex] = currentAnswer;
    this.props.updateIsMarked(answersCopy);
  };

  onAnswerChange = (d1, d2, d3) => {
    const ansCount = this.props.trainee.questions[this.props.trainee.activeQuestionIndex].anscount;
    if (d2) {
      if (this.state.ticked === ansCount) {
        return Alert('error', 'Error!', 'Clear selected options to select another option');
      } else {
        let op1 = [...this.state.options];
        op1[d1] = { ...op1[d1], checked: true };
        let op2 = [...this.state.answers];
        op2.push(d3);
        if (this.state.ticked === ansCount - 1) {
          this.setState((prevState) => ({
            AnswerSelected: true,
            ticked: prevState.ticked + 1,
            options: op1,
            answers: op2
          }));
        } else {
          this.setState((prevState) => ({
            ticked: prevState.ticked + 1,
            options: op1,
            answers: op2
          }));
        }
      }
    } else {
      let op1 = [...this.state.options];
      op1[d1] = { ...op1[d1], checked: false };
      let op2 = [...this.state.answers];
      const index = op2.indexOf(d3);
      op2.splice(index, 1);
      this.setState((prevState) => ({
        AnswerSelected: false,
        ticked: prevState.ticked - 1,
        options: op1,
        answers: op2
      }));
    }
  };

  render() {
    const opts = ['A', 'B', 'C', 'D', 'E'];

    return (
      <div>
          <Row className="question-header">
            <Col span={2}>
              <Button className="question-button">
                {this.props.trainee.activeQuestionIndex + 1}
              </Button>
            </Col>
            <Col span={22}>
              <Radio.Group className="question-type">
                <Radio.Button className="radio-button">
                  {this.props.trainee.questions[this.props.trainee.activeQuestionIndex].anscount === 1 ? "Single answer" : "Multiple answers"}
                </Radio.Button>
                <Radio.Button className="radio-button">
                  Marks: {this.props.trainee.questions[this.props.trainee.activeQuestionIndex].weightage}
                </Radio.Button>
              </Radio.Group>
            </Col>
          </Row>
          <div className="question-body">
            <h3>{this.props.trainee.questions[this.props.trainee.activeQuestionIndex].body}</h3>
            {this.props.trainee.questions[this.props.trainee.activeQuestionIndex].quesimg && (
              <img alt="Question" src={this.props.trainee.questions[this.props.trainee.activeQuestionIndex].quesimg} className="question-image" />
            )}
          </div>
          <div className="options">
            <Row>
              {this.state.options.map((d, i) => (
                <Col span={24} key={i} className="option-col">
                  <Checkbox
                    checked={d.checked}
                    onChange={(e) => { this.onAnswerChange(i, e.target.checked, d._id) }}
                    className="option-checkbox"
                  >
                    <span className="option-label">{opts[i]}. {d.optbody}</span>
                    {d.optimg && <img alt="Option" src={d.optimg} className="option-image" />}
                  </Checkbox>
                </Col>
              ))}
            </Row>
          </div>
          <div className="control-buttons">
            <Button className="control-button previous-btn" onClick={this.previous}>Previous</Button>
            <Button className="control-button mark-btn" onClick={this.mark}>{!this.props.trainee.answers[this.props.trainee.activeQuestionIndex].isMarked ? "Mark" : "Unmark"} Question</Button>
            <Button className="control-button next-btn" onClick={this.next}>{this.state.AnswerSelected ? "Save & Next" : "Next"}</Button>
          </div>
        
      </div>
    );
  }
}

const mapStateToProps = state => ({
  trainee: state.trainee
});

export default connect(mapStateToProps, {
  switchQuestion,
  updateIsMarked,
  fetchTestdata
})(SingleQuestion);
