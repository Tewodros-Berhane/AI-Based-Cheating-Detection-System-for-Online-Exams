var mongoose = require("mongoose");

var accommodationProfileSchema = new mongoose.Schema({
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
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'UserModel',
        required: true
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'UserModel',
        required: true
    },
    status: {
        type: String,
        enum: ['ACTIVE', 'REVOKED'],
        default: 'ACTIVE',
        required: true,
        index: true
    },
    reason: {
        type: String,
        required: true,
        trim: true
    },
    notes: {
        type: String,
        default: '',
        trim: true
    },
    timeAdjustments: {
        extraTimeMinutes: {
            type: Number,
            default: 0,
            min: 0,
            max: 720
        },
        customStartAt: {
            type: Date,
            default: null
        },
        customEndAt: {
            type: Date,
            default: null
        }
    },
    uiAdjustments: {
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
    integrityOverrides: {
        faceVerificationExempt: {
            type: Boolean,
            default: false
        },
        microphoneExempt: {
            type: Boolean,
            default: false
        },
        screenShareExempt: {
            type: Boolean,
            default: false
        },
        fullscreenExempt: {
            type: Boolean,
            default: false
        }
    },
    effectiveFrom: {
        type: Date,
        default: Date.now
    },
    effectiveUntil: {
        type: Date,
        default: null
    }
}, { timestamps: true });

accommodationProfileSchema.index({ testid: 1, traineeid: 1, status: 1 });
accommodationProfileSchema.index(
    { testid: 1, traineeid: 1, status: 1 },
    { unique: true, partialFilterExpression: { status: 'ACTIVE' } }
);

module.exports = accommodationProfileSchema;
