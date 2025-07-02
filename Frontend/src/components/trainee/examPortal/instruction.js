import React, { useState, useContext } from 'react';
import { connect } from 'react-redux';
import { Button, message } from 'antd';
import { ProceedtoTest, fetchTestdata } from '../../../actions/traineeAction';
import { MediaStreamContext } from '../../../contexts/MediaStreamContext';
import './portal.css';

function Instruction(props) {
  const { mediaStream, setMediaStream } = useContext(MediaStreamContext);
  const [permissionGranted, setPermissionGranted] = useState(!!mediaStream);
  const [streamingStarted, setStreamingStarted] = useState(false);

  // Request camera and microphone access and store the stream in context.
  const handleGivePermission = () => {
    if (
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === "function"
    ) {
      navigator.mediaDevices
        .getUserMedia({ video: true, audio: true })
        .then((stream) => {
          setMediaStream(stream);
          setPermissionGranted(true);
          message.success("Camera and microphone permission granted.");
        })
        .catch((err) => {
          setPermissionGranted(false);
          message.error("Permission denied. Please allow access to camera and microphone.");
        });
    } else {
      setPermissionGranted(false);
      message.error("getUserMedia is not supported in this browser or environment.");
    }
  };

  // Proceed only if permission is granted
  const handleProceed = async () => {
    if (!permissionGranted) {
      message.error("Please grant camera and microphone permission before proceeding.");
      return;
    }
    // Now start the streaming and test logic.
    setStreamingStarted(true);
    props.ProceedtoTest(props.trainee.testid, props.trainee.traineeid, () => {
      props.fetchTestdata(props.trainee.testid, props.trainee.traineeid);
    });
  };

  return (
    <div>
  <div className="instruction-page-wrapper">
    <div className="instruction-page-inner">
      <h2>General Instructions:</h2>
      <ul>
        <li>The uploaded picture should match the person taking the exam.</li>
        <li>No suspicious sounds, whispering, or cheating movements.</li>
        <li>Keep your face visible in the camera during the exam.</li>
        <li>Grant audio and camera permission to proceed.</li>
        <li>Click 'Proceed to Exam' once permissions are granted.</li>
        <li>Once you have proceeded to the exam <strong> Do not refresh the page </strong>.</li>
      </ul>

      {/* Exam Instructions */}
      <h2>Exam Instructions:</h2>
      <ul>
        <li>All questions are compulsory.</li>
        <li>You can bookmark any question.</li>
        <li>Answers can be updated anytime before the time limit.</li>
        <li>The exam is time-bound with a timer on the right panel.</li>
        <li>Click 'End Exam' to submit the test before the time limit.</li>
        <li>The exam will automatically be submitted when the clock hits 0:0.</li>
      </ul>

      <div style={{ marginTop: '20px' }}>
        <Button
          
          icon="camera"
          type="default" 
          onClick={handleGivePermission}
          style={{ marginRight: '10px', background: permissionGranted ? 'green' : 'red', color:'#fff' }}
        >
          Give Permission
        </Button>
        <Button
          style={{ float: 'right' }}
          type="primary"
          icon="caret-right"
          onClick={handleProceed}
          loading={props.trainee.proceedingToTest}
        >
          Proceed To Exam
        </Button>
      </div>
    <h2 style={{ textAlign: 'center', fontSize: '1rem', fontWeight: 'bold', color: '#000', marginTop: '40px' }}>GOOD LUCK!</h2>
    </div>
  </div>
  
</div>

  );
}

const mapStateToProps = state => ({
  trainee: state.trainee,
});

export default connect(mapStateToProps, {
  ProceedtoTest,
  fetchTestdata
})(Instruction);
