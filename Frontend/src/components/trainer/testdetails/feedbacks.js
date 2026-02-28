import React from 'react';
import { Avatar, Rate } from 'antd-compat';
import './testdetails.css';

function getInitial(name = '') {
  const trimmed = String(name).trim();
  return trimmed ? trimmed[0].toUpperCase() : '?';
}

export default function FeedBacks(props) {
  const feedbacks = props.feedbacks || [];

  return (
    <section className="testdetails-block">
      <div className="testdetails-block-head">
        <h4>Feedback Stream</h4>
        <p>Candidate sentiment captured after exam completion.</p>
      </div>

      {feedbacks.length === 0 ? (
        <div className="testdetails-empty">No feedback has been submitted.</div>
      ) : (
        <div className="testdetails-feedback-list">
          {feedbacks.map((item) => {
            const user = item.userid || {};
            const rating = Number(item.rating || 0);
            return (
              <article className="testdetails-feedback-card" key={item._id || `${user._id}-${rating}`}>
                <div className="testdetails-feedback-head">
                  <Avatar src={user.faceImageUrl} className="testdetails-feedback-avatar">
                    {getInitial(user.name)}
                  </Avatar>
                  <div className="testdetails-feedback-meta">
                    <span className="testdetails-feedback-name">{user.name || 'Unknown'}</span>
                    <span className="testdetails-feedback-org">{user.organisation || 'No organization'}</span>
                  </div>
                </div>

                <div className="testdetails-feedback-body">
                  <Rate disabled value={rating} style={{ fontSize: '14px' }} />
                  <p>{item.feedback || 'No comment provided.'}</p>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
