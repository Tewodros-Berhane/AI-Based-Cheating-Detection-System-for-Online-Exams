import apis from '../services/Apis';
import Alert from '../components/common/alert';
import { Post } from '../services/axiosCall';

let parse_time = (d)=>{
    const totalSeconds = Math.max(0, Math.floor(Number(d) || 0));
    return{
        m_left:Math.floor(totalSeconds/60),
        s_left:totalSeconds%60
    }
}

const buildFlagPayload = (raw = {}) => {
    const pendingSeconds = raw.completed || !raw.startedWriting ? 0 : Math.max(0, Math.floor(Number(raw.pending) || 0));
    const parsed = parse_time(pendingSeconds);
    return {
        testbegins: Boolean(raw.testbegins),
        startedWriting: Boolean(raw.startedWriting),
        testconducted: Boolean(raw.testconducted),
        completed: Boolean(raw.completed),
        m_left: parsed.m_left,
        s_left: parsed.s_left,
        examMeta: raw.examMeta || null,
        faceRecognitionEnabled: Boolean(raw.faceRecognitionEnabled),
        sessionVersion: Number(raw.sessionVersion || 0),
        disconnectCount: Number(raw.disconnectCount || 0),
        graceWindowUntil: raw.graceWindowUntil || null,
        completionReason: raw.completionReason || null,
        lastSavedQuestionIndex: Number(raw.lastSavedQuestionIndex || 0),
        lastHeartbeatAt: raw.lastHeartbeatAt || null,
        sessionConnectionStatus: raw.sessionConnectionStatus || 'idle',
        heartbeatIntervalMs: Number(raw.heartbeatIntervalMs || 10000),
        graceWindowMs: Number(raw.graceWindowMs || 120000)
    };
};

const normalizeAnswerRows = (rows = [], previousAnswers = []) => {
    const previousByQuestionId = previousAnswers.reduce((acc, answer) => {
        if (answer && answer.questionid) {
            acc[String(answer.questionid)] = answer;
        }
        return acc;
    }, {});

    return rows.map((row) => {
        const previous = previousByQuestionId[String(row.questionid)] || {};
        const chosenOption = Array.isArray(row.chosenOption) ? row.chosenOption.map((item) => String(item)) : [];
        return {
            ...row,
            chosenOption,
            isMarked: Boolean(previous.isMarked),
            isAnswered: chosenOption.length > 0,
            isDirty: false,
            lastLocalUpdatedAt: previous.lastLocalUpdatedAt || null,
            lastSyncedAt: previous.lastSyncedAt || null
        };
    });
};

export const setTestDetsils=(d1,d2)=>{
    return({
        type:'SET_TRAINEE_TEST_DETAILS',
        payload1:d1,
        payload2:d2
    })
}
export const LocaltestDone = (d)=> dispatch =>{
    dispatch({
        type : 'TEST_DONE_LOCAL'
    })
}

export const fetchTraineedata =(d)=>dispatch=>{
    return Post({
        url:apis.FETCH_TRAINEE_DETAILS,
        data:{
            _id:d
        }
    }).then((response)=>{
        if(response.data.success){
            dispatch({
                type:'FETCH_LOGGED_IN_TRAINEE',
                payload:response.data.data
            })
        }
        else{
            Alert('error','Error!',response.data.message);
        }
        return response.data;
    })
}

export const fetchTestdata =(d1,d2)=>dispatch=>{
    return Post({
        url:apis.FETCH_TRAINEE_TEST_DETAILS,
        data:{
            testid:d1,
            traineeid:d2
        }
    }).then((response)=>{
        if(response.data.success){
            dispatch({
                type:'FETCH_TEST_FLAG',
                payload: buildFlagPayload(response.data.data)
            })
        }
        else{
            dispatch({
                type:'INVALID_TEST_URL',
            })
        }
        return response.data;
    }).catch((err)=>{
        dispatch({
            type:'INVALID_TEST_URL',
        })
        throw err;
    })
}

export const ProceedtoTest=(d1,d2,d3)=>dispatch=>{
    dispatch({
        type:'PROCEEDING_TO_TEST',
        payload:true
    })
    return Post({
        url:`${apis.PROCEED_TO_TEST}`,
        data:{
            testid:d1,
            userid:d2
        }
    }).then((response)=>{
        if(!response.data.success){
            Alert('error','Error!',response.data.message);
        }
        d3();
        dispatch({
            type:'PROCEEDING_TO_TEST',
            payload:false
        })
        return response.data;
    }).catch((error)=>{
        dispatch({
            type:'PROCEEDING_TO_TEST',
            payload:false
        })
        Alert('error','Error!',"Server error");
        throw error;
    })
}

