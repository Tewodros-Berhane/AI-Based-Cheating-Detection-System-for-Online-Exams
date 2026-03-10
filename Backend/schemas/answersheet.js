var mongoose = require("mongoose");
var answersheetschema = new mongoose.Schema({
    startTime : {
        type : Number,
        required : true
    },
    testid :{ 
        type: mongoose.Schema.Types.ObjectId,
        ref : 'TestPaperModel',
        required : true
    },
    userid : {
        type: mongoose.Schema.Types.ObjectId,
        ref : 'TraineeEnterModel',
        required : true
    },
    questions : [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref :  'QuestionModel',
            required : true
        }
    ],
    answers : [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref : 'AnswersModel',
            required : true
        }
    ],
    completed :{
        type : Boolean,
        default : false,
        required : true
    },
    lastHeartbeatAt: {
        type: Date,
        default: null
    },
    lastClientSyncAt: {
        type: Date,
        default: null
    },
    disconnectCount: {
        type: Number,
        default: 0
    },
    graceWindowUntil: {
        type: Date,
        default: null
    },
    completionReason: {
        type: String,
        enum: ['SUBMITTED', 'TIMEOUT', 'FORCED_BY_TRAINER', 'AUTO_TERMINATED'],
        default: undefined
    },
    sessionVersion: {
        type: Number,
        default: 0
    },
    lastSavedQuestionIndex: {
        type: Number,
        default: 0
    },
    effectiveDurationMinutes: {
        type: Number,
        default: null
    },
    effectiveIntegrityPolicy: {
        requireCamera: {
            type: Boolean,
            default: null
        },
        requireMicrophone: {
            type: Boolean,
            default: null
        },
        requireFullscreen: {
            type: Boolean,
            default: null
        },
        requireScreenShare: {
            type: Boolean,
            default: null
        },
        requireFaceVerification: {
            type: Boolean,
            default: null
        },
        allowTabSwitchTolerance: {
            type: Number,
            default: null
        },
        preflightMaxFailures: {
            type: Number,
            default: null
        }
    },
    effectiveUiAdjustments: {
        highContrastMode: {
            type: Boolean,
            default: false
        },
        largeTextMode: {
            type: Boolean,
            default: false
        },
        screenReaderAllowed: {
            type: Boolean,
            default: false
        }
    },
    moderationStatus: {
        type: String,
        enum: ['NORMAL', 'UNDER_REVIEW', 'WARNED', 'FORCE_SUBMITTED', 'DISQUALIFIED', 'REOPENED'],
        default: 'NORMAL'
    },
    lastModerationActionAt: {
        type: Date,
        default: null
    },
    grantedExtraTimeMinutes: {
        type: Number,
        default: 0,
        min: 0
    }
})

answersheetschema.index({ testid: 1, userid: 1 }, { unique: true });
answersheetschema.index({ completed: 1, lastHeartbeatAt: 1 });

module.exports = answersheetschema;
