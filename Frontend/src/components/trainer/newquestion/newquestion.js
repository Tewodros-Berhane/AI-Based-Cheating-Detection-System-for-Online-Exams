import React, { Component } from 'react';
import './newquestion.css';
import {
  Form,
  Input,
  Button,
  Select,
  Row,
  Col,
  Checkbox,
  Modal,
  Upload,
  Icon,
  InputNumber
} from 'antd-compat';
import { connect } from 'react-redux';
import {
  ChangeQuestionTableData,
  ChangeQuestionModalState
} from '../../../actions/trainerAction';
import { ChangeSubjectTableData } from '../../../actions/adminAction';
import { SecurePost } from '../../../services/axiosCall';
import apis from '../../../services/Apis';
import Alert from '../../../components/common/alert';
import auth from '../../../services/AuthServices';

class NewQuestion extends Component {
  constructor(props) {
    super(props);
    this.state = {
      questionDetails: {
        questionimage: null,
        options: [
          {
            image: null,
            body: null,
            isAnswer: false
          },
          {
            image: null,
            body: null,
            isAnswer: false
          },
          {
            image: null,
            body: null,
            isAnswer: false
          },
          {
            image: null,
            body: null,
            isAnswer: false
          }
        ]
      },
      adding: false,
      submitDisabled: false,
      fifthoptioAddButtonVisible: true
    };
  }

  componentDidMount() {
    if (!this.props.admin.subjectTableData || this.props.admin.subjectTableData.length === 0) {
      this.props.ChangeSubjectTableData();
    }
  }

  addfifthOption = () => {
    this.setState((previousState) => ({
      fifthoptioAddButtonVisible: false,
      questionDetails: {
        ...previousState.questionDetails,
        options: [
          ...previousState.questionDetails.options,
          {
            image: null,
            body: null,
            isAnswer: false
          }
        ]
      }
    }));
  };

  Customalert = () => {
    Modal.confirm({
      icon: <Icon type="info-circle" style={{ fontSize: 22, color: '#c9d1d9' }} />,
      title: <span style={{ color: '#c9d1d9', fontWeight: 500 }}>Confirm</span>,
      content: <div style={{ color: '#c9d1d9' }}>Empty option cannot be set as answer.</div>,
      okText: 'I understand',
      okButtonProps: {
        style: {
          backgroundColor: '#238636',
          borderColor: '#238636',
          color: '#ffffff'
        }
      },
      cancelButtonProps: { style: { display: 'none' } },
      maskStyle: {
        backgroundColor: 'rgba(0, 0, 0, 0.85)'
      }
    });
  };

  OptionTextChange = (e, i) => {
    const newOptions = [...this.state.questionDetails.options];
    newOptions[i] = {
      ...this.state.questionDetails.options[i],
      body: e.target.value
    };

    if (
      (newOptions[i].image === 'undefined' || newOptions[i].image === undefined || newOptions[i].image === null || newOptions[i].image === 'null') &&
      (newOptions[i].body === 'undefined' || newOptions[i].body === undefined || newOptions[i].body === 'null' || newOptions[i].body === '' || newOptions[i].body === null)
    ) {
      newOptions[i] = {
        ...this.state.questionDetails.options[i],
        isAnswer: false
      };
    }

    this.setState((previousState) => ({
      questionDetails: {
        ...previousState.questionDetails,
        options: newOptions
      }
    }));
  };

  AnswerOptionSwitch = (e, i) => {
    if (
      (this.state.questionDetails.options[i].body !== '' && this.state.questionDetails.options[i].body !== null) ||
      (this.state.questionDetails.options[i].image !== null &&
        this.state.questionDetails.options[i].image !== 'undefined' &&
        this.state.questionDetails.options[i].image !== undefined)
    ) {
      const newOptions = [...this.state.questionDetails.options];
      newOptions[i] = {
        ...this.state.questionDetails.options[i],
        isAnswer: e.target.checked
      };
      this.setState((previousState) => ({
        questionDetails: {
          ...previousState.questionDetails,
          options: newOptions
        }
      }));
      return;
    }

    this.Customalert();
  };

  OptionImageonChange = (file, i) => {
    const newOptions = [...this.state.questionDetails.options];

    if (!file) {
      delete newOptions[i].image;
      newOptions[i].image = null;
    } else {
      newOptions[i] = {
        ...this.state.questionDetails.options[i],
        image: `${apis.BASE}/${file.link}`
      };
    }

    this.setState({
      submitDisabled: false
    });

    if (
      (newOptions[i].image === 'undefined' || newOptions[i].image === undefined || newOptions[i].image === null || newOptions[i].image === 'null') &&
      (newOptions[i].body === 'undefined' || newOptions[i].body === undefined || newOptions[i].body === 'null' || newOptions[i].body === '' || newOptions[i].body === null)
    ) {
      newOptions[i] = {
        ...this.state.questionDetails.options[i],
        isAnswer: false
      };
    }

    this.setState((previousState) => ({
      questionDetails: {
        ...previousState.questionDetails,
        options: newOptions
      }
    }));
  };

