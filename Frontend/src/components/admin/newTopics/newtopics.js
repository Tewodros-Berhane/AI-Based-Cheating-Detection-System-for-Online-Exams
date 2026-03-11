import React, { Component } from 'react';
import './newtopic.css';
import { Form, Input, Button } from 'antd-compat';
import { connect } from 'react-redux';
import { SecurePost } from '../../../services/axiosCall';
import apis from '../../../services/Apis';
import Alert from '../../../components/common/alert';
import {
  ChangeSubjectTableData,
  ChangeSubjectModalState
} from '../../../actions/adminAction';

class NewTopics extends Component {
  state = {
    submitting: false
  };

  closeModal = () => {
    this.props.ChangeSubjectModalState(false, null, 'New Course');
  };

  handleSubmit = (e) => {
    e.preventDefault();
    if (this.state.submitting) {
      return;
    }

    this.props.form.validateFieldsAndScroll((err, values) => {
      if (err) {
        return;
      }

      this.setState({ submitting: true });
      SecurePost({
        url: apis.CREATE_SUBJECT,
        data: {
          _id: this.props.admin.SubjectId,
          topic: values.topic
        }
      })
        .then((response) => {
          this.closeModal();
          if (response.data.success) {
            Alert('success', 'Success', response.data.message);
            this.props.ChangeSubjectTableData();
            return;
          }
          Alert('warning', 'Warning!', response.data.message);
        })
        .catch(() => {
          this.closeModal();
          Alert('error', 'Error!', 'Something went wrong. Please try again.');
        })
        .finally(() => {
          this.setState({ submitting: false });
        });
    });
  };

  render() {
    const { getFieldDecorator } = this.props.form;
    const isEditing = Boolean(this.props.admin.SubjectId);

    return (
      <div className="admin-form-shell">
        <p className="admin-form-caption">
          {isEditing
            ? 'Refine the selected course name while preserving linked exams and questions.'
            : 'Create a new course area for exam planning and question assignment.'}
        </p>

        <Form layout="vertical" hideRequiredMark onSubmit={this.handleSubmit}>
          <Form.Item>
            <div className="admin-field-label">Course Name</div>
            {getFieldDecorator('topic', {
              initialValue: this.props.admin.subjectDetails.topic,
              rules: [{ required: true, message: 'Please input a course name.', whitespace: true }]
            })(<Input placeholder="e.g. Data Structures" />)}
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              block
              className="admin-submit-btn"
              loading={this.state.submitting}
            >
              {this.state.submitting ? 'Saving...' : this.props.admin.Subjectmode}
            </Button>
          </Form.Item>
        </Form>
      </div>
    );
  }
}

const mapStateToProps = (state) => ({
  admin: state.admin
});

const NewSubjectForm = Form.create({ name: 'register' })(NewTopics);

export default connect(mapStateToProps, {
  ChangeSubjectTableData,
  ChangeSubjectModalState
})(NewSubjectForm);
