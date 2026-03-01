import React, { Component } from 'react';
import { connect } from 'react-redux';
import { Typography, Skeleton, Form, Input, Button, Row, Col, Alert } from 'antd-compat'; // Added Alert for better error display
import './portal.css';
import Instruction from './instruction';
import TestBoard from './testBoard';
import Answer from '../answersheet/answer';
import { fetchTraineedata, setTestDetsils, fetchTestdata, fetchTraineeByTraineeID, fetchTestByExamID } from '../../../actions/traineeAction'; // Assuming these actions update loading/error states in Redux
import { MediaStreamContext } from '../../../contexts/MediaStreamContext';
import TraineeStreamSender from '../TraineeStreamSender';
import WebRTCServer from '../WebRTCServer';
import TraineeSessionManager from '../TraineeSessionManager';
import withRouter from '../../../utils/withRouter';

const { Title } = Typography;

class MainPortal extends Component {
    static contextType = MediaStreamContext;

    constructor(props) {
        super(props);
        const params = new URLSearchParams(this.props.location.search);
        const testid = params.get('testid');
        const traineeid = params.get('traineeid');
        this.state = {
            // testDetails will now primarily be driven by Redux state once IDs are known,
            // but we can use it for initial URL params.
            initialTestIdFromUrl: testid || null,
            initialTraineeIdFromUrl: traineeid || null,
            showIdForm: !testid || !traineeid,
            formTestId: testid || '', // Pre-fill if available, though form is hidden then
            formTraineeId: traineeid || '', // Pre-fill
            formSubmissionError: null, // For errors specific to form submission (e.g., invalid IDs)
            attemptedFetchWithFormIds: false, // Flag to know if a fetch was tried with form IDs
            loading: false
        };

        if (testid && traineeid) {
            // Dispatch action to set IDs in Redux store.
            // The actual data fetching will be triggered based on Redux state or in componentDidMount.
            this.props.setTestDetsils(testid, traineeid);
        }
    }

    componentDidMount() {
        const { initialTestIdFromUrl, initialTraineeIdFromUrl } = this.state;
        const { traineeid: reduxTraineeId, testid: reduxTestId } = this.props.trainee;

        // If IDs came from URL and are set in Redux (by constructor call to setTestDetsils)
        // or if they are already in Redux store from a previous state (e.g. navigation)
        const effectiveTestId = initialTestIdFromUrl || reduxTestId;
        const effectiveTraineeId = initialTraineeIdFromUrl || reduxTraineeId;

        if (effectiveTestId && effectiveTraineeId && !this.state.showIdForm) {
            console.log('componentDidMount: Fetching data for traineeid:', effectiveTraineeId, 'testid:', effectiveTestId);
            // Ensure Redux actions set loading states (initialloading1, initialloading2)
            this.props.fetchTraineedata(effectiveTraineeId);
            this.props.fetchTestdata(effectiveTestId, effectiveTraineeId);
        }

        // Set up polling for test status updates
        this.pollInterval = setInterval(() => {
            const { traineeid, testid } = this.props.trainee;
            if (traineeid && testid) {
                console.log('Polling for test status...');
                this.props.fetchTestdata(testid, traineeid); 
            }
        }, 5000); 
    }

    componentWillUnmount() {
        clearInterval(this.pollInterval); 
    }

    componentDidUpdate(prevProps, prevState) {
        const { trainee } = this.props;
        const { initialloading1, initialloading2, invalidUrl } = trainee;

        // If we attempted a fetch with form IDs and it resulted in an invalidUrl error
        if (this.state.attemptedFetchWithFormIds &&
            !initialloading1 && !initialloading2 && // loading is complete
            invalidUrl && // and there's an error
            (prevProps.trainee.initialloading1 || prevProps.trainee.initialloading2)) { // and we were previously loading
            this.setState({
                showIdForm: true, // Show the form again
                formSubmissionError: 'Invalid Test ID or Trainee ID. Please check and try again.', // Set a specific error
                attemptedFetchWithFormIds: false, // Reset flag
            });
        }
    }