  extractUploadPayload = (response) => {
    if (!response) {
      return null;
    }
    if (typeof response === 'string') {
      try {
        return JSON.parse(response);
      } catch (error) {
        return null;
      }
    }
    if (response.data && typeof response.data === 'object') {
      return response.data;
    }
    return response;
  };

  handleQuestionImageUploadChange = (info) => {
    const { file } = info || {};
    if (!file) {
      return;
    }

    if (file.status === 'uploading') {
      this.setState({ submitDisabled: true });
      return;
    }

    if (file.status === 'removed') {
      this.changeqImage(null);
      return;
    }

    if (file.status === 'done') {
      const payload = this.extractUploadPayload(file.response);
      if (payload && payload.link) {
        this.changeqImage(payload);
        return;
      }
      this.setState({ submitDisabled: false });
      Alert(
        'error',
        'Error!',
        (payload && payload.message) || 'Image upload finished but no file link was returned.'
      );
      return;
    }

    if (file.status === 'error') {
      this.setState({ submitDisabled: false });
      const uploadError =
        (file.response && file.response.message) ||
        (file.error && file.error.message) ||
        'Image upload failed.';
      Alert('error', 'Error!', uploadError);
    }
  };

  handleOptionImageUploadChange = (info, i) => {
    const { file } = info || {};
    if (!file) {
      return;
    }

    if (file.status === 'uploading') {
      this.setState({ submitDisabled: true });
      return;
    }

    if (file.status === 'removed') {
      this.OptionImageonChange(null, i);
      return;
    }

    if (file.status === 'done') {
      const payload = this.extractUploadPayload(file.response);
      if (payload && payload.link) {
        this.OptionImageonChange(payload, i);
        return;
      }
      this.setState({ submitDisabled: false });
      Alert(
        'error',
        'Error!',
        (payload && payload.message) || 'Option image upload finished but no file link was returned.'
      );
      return;
    }

    if (file.status === 'error') {
      this.setState({ submitDisabled: false });
      const uploadError =
        (file.response && file.response.message) ||
        (file.error && file.error.message) ||
        'Option image upload failed.';
      Alert('error', 'Error!', uploadError);
    }
  };

  handleSubmit = (e) => {
    e.preventDefault();
    this.props.form.validateFieldsAndScroll((err, values) => {
      if (err) {
        return;
      }

      let f = 1;
      let ans = 0;
      const opts = [];

      this.state.questionDetails.options.forEach((element) => {
        opts.push({
          optbody: element.body,
          optimg: element.image,
          isAnswer: element.isAnswer
        });

        if (
          (element.image === 'undefined' || element.image === undefined || element.image === null || element.image === 'null') &&
          (element.body === '' || element.body === null || element.body === 'null' || element.body === 'undefined' || element.body === undefined)
        ) {
          f = 0;
        }

        if (element.isAnswer) {
          ans += 1;
        }
      });

      if (!f) {
        Alert('warning', 'Warning!', 'Please fill all the options.');
        return;
      }

      if (!ans) {
        Alert('warning', 'Warning!', 'There must be at least one right answer.');
        return;
      }

      this.setState({ adding: true });
      SecurePost({
        url: apis.CREATE_QUESTIONS,
        data: {
          body: values.questionbody,
          options: opts,
          quesimg: this.state.questionDetails.questionimage,
          subject: values.subject,
          explanation: values.explanation,
          weightage: values.waitage
        }
      })
        .then((response) => {
          this.setState({ adding: false });

          if (response.data.success) {
            this.props.ChangeQuestionModalState(false);
            this.props.form.resetFields();
            Alert('success', 'Success', response.data.message);
            this.props.ChangeQuestionTableData(this.props.trainer.selectedSubjects);
            return;
          }

          Alert('warning', 'Warning!', response.data.message);
        })
        .catch((error) => {
          this.setState({
            adding: false,
            questionDetails: {
              questionimage: null,
              options: [
                {
                  image: null,
                  body: null,
                  isAnswer: false
                },
                {
                  image: null,
                  body: null,
                  isAnswer: false
                },
                {
                  image: null,
                  body: null,
                  isAnswer: false
                },
                {
                  image: null,
                  body: null,
                  isAnswer: false
                }
              ]
            }
          });
          const errorMessage =
            (error && error.response && error.response.data && error.response.data.message) ||
            'Server Error';
          Alert('error', 'Error!', errorMessage);
        });
    });
  };

