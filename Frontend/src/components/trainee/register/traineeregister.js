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
            faceImageValidationError: '',
            validatingFaceImage: false,
            faceRecognitionEnabled: true,
            registrationConfigLoading: true,
            emailDelivered: true,
            registrationStatusMessage: ''
        };
        this.faceModelPromise = null;
    }

    getPersistKey = (testid) => `trainee_registration_state:${testid || 'default'}`;

    persistSentState = (testid, user, emailDelivered = true, registrationStatusMessage = "") => {
        if (!testid || !user) return;
        try {
            const payload = {
                inform: false,
                user: {
                    _id: user._id,
                    emailid: user.emailid,
                    name: user.name,
                },
                emailDelivered,
                registrationStatusMessage,
                savedAt: Date.now(),
            };
            window.sessionStorage.setItem(this.getPersistKey(testid), JSON.stringify(payload));
        } catch (error) {
            console.log('Unable to persist trainee registration state', error);
        }
    };

    componentDidMount() {
        const params = new URLSearchParams(this.props.location.search);
        const testid = params.get('testid');
        let persistedState = null;
        try {
            const cached = window.sessionStorage.getItem(this.getPersistKey(testid));
            if (cached) {
                const parsed = JSON.parse(cached);
                if (parsed && parsed.inform === false && parsed.user && parsed.user.emailid) {
                    persistedState = parsed;
                }
            }
        } catch (error) {
            console.log('Unable to read trainee registration state', error);
        }

        this.setState({
            testid,
            inform: persistedState ? false : true,
            user: persistedState ? persistedState.user : null,
            emailDelivered: persistedState ? persistedState.emailDelivered !== false : true,
            registrationStatusMessage: persistedState ? (persistedState.registrationStatusMessage || '') : '',
        }, () => {
            this.fetchRegistrationConfig(testid);
        });
    }

    fetchRegistrationConfig = (testid) => {
        if (!testid) {
            this.setState({ registrationConfigLoading: false, faceRecognitionEnabled: true });
            return;
        }

        this.setState({ registrationConfigLoading: true });
        Post({
            url: apis.FETCH_TRAINEE_REGISTRATION_CONFIG,
            data: { testid }
        }).then((response) => {
            if (response.data && response.data.success) {
                const faceRecognitionEnabled = Boolean(
                    response.data.data && response.data.data.faceRecognitionEnabled
                );
                this.setState((prevState) => ({
                    faceRecognitionEnabled,
                    registrationConfigLoading: false,
                    faceImage: faceRecognitionEnabled ? prevState.faceImage : null,
                    faceImageValidationError: faceRecognitionEnabled ? prevState.faceImageValidationError : '',
                    validatingFaceImage: false
                }));
            } else {
                this.setState({ registrationConfigLoading: false, faceRecognitionEnabled: true });
            }
        }).catch(() => {
            this.setState({ registrationConfigLoading: false, faceRecognitionEnabled: true });
        });
    };

    ensureFaceModelLoaded = async (faceapi) => {
        if (!this.faceModelPromise) {
            this.faceModelPromise = Promise.all([
                faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
                faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
                faceapi.nets.faceRecognitionNet.loadFromUri('/models')
            ]);
        }
        await this.faceModelPromise;
    };

    validateFaceImage = async (file) => {
        if (!file) return false;

        if (!file.type || !file.type.startsWith('image/')) {
            this.setState({
                faceImage: null,
                faceImageValidationError: 'Please upload an image file.',
                validatingFaceImage: false
            });
            return false;
        }

        this.setState({
            validatingFaceImage: true,
            faceImageValidationError: ''
        });

        let objectUrl = null;
        try {
            const faceapi = await import('face-api.js');
            await this.ensureFaceModelLoaded(faceapi);

            objectUrl = URL.createObjectURL(file);
            const image = await faceapi.fetchImage(objectUrl);
            const detectorOptions = new faceapi.TinyFaceDetectorOptions({
                inputSize: 416,
                scoreThreshold: 0.55
            });

            const detections = await faceapi
                .detectAllFaces(image, detectorOptions)
                .withFaceLandmarks()
                .withFaceDescriptors();

            const imageWidth = image.naturalWidth || image.width || 0;
            const imageHeight = image.naturalHeight || image.height || 0;
            const imageArea = imageWidth * imageHeight;

            const usableDetections = detections.filter((det) => {
                const score = det.detection && typeof det.detection.score === 'number' ? det.detection.score : 0;
                const box = det.detection && det.detection.box ? det.detection.box : { width: 0, height: 0 };
                const faceArea = Math.max(0, box.width) * Math.max(0, box.height);
                const areaRatio = imageArea > 0 ? faceArea / imageArea : 0;
                const minSide = Math.min(Math.max(0, box.width), Math.max(0, box.height));

                return score >= 0.6 && areaRatio >= 0.015 && minSide >= 72;
            });

            if (usableDetections.length !== 1) {
                this.setState({
                    faceImage: null,
                    faceImageValidationError: 'No clear face detected. Upload a front-facing photo with one visible face.',
                    validatingFaceImage: false
                });
                return false;
            }

            this.setState({
                faceImage: file,
                faceImageValidationError: '',
                validatingFaceImage: false
            });
            return true;
        } catch (error) {
            console.log('Face validation failed', error);
            this.setState({
                faceImage: null,
                faceImageValidationError: 'Unable to validate face image. Please try a different photo.',
                validatingFaceImage: false
            });
            return false;
        } finally {
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        }
    };

    onBeforeUploadFace = async (file) => {
        await this.validateFaceImage(file);
        return false;
    };

    handleSubmit = e => {
        e.preventDefault();
        this.props.form.validateFields((err, values) => {
            if (!err) {
                if (this.state.registrationConfigLoading) {
                    Alert('warning', 'Please wait', 'Exam settings are still loading.');
                    return;
                }

                if (this.state.faceRecognitionEnabled && this.state.validatingFaceImage) {
                    Alert('warning', 'Validation in progress', 'Please wait for face image validation to finish.');
                    return;
                }

                if (this.state.faceRecognitionEnabled && !this.state.faceImage) {
                    Alert('error', 'Missing File', 'Please upload a face image.');
                    return;
                }

                if (this.state.faceRecognitionEnabled && this.state.faceImageValidationError) {
                    Alert('error', 'Invalid Face Image', this.state.faceImageValidationError);
                    return;
                }

                const formData = new FormData();
                formData.append('name', values.name);
                formData.append('emailid', values.email);
                formData.append('contact', values.contact); 
                formData.append('organisation', values.organisation);
                formData.append('testid', this.state.testid);
                formData.append('location', values.location);
                if (this.state.faceRecognitionEnabled && this.state.faceImage) {
                    formData.append('faceImageUrl', this.state.faceImage);
                }

                Post({
                    url: apis.REGISTER_TRAINEE_FOR_TEST,
                    data: formData,
                    headers: { 'Content-Type': 'multipart/form-data' },
                }).then((data) => {
                    if (data.data.success) {
                        const emailDelivered = data.data.emailDelivered !== false;
                        const registrationStatusMessage = data.data.message || '';
                        this.persistSentState(this.state.testid, data.data.user, emailDelivered, registrationStatusMessage);
                        this.setState({
                            inform: false,
                            user: data.data.user,
                            emailDelivered,
                            registrationStatusMessage
                        });
                    } else {
                        this.props.form.resetFields();
                        Alert('error', 'Error!', data.data.message);
                    }
                }).catch((error) => {
                    console.log(error);
                    this.props.form.resetFields();
                    Alert('error', 'Error!', "Something went wrong. Please try again.");
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
                Alert('success', 'Success!', response.data.message || 'Email has been sent to your email');
            } else {
                Alert('error', 'Error!', response.data.message);
            }
        }).catch((error) => {
            console.log(error);
            const message = error && error.response && error.response.data && error.response.data.message
                ? error.response.data.message
                : 'Something went wrong. Please try again.';
            Alert('error', 'Error!', message);
        });
    }

    render() {
        const { getFieldDecorator } = this.props.form;
        const examRef = this.state.testid ? this.state.testid.slice(-8).toUpperCase() : 'EMAIL LINKED';
        const showFaceUpload = this.state.faceRecognitionEnabled;
        

        return (
            <div className="trainee-registration-form-wrapper">
                {this.state.inform ? (
                    <div className="trainee-registration-shell app-glass-card">
                    <div className="trainee-registration-layout">
                        <aside className="trainee-registration-side">
                            <div className="trainee-registration-side-badge">Exam Shield</div>
                            <h3>Examinee Registration</h3>
                            <p>Complete the registration form once. Your secure exam link will be delivered by email.</p>
                            <div className="trainee-registration-side-chip">Exam Ref: {examRef}</div>
                            <ul className="trainee-registration-checklist">
                                <li>Use your legal full name and active email.</li>
                                {showFaceUpload ? <li>Upload a recent face image for identity checks.</li> : null}
                                <li>Use the email link to enter your exam workspace.</li>
                            </ul>
                        </aside>
                        <section className="trainee-registration-content">
                            <div className="trainee-registration-header">
                                <Title level={3}>Exam Registration</Title>
                                <p>Provide your details exactly as they appear in your identity document.</p>
                            </div>
                            <Form onSubmit={this.handleSubmit} hideRequiredMark className="admin-form-shell trainee-register-form-shell">
                                <Row gutter={[12, 0]}>
                                    <Col xs={24} md={12}>
                                        <label className="trainee-field-label" htmlFor="trainee-name">Name</label>
                                        <Form.Item>
                                            {getFieldDecorator('name', {
                                                rules: [{ required: true, message: 'Please input your name' },
                                                       ],
                                            })(
                                                <Input
                                                    id="trainee-name"
                                                    placeholder="Name"
                                                />,
                                            )}
                                        </Form.Item>
                                    </Col>
                                    <Col xs={24} md={12}>
                                        <label className="trainee-field-label" htmlFor="trainee-email">Email Id</label>
                                        <Form.Item>
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
                                                    id="trainee-email"
                                                    placeholder="Email Id"
                                                />,
                                            )}
                                        </Form.Item>
                                    </Col>
                                    <Col xs={24} md={12}>
                                        <label className="trainee-field-label" htmlFor="trainee-contact">Phone Number</label>
                                        <Form.Item>
                                            {getFieldDecorator('contact', {
                                                rules: [{ required: true, message: 'Please input your phone number!' }],
                                                getValueFromEvent: (value) => value,
                                            })(
                                                <PhoneInput
                                                    inputProps={{ id: 'trainee-contact' }}
                                                    country={'et'}
                                                    enableSearch
                                                    inputStyle={{ width: '100%' }}
                                                />
                                            )}
                                        </Form.Item>

                                        <label className="trainee-field-label" htmlFor="trainee-organisation">Organisation</label>
                                        <Form.Item>
                                            {getFieldDecorator('organisation', {
                                                rules: [{
                                                    required: true,
                                                    message: 'Please input your organization',
                                                }],
                                            })(
                                                <Input
                                                    id="trainee-organisation"
                                                    placeholder="Organisation"
                                                />,
                                            )}
                                        </Form.Item>
                                    </Col>
                                    <Col xs={24} md={12}>
                                        <label className="trainee-field-label" htmlFor="trainee-location">Location</label>
                                        <Form.Item>
                                            {getFieldDecorator('location', {
                                                rules: [{ required: true, message: 'Please input your location' }],
                                            })(
                                                <Input
                                                    id="trainee-location"
                                                    placeholder="Location"
                                                />,
                                            )}
                                        </Form.Item>

                                        {showFaceUpload ? (
                                            <>
                                                <label className="trainee-field-label" htmlFor="trainee-face-upload">Upload Face Image</label>
                                                <Form.Item>
                                                    <Upload
                                                        beforeUpload={this.onBeforeUploadFace}
                                                        fileList={this.state.faceImage ? [this.state.faceImage] : []}
                                                        onRemove={() => this.setState({ faceImage: null, faceImageValidationError: '' })}
                                                    >
                                                        <Button className="trainee-upload-btn" loading={this.state.validatingFaceImage}>
                                                            <Icon type="upload" /> Click to Upload
                                                        </Button>
                                                    </Upload>
                                                    <input id="trainee-face-upload" type="hidden" value={this.state.faceImage ? 'selected' : ''} readOnly />
                                                    {!this.state.faceImage && !this.state.faceImageValidationError && (
                                                        <div className="trainee-inline-error">Please upload a face image.</div>
                                                    )}
                                                    {this.state.faceImageValidationError ? (
                                                        <div className="trainee-inline-error">{this.state.faceImageValidationError}</div>
                                                    ) : null}
                                                </Form.Item>
                                            </>
                                        ) : null}

                                    </Col>
                                    <Col xs={24} md={12}>
                                        <Form.Item>
                                            <Button
                                                type="primary"
                                                htmlType="submit"
                                                className="login-form-button trainee-register-submit"
                                                disabled={this.state.registrationConfigLoading || (showFaceUpload && this.state.validatingFaceImage)}
                                                loading={this.state.registrationConfigLoading}
                                            >
                                                Register
                                            </Button>
                                        </Form.Item>
                                    </Col>
                                </Row>
                            </Form>
                        </section>
                    </div>
                    </div>
                ) : (
                    <div className="reasendmail-container-register trainee-registration-success">
                        <div className="trainee-registration-side-badge">{this.state.emailDelivered ? 'Email Sent' : 'Registration Complete'}</div>
                        <Title level={4}>{this.state.emailDelivered ? 'Your exam access email has been sent.' : 'Registration completed, but the exam email could not be sent.'}</Title>
                        <p>
                            {this.state.emailDelivered
                                ? <>We sent the exam link to <strong>{this.state.user.emailid}</strong>.</>
                                : this.state.registrationStatusMessage || 'Email delivery is not configured on the server. Please contact the administrator.'}
                        </p>
                        <p>
                            {this.state.emailDelivered
                                ? 'If you did not receive it, use the resend action below.'
                                : 'Use resend after the email service is configured, or contact the administrator for access.'}
                        </p>
                        <Button type="primary" onClick={this.resendMail}>Resend Email</Button>
                    </div>
                )}
            </div>
        )
    }
}

const TraineeRegister = Form.create({ name: 'Trainee Registration' })(TraineeRegisterForm);
export default withRouter(TraineeRegister);


