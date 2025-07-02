// src/components/trainer/TrainerResultPreview.js
import React, { useEffect, useRef, useState } from 'react';
import { FaCircle } from 'react-icons/fa';   // ⬅️ filled circle
export default function TrainerResultPreview({ traineeId }) {
  const [result, setResult] = useState(null);     // last AI verdict
  const wsRef = useRef(null);

  useEffect(() => {
    // open a dedicated WS for this trainee
    const url = `ws://localhost:8081/?role=trainer&traineeid=${traineeId}`;
    wsRef.current = new WebSocket(url);

    wsRef.current.onopen = () => {
      console.log('result‑socket open for', traineeId);
    };

    wsRef.current.onmessage = async (e) => {
      const txt = e.data instanceof Blob ? await e.data.text() : e.data;
      let msg;
      try { msg = JSON.parse(txt); } catch { return; }

      // { type:"ai-result", behaviour:"cheating" | "suspicious" | "normal", traineeId:"…" }
      if (msg.type === 'ai-result') {
        setResult(msg.behaviour);           // ➡️ triggers re‑render every time
      }
    };

    wsRef.current.onerror  = (err) => console.error('result‑socket error', err);
    wsRef.current.onclose   = () => console.log('result‑socket closed for', traineeId);

    return () => wsRef.current && wsRef.current.close();
  }, [traineeId]);

  /* simple coloured badge (optional) */
  const colours = {
    cheating:   '#ff4444',   // bright red
    suspicious: '#ffec3d',   // vivid yellow
    normal:     '#2ecc71'    // bright green
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
