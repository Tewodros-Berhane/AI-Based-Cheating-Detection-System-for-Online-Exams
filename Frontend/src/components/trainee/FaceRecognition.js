import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';
import { useDispatch } from 'react-redux';
import { Modal, message } from 'antd-compat';
import { Post } from '../../services/axiosCall';
import apis from '../../services/Apis';
import { fetchTestdata } from '../../actions/traineeAction';
import { MediaStreamContext } from '../../contexts/MediaStreamContext';

const MODEL_URI = '/models';
const CHECK_INTERVAL_MS = 2000;
const NO_FACE_TIMEOUT_SECONDS = 30;
const FACE_MISMATCH_THRESHOLD = 0.5;
const MAX_MISMATCH_STRIKES = 3;
const MAX_MULTI_FACE_STRIKES = 2;
const VIDEO_READY_TIMEOUT_MS = 8000;

const DETECTOR_OPTIONS = new faceapi.TinyFaceDetectorOptions({
  inputSize: 320,
  scoreThreshold: 0.5
});

let modelLoadPromise = null;

function areModelsLoaded() {
  return Boolean(
    faceapi.nets.tinyFaceDetector.params &&
      faceapi.nets.faceLandmark68Net.params &&
      faceapi.nets.faceRecognitionNet.params
  );
}

async function ensureModelsLoaded() {
  if (areModelsLoaded()) return;
  if (!modelLoadPromise) {
    modelLoadPromise = Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URI),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URI),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URI)
    ]);
  }
  await modelLoadPromise;
}

function waitForVideoReady(videoEl, timeoutMs = VIDEO_READY_TIMEOUT_MS) {
  if (!videoEl) return Promise.reject(new Error('Video element not available'));
  if (videoEl.readyState >= 2) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error('Video stream not ready for face detection'));
    }, timeoutMs);

    function cleanup() {
      window.clearTimeout(timeoutId);
      videoEl.removeEventListener('loadeddata', onReady);
      videoEl.removeEventListener('canplay', onReady);
    }

    function onReady() {
      cleanup();
      resolve();
    }

    videoEl.addEventListener('loadeddata', onReady);
    videoEl.addEventListener('canplay', onReady);
  });
}

