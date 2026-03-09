var mongoose = require('mongoose');

var optionSelectionRateSchema = new mongoose.Schema({
    optionid: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Options',
        required: true
    },
    label: {
        type: String,
        required: true
    },
    text: {
        type: String,
        default: ''
    },
    isCorrect: {
        type: Boolean,
        default: false
    },
    count: {
        type: Number,
        default: 0
    },
    rate: {
        type: Number,
        default: 0
    }
}, { _id: false });

var questionMetricSchema = new mongoose.Schema({
    questionid: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'QuestionModel',
        required: true
    },
    questionNumber: {
        type: Number,
        required: true
    },
    questionBody: {
        type: String,
        default: ''
    },
    subjectid: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SubjectModel',
        default: null
    },
    subjectLabel: {
        type: String,
        default: 'Unassigned'
    },
    weightage: {
        type: Number,
        default: 1
    },
    correctCount: {
        type: Number,
        default: 0
    },
    incorrectCount: {
        type: Number,
        default: 0
    },
    skippedCount: {
        type: Number,
        default: 0
    },
    difficultyIndex: {
        type: Number,
        default: 0
    },
    discriminationIndex: {
        type: Number,
        default: null
    },
    pointBiserial: {
        type: Number,
        default: null
    },
    optionSelectionRates: {
        type: [optionSelectionRateSchema],
        default: []
    },
    flagLowQuality: {
        type: Boolean,
        default: false
    },
    qualityFlags: {
        type: [String],
        default: []
    }
}, { _id: false });

var distributionBandSchema = new mongoose.Schema({
    label: {
        type: String,
        required: true
    },
    minPercent: {
        type: Number,
        required: true
    },
    maxPercent: {
        type: Number,
        required: true
    },
    count: {
        type: Number,
        default: 0
    }
}, { _id: false });

var subjectMetricSchema = new mongoose.Schema({
    subjectid: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SubjectModel',
        default: null
    },
    subjectLabel: {
        type: String,
        default: 'Unassigned'
    },
    questionCount: {
        type: Number,
        default: 0
    },
    flaggedQuestionCount: {
        type: Number,
        default: 0
    },
    averageDifficultyIndex: {
        type: Number,
        default: 0
    }
}, { _id: false });

var psychometricMetricSchema = new mongoose.Schema({
    testid: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'TestPaperModel',
        required: true,
        unique: true,
        index: true
    },
    computedAt: {
        type: Date,
        default: Date.now,
        required: true
    },
    sampleSize: {
        type: Number,
        default: 0
    },
    questionCount: {
        type: Number,
        default: 0
    },
    maxScore: {
        type: Number,
        default: 0
    },
    summary: {
        averageScore: {
            type: Number,
            default: 0
        },
        averagePercent: {
            type: Number,
            default: 0
        },
        medianScore: {
            type: Number,
            default: 0
        },
        medianPercent: {
            type: Number,
            default: 0
        },
        passRate: {
            type: Number,
            default: 0
        },
        reliabilityAlpha: {
            type: Number,
            default: null
        },
        flaggedQuestionCount: {
            type: Number,
            default: 0
        },
        difficultQuestionCount: {
            type: Number,
            default: 0
        },
        easyQuestionCount: {
            type: Number,
            default: 0
        },
        lowDiscriminationCount: {
            type: Number,
            default: 0
        }
    },
    qualityDistribution: {
        healthy: {
            type: Number,
            default: 0
        },
        flagged: {
            type: Number,
            default: 0
        }
    },
    scoreDistribution: {
        type: [distributionBandSchema],
        default: []
    },
    subjectMetrics: {
        type: [subjectMetricSchema],
        default: []
    },
    topFlaggedQuestions: {
        type: [questionMetricSchema],
        default: []
    },
    questionMetrics: {
        type: [questionMetricSchema],
        default: []
    }
}, { minimize: false });

module.exports = psychometricMetricSchema;
