const defaultIntegrityPolicy = {
    requireCamera:true,
    requireMicrophone:true,
    requireFullscreen:false,
    requireScreenShare:false,
    requireFaceVerification:true,
    allowTabSwitchTolerance:1,
    preflightMaxFailures:1
};

const initialState = {
    proceedingToTest:false,
    invalidUrl:false,
    testid:null,
    traineeid:null,
    initialloading1:true,
    initialloading2:true,
    testbegins : true,
    startedWriting:true,
    testconducted:false,
    LocaltestDone:true,
    m_left:0,
    s_left:0,
    faceRecognitionEnabled:false,
    sessionVersion:0,
    disconnectCount:0,
    graceWindowUntil:null,
    completionReason:null,
    lastSavedQuestionIndex:0,
    lastHeartbeatAt:null,
    sessionConnectionStatus:'idle',
    heartbeatIntervalMs:10000,
    graceWindowMs:120000,
    sessionSyncing:false,
    sessionRestorePending:false,
    sessionStatusMessage:'',
    hasOfflineChanges:false,
    lastSyncedAt:null,
    supportSummary:{
        active:false,
        headline:'',
        items:[],
        extraTimeMinutes:0
    },
    candidateNotices:[],
    examMeta:{
        title:'',
        organisation:'',
        duration:0,
        totalQuestions:0,
        examID:'',
        integrityMode:'STANDARD',
        integrityPolicy:defaultIntegrityPolicy,
        preflightEnabled:false
    },
    traineeDetails:{
        name:"",
        emailid:"",
        contact:""
    },
    activeQuestionIndex:0,
    questions:[],
    answers:[],
    hasGivenFeedBack:false
}

const normalizeAnswerPayload = (answers = [], previousAnswers = []) => {
    const previousByQuestionId = previousAnswers.reduce((acc, answer) => {
        if (answer && answer.questionid) {
            acc[String(answer.questionid)] = answer;
        }
        return acc;
    }, {});

    return answers.map((answer) => {
        const previous = previousByQuestionId[String(answer.questionid)] || {};
        const chosenOption = Array.isArray(answer.chosenOption) ? answer.chosenOption.map((item) => String(item)) : [];
        return {
            ...answer,
            chosenOption,
            isMarked: Boolean(previous.isMarked || answer.isMarked),
            isAnswered: chosenOption.length > 0,
            isDirty: Boolean(answer.isDirty),
            lastLocalUpdatedAt: answer.lastLocalUpdatedAt || previous.lastLocalUpdatedAt || null,
            lastSyncedAt: answer.lastSyncedAt || previous.lastSyncedAt || null
        };
    });
};

