const INTEGRITY_MODES = {
  LIGHT: "LIGHT",
  STANDARD: "STANDARD",
  STRICT: "STRICT"
};

const DEFAULT_INTEGRITY_MODE = INTEGRITY_MODES.STANDARD;

const buildDefaultIntegrityPolicy = (mode = DEFAULT_INTEGRITY_MODE) => {
  if (mode === INTEGRITY_MODES.LIGHT) {
    return {
      requireCamera: true,
      requireMicrophone: false,
      requireFullscreen: false,
      requireScreenShare: false,
      requireFaceVerification: false,
      allowTabSwitchTolerance: 3,
      preflightMaxFailures: 2
    };
  }

  if (mode === INTEGRITY_MODES.STRICT) {
    return {
      requireCamera: true,
      requireMicrophone: true,
      requireFullscreen: true,
      requireScreenShare: true,
      requireFaceVerification: true,
      allowTabSwitchTolerance: 0,
      preflightMaxFailures: 0
    };
  }

  return {
    requireCamera: true,
    requireMicrophone: true,
    requireFullscreen: false,
    requireScreenShare: false,
    requireFaceVerification: true,
    allowTabSwitchTolerance: 1,
    preflightMaxFailures: 1
  };
};

const normalizeIntegrityMode = (rawMode) => {
  const mode = String(rawMode || DEFAULT_INTEGRITY_MODE).trim().toUpperCase();
  if (mode === INTEGRITY_MODES.LIGHT || mode === INTEGRITY_MODES.STANDARD || mode === INTEGRITY_MODES.STRICT) {
    return mode;
  }
  return DEFAULT_INTEGRITY_MODE;
};

const toBoolean = (value, fallback) => {
  if (typeof value === "boolean") return value;
  return fallback;
};

const toSafeNumber = (value, fallback, minValue, maxValue) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(minValue, Math.min(maxValue, numeric));
};

const resolveIntegrityPolicy = (mode, policy = {}) => {
  const normalizedMode = normalizeIntegrityMode(mode);
  const defaults = buildDefaultIntegrityPolicy(normalizedMode);
  const payload = policy && typeof policy === "object" ? policy : {};

  return {
    requireCamera: toBoolean(payload.requireCamera, defaults.requireCamera),
    requireMicrophone: toBoolean(payload.requireMicrophone, defaults.requireMicrophone),
    requireFullscreen: toBoolean(payload.requireFullscreen, defaults.requireFullscreen),
    requireScreenShare: toBoolean(payload.requireScreenShare, defaults.requireScreenShare),
    requireFaceVerification: toBoolean(payload.requireFaceVerification, defaults.requireFaceVerification),
    allowTabSwitchTolerance: toSafeNumber(
      payload.allowTabSwitchTolerance,
      defaults.allowTabSwitchTolerance,
      0,
      10
    ),
    preflightMaxFailures: toSafeNumber(
      payload.preflightMaxFailures,
      defaults.preflightMaxFailures,
      0,
      10
    )
  };
};

module.exports = {
  INTEGRITY_MODES,
  DEFAULT_INTEGRITY_MODE,
  normalizeIntegrityMode,
  buildDefaultIntegrityPolicy,
  resolveIntegrityPolicy
};
