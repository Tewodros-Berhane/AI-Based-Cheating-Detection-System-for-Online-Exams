import React from 'react';
import { connect } from 'react-redux';
import { Badge, Button, Icon } from 'antd-compat';
import './portal.css';
import { switchQuestion } from '../../../actions/traineeAction';

function Operations({ trainee, switchQuestion }) {
  return (
    <div className="question-list-wrapper">
      <div className="question-list-header">
        <h4>Question Navigator</h4>
        <p>Select a number to jump to that question.</p>
      </div>
      <div className="question-list-inner">
        {trainee.answers.map((answer, index) => {
          const buttonClass = [
            'question-nav-btn',
            answer.isAnswered ? 'answered' : 'unanswered',
            answer.isMarked ? 'flagged' : '',
            trainee.activeQuestionIndex === index ? 'active' : '',
          ]
            .join(' ')
            .trim();

          const button = (
            <Button onClick={() => switchQuestion(index)} className={buttonClass}>
              {index + 1}
            </Button>
          );

          return answer.isMarked ? (
            <Badge
              key={index}
              count={<Icon type="flag" theme="filled" style={{ color: '#f97316' }} />}
              className="question-nav-badge"
            >
              {button}
            </Badge>
          ) : (
            <span key={index} className="question-nav-item">
              {button}
            </span>
          );
        })}
      </div>
    </div>
  );
}

const mapStateToProps = (state) => ({
  trainee: state.trainee,
});

export default connect(mapStateToProps, {
  switchQuestion,
})(Operations);