const traineeReducer = (state = initialState, action )=>{
    switch(action.type){
        case 'SET_HAS_GIVEN_FEEDBACK':
            return{
                ...state,
                hasGivenFeedBack:action.payload
            }
        case 'SET_TRAINEE_TEST_DETAILS':
            return{
                ...state,
                testid:action.payload1,
                traineeid:action.payload2,
                invalidUrl:false,
                initialloading1:true,
                initialloading2:true,
                sessionVersion:0,
                disconnectCount:0,
                graceWindowUntil:null,
                completionReason:null,
                lastSavedQuestionIndex:0,
                lastHeartbeatAt:null,
                sessionConnectionStatus:'idle',
                sessionSyncing:false,
                sessionRestorePending:false,
                sessionStatusMessage:'',
                hasOfflineChanges:false,
                lastSyncedAt:null,
                supportSummary:{
                    active:false,
                    headline:'',
                    items:[],
                    extraTimeMinutes:0
                },
                candidateNotices:[],
                activeQuestionIndex:0,
                answers:[],
                questions:[],
                examMeta:{
                    title:'',
                    organisation:'',
                    duration:0,
                    totalQuestions:0,
                    examID:'',
                    integrityMode:'STANDARD',
                    integrityPolicy:defaultIntegrityPolicy,
                    preflightEnabled:false
                },
                faceRecognitionEnabled:false
            }
        case 'FETCH_TEST_FLAG':
            return{
                ...state,
                testbegins:action.payload.testbegins,
                startedWriting:action.payload.startedWriting,
                testconducted:action.payload.testconducted,
                LocaltestDone:action.payload.completed,
                m_left:action.payload.m_left,
                s_left:action.payload.s_left,
                faceRecognitionEnabled: typeof action.payload.faceRecognitionEnabled === 'boolean' ? action.payload.faceRecognitionEnabled : state.faceRecognitionEnabled,
                examMeta:action.payload.examMeta || state.examMeta,
                sessionVersion:Number(action.payload.sessionVersion || state.sessionVersion || 0),
                disconnectCount:Number(action.payload.disconnectCount || 0),
                graceWindowUntil:action.payload.graceWindowUntil || null,
                completionReason:action.payload.completionReason || null,
                lastSavedQuestionIndex:Number(action.payload.lastSavedQuestionIndex || 0),
                lastHeartbeatAt:action.payload.lastHeartbeatAt || null,
                sessionConnectionStatus:action.payload.sessionConnectionStatus || state.sessionConnectionStatus,
                heartbeatIntervalMs:Number(action.payload.heartbeatIntervalMs || state.heartbeatIntervalMs || 10000),
                graceWindowMs:Number(action.payload.graceWindowMs || state.graceWindowMs || 120000),
                supportSummary:action.payload.supportSummary || state.supportSummary,
                candidateNotices:Array.isArray(action.payload.candidateNotices) ? action.payload.candidateNotices : state.candidateNotices,
                invalidUrl:false,
                initialloading1:false
            }
        case 'INVALID_TEST_URL':
            return{
                ...state,
                invalidUrl:true,
                initialloading1:false
            }
        case 'TEST_DONE_LOCAL':
            return {
                ...state,
                LocaltestDone : true
            }
        case 'PROCEEDING_TO_TEST':
            return{
                ...state,
                proceedingToTest:action.payload
            }
        case 'SWITCH_QUESTION':
            return {
                ...state,
                activeQuestionIndex:action.payload
            }
        case 'FETCH_LOGGED_IN_TRAINEE':
            return{
                ...state,
                initialloading2:false,
                traineeDetails:action.payload
            }
        case 'UPDATE_TRAINEE_TEST_QUESTIONS':
            return{
                ...state,
                questions:action.payload
            }
        case 'UPDATE_TRAINEE_TEST_ANSWERSHEET':
            return{
                ...state,
                answers:normalizeAnswerPayload(action.payload, state.answers),
                sessionVersion: action.meta && typeof action.meta.sessionVersion === 'number' ? action.meta.sessionVersion : state.sessionVersion,
                lastSavedQuestionIndex: action.meta && typeof action.meta.lastSavedQuestionIndex === 'number' ? action.meta.lastSavedQuestionIndex : state.lastSavedQuestionIndex,
                lastSyncedAt: action.meta && action.meta.lastSyncedAt ? action.meta.lastSyncedAt : state.lastSyncedAt,
                hasOfflineChanges:false
            }
        case 'UPDATE_TRAINEE_ANSWER_LOCAL': {
            const nextAnswers = [...state.answers];
            const questionIndex = Number(action.payload.questionIndex);
            const targetIndex = Number.isInteger(questionIndex) && questionIndex >= 0
                ? questionIndex
                : nextAnswers.findIndex((answer) => String(answer.questionid) === String(action.payload.questionId));
            if (targetIndex < 0 || !nextAnswers[targetIndex]) {
                return state;
            }
            const chosenOption = Array.isArray(action.payload.chosenOption)
                ? action.payload.chosenOption.map((item) => String(item))
                : [];
            nextAnswers[targetIndex] = {
                ...nextAnswers[targetIndex],
                chosenOption,
                isAnswered: chosenOption.length > 0,
                isDirty: true,
                lastLocalUpdatedAt: Date.now()
            };
            return {
                ...state,
                answers: nextAnswers,
                sessionVersion: Number(state.sessionVersion || 0) + 1,
                hasOfflineChanges:true,
                lastSavedQuestionIndex: targetIndex
            };
        }
        case 'HYDRATE_TRAINEE_SESSION': {
            return {
                ...state,
                answers: normalizeAnswerPayload(action.payload.answers || [], state.answers),
                activeQuestionIndex: Number.isInteger(Number(action.payload.activeQuestionIndex)) ? Number(action.payload.activeQuestionIndex) : state.activeQuestionIndex,
                sessionVersion: Number((action.payload.session && action.payload.session.sessionVersion) || state.sessionVersion || 0),
                disconnectCount: Number((action.payload.session && action.payload.session.disconnectCount) || 0),
                graceWindowUntil: action.payload.session && action.payload.session.graceWindowUntil ? action.payload.session.graceWindowUntil : state.graceWindowUntil,
                completionReason: action.payload.session && action.payload.session.completionReason ? action.payload.session.completionReason : state.completionReason,
                lastSavedQuestionIndex: Number((action.payload.session && action.payload.session.lastSavedQuestionIndex) || state.lastSavedQuestionIndex || 0),
                lastHeartbeatAt: action.payload.session && action.payload.session.lastHeartbeatAt ? action.payload.session.lastHeartbeatAt : state.lastHeartbeatAt,
                sessionConnectionStatus: action.payload.session && action.payload.session.sessionConnectionStatus ? action.payload.session.sessionConnectionStatus : state.sessionConnectionStatus,
                heartbeatIntervalMs: Number((action.payload.session && action.payload.session.heartbeatIntervalMs) || state.heartbeatIntervalMs || 10000),
                graceWindowMs: Number((action.payload.session && action.payload.session.graceWindowMs) || state.graceWindowMs || 120000),
                hasOfflineChanges: Boolean((action.payload.session && action.payload.session.hasOfflineChanges) || false),
                sessionRestorePending:false,
                lastSyncedAt: action.payload.session && action.payload.session.lastSyncedAt ? action.payload.session.lastSyncedAt : state.lastSyncedAt,
                m_left: action.payload.session && typeof action.payload.session.m_left === 'number' ? action.payload.session.m_left : state.m_left,
                s_left: action.payload.session && typeof action.payload.session.s_left === 'number' ? action.payload.session.s_left : state.s_left,
                LocaltestDone: action.payload.session && typeof action.payload.session.completed === 'boolean' ? action.payload.session.completed : state.LocaltestDone,
                testbegins: action.payload.session && typeof action.payload.session.testbegins === 'boolean' ? action.payload.session.testbegins : state.testbegins,
                startedWriting: action.payload.session && typeof action.payload.session.startedWriting === 'boolean' ? action.payload.session.startedWriting : state.startedWriting,
                testconducted: action.payload.session && typeof action.payload.session.testconducted === 'boolean' ? action.payload.session.testconducted : state.testconducted,
                examMeta: action.payload.session && action.payload.session.examMeta ? action.payload.session.examMeta : state.examMeta,
                faceRecognitionEnabled: action.payload.session && typeof action.payload.session.faceRecognitionEnabled === 'boolean' ? action.payload.session.faceRecognitionEnabled : state.faceRecognitionEnabled
            };
        }
        case 'MARK_TRAINEE_ANSWERS_SYNCED': {
            const syncedIds = new Set((action.payload.questionIds || []).map((id) => String(id)));
            const nextAnswers = state.answers.map((answer) => {
                if (!syncedIds.has(String(answer.questionid))) {
                    return answer;
                }
                return {
                    ...answer,
                    isDirty: false,
                    lastSyncedAt: action.payload.lastSyncedAt || Date.now()
                };
            });
            return {
                ...state,
                answers: nextAnswers,
                sessionVersion: typeof action.payload.sessionVersion === 'number' ? action.payload.sessionVersion : state.sessionVersion,
                lastSavedQuestionIndex: typeof action.payload.lastSavedQuestionIndex === 'number' ? action.payload.lastSavedQuestionIndex : state.lastSavedQuestionIndex,
                lastSyncedAt: action.payload.lastSyncedAt || state.lastSyncedAt,
                hasOfflineChanges: nextAnswers.some((answer) => answer.isDirty)
            };
        }
        case 'SET_TRAINEE_SESSION_CONNECTION':
            return {
                ...state,
                sessionConnectionStatus: action.payload.status || state.sessionConnectionStatus,
                hasOfflineChanges: typeof action.payload.hasOfflineChanges === 'boolean' ? action.payload.hasOfflineChanges : state.hasOfflineChanges,
                sessionSyncing: typeof action.payload.syncing === 'boolean' ? action.payload.syncing : state.sessionSyncing,
                sessionRestorePending: typeof action.payload.restorePending === 'boolean' ? action.payload.restorePending : state.sessionRestorePending,
                sessionStatusMessage: typeof action.payload.message === 'string' ? action.payload.message : state.sessionStatusMessage
            }
        case 'UPDATE_TRAINEE_SESSION_META':
            return {
                ...state,
                sessionVersion: typeof action.payload.sessionVersion === 'number' ? action.payload.sessionVersion : state.sessionVersion,
                disconnectCount: typeof action.payload.disconnectCount === 'number' ? action.payload.disconnectCount : state.disconnectCount,
                graceWindowUntil: action.payload.graceWindowUntil !== undefined ? action.payload.graceWindowUntil : state.graceWindowUntil,
                completionReason: action.payload.completionReason !== undefined ? action.payload.completionReason : state.completionReason,
                lastSavedQuestionIndex: typeof action.payload.lastSavedQuestionIndex === 'number' ? action.payload.lastSavedQuestionIndex : state.lastSavedQuestionIndex,
                lastHeartbeatAt: action.payload.lastHeartbeatAt !== undefined ? action.payload.lastHeartbeatAt : state.lastHeartbeatAt,
                sessionConnectionStatus: action.payload.sessionConnectionStatus || state.sessionConnectionStatus,
                heartbeatIntervalMs: typeof action.payload.heartbeatIntervalMs === 'number' ? action.payload.heartbeatIntervalMs : state.heartbeatIntervalMs,
                graceWindowMs: typeof action.payload.graceWindowMs === 'number' ? action.payload.graceWindowMs : state.graceWindowMs,
                lastSyncedAt: action.payload.lastSyncedAt !== undefined ? action.payload.lastSyncedAt : state.lastSyncedAt,
                m_left: typeof action.payload.m_left === 'number' ? action.payload.m_left : state.m_left,
                s_left: typeof action.payload.s_left === 'number' ? action.payload.s_left : state.s_left,
                LocaltestDone: typeof action.payload.completed === 'boolean' ? action.payload.completed : state.LocaltestDone,
                testconducted: typeof action.payload.testconducted === 'boolean' ? action.payload.testconducted : state.testconducted,
                startedWriting: typeof action.payload.startedWriting === 'boolean' ? action.payload.startedWriting : state.startedWriting
            }
        default:
            return state;
    }
}

export default traineeReducer;
