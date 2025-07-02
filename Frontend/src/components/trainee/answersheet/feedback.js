import React, { Component } from 'react';
import './answer.css';
import { connect } from 'react-redux';
import { Post } from '../../../services/axiosCall';
import apis from '../../../services/Apis';
import Alert from '../../common/alert';
import { Rate, Input, Button } from 'antd';
import { FeedbackStatus } from '../../../actions/traineeAction';

const { TextArea } = Input;

class Feedback extends Component {
    constructor(props) {
        super(props);
        this.state = {
            star: 0,
            comment: '',
            loading: false,
            error: '' // For storing error messages
        };
    }

    handleStarChange = (star) => {
        console.log(star);
        this.setState({ star: star, error: '' }); // Clear error when rating is selected
    };

    onCommentChange = (comment) => {
        this.setState({ comment: comment.target.value, error: '' }); // Clear error when comment is typed
    };

    submitFeedback = () => {
        this.setState({ loading: true, error: '' }); // Reset loading and error

        let { star, comment } = this.state;

        // Validation: Check if both star rating and comment are provided
        if (star === 0 || comment.trim().length === 0) {
            this.setState({ loading: false, error: 'Both rating and comment are required!' });
            return; // Prevent form submission if validation fails
        }

        // If validation passes, submit feedback
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
                Alert('error', 'Failed', 'Server Error');
                this.setState({ loading: false });
            });
    };

    render() {
        const desc = ['terrible', 'bad', 'normal', 'good', 'wonderful'];
        return (
            <div className="feedbackFormHolder">
                <div><p>Rate you exam experience (optional)</p></div>
                <div className="pp">
                    <span>
                        <Rate tooltips={desc} onChange={this.handleStarChange} value={this.state.star} />
                        {this.state.star ? <span className="ant-rate-text">{desc[this.state.star - 1]}</span> : ''}
                    </span>
                </div>

                {/* Show error message if validation fails */}
                {this.state.error && <div className="error-message" style={{ color: 'red' }}>{this.state.error}</div>}

                <div className="pp">
                    <TextArea rows={4} onChange={this.onCommentChange} value={this.state.comment} />
                </div>
                <div className="pp">
                    <Button type="primary" onClick={this.submitFeedback} loading={this.state.loading}>
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
