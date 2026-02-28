import React, { Component } from 'react';
import './trainerRegister.css';
import { Row, Col, Form, Icon, Input, Button, Typography, Upload } from 'antd-compat';
import apis from '../../../services/Apis';
import { Post } from '../../../services/axiosCall';
import Alert from '../../common/alert';
import 'react-phone-input-2/lib/style.css';
import PhoneInput from 'react-phone-input-2';
import withRouter from '../../../utils/withRouter';

const { Title } = Typography;

class TraineeRegisterForm extends Component {
    constructor(props) {
        super(props);
        this.state = {
            inform: true,
            testid: null,
            user: null,
            faceImage: null, 
        };
    }

    componentDidMount() {
        const params = new URLSearchParams(this.props.location.search);
        this.setState({
            testid: params.get('testid')
        });
    }

    handleFaceUpload = (e) => {
        const file = e.target.files[0];
        this.setState({ faceImage: file });
    };

    handleSubmit = e => {
        e.preventDefault();
        this.props.form.validateFields((err, values) => {
            if (!err) {
                if (!this.state.faceImage) {
                    Alert('error', 'Missing File', 'Please upload a face image.');
                    return;
                }

                const formData = new FormData();
                formData.append('name', values.name);
                formData.append('emailid', values.email);
                formData.append('contact', values.contact); 
                formData.append('organisation', values.organisation);
                formData.append('testid', this.state.testid);
                formData.append('location', values.location);
                formData.append('faceImageUrl', this.state.faceImage); 

                Post({
                    url: apis.REGISTER_TRAINEE_FOR_TEST,
                    data: formData,
                    headers: { 'Content-Type': 'multipart/form-data' },
                }).then((data) => {
                    if (data.data.success) {
                        this.setState({
                            inform: false,
                            user: data.data.user
                        });
                    } else {
                        this.props.form.resetFields();
                        Alert('error', 'Error!', data.data.message);
                    }
                }).catch((error) => {
                    console.log(error);
                    this.props.form.resetFields();
                    Alert('error', 'Error!', "Server Error");
                });
            }
        });
    };


    resendMail = () => {
        Post({
            url: apis.RESEND_TRAINER_REGISTRATION_LINK,
            data: {
                id: this.state.user._id
            }
        }).then((response) => {
            if (response.data.success) {
                Alert('success', 'Success!', "Email has been sent to your email");
            } else {
                Alert('error', 'Error!', response.data.message);
            }
        }).catch((error) => {
            console.log(error);
            Alert('error', 'Error!', "Server Error");
        });
    }

    render() {
        const { getFieldDecorator } = this.props.form;
        

        return (
            <div className="trainee-registration-form-wrapper">
                {this.state.inform ?
                    <div className="trainee-registration-form-inner">
                        <Form onSubmit={this.handleSubmit} className="login-form">
                            <Row>
                                <Col span={12} style={{ padding: '5px' }}>
                                    <Form.Item label="Name">
                                        {getFieldDecorator('name', {
                                            rules: [{ required: true, message: 'Please input your name' },
                                                   ],
                                        })(
                                            <Input
                                                prefix={<Icon type="user" style={{ color: 'rgba(0,0,0,.25)' }} />}
                                                placeholder="Name"
                                            />,
                                        )}
                                    </Form.Item>
                                </Col>
                                <Col span={12} style={{ padding: '5px' }}>
                                    <Form.Item label="Email Id">
                                        {getFieldDecorator('email', {
                                            rules: [
                                                {
                                                    type: 'email',
                                                    message: 'The input is not valid E-mail!',
                                                },
                                                {
                                                    required: true,
                                                    message: 'Please input your E-mail!',
                                                }
                                            ],
                                        })(
                                            <Input
                                                prefix={<Icon type="mail" style={{ color: 'rgba(0,0,0,.25)' }} />}
                                                placeholder="Email Id"
                                            />,
                                        )}
                                    </Form.Item>
                                </Col>
                                <Col span={12} style={{ padding: '5px' }}>
                                    <Form.Item label="Phone Number">
                                        {getFieldDecorator('contact', {
                                            rules: [{ required: true, message: 'Please input your phone number!' }],
                                            getValueFromEvent: (value) => value,
                                        })(
                                            <PhoneInput
                                                country={'et'}
                                                enableSearch
                                                inputStyle={{ width: '100%' }}
                                            />
                                        )}
                                    </Form.Item>

                                    <Form.Item label="Organisation">
                                        {getFieldDecorator('organisation', {
                                            rules: [{
                                                required: true,
                                                message: 'Please input your name',
                                            }],
                                        })(
                                            <Input
                                                prefix={<Icon type="idcard" style={{ color: 'rgba(0,0,0,.25)' }} />}
                                                placeholder="Organisation"
                                            />,
                                        )}
                                    </Form.Item>
                                </Col>
                                <Col span={12} style={{ padding: '5px' }}>
                                    <Form.Item label="Location">
                                        {getFieldDecorator('location', {
                                            rules: [{ required: true, message: 'Please input your location' }],
                                        })(
                                            <Input
                                                prefix={<Icon type="home" style={{ color: 'rgba(0,0,0,.25)' }} />}
                                                placeholder="Location"
                                            />,
                                        )}
                                    </Form.Item>

                                    <Form.Item label="Upload Face Image" required>
                                        <Upload
                                            beforeUpload={(file) => {
                                                this.setState({ faceImage: file });
                                                return false;
                                            }}
                                            fileList={this.state.faceImage ? [this.state.faceImage] : []}
                                            onRemove={() => this.setState({ faceImage: null })}
                                        >
                                            <Button>
                                                <Icon type="upload" /> Click to Upload
                                            </Button>
                                        </Upload>
                                        {!this.state.faceImage && (
                                            <div style={{ color: 'red' }}>Please upload a face image.</div>
                                        )}
                                    </Form.Item>

                                </Col>
                                <Col span={12} style={{ paddingTop: '0px' }}>
                                    <Form.Item>
                                        <Button style={{ width: '100%' }} type="primary" htmlType="submit" className="login-form-button">
                                            Register
                                        </Button>
                                    </Form.Item>
                                </Col>
                            </Row>
                        </Form>
                        <hr></hr>
                        <p> <span style={{ color: 'red' }}  >NB:</span> The image you upload should be as latest as possible. Older images may not be recognized as you.</p>
                        <p>Use the exam link sent to your email to start your test session.</p>
                    </div>
                    
                    :
                    <div className="reasendmail-container-register">
                        <Title style={{ color: '#24292f' }} level={4}>An email containing your test link has been sent to {this.state.user.emailid}</Title>
                        <Button type="primary" onClick={this.resendMail}>Resend Mail</Button>
                    </div>}
            </div>
        )
    }
}

const TraineeRegister = Form.create({ name: 'Trainee Registration' })(TraineeRegisterForm);
export default withRouter(TraineeRegister);