export default function FaceRecognition({ traineeId: initialTraineeId, testId: initialTestId }) {
  const dispatch = useDispatch();
  const videoRef = useRef(null);
  const { mediaStream, setMediaStream } = useContext(MediaStreamContext);

  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [showNoFaceModal, setShowNoFaceModal] = useState(false);
  const [noFaceTimer, setNoFaceTimer] = useState(NO_FACE_TIMEOUT_SECONDS);

  const mountedRef = useRef(true);
  const intervalRef = useRef(null);
  const countdownRef = useRef(null);
  const registeredDescriptorRef = useRef(null);
  const checkInProgressRef = useRef(false);
  const examEndedRef = useRef(false);
  const noFaceCountdownActiveRef = useRef(false);
  const noFaceRemainingRef = useRef(NO_FACE_TIMEOUT_SECONDS);
  const mismatchStrikeRef = useRef(0);
  const multiFaceStrikeRef = useRef(0);
  const traineeIdRef = useRef(initialTraineeId);
  const testIdRef = useRef(initialTestId);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    traineeIdRef.current = initialTraineeId;
  }, [initialTraineeId]);

  useEffect(() => {
    testIdRef.current = initialTestId;
  }, [initialTestId]);

  const clearNoFaceCountdown = useCallback((resetTimer = true) => {
    if (countdownRef.current) {
      window.clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    noFaceCountdownActiveRef.current = false;
    if (mountedRef.current) {
      setShowNoFaceModal(false);
    }
    if (resetTimer) {
      noFaceRemainingRef.current = NO_FACE_TIMEOUT_SECONDS;
      if (mountedRef.current) {
        setNoFaceTimer(NO_FACE_TIMEOUT_SECONDS);
      }
    }
  }, []);

  const stopMonitoring = useCallback(() => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    clearNoFaceCountdown();
    checkInProgressRef.current = false;
  }, [clearNoFaceCountdown]);

  const endExam = useCallback(
    async (reason) => {
      if (examEndedRef.current) return;
      examEndedRef.current = true;
      stopMonitoring();

      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
        setMediaStream(null);
      }

      const currentTestId = testIdRef.current;
      const currentTraineeId = traineeIdRef.current;

      try {
        if (currentTestId && currentTraineeId) {
          await Post({
            url: apis.END_TEST,
            data: { testid: currentTestId, userid: currentTraineeId }
          });
        }
      } catch (error) {
        console.error('Face recognition end-exam call failed:', error);
      }

      if (currentTestId && currentTraineeId) {
        dispatch(fetchTestdata(currentTestId, currentTraineeId));
      }

      message.error(
        <>
          <div>
            Your exam has been terminated because: <strong>{reason}</strong>
          </div>
          <div>If you have any questions, please contact your instructor.</div>
        </>,
        10
      );
    },
    [dispatch, mediaStream, setMediaStream, stopMonitoring]
  );

  const startNoFaceCountdown = useCallback(() => {
    if (examEndedRef.current || noFaceCountdownActiveRef.current) return;
    noFaceCountdownActiveRef.current = true;
    noFaceRemainingRef.current = NO_FACE_TIMEOUT_SECONDS;
    if (mountedRef.current) {
      setNoFaceTimer(NO_FACE_TIMEOUT_SECONDS);
      setShowNoFaceModal(true);
    }

    countdownRef.current = window.setInterval(() => {
      noFaceRemainingRef.current = Math.max(noFaceRemainingRef.current - 1, 0);
      if (mountedRef.current) {
        setNoFaceTimer(noFaceRemainingRef.current);
      }
      if (noFaceRemainingRef.current === 0) {
        clearNoFaceCountdown(false);
        endExam('No face detected for 30s');
      }
    }, 1000);
  }, [clearNoFaceCountdown, endExam]);

  const checkFace = useCallback(async () => {
    if (examEndedRef.current || checkInProgressRef.current || !registeredDescriptorRef.current) return;
    const videoEl = videoRef.current;
    if (!videoEl || videoEl.readyState < 2) return;

    checkInProgressRef.current = true;
    try {
      const faces = await faceapi
        .detectAllFaces(videoEl, DETECTOR_OPTIONS)
        .withFaceLandmarks()
        .withFaceDescriptors();

      if (faces.length === 0) {
        mismatchStrikeRef.current = 0;
        multiFaceStrikeRef.current = 0;
        startNoFaceCountdown();
        return;
      }

      clearNoFaceCountdown();

      if (faces.length > 1) {
        multiFaceStrikeRef.current += 1;
        mismatchStrikeRef.current = 0;
        if (multiFaceStrikeRef.current >= MAX_MULTI_FACE_STRIKES) {
          endExam('Multiple faces detected');
        }
        return;
      }

      multiFaceStrikeRef.current = 0;
      const distance = faceapi.euclideanDistance(registeredDescriptorRef.current, faces[0].descriptor);
      if (distance > FACE_MISMATCH_THRESHOLD) {
        mismatchStrikeRef.current += 1;
        if (mismatchStrikeRef.current >= MAX_MISMATCH_STRIKES) {
          endExam('Face did not match');
        }
        return;
      }

      mismatchStrikeRef.current = 0;
    } catch (error) {
      // Keep running on transient detection failures.
      console.error('Face recognition check failed:', error);
    } finally {
      checkInProgressRef.current = false;
    }
  }, [clearNoFaceCountdown, endExam, startNoFaceCountdown]);

  useEffect(() => {
    let cancelled = false;

    async function loadModels() {
      try {
        await ensureModelsLoaded();
        if (!cancelled && mountedRef.current) {
          setModelsLoaded(true);
        }
      } catch (error) {
        console.error('Face model loading failed:', error);
        if (!cancelled && mountedRef.current) {
          message.warning('Face verification could not be started. Please keep your camera on.');
        }
      }
    }

    loadModels();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!modelsLoaded || !mediaStream || !initialTraineeId || !initialTestId) return undefined;
    let cancelled = false;
    const videoEl = videoRef.current;
    if (!videoEl) return undefined;

    async function initialize() {
      try {
        const videoOnlyStream = new MediaStream(mediaStream.getVideoTracks());
        videoEl.srcObject = videoOnlyStream;
        await videoEl.play().catch(() => null);
        await waitForVideoReady(videoEl);

        const response = await Post({
          url: apis.FETCH_TRAINEE_DETAILS,
          data: { _id: initialTraineeId }
        });

        if (!response.data.success || !response.data.data) {
          throw new Error(response.data.message || 'Could not fetch trainee details');
        }

        const details = response.data.data;
        if (!details.faceImageUrl) {
          throw new Error('No registered face image found for trainee');
        }

        traineeIdRef.current = details._id || initialTraineeId;

        const image = await faceapi.fetchImage(details.faceImageUrl);
        const detection = await faceapi
          .detectSingleFace(image, DETECTOR_OPTIONS)
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (!detection || cancelled) {
          throw new Error('No face detected in the registered face image');
        }

        registeredDescriptorRef.current = detection.descriptor;
        if (!intervalRef.current) {
          intervalRef.current = window.setInterval(() => {
            checkFace();
          }, CHECK_INTERVAL_MS);
        }
      } catch (error) {
        console.error('Face recognition initialization failed:', error);
        if (!cancelled && mountedRef.current) {
          message.warning('Face verification failed to initialize. Please refresh and retry.');
        }
      }
    }

    initialize();
    return () => {
      cancelled = true;
      stopMonitoring();
      registeredDescriptorRef.current = null;
      mismatchStrikeRef.current = 0;
      multiFaceStrikeRef.current = 0;
      if (videoEl) {
        videoEl.pause();
        videoEl.srcObject = null;
      }
    };
  }, [checkFace, initialTestId, initialTraineeId, mediaStream, modelsLoaded, stopMonitoring]);

  return (
    <>
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        width={0}
        height={0}
        style={{ position: 'fixed', bottom: 10, right: 10, border: '2px solid transparent' }}
      />

      <Modal visible={showNoFaceModal} title="No Face Detected" closable={false} footer={null}>
        <p>Please look at the camera.</p>
        <p>Test will end in {noFaceTimer} seconds if no face is detected.</p>
      </Modal>
    </>
  );
}