export const fetchTraineeTestQuestions=(tid)=>dispatch=>{
    return Post({
        url:`${apis.FETCH_TRAINEE_TEST_QUESTION}`,
        data:{
            id:tid
        }
    }).then((response)=>{
        if(response.data.success){
            dispatch({
                type:'UPDATE_TRAINEE_TEST_QUESTIONS',
                payload:response.data.data
            })
        } 
        else{
            Alert('error','Error!',response.data.message);
        }
        return response.data;
    }).catch((error)=>{
        Alert('error','Error!',"Server error");
        throw error;
    })
}

export const fetchTraineeTestAnswerSheet=(tid,uid)=>dispatch=>{
    return Post({
        url:`${apis.FETCH_TRAINEE_TEST_ANSWERSHEET}`,
        data:{
            testid:tid,
            userid:uid
        }
    }).then((response)=>{
        if(response.data.success){
            dispatch({
                type:'UPDATE_TRAINEE_TEST_ANSWERSHEET',
                payload: normalizeAnswerRows(response.data.data.answers || []),
                meta: {
                    sessionVersion: Number(response.data.data.sessionVersion || 0),
                    lastSavedQuestionIndex: Number(response.data.data.lastSavedQuestionIndex || 0),
                    lastSyncedAt: response.data.data.lastClientSyncAt || null
                }
            })
        } 
        else{
            Alert('error','Error!',response.data.message);
        }
        return response.data;
    }).catch((error)=>{
        Alert('error','Error!',"Server error");
        throw error;
    })
}

export const switchQuestion = (d1)=>{
    return{
        type:'SWITCH_QUESTION',
        payload:d1
    }
}

export const updateIsMarked = (d1)=>{
    return {
        type:'UPDATE_TRAINEE_TEST_ANSWERSHEET',
        payload:d1
    }
}

export const updateTraineeAnswerLocal = ({ questionIndex, chosenOption, questionId }) => ({
    type: 'UPDATE_TRAINEE_ANSWER_LOCAL',
    payload: {
        questionIndex,
        chosenOption,
        questionId
    }
});

export const hydrateTraineeSession = ({ answers = [], session = {}, activeQuestionIndex = 0 }) => ({
    type: 'HYDRATE_TRAINEE_SESSION',
    payload: {
        answers,
        session,
        activeQuestionIndex
    }
});

export const markTraineeAnswersSynced = ({ questionIds = [], sessionVersion = 0, lastSavedQuestionIndex = 0, lastSyncedAt = null }) => ({
    type: 'MARK_TRAINEE_ANSWERS_SYNCED',
    payload: {
        questionIds,
        sessionVersion,
        lastSavedQuestionIndex,
        lastSyncedAt
    }
});

export const setTraineeSessionConnection = ({ status, hasOfflineChanges = false, syncing = false, restorePending = false, message = '' }) => ({
    type: 'SET_TRAINEE_SESSION_CONNECTION',
    payload: {
        status,
        hasOfflineChanges,
        syncing,
        restorePending,
        message
    }
});

export const updateTraineeSessionMeta = (payload = {}) => ({
    type: 'UPDATE_TRAINEE_SESSION_META',
    payload
});

export const FeedbackStatus = (s)=>{
    return{
        type:'SET_HAS_GIVEN_FEEDBACK',
        payload:s
    }
}

export const fetchTraineeByTraineeID = (traineeID) => async (dispatch) => {
  try {
    const response = await Post({
      url: apis.FETCH_TRAINEE_BY_TRAINEEID,
      data: { traineeID }
    });
    return response.data;
  } catch (error) {
    console.error('Trainee fetch error:', error);
    throw error;
  }
};

export const fetchTestByExamID = (examID, traineeMongoId) => (dispatch) => {
  return Post({
    url: apis.FETCH_TEST_BY_EXAMID, 
    data: { examID }
  }).then((response) => {
    if (response && response.data && response.data.success) {
      return response.data;
    } else {
      const errorMessage = (response && response.data && response.data.message) 
        ? response.data.message 
        : "Invalid Exam ID";
      Alert('error', 'Error!', errorMessage);
      throw new Error(errorMessage);
    }
  }).catch((error) => {
    console.error('Test fetch error:', error);
    throw error;
  });
};
