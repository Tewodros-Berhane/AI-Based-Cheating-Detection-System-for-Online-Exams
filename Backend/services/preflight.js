var mongoose = require("mongoose");
var PreflightRunModel = require("../models/preflightRun");
var TestPaperModel = require("../models/testpaper");
var TraineeEnterModel = require("../models/trainee");
var logger = require("./logger");
var accommodations = require("./accommodations");

const REQUIRED_CHECK_BY_POLICY = {
  requireCamera: "camera",
  requireMicrophone: "microphone",
  requireFullscreen: "fullscreen",
  requireScreenShare: "screen_share",
  requireFaceVerification: "face_reference"
};

const CHECK_LABEL_BY_TYPE = {
  camera: "Camera",
  microphone: "Microphone",
  fullscreen: "Fullscreen",
  screen_share: "Screen sharing",
  face_reference: "Profile photo",
  network: "Internet connection"
};

const normalizeObjectId = (value) => {
  if (!value) return null;
  if (!mongoose.Types.ObjectId.isValid(value)) return null;
  return String(value);
};

const normalizeCheckType = (value) => String(value || "").trim().toLowerCase();

const toCheckLabel = (checkType) => CHECK_LABEL_BY_TYPE[checkType] || String(checkType || "check");

const resolveEffectiveIntegrity = async (test, traineeid) => {
  const profile = await accommodations.getActiveAccommodationProfile(test && test._id, traineeid);
  const resolved = accommodations.buildResolvedAccommodation({ test, profile });

  return {
    mode: resolved.integrityMode,
    policy: resolved.effectiveIntegrityPolicy,
    preflightEnabled: resolved.preflightEnabled,
    faceRecognitionEnabled: Boolean(test && test.faceRecognitionEnabled && resolved.effectiveIntegrityPolicy && resolved.effectiveIntegrityPolicy.requireFaceVerification)
  };
};

const ensureCandidateAndTest = async (testid, traineeid) => {
  const safeTestId = normalizeObjectId(testid);
  const safeTraineeId = normalizeObjectId(traineeid);
  if (!safeTestId || !safeTraineeId) return null;

  const [test, trainee] = await Promise.all([
    TestPaperModel.findById(safeTestId, {
      _id: 1,
      preflightEnabled: 1,
      integrityMode: 1,
      integrityPolicy: 1,
      faceRecognitionEnabled: 1
    }),
    TraineeEnterModel.findOne(
      { _id: safeTraineeId, testid: safeTestId },
      { _id: 1, faceImageUrl: 1, testid: 1 }
    )
  ]);

  if (!test || !trainee) return null;
  return { test, trainee };
};

const toClientMeta = (payload = {}) => ({
  userAgent: String(payload.userAgent || ""),
  platform: String(payload.platform || ""),
  screenWidth: Number(payload.screenWidth || 0),
  screenHeight: Number(payload.screenHeight || 0),
  timezone: String(payload.timezone || "")
});

const getMissingRequiredChecks = (policy, checks = []) => {
  const latestByType = new Map();
  checks.forEach((check) => {
    const key = normalizeCheckType(check.checkType);
    if (!key) return;
    latestByType.set(key, check);
  });

  const missing = [];
  Object.keys(REQUIRED_CHECK_BY_POLICY).forEach((policyKey) => {
    if (!policy[policyKey]) return;
    const expectedCheckType = REQUIRED_CHECK_BY_POLICY[policyKey];
    const current = latestByType.get(expectedCheckType);
    if (!current || !current.passed) {
      missing.push(expectedCheckType);
    }
  });
  return missing;
};

const startPreflight = async (req, res) => {
  const testid = req.body.testid;
  const traineeid = req.body.traineeid;

  if (!testid || !traineeid) {
    return res.status(400).json({
      success: false,
      message: "testid and traineeid are required."
    });
  }

  try {
    const info = await ensureCandidateAndTest(testid, traineeid);
    if (!info) {
      return res.json({
        success: false,
        message: "Invalid test or trainee reference."
      });
    }

    const integrity = await resolveEffectiveIntegrity(info.test, info.trainee._id);
    const mode = integrity.mode;
    const policy = integrity.policy;
    const lastRun = await PreflightRunModel.findOne({
      testid: info.test._id,
      traineeid: info.trainee._id
    }).sort({ attemptNo: -1, createdAt: -1 });
    const nextAttempt = lastRun ? Number(lastRun.attemptNo || 0) + 1 : 1;

    const run = await PreflightRunModel.create({
      testid: info.test._id,
      traineeid: info.trainee._id,
      attemptNo: nextAttempt,
      mode,
      status: integrity.preflightEnabled ? "PENDING" : "PASSED",
      startedAt: new Date(),
      completedAt: integrity.preflightEnabled ? null : new Date(),
      checks: [],
      policy,
      clientMeta: toClientMeta(req.body.clientMeta)
    });

    return res.json({
      success: true,
      message: integrity.preflightEnabled
        ? "Setup check started."
        : "Setup check is disabled for this exam.",
      data: {
        runid: run._id,
        status: run.status,
        preflightEnabled: Boolean(integrity.preflightEnabled),
        integrityMode: mode,
        integrityPolicy: policy
      }
    });
  } catch (error) {
    logger.error("preflight_start_failed", {
      testId: testid,
      traineeId: traineeid,
      error: logger.normalizeError(error)
    });
    return res.status(500).json({
      success: false,
      message: "Unable to start preflight."
    });
  }
};

