var mongoose = require("mongoose");
var integrityPolicy = require("../services/integrityPolicy");
var testschema = new mongoose.Schema({

    examID : {
        type : String,
        required : true

    },
    title : {
        type : String,
        required : true

    },

    questions : [
    
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'QuestionModel',
                required : false
        
            }
        
    ],
    subjects : [
    
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'SubjectModel',
            required : false
    
        }
    
    ],
    duration : {
        type : Number,
        required : true
    
        },
    organisation : {
        type : String,
        required : false
    },
    difficulty : {
        type : Number,
        default : 1,
        required : false
    },
    testbegins : {
        type : Boolean,
        default : false,
        required : true
    },
    status : {
        required : true,
        default : 1,
        type : Boolean
    },
    createdBy:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'UserModel'
    },
    isRegistrationavailable :{
        type : Boolean,
        default : true,
        required : true
    },
    testconducted : {
        type : Boolean,
        default : false,
        required : true
    },
    isResultgenerated :{
        type : Boolean,
        default : false,
        required : true
    },
    faceRecognitionEnabled: {
        type: Boolean,
        default: false,
        required: true
    },
    integrityMode: {
        type: String,
        enum: ['LIGHT', 'STANDARD', 'STRICT'],
        default: integrityPolicy.DEFAULT_INTEGRITY_MODE,
        required: true
    },
    integrityPolicy: {
        requireCamera: {
            type: Boolean,
            default: true
        },
        requireMicrophone: {
            type: Boolean,
            default: true
        },
        requireFullscreen: {
            type: Boolean,
            default: false
        },
        requireScreenShare: {
            type: Boolean,
            default: false
        },
        requireFaceVerification: {
            type: Boolean,
            default: true
        },
        allowTabSwitchTolerance: {
            type: Number,
            default: 1
        },
        preflightMaxFailures: {
            type: Number,
            default: 1
        }
    },
    preflightEnabled: {
        type: Boolean,
        default: true,
        required: true
    }


},
{ timestamps: {}}

);

module.exports =  testschema;