  changeqImage = (file) => {
    this.setState((previousState) => ({
      questionDetails: {
        ...previousState.questionDetails,
        questionimage: file && file.link ? `${apis.BASE}/${file.link}` : null
      },
      submitDisabled: false
    }));
  };

  render() {
    const { getFieldDecorator } = this.props.form;
    const { Option } = Select;
    const { TextArea } = Input;

    const questionImageProps = {
      name: 'file',
      action: `${apis.BASE}${apis.FILE_UPLOAD}`,
      headers: {
        Authorization: `Bearer ${auth.retriveToken()}`
      },
      listType: 'picture'
    };

    return (
      <div className="admin-form-shell question-form-shell">
        <p className="admin-form-caption">
          Create a question with optional media, weighted scoring, and at least one correct answer.
        </p>

        <Form layout="vertical" hideRequiredMark onSubmit={this.handleSubmit}>
          <Row gutter={16} className="question-form-row">
            <Col xs={24} md={10}>
              <Form.Item>
                <div className="admin-field-label">Subject</div>
                {getFieldDecorator('subject', {
                  rules: [{ required: true, message: 'Please select any subject!' }]
                })(
                  <Select
                    className="question-form-select"
                    showSearch
                    placeholder="Select a subject"
                    optionFilterProp="children"
                    getPopupContainer={(triggerNode) => triggerNode.parentNode}
                  >
                    {(this.props.admin.subjectTableData || []).map((subject) => (
                      <Option key={subject._id} value={subject._id}>
                        {subject.topic}
                      </Option>
                    ))}
                  </Select>
                )}
              </Form.Item>
            </Col>

            <Col xs={24} md={6}>
              <Form.Item>
                <div className="admin-field-label">Weightage</div>
                {getFieldDecorator('waitage', {
                  rules: [{ required: true, message: 'Please enter the marks.' }]
                })(<InputNumber min={1} max={2} className="question-weight-input" />)}
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item>
                <div className="admin-field-label">Question Image</div>
                <Upload
                  {...questionImageProps}
                  onRemove={this.changeqImage}
                  onChange={this.handleQuestionImageUploadChange}
                >
                  <Button className="question-upload-btn">
                    <Icon type="upload" /> Upload Image
                  </Button>
                </Upload>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item className="question-body-field">
            <div className="admin-field-label">Question Prompt</div>
            {getFieldDecorator('questionbody', {
              rules: [{ required: true, message: 'Please type question!' }]
            })(<TextArea rows={4} placeholder="Type the full question prompt" />)}
          </Form.Item>

          <section className="question-options-section">
            <h4 className="question-options-title">Answer Options</h4>
            {this.state.questionDetails.options.map((option, i) => (
              <div key={i} className="question-option-card">
                <Row gutter={14}>
                  <Col xs={24} md={14}>
                    <Form.Item>
                      <div className="admin-field-label">Option {i + 1} Text</div>
                      <TextArea
                        value={option.body}
                        onChange={(event) => this.OptionTextChange(event, i)}
                        rows={3}
                        placeholder={`Option ${i + 1} statement`}
                      />
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={7}>
                    <Form.Item>
                      <div className="admin-field-label">Option {i + 1} Image</div>
                      <Upload
                        {...questionImageProps}
                        onRemove={() => this.OptionImageonChange(null, i)}
                        onChange={(info) => this.handleOptionImageUploadChange(info, i)}
                      >
                        <Button className="question-upload-btn">
                          <Icon type="upload" /> Upload
                        </Button>
                      </Upload>
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={3}>
                    <Form.Item>
                      <div className="admin-field-label">Correct</div>
                      <label className="question-option-toggle">
                        <Checkbox checked={option.isAnswer} onChange={(event) => this.AnswerOptionSwitch(event, i)} />
                        <span>Answer</span>
                      </label>
                    </Form.Item>
                  </Col>
                </Row>
              </div>
            ))}
          </section>

          <div className="question-form-actions">
            {this.state.fifthoptioAddButtonVisible ? (
              <Button className="question-add-option-btn" onClick={this.addfifthOption}>
                Add 5th Option
              </Button>
            ) : null}

            <Button
              type="primary"
              htmlType="submit"
              disabled={this.state.submitDisabled}
              loading={this.state.adding}
              className="admin-submit-btn question-submit-btn"
            >
              {this.state.adding ? 'Creating...' : 'Create Question'}
            </Button>
          </div>
        </Form>
      </div>
    );
  }
}

const mapStateToProps = (state) => ({
  trainer: state.trainer,
  admin: state.admin
});

const NewQuestionForm = Form.create({ name: 'newQuestion' })(NewQuestion);

export default connect(mapStateToProps, {
  ChangeQuestionModalState,
  ChangeQuestionTableData,
  ChangeSubjectTableData
})(NewQuestionForm);
