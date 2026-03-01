import React, { useEffect, useRef, useContext } from 'react';
import { MediaStreamContext } from '../../contexts/MediaStreamContext';
import apis from '../../services/Apis';
import { sendAiResult } from '../../services/traineeSession';

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

export default function WebRTC({ traineeId, testId }) {
  const { mediaStream, setControlChannel } = useContext(MediaStreamContext);
  const pcRef = useRef(null);
  const pingIntervalRef = useRef(null);

  useEffect(() => {
    if (!mediaStream) return undefined;

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
    };

    const setupPeerConnection = async () => {
      const pc = new RTCPeerConnection({
        iceServers: buildIceServers()
      });
      pcRef.current = pc;

      const ctrlDC = pc.createDataChannel('control');

      ctrlDC.onopen = () => {
        pingIntervalRef.current = setInterval(() => {
          if (ctrlDC.readyState === 'open') {
            ctrlDC.send(JSON.stringify({ type: 'ping' }));
          }
        }, 1000);
      };

      ctrlDC.onclose = () => {
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }
      };

      ctrlDC.onerror = (error) => console.error('Control channel error:', error);
      setControlChannel(ctrlDC);

      pc.ondatachannel = (event) => {
        const dc = event.channel;

        dc.onmessage = async (e) => {
          try {
            const msg = JSON.parse(e.data);
            if (msg.behaviour) {
              await sendAiResult(traineeId, testId, msg.behaviour);
            }
          } catch (error) {
            console.warn('Non-JSON message:', e.data, error);
          }
        };
      };

      mediaStream.getTracks().forEach((track) => {
        pc.addTrack(track, mediaStream);
      });

      const negotiate = async () => {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        if (pc.iceGatheringState !== 'complete') {
          await new Promise((resolve) => {
            const checkState = () => {
              if (pc.iceGatheringState === 'complete') {
                pc.removeEventListener('icegatheringstatechange', checkState);
                resolve();
              }
            };
            pc.addEventListener('icegatheringstatechange', checkState);
          });
        }

        const response = await fetch(`${apis.AI_SERVER_URL}/offer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sdp: pc.localDescription.sdp,
            type: pc.localDescription.type,
            traineeId
          })
        });

        if (!response.ok) {
          throw new Error(`AI offer negotiation failed (${response.status})`);
        }

        const answer = await response.json();
        if (!answer || !answer.sdp || !answer.type) {
          throw new Error('Invalid AI server answer payload');
        }
        await pc.setRemoteDescription(answer);
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
          cleanup();
          setTimeout(() => {
            setupPeerConnection();
          }, 10000);
        }
      };

      try {
        await negotiate();
      } catch (error) {
        console.error('WebRTC negotiation error:', error);
      }
    };

    setupPeerConnection();
    return cleanup;
  }, [mediaStream, setControlChannel, traineeId, testId]);

  return (
    <div>
      <p hidden>Real-time AI streaming via aiortc and PyAV.</p>
    </div>
  );
}
