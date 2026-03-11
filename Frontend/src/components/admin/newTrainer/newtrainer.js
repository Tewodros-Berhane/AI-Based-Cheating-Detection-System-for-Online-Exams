import React, { Component } from 'react';
import './newtrainer.css';
import { Form, Input, Button } from 'antd-compat';
import { SecurePost } from '../../../services/axiosCall';
import apis from '../../../services/Apis';
import { connect } from 'react-redux';
import {
  ChangeTrainerConfirmDirty,
  ChangeTrainerModalState,
  ChangeTrainerTableData
} from '../../../actions/adminAction';
import Alert from '../../../components/common/alert';
import 'react-phone-input-2/lib/style.css';
import PhoneInput from 'react-phone-input-2';

class NewTrainer extends Component {
  state = {
    submitting: false
  };

  compareToFirstPassword = (rule, value, callback) => {
    const form = this.props.form;
    if (value && value !== form.getFieldValue('password')) {
      callback('Passwords are not the same.');
      return;
    }
    callback();
  };

  validateToNextPassword = (rule, value, callback) => {
    const form = this.props.form;
    if (value && this.props.admin.TrainerconfirmDirty) {
      form.validateFields(['confirm'], { force: true });
    }
    callback();
  };

  handleConfirmBlur = (e) => {
    const { value } = e.target;
    this.props.ChangeTrainerConfirmDirty(this.props.admin.TrainerconfirmDirty || !!value);
  };

  closeModal = () => {
    this.props.ChangeTrainerModalState(false, null, 'Register');
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
        url: apis.CREATE_TRAINER,
        data: {
          _id: this.props.admin.trainerId,
          name: values.name,
          password: values.password,
          emailid: values.emailid,
          contact: values.contact
        }
      })
        .then((response) => {
          this.closeModal();
          if (response.data.success) {
            Alert('success', 'Success', response.data.message);
            this.props.ChangeTrainerTableData();
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
    const isEditing = Boolean(this.props.admin.trainerId);

    return (
      <div className="admin-form-shell">
        <p className="admin-form-caption">
          {isEditing
            ? 'Update examiner profile details and save the changes.'
            : 'Register a new examiner and provision secure sign-in access.'}
        </p>

        <Form layout="vertical" hideRequiredMark onSubmit={this.handleSubmit}>
          <Form.Item>
            <div className="admin-field-label">Full Name</div>
            {getFieldDecorator('name', {
              initialValue: this.props.admin.trainerdetails.name,
              rules: [{ required: true, message: 'Please input a name.', whitespace: true }]
            })(<Input placeholder="Examiner name" />)}
          </Form.Item>

          {!isEditing ? (
            <Form.Item>
              <div className="admin-field-label">Email Address</div>
              {getFieldDecorator('emailid', {
                initialValue: this.props.admin.trainerdetails.emailid,
                rules: [
                  { type: 'email', message: 'Please enter a valid email.' },
                  { required: true, message: 'Please input an email address.' }
                ]
              })(<Input placeholder="name@company.com" />)}
            </Form.Item>
          ) : null}

          <Form.Item>
            <div className="admin-field-label">Phone Number</div>
            {getFieldDecorator('contact', {
              initialValue: this.props.admin.trainerdetails.contact || '',
              rules: [{ required: true, message: 'Please input a phone number.' }]
            })(
              <PhoneInput
                country="et"
                enableSearch
                specialLabel={null}
                placeholder="Contact number"
                inputStyle={{ width: '100%' }}
              />
            )}
          </Form.Item>

          {!isEditing ? (
            <>
              <Form.Item>
                <div className="admin-field-label">Password</div>
                {getFieldDecorator('password', {
                  initialValue: this.props.admin.trainerdetails.password,
                  rules: [
                    { required: true, message: 'Please input a password.' },
                    { validator: this.validateToNextPassword }
                  ]
                })(<Input.Password placeholder="Create password" />)}
              </Form.Item>

              <Form.Item>
                <div className="admin-field-label">Confirm Password</div>
                {getFieldDecorator('confirm', {
                  initialValue: this.props.admin.trainerdetails.confirmpassword,
                  rules: [
                    { required: true, message: 'Please confirm the password.' },
                    { validator: this.compareToFirstPassword }
                  ]
                })(
                  <Input.Password
                    onBlur={this.handleConfirmBlur}
                    placeholder="Re-enter password"
                  />
                )}
              </Form.Item>
            </>
          ) : null}

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={this.state.submitting}
              className="admin-submit-btn"
            >
              {this.state.submitting ? 'Saving...' : this.props.admin.Trainermode}
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

const NewTrainerForm = Form.create({ name: 'register' })(NewTrainer);

export default connect(mapStateToProps, {
  ChangeTrainerConfirmDirty,
  ChangeTrainerModalState,
  ChangeTrainerTableData
})(NewTrainerForm);