    handleInputChange = (e) => {
        this.setState({
            [e.target.name]: e.target.value,
            formSubmissionError: null, // Clear error on input change
        });
    }

handleIdSubmit = async (e) => {
  e.preventDefault();
  const { formTestId: examID, formTraineeId: traineeID } = this.state;

  // Basic validation
  if (!examID || !traineeID) {
    this.setState({ formSubmissionError: 'Both Test ID and Trainee ID are required.' });
    return;
  }

  this.setState({
    showIdForm: false,
    formSubmissionError: null,
    loading: true,
    attemptedFetchWithFormIds: true
  });

  try {
    // 1. Fetch Trainee Data
    const traineeResult = await this.props.fetchTraineeByTraineeID(traineeID);
    
    if (!traineeResult || !traineeResult.success || !traineeResult.data || !traineeResult.data._id) {
      const errorMsg = (traineeResult && traineeResult.message) 
        ? traineeResult.message 
        : 'Invalid trainee response';
      throw new Error(errorMsg);
    }
    
    const traineeMongoId = traineeResult.data._id;
    console.log('Trainee Mongo ID:', traineeMongoId);

    // 2. Fetch Test Data
    const testResult = await this.props.fetchTestByExamID(examID, traineeMongoId);
    
    if (!testResult || !testResult.success || !testResult.data || !testResult.data._id) {
      const errorMsg = (testResult && testResult.message) 
        ? testResult.message 
        : 'Invalid test response';
      throw new Error(errorMsg);
    }
    
    const testMongoId = testResult.data._id;
    console.log('Test Mongo ID:', testMongoId);

    // 3. Update Redux state
    this.props.setTestDetsils(testMongoId, traineeMongoId);
    this.props.fetchTestdata(testMongoId, traineeMongoId);
    this.props.fetchTraineedata(traineeMongoId);
    
    // 4. Update URL
    const newSearch = new URLSearchParams({
      testid: testMongoId,
      traineeid: traineeMongoId
    }).toString();
    this.props.history.push(`${this.props.location.pathname}?${newSearch}`);

  } catch (error) {
    console.error('Error in handleIdSubmit:', {
      error: error.message,
      stack: error.stack
    });
    this.setState({ 
      showIdForm: true,
      formSubmissionError: error.message || 'Failed to process IDs. Please try again.',
      loading: false
    });
  } finally {
    this.setState({ loading: false });
  }
};

    renderIdForm() {
    const { formTestId, formTraineeId, formSubmissionError } = this.state;
        console.log('[renderIdForm] form is rendering');
        return (
            <div className="id-form-wrapper">
                <Row justify="center" style={{ width: '100%' }}>
                    <Col xs={24} sm={18} md={12} lg={8} xl={7}>
                        <div className="id-form-inner app-glass-card">
                            <div className="id-form-header">
                                <Title level={3}>Access Exam Workspace</Title>
                                <p>Enter the IDs from your invitation email to continue.</p>
                            </div>
                            {formSubmissionError && (
                                <Alert message={formSubmissionError} type="error" showIcon className="id-form-alert" />
                            )}
                            <Form layout="vertical" className="trainee-access-form">
                                <Form.Item
                                    label="Candidate ID"
                                    name="formTraineeId"
                                    htmlFor="formTraineeId"
                                >
                                    <Input
                                        id="formTraineeId"
                                        name="formTraineeId"
                                        value={formTraineeId}
                                        onChange={this.handleInputChange}
                                        onPressEnter={this.handleIdSubmit}
                                        placeholder="Enter your candidate ID"
                                        size="large"
                                    />
                                </Form.Item>
                                <Form.Item
                                    label="Exam ID"
                                    name="formTestId"
                                    htmlFor="formTestId"
                                >
                                    <Input
                                        id="formTestId"
                                        name="formTestId"
                                        value={formTestId}
                                        onChange={this.handleInputChange}
                                        onPressEnter={this.handleIdSubmit}
                                        placeholder="Enter the Exam ID"
                                        size="large"
                                    />
                                </Form.Item>
                                
                                <Form.Item className="id-form-action">
                                    <Button type="primary" block size="large" htmlType="submit" onClick={this.handleIdSubmit} loading={this.state.loading}>
                                        Enter Testing Room
                                    </Button>
                                </Form.Item>
                            </Form>
                        </div>
                    </Col>
                </Row>
            </div>
        );
    }

