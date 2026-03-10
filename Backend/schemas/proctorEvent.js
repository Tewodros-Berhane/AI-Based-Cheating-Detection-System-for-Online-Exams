var mongoose = require("mongoose");

var proctorEventSchema = new mongoose.Schema({
    testid: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'TestPaperModel',
        required: true,
        index: true
    },
    traineeid: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'TraineeEnterModel',
        required: true,
        index: true
    },
    sessionId: {
        type: String,
        required: true,
        index: true
    },
    eventId: {
        type: String,
        required: true,
        unique: true
    },
    eventType: {
        type: String,
        required: true,
        index: true
    },
    source: {
        type: String,
        enum: ['AI', 'FACE', 'SYSTEM', 'TRAINER'],
        required: true
    },
    severityScore: {
        type: Number,
        min: 0,
        max: 100,
        required: true
    },
    severityLevel: {
        type: String,
        enum: ['NORMAL', 'SUSPICIOUS', 'HIGH_RISK', 'CHEATING', 'FINISHED'],
        required: true,
        index: true
    },
    confidence: {
        type: Number,
        min: 0,
        max: 1,
        default: 1
    },
    message: {
        type: String,
        required: true
    },
    payload: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    dedupeKey: {
        type: String,
        default: null,
        index: true
    },
    acked: {
        type: Boolean,
        default: false
    },
    ackedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'userModel',
        default: null
    },
    ackedAt: {
        type: Date,
        default: null
    },
    resolutionStatus: {
        type: String,
        enum: ['UNRESOLVED', 'CONFIRMED', 'EXCUSED'],
        default: 'UNRESOLVED',
        index: true
    },
    resolvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'UserModel',
        default: null
    },
    resolvedAt: {
        type: Date,
        default: null
    },
    resolutionReason: {
        type: String,
        default: ''
    },
    resolutionActionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ModerationActionModel',
        default: null
    }
}, {
    timestamps: {
        createdAt: true,
        updatedAt: false
    }
});

proctorEventSchema.index({ testid: 1, traineeid: 1, createdAt: -1 });
proctorEventSchema.index({ sessionId: 1, createdAt: -1 });
proctorEventSchema.index({ severityLevel: 1, createdAt: -1 });
proctorEventSchema.index({ dedupeKey: 1, createdAt: -1 });

module.exports = proctorEventSchema;
