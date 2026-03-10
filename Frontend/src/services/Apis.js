const environment = process.env.NODE_ENV;
const browserHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
const browserOrigin = typeof window !== 'undefined' ? window.location.origin : `http://${browserHost}:3000`;
const defaultFrontendBase = browserOrigin;
const defaultApiBase = `http://${browserHost}:5001`;
const defaultSignalingWs = `ws://${browserHost}:8080`;
const defaultResultWs = `ws://${browserHost}:8081`;
const defaultAiServer = `http://${browserHost}:5020`;

const normalizeUrl = (url = '') => {
    if (!url) return '';
    return url.endsWith('/') ? url.slice(0, -1) : url;
};

const parseCsv = (value = '') => value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

const apis = {
    BASE_LOCAL_URL: normalizeUrl(
        process.env.REACT_APP_FRONTEND_BASE_URL ||
        (environment === 'development' ? 'http://localhost:3000' : defaultFrontendBase)
    ),
    BASE: normalizeUrl(
        process.env.REACT_APP_API_BASE_URL ||
        (environment === 'development' ? 'http://localhost:5001' : defaultApiBase)
    ),
    WS_SIGNALING_URL: normalizeUrl(process.env.REACT_APP_WS_SIGNALING_URL || defaultSignalingWs),
    WS_RESULT_URL: normalizeUrl(process.env.REACT_APP_WS_RESULT_URL || defaultResultWs),
    AI_SERVER_URL: normalizeUrl(process.env.REACT_APP_AI_SERVER_URL || defaultAiServer),
    RTC_STUN_URLS: parseCsv(process.env.REACT_APP_RTC_STUN_URLS || 'stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302'),
    RTC_TURN_URLS: parseCsv(process.env.REACT_APP_RTC_TURN_URLS || ''),
    RTC_TURN_USERNAME: process.env.REACT_APP_RTC_TURN_USERNAME || '',
    RTC_TURN_CREDENTIAL: process.env.REACT_APP_RTC_TURN_CREDENTIAL || '',
    LOGIN : "/api/v1/login/",
    GET_DASHBOARD: "/api/v1/dashboard",
    GETDETAILSUSER : "/api/v1/user/details",
    GET_ALL_TRAINER :'/api/v1/admin/trainer/details/all',
    GET_SINGLE_TRAINER_DETAILS : '/api/v1/admin/trainer/details',
    CREATE_TRAINER : '/api/v1/admin/trainer/create',
    DELETE_TRAINER : '/api/v1/admin/trainer/remove',
    GET_ALL_SUBJECTS : '/api/v1/subject/details/all',
    GET_SINGLE_SUBJECT_DETAILS : '/api/v1/subject/details',
    CREATE_SUBJECT : '/api/v1/subject/create',
    GET_ALL_QUESTIONS : '/api/v1/questions/details/all',
    DELETE_QUESTION:'/api/v1/questions/delete',
    FETCH_SINGLE_QUESTION:'/api/v1/questions/details',
    CREATE_QUESTIONS :'/api/v1/questions/create',
    FILE_UPLOAD:'/api/v1/upload',
    CREATE_TEST : '/api/v1/test/create',
    DELETE_TEST:'/api/v1/test/delete',
    GET_ALL_TESTS:'/api/v1/test/details/all',
    GET_SINGLE_TEST:'/api/v1/test/trainer/details',
    REGISTER_TRAINEE_FOR_TEST:'/api/v1/trainee/enter',
    FETCH_TRAINEE_REGISTRATION_CONFIG:'/api/v1/trainee/register/config',
    RESEND_TRAINER_REGISTRATION_LINK: '/api/v1/trainee/resend/testlink',
    GET_SINGLE_TEST_DETAILS_BASIC:'/api/v1/test/basic/details',
    STOP_REGISTRATION :'/api/v1/trainer/registration/stop',
    START_TEST_BY_TRAINER:'/api/v1/test/begin',
    SET_TEST_INTEGRITY_CONFIG:'/api/v1/test/integrity/config',
    GET_TEST_INTEGRITY_CONFIG:'/api/v1/test/integrity/details',
    GET_TEST_CANDIDATES :'/api/v1/test/candidates',
    GET_PROCTOR_SUMMARY:'/api/v1/test/proctor/summary',
    GET_PROCTOR_EVENTS:'/api/v1/test/proctor/events',
    GET_TEST_PSYCHOMETRIC_OVERVIEW:'/api/v1/test/psychometrics/overview',
    GET_TEST_PSYCHOMETRIC_QUESTIONS:'/api/v1/test/psychometrics/questions',
    ACK_PROCTOR_EVENT:'/api/v1/test/proctor/event/ack',
    ESCALATE_PROCTOR_EVENT:'/api/v1/test/proctor/event/escalate',
    UPSERT_CANDIDATE_ACCOMMODATION:'/api/v1/test/candidate/accommodations/upsert',
    GET_CANDIDATE_ACCOMMODATION:'/api/v1/test/candidate/accommodations/get',
    LIST_TEST_ACCOMMODATIONS:'/api/v1/test/candidate/accommodations/list',
    REVOKE_CANDIDATE_ACCOMMODATION:'/api/v1/test/candidate/accommodations/revoke',
    SUBMIT_MODERATION_ACTION:'/api/v1/test/moderation/action',
    GET_MODERATION_HISTORY:'/api/v1/test/moderation/history',
    GET_MODERATION_SUMMARY:'/api/v1/test/moderation/summary',
    GET_TEST_QUESTIONS :'/api/v1/test/questions',
    FETCH_TRAINEE_DETAILS:'/api/v1/trainee/details',
    FETCH_TRAINEE_TEST_DETAILS:'/api/v1/trainee/flags',
    TRAINEE_PREFLIGHT_START:'/api/v1/trainee/preflight/start',
    TRAINEE_PREFLIGHT_CHECK:'/api/v1/trainee/preflight/check',
    TRAINEE_PREFLIGHT_COMPLETE:'/api/v1/trainee/preflight/complete',
    TRAINEE_PREFLIGHT_LATEST:'/api/v1/trainee/preflight/latest',
    PROCEED_TO_TEST:'/api/v1/trainee/answersheet',
    FETCH_TRAINEE_TEST_QUESTION:'/api/v1/trainee/paper/questions',
    FETCH_TRAINEE_TEST_ANSWERSHEET:'/api/v1/trainee/chosen/options',
    TRAINEE_SESSION_HEARTBEAT:'/api/v1/trainee/session/heartbeat',
    TRAINEE_SESSION_RESUME:'/api/v1/trainee/session/resume',
    TRAINEE_BATCH_SAVE_ANSWERS:'/api/v1/trainee/answers/batch-save',
    UPDATE_ANSWERS:'/api/v1/trainee/update/answer',
    END_TEST : '/api/v1/trainee/end/test',
    FETCH_OWN_RESULT:'/api/v1/final/results',
    FETCH_SINGLE_QUESTION_BY_TRAINEE:'/api/v1/trainee/get/question',
    END_TEST_BY_TRAINER:'/api/v1/test/end',
    TOGGLE_FACE_RECOGNITION:'/api/v1/test/face-recognition',
    FEEDBACK_STATUS_CHECK:'/api/v1/trainee/feedback/status',
    GIVE_FEEDBACK:'/api/v1/trainee/feedback',
    GET_STATS:'/api/v1/test/candidates/details',
    GET_EXCEL:'/api/v1/trainer/result/download',
    MAX_MARKS_FETCH:'/api/v1/test/max/marks',
    GET_FEEDBACKS:'/api/v1/trainer/get/feedbacks',
    CHECK_TEST_NAME:'/api/v1/test/new/name/check',
    FETCH_TRAINEE_BY_TRAINEEID:'/api/v1/trainee/fetch-trainee-by-traineeid',
    FETCH_TEST_BY_EXAMID:'/api/v1/trainee/fetch-test-by-examid'
};

export default apis;


