import React, { useEffect, useRef } from 'react';
import apis from '../../services/Apis';

const TrainerLivePreview = ({ traineeId, testId }) => {
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);
  const wsRef = useRef(null);

  useEffect(() => {
    const sendSignal = (data) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(data));
      }
    };

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
    const pc = new RTCPeerConnection({ iceServers });
    pcRef.current = pc;

    pc.ontrack = (event) => {
      console.log('Remote track received:', event);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
        console.log('Remote stream attached to video element');
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('Sending ICE candidate:', event.candidate);
        sendSignal({ type: 'ice-candidate', candidate: event.candidate });
      }
    };

    const params = new URLSearchParams({
      role: 'trainer',
      traineeid: traineeId
    });
    if (testId) {
      params.set('testid', testId);
      params.set('sessionid', `${testId}:${traineeId}`);
    }

    wsRef.current = new WebSocket(`${apis.WS_SIGNALING_URL}/?${params.toString()}`);
    wsRef.current.onopen = () => {
      console.log("Trainer signaling socket connected");
      console.log("Trainee " + traineeId);
      sendSignal({ type: 'request-offer' });
    };

    wsRef.current.onmessage = async (event) => {
      let data;
      if (event.data instanceof Blob) {
        data = await event.data.text();
      } else {
        data = event.data;
      }
      try {
        const message = JSON.parse(data);
        if (message.type === 'offer') {
          console.log("Received offer:", message.sdp);
          pc.setRemoteDescription(new RTCSessionDescription(message.sdp))
            .then(() => pc.createAnswer())
            .then(answer => pc.setLocalDescription(answer).then(() => answer))
            .then(answer => {
              console.log("Sending answer:", answer);
              sendSignal({ type: 'answer', sdp: answer });
            })
            .catch(e => console.error("Error handling offer:", e));
        } else if (message.type === 'ice-candidate') {
          console.log("Received ICE candidate:", message.candidate);
          pc.addIceCandidate(new RTCIceCandidate(message.candidate))
            .catch(e => console.error("Error adding ICE candidate:", e));
        }
      } catch (e) {
        console.error("Error parsing WebSocket message:", e);
      }
    };
    

    wsRef.current.onerror = (err) => {
      console.error("Trainer socket error:", err);
    };

    wsRef.current.onclose = () => {
      console.log("Trainer socket closed");
    };

    return () => {
      if (pcRef.current) pcRef.current.close();
      if (wsRef.current) wsRef.current.close();
    };
  }, [traineeId, testId]);

  return (
    <div>
      <video ref={remoteVideoRef} autoPlay playsInline controls style={{ width: '550px' }} />
    </div>
  );
};

export default TrainerLivePreview;
