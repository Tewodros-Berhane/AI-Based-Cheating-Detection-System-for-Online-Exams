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
    examMeta:{
        title:'',
        organisation:'',
        duration:0,
        totalQuestions:0,
        examID:'',
        integrityMode:'STANDARD',
        integrityPolicy:{
            requireCamera:true,
            requireMicrophone:true,
            requireFullscreen:false,
            requireScreenShare:false,
            requireFaceVerification:true,
            allowTabSwitchTolerance:1,
            preflightMaxFailures:1
        },
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
                examMeta:{
                    title:'',
                    organisation:'',
                    duration:0,
                    totalQuestions:0,
                    examID:'',
                    integrityMode:'STANDARD',
                    integrityPolicy:{
                        requireCamera:true,
                        requireMicrophone:true,
                        requireFullscreen:false,
                        requireScreenShare:false,
                        requireFaceVerification:true,
                        allowTabSwitchTolerance:1,
                        preflightMaxFailures:1
                    },
                    preflightEnabled:false
                },
                faceRecognitionEnabled:false
            }
        case 'FETCH_TEST_FLAG':
            return{
                ...state,
                testbegins:action.payload1,
                startedWriting:action.payload2,
                testconducted:action.payload3,
                LocaltestDone:action.payload4,
                m_left:action.payload5,
                s_left:action.payload6,
                faceRecognitionEnabled: typeof action.payload8 === 'boolean' ? action.payload8 : state.faceRecognitionEnabled,
                examMeta:action.payload7 || state.examMeta,
                invalidUrl:false,
                initialloading1:false
            }
        case 'INVALID_TEST_URL':
            return{
                ...state,
                invalidUrl:true
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
                answers:action.payload
            }
        default:
            return state;
    }
}

export default traineeReducer;
