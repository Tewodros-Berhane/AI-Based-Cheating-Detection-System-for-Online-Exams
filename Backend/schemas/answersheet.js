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
    }
})

answersheetschema.index({ testid: 1, userid: 1 }, { unique: true });
answersheetschema.index({ completed: 1, lastHeartbeatAt: 1 });

module.exports = answersheetschema;
