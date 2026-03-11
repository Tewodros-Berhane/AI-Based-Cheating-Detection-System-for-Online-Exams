import React, { Component } from 'react';
import './answer.css';
import { connect } from 'react-redux';
import { Post } from '../../../services/axiosCall';
import apis from '../../../services/Apis';
import Alert from '../../common/alert';
import { Rate, Input, Button } from 'antd-compat';
import { FeedbackStatus } from '../../../actions/traineeAction';

const { TextArea } = Input;

class Feedback extends Component {
    constructor(props) {
        super(props);
        this.state = {
            star: 0,
            comment: '',
            loading: false,
            error: '' 
        };
    }

    handleStarChange = (star) => {
        console.log(star);
        this.setState({ star: star, error: '' }); 
    };

    onCommentChange = (comment) => {
        this.setState({ comment: comment.target.value, error: '' }); 
    };

    submitFeedback = () => {
        this.setState({ loading: true, error: '' }); 

        let { star, comment } = this.state;

        
        if (star === 0 || comment.trim().length === 0) {
            this.setState({ loading: false, error: 'Both rating and comment are required!' });
            return; 
        }

        
        Post({
            url: apis.GIVE_FEEDBACK,
            data: {
                testid: this.props.trainee.testid,
                userid: this.props.trainee.traineeid,
                rating: star,
                feedback: comment
            }
        })
            .then((response) => {
                if (response.data.success) {
                    this.setState({ loading: false });
                    Alert('success', 'Success', 'Thanks for your feedback');
                    this.props.FeedbackStatus(true);
                } else {
                    this.setState({ loading: false });
                    Alert('error', 'Failed', response.data.message);
                }
            })
            .catch((error) => {
                console.log(error);
                Alert('error', 'Failed', 'Something went wrong. Please try again.');
                this.setState({ loading: false });
            });
    };

    render() {
        const desc = ['terrible', 'bad', 'normal', 'good', 'wonderful'];
        return (
            <div className="feedbackFormHolder result-feedback-card">
                <div className="result-feedback-header">
                    <h3>Share Your Exam Feedback</h3>
                    <p>Your feedback helps improve future assessments.</p>
                </div>
                <div className="pp">
                    <Rate tooltips={desc} onChange={this.handleStarChange} value={this.state.star} />
                    {this.state.star ? <span className="ant-rate-text result-rate-text">{desc[this.state.star - 1]}</span> : ''}
                </div>

                {this.state.error && <div className="result-feedback-error">{this.state.error}</div>}

                <div className="pp">
                    <TextArea
                        rows={4}
                        onChange={this.onCommentChange}
                        value={this.state.comment}
                        placeholder="Tell us what went well and what can be improved."
                    />
                </div>
                <div className="pp">
                    <Button
                        type="primary"
                        onClick={this.submitFeedback}
                        loading={this.state.loading}
                        className="result-feedback-submit"
                    >
                        Submit
                    </Button>
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state) => ({
    trainee: state.trainee
});

export default connect(mapStateToProps, {
    FeedbackStatus
})(Feedback);

