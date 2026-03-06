import React, { useContext, useEffect, useRef } from 'react';
import { message } from 'antd-compat';
import { MediaStreamContext } from '../../contexts/MediaStreamContext';
import apis from '../../services/Apis';

const hasLiveVideoTrack = (stream) =>
  Boolean(
    stream &&
      typeof stream.getVideoTracks === 'function' &&
      stream.getVideoTracks().some((track) => track.readyState === 'live')
  );

const buildIceServers = () => {
  const iceServers = [];
  if (apis.RTC_STUN_URLS.length > 0) {
    iceServers.push({ urls: apis.RTC_STUN_URLS });
  }
  if (
    apis.RTC_TURN_URLS.length > 0 &&
    apis.RTC_TURN_USERNAME &&
    apis.RTC_TURN_CREDENTIAL
  ) {
    iceServers.push({
      urls: apis.RTC_TURN_URLS,
      username: apis.RTC_TURN_USERNAME,
      credential: apis.RTC_TURN_CREDENTIAL
    });
  }
  return iceServers;
};

const buildOfferPayload = (offer, cameraStream, screenStream, requireScreenShare) => ({
  type: 'offer',
  sdp: offer,
  mediaMeta: {
    cameraStreamId: cameraStream && cameraStream.id ? cameraStream.id : null,
    screenStreamId: screenStream && screenStream.id ? screenStream.id : null,
    requireScreenShare: Boolean(requireScreenShare)
  }
});

const TraineeStreamSender = ({ traineeId, testId, requireScreenShare = false }) => {
  const localVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const socketRef = useRef(null);
  const mountedRef = useRef(true);
  const mediaStreamRef = useRef(null);
  const screenStreamRef = useRef(null);

  const { mediaStream, setMediaStream, screenStream, setScreenStream } = useContext(MediaStreamContext);

  useEffect(() => {
    mediaStreamRef.current = mediaStream;
  }, [mediaStream]);

  useEffect(() => {
    screenStreamRef.current = screenStream;
  }, [screenStream]);

  useEffect(() => {
    mountedRef.current = true;

    const connectWebSocketAndStream = async () => {
      try {
        let cameraStream = mediaStreamRef.current;
        if (!hasLiveVideoTrack(cameraStream)) {
          cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          if (mountedRef.current) {
            setMediaStream(cameraStream);
          }
        }

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = cameraStream;
        }

        let activeScreenStream = null;
        if (requireScreenShare) {
          activeScreenStream = screenStreamRef.current;
          if (!hasLiveVideoTrack(activeScreenStream)) {
            if (!navigator.mediaDevices || typeof navigator.mediaDevices.getDisplayMedia !== 'function') {
              throw new Error('Screen sharing is not supported in this browser.');
            }
            activeScreenStream = await navigator.mediaDevices.getDisplayMedia({
              video: true,
              audio: false
            });
            if (mountedRef.current) {
              setScreenStream(activeScreenStream);
            }
          }
        }

        const pc = new RTCPeerConnection({ iceServers: buildIceServers() });
        peerConnectionRef.current = pc;

        cameraStream.getTracks().forEach((track) => {
          pc.addTrack(track, cameraStream);
        });

        if (requireScreenShare && activeScreenStream) {
          activeScreenStream.getVideoTracks().forEach((track) => {
            track.contentHint = 'detail';
            track.onended = () => {
              if (!mountedRef.current) return;
              if (mountedRef.current) {
                setScreenStream(null);
              }
              message.warning('Screen sharing was stopped. This exam requires active screen sharing.');
            };
            pc.addTrack(track, activeScreenStream);
          });
        }

        pc.onicecandidate = (event) => {
          if (event.candidate && socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({ type: 'ice-candidate', candidate: event.candidate }));
          }
        };

        const params = new URLSearchParams({
          role: 'trainee',
          traineeid: traineeId
        });
        if (testId) {
          params.set('testid', testId);
          params.set('sessionid', `${testId}:${traineeId}`);
        }

        socketRef.current = new WebSocket(`${apis.WS_SIGNALING_URL}/?${params.toString()}`);
        socketRef.current.onopen = async () => {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socketRef.current.send(
            JSON.stringify(buildOfferPayload(offer, cameraStream, activeScreenStream, requireScreenShare))
          );
        };

        socketRef.current.onmessage = async (event) => {
          let data;
          if (event.data instanceof Blob) {
            data = await event.data.text();
          } else {
            data = event.data;
          }
          try {
            const signal = JSON.parse(data);
            if (signal.type === 'request-offer') {
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              socketRef.current.send(
                JSON.stringify(buildOfferPayload(offer, cameraStream, activeScreenStream, requireScreenShare))
              );
            } else if (signal.type === 'answer') {
              await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
            } else if (signal.type === 'ice-candidate') {
              pc.addIceCandidate(new RTCIceCandidate(signal.candidate)).catch((error) => {
                console.error('Error adding ICE candidate:', error);
              });
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        socketRef.current.onerror = (error) => {
          console.error('Trainee socket error:', error);
        };
      } catch (error) {
        console.error('Error setting up local stream and peer connection:', error);
        if (mountedRef.current) {
          message.error(error && error.message ? error.message : 'Unable to start live streaming for this exam.');
        }
      }
    };

    connectWebSocketAndStream();

    return () => {
      mountedRef.current = false;
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [traineeId, testId, requireScreenShare, setMediaStream, setScreenStream]);

  return (
    <video
      ref={localVideoRef}
      autoPlay
      playsInline
      muted
      style={{ display: 'none' }}
      aria-hidden="true"
    />
  );
};

export default TraineeStreamSender;
