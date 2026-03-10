var mongoose = require("mongoose");

var proctorRiskSnapshotSchema = new mongoose.Schema({
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
    rollingRiskScore: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
    },
    severityLevel: {
        type: String,
        enum: ['NORMAL', 'SUSPICIOUS', 'HIGH_RISK', 'CHEATING', 'FINISHED'],
        default: 'NORMAL'
    },
    lastEventType: {
        type: String,
        default: ''
    },
    lastEventMessage: {
        type: String,
        default: ''
    },
    lastEventAt: {
        type: Date,
        default: null
    },
    suspiciousCount: {
        type: Number,
        default: 0
    },
    highRiskCount: {
        type: Number,
        default: 0
    },
    criticalCount: {
        type: Number,
        default: 0
    },
    isFinished: {
        type: Boolean,
        default: false
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

proctorRiskSnapshotSchema.index({ testid: 1, traineeid: 1 }, { unique: true });
proctorRiskSnapshotSchema.index({ severityLevel: 1, updatedAt: -1 });
proctorRiskSnapshotSchema.index({ testid: 1, updatedAt: -1 });

module.exports = proctorRiskSnapshotSchema;