    render() {
        const { showIdForm } = this.state;
        const { trainee } = this.props;
        
        // Destructure relevant props from trainee AFTER it's defined
        const { initialloading1, initialloading2, invalidUrl, LocaltestDone, testconducted, testbegins, startedWriting, traineeid, testid } = trainee;


        if (showIdForm) {
            return this.renderIdForm();
        }

        // If IDs are not yet in Redux store (e.g., setTestDetsils is async or form not submitted yet)
        // and we are not showing the form, it might be a brief moment before data fetch starts.
        // The loading flags from Redux (initialloading1, initialloading2) are the primary indicators.
        if (!traineeid || !testid) {
             // This condition should ideally be caught by showIdForm=true if no URL params initially.
             // If form was submitted, setTestDetsils should have updated these in Redux.
             // If they are still null/undefined here and form is not shown, it's an inconsistent state.
             // Could show a generic loading or redirect to form.
             // For now, assuming if form is not shown, IDs are expected to be in Redux soon or data is loading.
             // The skeleton loader below should handle the visual feedback.
        }


        if (initialloading1 || initialloading2) {
            return (
                <div className="skeletor-wrapper">
                    <Skeleton active paragraph={{ rows: 4 }} />
                    <Skeleton active paragraph={{ rows: 4 }} style={{marginTop: '20px'}}/>
                </div>
            );
        }

        // IMPORTANT: The 'invalidUrl' flag is critical here.
        // If it becomes true AFTER data fetching was attempted (either from URL or form),
        // componentDidUpdate should handle resetting to showIdForm with an error.
        // If invalidUrl is true and we are NOT showing the form, and loading is complete,
        // it implies an unhandled error state or a logic flaw.
        // The current componentDidUpdate aims to catch this for form submissions.
        // If invalidUrl is from initial URL load, page might blank or show error as per original logic.
        // Let's refine the invalidUrl check:
        if (invalidUrl && !showIdForm && !initialloading1 && !initialloading2) {
            // This situation should ideally have been handled by componentDidUpdate to show the form again
            // if the error was due to a form submission.
            // If it's due to bad URL params initially, redirecting or showing an error page might be suitable.
            // For now, to prevent loops, let's show a generic error if not caught by form logic.
            // This assumes your Redux actions correctly set `invalidUrl`.
            console.warn("Render: invalidUrl is true, loading is false, and form is not shown. This might indicate an issue if IDs were from a form and failed.");
            // Fallback to showing the form, which is safer.
            // But this might flash if componentDidUpdate is also trying to set it.
            // A cleaner way is to ensure componentDidUpdate robustly handles the reset.
            // The current componentDidUpdate should handle this. If we reach here,
            // it means invalidUrl was set for reasons other than recent form submission (e.g. initial URL params were bad).
            // In that case, showing a generic error or redirecting as per original logic might be better.
            // return window.location.href=``; // Original redirect for invalid URL
             return (
                <div className="trainee-status-page">
                    <div className="trainee-status-card app-glass-card">
                        <Title level={4}>Unable to load exam details</Title>
                        <Typography.Text>We could not validate the provided IDs or the exam is not currently accessible.</Typography.Text>
                        <Button className="trainee-status-action" onClick={() => this.setState({ showIdForm: true, initialTestIdFromUrl: null, initialTraineeIdFromUrl: null, formSubmissionError: null, attemptedFetchWithFormIds: false })}>
                            Re-enter IDs
                        </Button>
                    </div>
                </div>
            );
        }


        // Existing rendering logic based on Redux state
        if (LocaltestDone) {
            return <div><Answer /></div>;
        }
        if (testconducted) {
            return (
                <div className="Test-portal-not-started-yet-wrapper">
                    <div className="Test-portal-not-started-yet-inner app-glass-card">
                        <Title className="Test-portal-not-started-yet-inner-message" level={4}>This exam session has ended.</Title>
                        <p className="trainee-status-supporting-text">The examiner closed this session. If you need help, contact your examiner.</p>
                    </div>
                </div>
            );
        }
        if (!testbegins) {
            return (
                <div className="Test-portal-not-started-yet-wrapper">
                    <div className="Test-portal-not-started-yet-inner app-glass-card">
                        <Title className="Test-portal-not-started-yet-inner-message" level={4}>Exam has not started yet.</Title>
                        <p className="trainee-status-supporting-text">Keep this page open. You will be redirected automatically once the exam begins.</p>
                    </div>
                </div>
            );
        }
        if (startedWriting) {
            return (
                <div>
                    {traineeid && <TraineeSessionManager traineeId={traineeid} testId={testid} />}
                    <TestBoard />
                    {traineeid && testid &&
                        <TraineeStreamSender traineeId={traineeid} testId={testid} />
                    }
                    {traineeid && testid &&
                        <WebRTCServer traineeId={traineeid} testId={testid}/>
                    }

                    {/* {traineeid && testid &&
                        <FaceRecognition traineeId={traineeid} testId={testid} />
                    } */}
                </div>
            );
        }
        
        return <div><Instruction /></div>;
    }
}

const mapStateToProps = state => ({
    trainee: state.trainee,
});

export default withRouter(connect(mapStateToProps, {
    fetchTraineedata,
    setTestDetsils,
    fetchTestdata,
    fetchTraineeByTraineeID,
    fetchTestByExamID,
})(MainPortal));

