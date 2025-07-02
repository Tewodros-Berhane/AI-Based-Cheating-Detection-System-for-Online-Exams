// src/components/TraineeStreamSender.jsx
import React, { useEffect, useRef, useContext } from 'react';
import { MediaStreamContext } from '../../contexts/MediaStreamContext';
import apis from '../../services/Apis';
import { Post } from '../../services/axiosCall';

const TraineeStreamSender = ({ traineeId, testid }) => {
  const localVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const socketRef = useRef(null);
  const { setMediaStream } = useContext(MediaStreamContext);

  useEffect(() => {
    

    const connectWebSocketAndStream = async () => {
      try {
        // 1. Get local media stream and save it to context
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        setMediaStream(stream);


        // 2. Create RTCPeerConnection and add local tracks
        const pc = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });
        peerConnectionRef.current = pc;
        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });

        // 3. Handle ICE candidates
        pc.onicecandidate = (event) => {
          if (event.candidate && socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({ type: 'ice-candidate', candidate: event.candidate }));
          }
        };

        // 4. Connect to signaling server as trainee (using local WebSocket)
        socketRef.current = new WebSocket(`ws://localhost:8080/?role=trainee&traineeid=${traineeId}`);
        socketRef.current.onopen = async () => {
          console.log("Trainee signaling socket connected");
          // Create and send initial offer
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socketRef.current.send(JSON.stringify({ type: 'offer', sdp: offer }));
        };

        socketRef.current.onmessage = async (event) => {
          let data;
          if (event.data instanceof Blob) {
            data = await event.data.text();
          } else {
            data = event.data;
          }
          try {
            const message = JSON.parse(data);
            if (message.type === 'request-offer') {
              console.log("Received offer request from trainer, sending new offer");
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              socketRef.current.send(JSON.stringify({ type: 'offer', sdp: offer }));
            } else if (message.type === 'answer') {
              await pc.setRemoteDescription(new RTCSessionDescription(message.sdp));
            } else if (message.type === 'ice-candidate') {
              pc.addIceCandidate(new RTCIceCandidate(message.candidate))
                .catch(e => console.error("Error adding ICE candidate:", e));
            }
          } catch (err) {
            console.error("Error parsing WebSocket message:", err);
          }
        };

        socketRef.current.onerror = (err) => {
          console.error("Trainee socket error:", err);
        };

        socketRef.current.onclose = () => {
          console.log("Trainee socket closed.");
        };

      } catch (error) {
        console.error("Error setting up local stream and peer connection:", error);
      }
    };

    connectWebSocketAndStream();

    return () => {
      // Cleanup on component unmount
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [traineeId, setMediaStream]);

  return (
    <div>
      <h3>Your Live Stream (Trainee)</h3>
      <video ref={localVideoRef} autoPlay playsInline muted style={{ width: '300px' }} />
    </div>
  );
};

export default TraineeStreamSender;
