import React, { useState, useEffect, useContext, useRef } from 'react';
import { connect } from 'react-redux';
import { LocaltestDone, fetchTestdata } from '../../../actions/traineeAction';
import './portal.css';
import apis from '../../../services/Apis';
import { Post } from '../../../services/axiosCall';
import Alert from '../../common/alert';
import { MediaStreamContext } from '../../../contexts/MediaStreamContext';

const Clock = ({ trainee, LocaltestDone, fetchTestdata }) => {
  const [localMinutes, setLocalMinutes] = useState(trainee.m_left);
  const [localSeconds, setLocalSeconds] = useState(trainee.s_left);
  const { controlChannel, mediaStream, setMediaStream } = useContext(MediaStreamContext);
  const finishSockRef = useRef(null);
  const t_id = trainee.traineeid;


  const [isWsReady, setIsWsReady] = useState(false);
  
    useEffect(() => {
      const ws = new WebSocket(`ws://localhost:8081/?role=trainee&traineeid=${t_id}`);
      
      ws.onopen = () => {
        finishSockRef.current = ws;
        setIsWsReady(true);
      };
  
      return () => {
        setIsWsReady(false);
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      };
    }, [t_id]);


  const endTest = () => {
    Post({
      url: `${apis.END_TEST}`,
      data: {
        testid: trainee.testid,
        userid: trainee.traineeid
      }
    }).then((response) => {
      if (response.data.success) {
        // Send stop signal through control channel
        if (controlChannel && controlChannel.readyState === 'open') {
          controlChannel.send(JSON.stringify({ action: 'endTest' }));
          console.log('🛑 Sent endTest to server');
        }

        // Send AI result through finish socket
        const sendAIResult = () => {
          if (
            finishSockRef.current && 
            finishSockRef.current.readyState === WebSocket.OPEN
          ) {
            finishSockRef.current.send(
              JSON.stringify({ type: 'ai-result', t_id, behaviour: 'finished' })
            );
            console.log('📡 Finish exam relayed');
          } else {
            setTimeout(sendAIResult, 100); // Retry after 100ms
          }
        };
        sendAIResult();

        // Send test-ended message over WebSocket (if available)
        if (mediaStream) {
          mediaStream.getTracks().forEach(track => track.stop());
          setMediaStream(null);
          console.log("Media stream stopped due to test end." ` ${mediaStream}`);
        }

        fetchTestdata(trainee.testid, trainee.traineeid);
      } else {
        Alert('error', 'Error!', response.data.message);
      }
    }).catch((error) => {
      Alert('error', 'Error!', 'Error');
    });
  };

  useEffect(() => {
    const clockInterval = setInterval(() => {
      setLocalSeconds((prevSeconds) => {
        if (prevSeconds === 1 && localMinutes === 0) {
          clearInterval(clockInterval);
          endTest();
          return 0;
        }
        
        if (prevSeconds === 0) {
          setLocalMinutes((prevMinutes) => prevMinutes - 1);
          return 59;
        }
        
        return prevSeconds - 1;
      });
    }, 1000);

    return () => clearInterval(clockInterval);
  }, [localMinutes]);

  return (
    <div className="clock-wrapper">
      <div className="clock-container">
        {localMinutes.toString().padStart(2, '0')} : 
        {localSeconds.toString().padStart(2, '0')}
      </div>
    </div>
  );
};

const mapStateToProps = state => ({
  trainee: state.trainee
});

export default connect(mapStateToProps, {
  LocaltestDone,
  fetchTestdata
})(Clock);