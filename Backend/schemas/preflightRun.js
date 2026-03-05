var mongoose = require("mongoose");

var preflightCheckSchema = new mongoose.Schema(
  {
    checkType: {
      type: String,
      required: true
    },
    passed: {
      type: Boolean,
      required: true
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    reason: {
      type: String,
      default: ""
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

var preflightPolicySnapshotSchema = new mongoose.Schema(
  {
    requireCamera: { type: Boolean, default: true },
    requireMicrophone: { type: Boolean, default: true },
    requireFullscreen: { type: Boolean, default: false },
    requireScreenShare: { type: Boolean, default: false },
    requireFaceVerification: { type: Boolean, default: true },
    allowTabSwitchTolerance: { type: Number, default: 2 },
    preflightMaxFailures: { type: Number, default: 1 }
  },
  { _id: false }
);

var preflightClientMetaSchema = new mongoose.Schema(
  {
    userAgent: { type: String, default: "" },
    platform: { type: String, default: "" },
    screenWidth: { type: Number, default: 0 },
    screenHeight: { type: Number, default: 0 },
    timezone: { type: String, default: "" }
  },
  { _id: false }
);

var preflightRunSchema = new mongoose.Schema(
  {
    testid: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TestPaperModel",
      required: true
    },
    traineeid: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TraineeEnterModel",
      required: true
    },
    attemptNo: {
      type: Number,
      required: true,
      default: 1
    },
    mode: {
      type: String,
      enum: ["LIGHT", "STANDARD", "STRICT"],
      default: "STANDARD",
      required: true
    },
    status: {
      type: String,
      enum: ["PENDING", "PASSED", "FAILED", "EXPIRED"],
      default: "PENDING",
      required: true
    },
    startedAt: {
      type: Date,
      default: Date.now
    },
    completedAt: {
      type: Date,
      default: null
    },
    checks: {
      type: [preflightCheckSchema],
      default: []
    },
    policy: {
      type: preflightPolicySnapshotSchema,
      default: () => ({})
    },
    clientMeta: {
      type: preflightClientMetaSchema,
      default: () => ({})
    }
  },
  { timestamps: true }
);

preflightRunSchema.index({ testid: 1, traineeid: 1, createdAt: -1 });
preflightRunSchema.index({ status: 1, createdAt: -1 });

module.exports = preflightRunSchema;
