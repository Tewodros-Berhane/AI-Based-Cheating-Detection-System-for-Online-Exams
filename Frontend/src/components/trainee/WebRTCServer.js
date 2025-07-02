import React, { useEffect, useRef, useContext } from 'react';
import { MediaStreamContext } from '../../contexts/MediaStreamContext';

export default function WebRTC({traineeId}) {
  const { mediaStream, setMediaStream, setControlChannel } = useContext(MediaStreamContext);
  const pcRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const resultSockRef = useRef(null);   // 🔄 WS that relays AI results


  useEffect(() => {
    if (!mediaStream) return;

    // open as "trainee" (same role the signalling code expects)
    resultSockRef.current = new WebSocket(
      `ws://localhost:8081/?role=trainee&traineeid=${traineeId}`
    );

    // Helper: closes existing pc and cleans up intervals
    const cleanup = () => {
      if (pcRef.current) {
        pcRef.current.oniceconnectionstatechange = null;
        pcRef.current.close();
        pcRef.current = null;
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      if (resultSockRef.current) resultSockRef.current.close();
    };

    // The actual negotiation logic
    const setupPeerConnection = async () => {

      resultSockRef.current = new WebSocket(
        `ws://localhost:8081/?role=trainee&traineeid=${traineeId}`
      );
      // 1) Create RTCPeerConnection with a public STUN server
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
          { urls: [ "stun:eu-turn3.xirsys.com" ] }, 
          {
          username: "3qpJOOqcH67GkA8i39ivzU9fBjpZddgqKi_e5NgyAs7Io7T0x7riqPmKkZiHQdGcAAAAAGgu_IRoaWthcmk=",
          credential: "a188962e-36f7-11f0-b2e9-0242ac140004",
          urls: [
              "turn:eu-turn3.xirsys.com:80?transport=udp",
              "turn:eu-turn3.xirsys.com:3478?transport=udp",
              "turn:eu-turn3.xirsys.com:80?transport=tcp",
              "turn:eu-turn3.xirsys.com:3478?transport=tcp",
              "turns:eu-turn3.xirsys.com:443?transport=tcp",
              "turns:eu-turn3.xirsys.com:5349?transport=tcp"
          ]
        }]
      });
      pcRef.current = pc;

      // 1️⃣ Create a control channel
      const ctrlDC = pc.createDataChannel('control');

      ctrlDC.onopen = () => {
        console.log('✅ Control channel open');
        // Send ping every 5 seconds
        pingIntervalRef.current = setInterval(() => {
          if (ctrlDC.readyState === "open") {
            ctrlDC.send(JSON.stringify({ type: "ping" }));
          }
        }, 1000);
      };
      ctrlDC.onclose = () => {
        console.log('❌ Control channel closed');
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      };
      ctrlDC.onerror = (e) => console.error('⚠️ Control channel error', e);

      // expose it so other components (Sidepanel) can send on it
      setControlChannel(ctrlDC);

      // 2) Handle incoming data channel from the server
      pc.ondatachannel = (event) => {
        const dc = event.channel;
        console.log('📡 Data channel label:', dc.label);

        dc.onopen = () => console.log('✅ Data channel open');
        dc.onclose = () => console.log('❌ Data channel closed');
        dc.onerror = (err) => console.error('⚠️ Data channel error:', err);

        dc.onmessage = (e) => {
          console.log('📥 Raw message:', e.data);
          try {
            const msg = JSON.parse(e.data);
            console.log('🤖 AI result:', msg);
               // 🔄 relay to WS signalling server so the trainer gets it
             if (
               resultSockRef.current &&
               resultSockRef.current.readyState === WebSocket.OPEN
             ) {
               resultSockRef.current.send(
                 JSON.stringify({ type: 'ai-result', traineeId, ...msg })
               );
               console.log ('📡 AI result relayed')
             }

             if (dc.label === 'control' && msg.behaviour === 'finished') {
                console.log('✅ Test finished for trainee', msg.traineeId);

                // 1) Stop local media
                mediaStream.getTracks().forEach(t => t.stop());
                setMediaStream(null);
              }
          } catch {
            console.warn('⚠️ Non-JSON message:', e.data);
          }
        };
      };

      // 3) Add all local tracks to the peer connection
      mediaStream.getTracks().forEach((track) => {
        pc.addTrack(track, mediaStream);
      });

      // 4) Negotiate once: createOffer, wait ICE, POST to /offer, setRemote
      const negotiate = async () => {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);

          // wait for ICE gathering to finish
          if (pc.iceGatheringState !== 'complete') {
            await new Promise((resolve) => {
              function checkState() {
                if (pc.iceGatheringState === 'complete') {
                  pc.removeEventListener('icegatheringstatechange', checkState);
                  resolve();
                }
              }
              pc.addEventListener('icegatheringstatechange', checkState);
            });
          }

          // send the full SDP (with candidates) to your Python server
          const response = await fetch('http://localhost:5020/offer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sdp:  pc.localDescription.sdp,
                type: pc.localDescription.type,
                traineeId})
          });
          console.log('Negotiation response', response.status, response.statusText);

          const answer = await response.json();
          await pc.setRemoteDescription(answer);
        } catch (err) {
          console.error('WebRTC negotiation error:', err);
        }
      };

      // ICE state change handler
      pc.oniceconnectionstatechange = () => {
        console.log(`🧊 ICE state: ${pc.iceConnectionState}`);
        if (
          pc.iceConnectionState === "disconnected" ||
          pc.iceConnectionState === "failed"
        ) {
          console.log("🚨 ICE disconnected or failed! Attempting restar…");
          cleanup();
          setTimeout(() => {
            setupPeerConnection(); // re-create everything, triggers fresh negotiation
          }, 10000);
        }
      };

      // Start negotiation
      await negotiate();
    };

    // INITIALIZE
    setupPeerConnection();

    // Cleanup on unmount or when mediaStream changes
    return cleanup;
  }, [mediaStream, setControlChannel]);

  return (
    <div>
      <p>Real-time AI streaming via aiortc  PyAV…</p>
    </div>
  );
}