const updatePreflightCheck = async (req, res) => {
  const runid = req.body.runid;
  const testid = req.body.testid;
  const traineeid = req.body.traineeid;
  const checkType = normalizeCheckType(req.body.checkType);
  const passed = req.body.passed;
  const value = req.body.value;
  const reason = req.body.reason;

  if (!runid || !testid || !traineeid || !checkType || typeof passed !== "boolean") {
    return res.status(400).json({
      success: false,
      message: "runid, testid, traineeid, checkType and passed are required."
    });
  }

  try {
    const run = await PreflightRunModel.findOne({
      _id: runid,
      testid: normalizeObjectId(testid),
      traineeid: normalizeObjectId(traineeid)
    });

    if (!run) {
      return res.json({
        success: false,
        message: "Invalid preflight run."
      });
    }

    if (run.status !== "PENDING") {
      return res.json({
        success: false,
        message: "This preflight run is not active.",
        data: {
          runid: run._id,
          status: run.status
        }
      });
    }

    run.checks.push({
      checkType,
      passed,
      value: value === undefined ? null : value,
      reason: String(reason || ""),
      timestamp: new Date()
    });

    await run.save();
    return res.json({
      success: true,
      message: "Check recorded.",
      data: {
        runid: run._id,
        status: run.status,
        checks: run.checks
      }
    });
  } catch (error) {
    logger.error("preflight_check_update_failed", {
      runId: runid,
      testId: testid,
      traineeId: traineeid,
      checkType,
      error: logger.normalizeError(error)
    });
    return res.status(500).json({
      success: false,
      message: "Unable to record preflight check."
    });
  }
};

const completePreflight = async (req, res) => {
  const runid = req.body.runid;
  const testid = req.body.testid;
  const traineeid = req.body.traineeid;

  if (!runid || !testid || !traineeid) {
    return res.status(400).json({
      success: false,
      message: "runid, testid and traineeid are required."
    });
  }

  try {
    const info = await ensureCandidateAndTest(testid, traineeid);
    if (!info) {
      return res.json({
        success: false,
        message: "Invalid test or trainee reference."
      });
    }

    const run = await PreflightRunModel.findOne({
      _id: runid,
      testid: info.test._id,
      traineeid: info.trainee._id
    });

    if (!run) {
      return res.json({
        success: false,
        message: "Invalid preflight run."
      });
    }

    const integrity = await resolveEffectiveIntegrity(info.test, info.trainee._id);

    if (!integrity.preflightEnabled) {
      run.status = "PASSED";
      run.completedAt = new Date();
      run.policy = integrity.policy;
      await run.save();
      return res.json({
        success: true,
        message: "Setup check skipped because it is disabled for this exam.",
        data: {
          runid: run._id,
          status: run.status,
          missingChecks: []
        }
      });
    }

    const missingChecks = getMissingRequiredChecks(integrity.policy, run.checks);

    run.mode = integrity.mode;
    run.policy = integrity.policy;
    run.completedAt = new Date();
    run.status = missingChecks.length === 0 ? "PASSED" : "FAILED";
    await run.save();

    return res.json({
      success: true,
      message: run.status === "PASSED"
        ? "Setup check completed."
        : "Setup check failed. Please complete the required steps.",
      data: {
        runid: run._id,
        status: run.status,
        missingChecks,
        missingCheckLabels: missingChecks.map(toCheckLabel)
      }
    });
  } catch (error) {
    logger.error("preflight_complete_failed", {
      runId: runid,
      testId: testid,
      traineeId: traineeid,
      error: logger.normalizeError(error)
    });
    return res.status(500).json({
      success: false,
      message: "Unable to complete preflight."
    });
  }
};

const getLatestPreflight = async (req, res) => {
  const testid = req.body.testid;
  const traineeid = req.body.traineeid;

  if (!testid || !traineeid) {
    return res.status(400).json({
      success: false,
      message: "testid and traineeid are required."
    });
  }

  try {
    const info = await ensureCandidateAndTest(testid, traineeid);
    if (!info) {
      return res.json({
        success: false,
        message: "Invalid test or trainee reference."
      });
    }
    const integrity = await resolveEffectiveIntegrity(info.test, info.trainee._id);

    const run = await PreflightRunModel.findOne({
      testid: info.test._id,
      traineeid: info.trainee._id
    }).sort({ createdAt: -1 });

    if (!run) {
      return res.json({
        success: true,
        message: "No setup check run found.",
        data: {
          run: null,
          preflightEnabled: Boolean(integrity.preflightEnabled),
          integrityMode: integrity.mode,
          integrityPolicy: integrity.policy
        }
      });
    }

    return res.json({
      success: true,
      message: "Latest setup check run fetched.",
      data: {
        run,
        preflightEnabled: Boolean(integrity.preflightEnabled),
        integrityMode: integrity.mode,
        integrityPolicy: integrity.policy
      }
    });
  } catch (error) {
    logger.error("preflight_latest_failed", {
      testId: testid,
      traineeId: traineeid,
      error: logger.normalizeError(error)
    });
    return res.status(500).json({
      success: false,
      message: "Unable to fetch latest preflight run."
    });
  }
};

module.exports = {
  startPreflight,
  updatePreflightCheck,
  completePreflight,
  getLatestPreflight
};
