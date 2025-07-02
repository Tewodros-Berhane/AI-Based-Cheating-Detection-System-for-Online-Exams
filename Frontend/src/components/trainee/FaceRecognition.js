// src/components/trainee/examPortal/FaceRecognition.js
import React, { useEffect, useRef, useState, useContext } from 'react';
import * as faceapi from 'face-api.js';
import { useDispatch } from 'react-redux';
import { Post } from '../../services/axiosCall';
import apis from '../../services/Apis';
import { fetchTestdata } from '../../actions/traineeAction';
import { Modal, Button, message } from 'antd';
import { MediaStreamContext } from '../../contexts/MediaStreamContext';

export default function FaceRecognition({
  traineeId: initialTraineeId,
  testId: initialTestId
}) {
  const dispatch = useDispatch();
  const FaceRecognitionvideoRef = useRef();
  const { mediaStream, setMediaStream } = useContext(MediaStreamContext);

  // IDs
  const [traineeId, setTraineeId] = useState(initialTraineeId);
  const [testId,    setTestId]    = useState(initialTestId);

  const registeredDescriptor = useRef();
  const [modelsLoaded, setModelsLoaded]   = useState(false);
  const [mismatchCount, setMismatchCount] = useState(0);

  // no-face modal + timer
  const [showNoFaceModal, setShowNoFaceModal] = useState(false);
  const [noFaceTimer,    setNoFaceTimer]      = useState(10);

  // end-test modal + reason
  const [endReason, setEndReason] = useState(null);

  const countdownRef = useRef();
  const intervalRef  = useRef();

  // 1) Load face-api models once
  useEffect(() => {
    async function loadModels() {
      console.log('⏳ Loading face-api models…');
      await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
      await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
      await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
      console.log('✅ Models loaded');
      setModelsLoaded(true);
    }
    loadModels();
  }, []);

  // 2) When models + stream ready → fetch details, compute descriptor, start checks
  useEffect(() => {
    if (!modelsLoaded || !mediaStream) return;

    const videoOnlyStream = new MediaStream(mediaStream.getVideoTracks());

    console.log('📹 Attaching cloned video-only stream to hidden video');
    FaceRecognitionvideoRef.current.srcObject = videoOnlyStream;

    (async () => {
      try {
        console.log('🔎 Fetching trainee details…');
        const resp = await Post({
          url: apis.FETCH_TRAINEE_DETAILS,
          data: { _id: initialTraineeId }
        });
        if (!resp.data.success) throw new Error(resp.data.message);

        const details = resp.data.data;
        console.log('👤 Trainee details:', details);
        setTraineeId(details._id);

        const img = await faceapi.fetchImage(details.faceImageUrl);
        const det = await faceapi
          .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceDescriptor();
        
          if (!det) {
            throw new Error("No face detected in the trainee's registered photo.");
          }

        registeredDescriptor.current = det.descriptor;
        console.log('✅ Registered face descriptor saved');

        console.log('🚀 Starting face-check interval');
        intervalRef.current = setInterval(checkFace, 2000);
      } catch (err) {
        console.error('❌ Initialization error:', err);
        endExam('Initialization error');
      }
    })();

    return () => {
      clearInterval(intervalRef.current);
      clearInterval(countdownRef.current)
    };
  }, [modelsLoaded, mediaStream]);

  // 3) Main face-check routine
  async function checkFace() {
    if (!registeredDescriptor.current) return;
    console.log('🔄 Running face check…');

    const faces = await faceapi
      .detectAllFaces(FaceRecognitionvideoRef.current, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptors();
    console.log(`👀 Faces found: ${faces.length}`);

    // if any face, clear the no-face timer/modal
    if (faces.length > 0) {
      console.log('🙂 Face detected—clearing no-face warning');
      hideNoFaceModal();
    }

    // multi-face → end immediately
    if (faces.length > 1) {
      console.log('⚠️ Multiple faces—ending exam');
      return endExam('Multiple faces detected');
    }

    // no face → start or continue countdown
    if (faces.length === 0) {
      console.log('😶 No face detected');
      if (!showNoFaceModal) startNoFaceCountdown();
      return;
    }

    // single face → compare descriptor
    const distance = faceapi.euclideanDistance(
      registeredDescriptor.current,
      faces[0].descriptor
    );
    console.log('🔍 Face distance:', distance.toFixed(3));
    const THRESH = 0.5;
    if (distance > THRESH) {
      console.log('❌ Face did not match—ending exam');
      return endExam('Face did not match');
    }

  }

  // 4) No-face countdown logic
  function startNoFaceCountdown() {
    console.log('⏱️ Starting no-face countdown');
    setShowNoFaceModal(true);
    countdownRef.current = setInterval(() => {
       setNoFaceTimer(prev => {
         const next = prev - 1;
         console.log('No-face timer:', next);
         if (next <= 0) {
          clearInterval(countdownRef.current);
           console.log('⏰ No-face timeout—ending exam');
           endExam('No face detected for 30s');
           return 0;       // <-- return a number, not a Promise
        }
         return next;
       });
    }, 1000);
  }

  function hideNoFaceModal() {
    console.log('🚫 Hiding no-face modal + stopping timer');
    setShowNoFaceModal(false);
    setNoFaceTimer(30);
    clearInterval(countdownRef.current);
    countdownRef.current = null;
  }

  // 5) End exam, then fetch test data via Redux, show reason modal
  async function endExam(reason) {
    // stop loops
    clearInterval(intervalRef.current);
    clearInterval(countdownRef.current);

    console.log('🏁 endExam triggered:', { testId, traineeId, reason });
    // clear camera
    if (mediaStream) {
      mediaStream.getTracks().forEach(t => t.stop());
      setMediaStream(null);
    }

    // call backend
    try {
      const resp = await Post({
        url: apis.END_TEST,
        data: { testid: testId, userid: traineeId }
      });
      console.log('✅ End-test response:', resp.data);
    } catch (err) {
      console.error('❌ End-test error:', err);
    }

    // dispatch reload
    dispatch(fetchTestdata(testId, traineeId));

    // show modal with reason
    message.error(
        <>
          <div>Your exam has been terminated because: <strong>{reason}</strong></div>
          <div>If you have any questions, please contact your instructor.</div>
        </>,
    10);
  }

  return (
    <>
      {/* hidden video for face-api only */}
      <video
        ref={FaceRecognitionvideoRef}
        autoPlay
        muted
        width={0}
        height={0}
        style={{ position: 'fixed', bottom: 10, right: 10, border: '2px solid transparent' }}
        />

      {/* no-face warning modal */}
      <Modal
        visible={showNoFaceModal}
        title="No Face Detected"
        closable={false}
        footer={null}
      >
        <p>Please look at the camera.</p>
        <p>Test will end in {noFaceTimer} seconds if no face is detected.</p>
      </Modal>
    </>
  );
}
