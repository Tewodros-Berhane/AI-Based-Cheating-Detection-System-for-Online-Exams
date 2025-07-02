import React, { Component, Fragment } from 'react';
import { connect } from 'react-redux';
import { withRouter } from 'react-router-dom';
import { Typography, Skeleton, Form, Input, Button, Row, Col, Alert } from 'antd'; // Added Alert for better error display
import './portal.css';
import Instruction from './instruction';
import TestBoard from './testBoard';
import Answer from '../answersheet/answer';
import { fetchTraineedata, setTestDetsils, fetchTestdata, fetchTraineeByTraineeID, fetchTestByExamID } from '../../../actions/traineeAction'; // Assuming these actions update loading/error states in Redux
import queryString from 'query-string';
import { MediaStreamContext } from '../../../contexts/MediaStreamContext';
import TraineeStreamSender from '../TraineeStreamSender';
import WebRTCServer from '../WebRTCServer';
import FaceRecognition from '../FaceRecognition';

const { Title } = Typography;

class MainPortal extends Component {
    static contextType = MediaStreamContext;

    constructor(props) {
        super(props);
        let params = queryString.parse(this.props.location.search);
        this.state = {
            // testDetails will now primarily be driven by Redux state once IDs are known,
            // but we can use it for initial URL params.
            initialTestIdFromUrl: params.testid || null,
            initialTraineeIdFromUrl: params.traineeid || null,
            showIdForm: !params.testid || !params.traineeid,
            formTestId: params.testid || '', // Pre-fill if available, though form is hidden then
            formTraineeId: params.traineeid || '', // Pre-fill
            formSubmissionError: null, // For errors specific to form submission (e.g., invalid IDs)
            attemptedFetchWithFormIds: false, // Flag to know if a fetch was tried with form IDs
        };

        if (params.testid && params.traineeid) {
            // Dispatch action to set IDs in Redux store.
            // The actual data fetching will be triggered based on Redux state or in componentDidMount.
            this.props.setTestDetsils(params.testid, params.traineeid);
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
    loading: true
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
    const newSearch = queryString.stringify({
      testid: testMongoId,
      traineeid: traineeMongoId
    });
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
            <div className="id-form-wrapper" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', padding: '20px', background: '#f0f2f5' }}>
                <Row justify="center" style={{ width: '100%' }}>
                    <Col xs={24} sm={18} md={12} lg={8} xl={7}>
                        <div className="id-form-inner" style={{ padding: '30px 40px', border: '1px solid #d9d9d9', borderRadius: '8px', background: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                            <Title level={3} style={{ textAlign: 'center', marginBottom: '24px', color: '#333' }}>Access Test Portal</Title>
                            {formSubmissionError && (
                                <Alert message={formSubmissionError} type="error" showIcon style={{ marginBottom: '20px' }} />
                            )}
                            <Form layout="vertical">
                                <Form.Item
                                    label="Student ID"
                                    name="formTraineeId"
                                    required
                                    htmlFor="formTraineeId"
                                // help={formSubmissionError && !formTraineeId ? 'Trainee ID is required' : ''}
                                >
                                    <Input
                                        id="formTraineeId"
                                        name="formTraineeId"
                                        value={formTraineeId}
                                        onChange={this.handleInputChange}
                                        placeholder="Enter your Student ID"
                                        size="large"
                                    />
                                </Form.Item>
                                <Form.Item
                                    label="Exam ID"
                                    name="formTestId"
                                    required
                                    htmlFor="formTestId"
                                // help={formSubmissionError && !formTestId ? 'Test ID is required' : ''} // Can add individual field errors if needed
                                >
                                    <Input
                                        id="formTestId"
                                        name="formTestId"
                                        value={formTestId}
                                        onChange={this.handleInputChange}
                                        placeholder="Enter the Exam ID"
                                        size="large"
                                    />
                                </Form.Item>
                                
                                <Form.Item style={{ marginTop: '24px' }}>
                                    <Button type="primary" block size="large" onClick={this.handleIdSubmit}>
                                        Proceed to Test
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
                <div className="skeletor-wrapper" style={{padding: '50px'}}>
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
                <div style={{ textAlign: 'center', padding: '50px' }}>
                    <Title level={4}>Error</Title>
                    <Typography.Text>Could not load test details. The provided Test ID or Trainee ID might be invalid, or the test is not accessible.</Typography.Text>
                    <br /><br />
                    <Button onClick={() => this.setState({ showIdForm: true, initialTestIdFromUrl: null, initialTraineeIdFromUrl: null, formSubmissionError: null, attemptedFetchWithFormIds: false })}>
                        Enter IDs Again
                    </Button>
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
                    <div className="Test-portal-not-started-yet-inner">
                        <Title className="Test-portal-not-started-yet-inner-message" style={{ color: '#24292f' }} level={4}>The Exam is Over!<br /> The examiner has ended the exam.</Title>
                    </div>
                </div>
            );
        }
        if (!testbegins) {
            return (
                <div className="Test-portal-not-started-yet-wrapper">
                    <div className="Test-portal-not-started-yet-inner">
                        <Title className="Test-portal-not-started-yet-inner-message" style={{ color: '#24292f' }} level={4}>The exam has not started yet. You will be redirected once the exam starts.</Title>
                    </div>
                </div>
            );
        }
        if (startedWriting) {
            return (
                <div>
                    <TestBoard />
                    {traineeid && testid &&
                        <TraineeStreamSender traineeId={traineeid} testId={testid} />
                    }
                    {traineeid && testid &&
                        <WebRTCServer traineeId={traineeid} testId={testid}/>
                    }

                    {traineeid && testid &&
                        <FaceRecognition traineeId={traineeid} testId={testid} />
                    }
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