import React, { useEffect, useRef, useState } from 'react';
import apis from '../../services/Apis';

const looksLikeScreenTrack = (track) => {
  if (!track) return false;
  const label = String(track.label || '').toLowerCase();
  const settings = typeof track.getSettings === 'function' ? track.getSettings() : {};
  return Boolean(settings.displaySurface) || /screen|display|window|monitor/.test(label);
};

const hasLiveVideo = (stream) =>
  Boolean(
    stream &&
      typeof stream.getVideoTracks === 'function' &&
      stream.getVideoTracks().some((track) => track.readyState === 'live')
  );

const attachStream = (videoEl, stream) => {
  if (!videoEl || !stream) return;
  if (videoEl.srcObject !== stream) {
    videoEl.srcObject = stream;
  }
  const playPromise = videoEl.play && videoEl.play();
  if (playPromise && typeof playPromise.catch === 'function') {
    playPromise.catch(() => {});
  }
};

const TrainerLivePreview = ({ traineeId, testId }) => {
  const cameraVideoRef = useRef(null);
  const screenVideoRef = useRef(null);
  const pcRef = useRef(null);
  const wsRef = useRef(null);
  const mediaMetaRef = useRef({
    cameraStreamId: null,
    screenStreamId: null,
    requireScreenShare: false
  });
  const fallbackVideoTrackCountRef = useRef(0);
  const [hasScreenStream, setHasScreenStream] = useState(false);

  useEffect(() => {
    const cameraVideoNode = cameraVideoRef.current;
    const screenVideoNode = screenVideoRef.current;

    const sendSignal = (data) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(data));
      }
    };

    const bindTrackEnd = (track, role) => {
      if (!track) return;
      track.onended = () => {
        if (role !== 'screen') {
          return;
        }
        const current = screenVideoRef.current && screenVideoRef.current.srcObject;
        setHasScreenStream(hasLiveVideo(current));
        if (!hasLiveVideo(current) && screenVideoRef.current) {
          screenVideoRef.current.srcObject = null;
        }
      };
    };

    const resolveStreamRole = (event) => {
      const track = event.track;
      const stream = event.streams && event.streams[0] ? event.streams[0] : null;
      const mediaMeta = mediaMetaRef.current || {};

      if (track && track.kind === 'audio') {
        return 'camera';
      }

      if (stream && mediaMeta.screenStreamId && stream.id === mediaMeta.screenStreamId) {
        return 'screen';
      }

      if (stream && mediaMeta.cameraStreamId && stream.id === mediaMeta.cameraStreamId) {
        return 'camera';
      }

      if (track && looksLikeScreenTrack(track)) {
        return 'screen';
      }

      if (stream) {
        if (!cameraVideoRef.current || !cameraVideoRef.current.srcObject) {
          return 'camera';
        }
        if (
          mediaMeta.requireScreenShare &&
          screenVideoRef.current &&
          screenVideoRef.current.srcObject !== stream &&
          cameraVideoRef.current.srcObject !== stream
        ) {
          return 'screen';
        }
      }

      if (track && track.kind === 'video') {
        const nextOrder = fallbackVideoTrackCountRef.current;
        fallbackVideoTrackCountRef.current += 1;
        return nextOrder === 0 ? 'camera' : 'screen';
      }

      return 'camera';
    };

    const attachEventStream = (role, stream, track) => {
      if (role === 'screen') {
        attachStream(screenVideoRef.current, stream);
        setHasScreenStream(hasLiveVideo(stream));
      } else {
        attachStream(cameraVideoRef.current, stream);
      }
      bindTrackEnd(track, role);
    };

    const attachEventTrack = (role, track) => {
      const targetRef = role === 'screen' ? screenVideoRef : cameraVideoRef;
      const videoEl = targetRef.current;
      if (!videoEl || !track) return;

      let targetStream = videoEl.srcObject;
      if (!(targetStream instanceof MediaStream)) {
        targetStream = new MediaStream();
        videoEl.srcObject = targetStream;
      }

      const existing = targetStream.getTracks().some((item) => item.id === track.id);
      if (!existing) {
        targetStream.addTrack(track);
      }
      attachStream(videoEl, targetStream);

      if (role === 'screen') {
        setHasScreenStream(hasLiveVideo(targetStream));
      }
      bindTrackEnd(track, role);
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
      const role = resolveStreamRole(event);
      const stream = event.streams && event.streams[0] ? event.streams[0] : null;

      if (stream) {
        attachEventStream(role, stream, event.track);
        return;
      }

      attachEventTrack(role, event.track);
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
          if (message.mediaMeta) {
            mediaMetaRef.current = {
              cameraStreamId: message.mediaMeta.cameraStreamId || null,
              screenStreamId: message.mediaMeta.screenStreamId || null,
              requireScreenShare: Boolean(message.mediaMeta.requireScreenShare)
            };
          }

          await pc.setRemoteDescription(new RTCSessionDescription(message.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendSignal({ type: 'answer', sdp: answer });
        } else if (message.type === 'ice-candidate') {
          await pc.addIceCandidate(new RTCIceCandidate(message.candidate));
        }
      } catch (error) {
        console.error('Error handling trainer preview signaling:', error);
      }
    };

    return () => {
      setHasScreenStream(false);
      fallbackVideoTrackCountRef.current = 0;
      mediaMetaRef.current = {
        cameraStreamId: null,
        screenStreamId: null,
        requireScreenShare: false
      };

      if (cameraVideoNode) {
        cameraVideoNode.srcObject = null;
      }
      if (screenVideoNode) {
        screenVideoNode.srcObject = null;
      }
      if (pcRef.current) {
        pcRef.current.close();
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
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
      ) : (
        <div style={{ color: '#94a3b8', fontSize: 14 }}>Screen share is not available yet.</div>
      )}
    </div>
  );
};

export default TrainerLivePreview;
