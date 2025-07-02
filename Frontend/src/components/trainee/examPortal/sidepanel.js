import React, { useEffect, useRef, useContext, useState } from 'react';
import { connect } from 'react-redux';
import './portal.css';
import Trainee from './user';
import { Button, Popconfirm } from 'antd';
import Operations from './operations';
import Clock from './clock';
import Alert from '../../common/alert';
import apis from '../../../services/Apis';
import { Post } from '../../../services/axiosCall';
import { fetchTestdata } from '../../../actions/traineeAction';
import { MediaStreamContext } from '../../../contexts/MediaStreamContext';

const Sidepanel = ({ mode, trainee, fetchTestdata }) => {
  const finishSockRef = useRef(null);
  const { controlChannel, mediaStream, setMediaStream } = useContext(MediaStreamContext);

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
        // 1) send stop signal to server
        if (controlChannel && controlChannel.readyState === 'open') {
          controlChannel.send(JSON.stringify({ action: 'endTest' }));
          console.log('🛑 Sent endTest to server');
        }

        // AI result: {behaviour: 'finished', traineeId: '682f0c9182137e5fe4216fd6'}

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
        return Alert('error', 'Error!', response.data.message);
        console.log(response.data.message);
      }
    }).catch((error) => {
      return Alert('error', 'Error!', 'Error');
      console.log(error);
    });
  };

  return (
    <div className={`side-panel-in-exam-dashboard ${mode === 'desktop' ? 'w-20' : 'w-100'}`}>
      <Trainee />
      <Clock />
      <Operations />
      <div className="End-test-container">
        <Popconfirm
          title="Are you sure to end the exam?"
          onConfirm={endTest}
          okText="Yes"
          cancelText="No"
        >
          <Button type="default">End Exam</Button>
        </Popconfirm>
      </div>
    </div>
  );
};

const mapStateToProps = state => ({
  trainee: state.trainee
});

export default connect(mapStateToProps, {
  fetchTestdata
})(Sidepanel);