var mongoose = require("mongoose");

var moderationActionSchema = new mongoose.Schema({
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
    trainerid: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'UserModel',
        required: true,
        index: true
    },
    actionType: {
        type: String,
        enum: ['NOTE', 'ACK_EVENT', 'EXCUSE_EVENT', 'CONFIRM_EVENT', 'WARN_CANDIDATE', 'EXTEND_TIME', 'FORCE_SUBMIT', 'REOPEN_SESSION', 'DISQUALIFY', 'CLEAR_CONCERN'],
        required: true,
        index: true
    },
    reason: {
        type: String,
        required: true,
        trim: true
    },
    linkedEventId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ProctorEventModel',
        default: null,
        index: true
    },
    payload: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    beforeState: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    afterState: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    visibleToCandidate: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: {
        createdAt: true,
        updatedAt: false
    }
});

moderationActionSchema.index({ testid: 1, traineeid: 1, createdAt: -1 });
moderationActionSchema.index({ linkedEventId: 1, createdAt: -1 });

module.exports = moderationActionSchema;
