// src/components/trainer/TrainerResultPreview.js
import React, { useEffect, useRef, useState } from 'react';
import { FaCircle } from 'react-icons/fa';   
import apis from '../../services/Apis';
export default function TrainerResultPreview({ traineeId, testId }) {
  const [result, setResult] = useState(null);     
  const wsRef = useRef(null);

  useEffect(() => {
    const params = new URLSearchParams({
      role: 'trainer',
      traineeid: traineeId
    });
    if (testId) {
      params.set('testid', testId);
      params.set('sessionid', `${testId}:${traineeId}`);
    }
    const url = `${apis.WS_RESULT_URL}/?${params.toString()}`;
    wsRef.current = new WebSocket(url);

    wsRef.current.onopen = () => {
      console.log('result‑socket open for', traineeId);
    };

    wsRef.current.onmessage = async (e) => {
      const txt = e.data instanceof Blob ? await e.data.text() : e.data;
      let msg;
      try { msg = JSON.parse(txt); } catch { return; }

      
      if (msg.type === 'ai-result') {
        setResult(msg.behaviour);           
      }
    };

    wsRef.current.onerror  = (err) => console.error('result‑socket error', err);
    wsRef.current.onclose   = () => console.log('result‑socket closed for', traineeId);

    return () => wsRef.current && wsRef.current.close();
  }, [traineeId, testId]);

  const colours = {
    cheating:   '#ff4444',   
    suspicious: '#ffec3d',   
    normal:     '#2ecc71'    
  };

  return (
    result && (
      result === 'finished' ? (
      <span style={{
        fontWeight: 'bold',
        color: 'white',
        fontSize: '18px'
      }}>
        FINISHED
      </span>
    ) : (
      <FaCircle
        size={18}
        style={{
          fill: colours[result],
          color: colours[result],
          animation: 'pulse 1s ease-in-out infinite',
          filter: `drop-shadow(0 0 6px ${colours[result]})`
        }}
      />
    )
    )
  );
}
