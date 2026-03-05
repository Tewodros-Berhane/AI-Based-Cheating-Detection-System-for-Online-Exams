import React, { useEffect, useRef, useState } from 'react';
import apis from '../../services/Apis';

const looksLikeScreenTrack = (track) => {
  if (!track) return false;
  const label = String(track.label || '').toLowerCase();
  const settings = typeof track.getSettings === 'function' ? track.getSettings() : {};
  return Boolean(settings.displaySurface) || /screen|display|window|monitor/.test(label);
};

const attachTrackToVideo = (videoEl, track) => {
  if (!videoEl || !track) return;
  let stream = videoEl.srcObject;
  if (!stream) {
    stream = new MediaStream();
    videoEl.srcObject = stream;
  }
  const alreadyAttached = stream.getTracks().some((item) => item.id === track.id);
  if (!alreadyAttached) {
    stream.addTrack(track);
  }
};

const TrainerLivePreview = ({ traineeId, testId }) => {
  const cameraVideoRef = useRef(null);
  const screenVideoRef = useRef(null);
  const pcRef = useRef(null);
  const wsRef = useRef(null);
  const [hasScreenStream, setHasScreenStream] = useState(false);

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
      const track = event.track;
      if (!track) return;

      if (track.kind === 'audio') {
        attachTrackToVideo(cameraVideoRef.current, track);
        return;
      }

      const cameraHasVideo =
        Boolean(cameraVideoRef.current && cameraVideoRef.current.srcObject) &&
        cameraVideoRef.current.srcObject.getVideoTracks().length > 0;
      const screenHasVideo =
        Boolean(screenVideoRef.current && screenVideoRef.current.srcObject) &&
        screenVideoRef.current.srcObject.getVideoTracks().length > 0;

      const shouldRouteToScreen = looksLikeScreenTrack(track) || (cameraHasVideo && !screenHasVideo);
      if (shouldRouteToScreen) {
        attachTrackToVideo(screenVideoRef.current, track);
        setHasScreenStream(true);
        track.onended = () => {
          const current = screenVideoRef.current && screenVideoRef.current.srcObject;
          if (current && current.getTracks().some((item) => item.id === track.id)) {
            current.removeTrack(track);
          }
          const hasRemainingVideo = current && current.getVideoTracks().length > 0;
          setHasScreenStream(Boolean(hasRemainingVideo));
        };
        return;
      }

      attachTrackToVideo(cameraVideoRef.current, track);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
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
          pc.setRemoteDescription(new RTCSessionDescription(message.sdp))
            .then(() => pc.createAnswer())
            .then(answer => pc.setLocalDescription(answer).then(() => answer))
            .then(answer => {
              sendSignal({ type: 'answer', sdp: answer });
            })
            .catch(e => console.error("Error handling offer:", e));
        } else if (message.type === 'ice-candidate') {
          pc.addIceCandidate(new RTCIceCandidate(message.candidate))
            .catch(e => console.error("Error adding ICE candidate:", e));
        }
      } catch (e) {
        console.error("Error parsing WebSocket message:", e);
      }
    };

    return () => {
      if (pcRef.current) pcRef.current.close();
      if (wsRef.current) wsRef.current.close();
    };
  }, [traineeId, testId]);

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div>
        <div style={{ marginBottom: 8, fontWeight: 600, color: '#dbeafe' }}>Camera Feed</div>
        <video ref={cameraVideoRef} autoPlay playsInline controls style={{ width: '100%', maxWidth: 550 }} />
      </div>
      {hasScreenStream ? (
        <div>
          <div style={{ marginBottom: 8, fontWeight: 600, color: '#dbeafe' }}>Screen Share</div>
          <video ref={screenVideoRef} autoPlay playsInline controls style={{ width: '100%', maxWidth: 700 }} />
        </div>
      ) : null}
    </div>
  );
};

export default TrainerLivePreview;
