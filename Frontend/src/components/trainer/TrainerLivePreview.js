// TrainerLivePreview.js
import React, { useEffect, useRef } from 'react';

const TrainerLivePreview = ({ traineeId }) => {
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);
  const wsRef = useRef(null);

  useEffect(() => {
    // Helper function to send signaling messages
    const sendSignal = (data) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(data));
      }
    };

    // 1. Create RTCPeerConnection with a STUN server.
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
    pcRef.current = pc;

    // 2. When remote track arrives, attach it to the video element.
    pc.ontrack = (event) => {
      console.log('Remote track received:', event);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
        console.log('Remote stream attached to video element');
      }
    };

    // 3. ICE candidate event: send candidates to signaling server.
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('Sending ICE candidate:', event.candidate);
        sendSignal({ type: 'ice-candidate', candidate: event.candidate });
      }
    };

    // 4. Connect to the signaling server as trainer.
    wsRef.current = new WebSocket(`ws://localhost:8080/?role=trainer&traineeid=${traineeId}`);
    wsRef.current.onopen = () => {
      console.log("Trainer signaling socket connected");
      console.log("Trainee " + traineeId);
      sendSignal({ type: 'request-offer' });
    };

    // 5. Handle incoming messages from the trainee.
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
  }, [traineeId]);

  return (
    <div>
      <video ref={remoteVideoRef} autoPlay playsInline controls style={{ width: '550px' }} />
    </div>
  );
};

export default TrainerLivePreview;
