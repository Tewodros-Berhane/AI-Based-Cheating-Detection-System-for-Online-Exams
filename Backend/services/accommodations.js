const AccommodationProfileModel = require('../models/accommodationProfile');
const TestPaperModel = require('../models/testpaper');
const TraineeEnterModel = require('../models/trainee');
const integrityPolicy = require('./integrityPolicy');
const logger = require('./logger');

const ACTIVE_STATUS = 'ACTIVE';
const REVOKED_STATUS = 'REVOKED';
const MAX_EXTRA_TIME_MINUTES = 720;

const normalizeBoolean = (value, fallback = false) => {
    if (typeof value === 'boolean') {
        return value;
    }
    return fallback;
};

const normalizeString = (value, fallback = '') => {
    if (typeof value !== 'string') {
        return fallback;
    }
    return value.trim();
};

const normalizeDate = (value) => {
    if (!value) {
        return null;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return null;
    }
    return parsed;
};

const normalizeExtraTimeMinutes = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return 0;
    }
    return Math.max(0, Math.min(Math.round(numeric), MAX_EXTRA_TIME_MINUTES));
};

const isProfileCurrentlyEffective = (profile, now = new Date()) => {
    if (!profile) {
        return false;
    }

    const effectiveFrom = profile.effectiveFrom ? new Date(profile.effectiveFrom) : null;
    const effectiveUntil = profile.effectiveUntil ? new Date(profile.effectiveUntil) : null;

    if (effectiveFrom && effectiveFrom.getTime() > now.getTime()) {
        return false;
    }

    if (effectiveUntil && effectiveUntil.getTime() <= now.getTime()) {
        return false;
    }

    return true;
};

const getTrainerOwnedTest = async (trainerid, testid, projection = null) => {
    return TestPaperModel.findOne({ _id: testid, createdBy: trainerid }, projection || {
        _id: 1,
        title: 1,
        duration: 1,
        organisation: 1,
        examID: 1,
        faceRecognitionEnabled: 1,
        integrityMode: 1,
        integrityPolicy: 1,
        preflightEnabled: 1,
        testbegins: 1,
        testconducted: 1,
        isResultgenerated: 1
    });
};

const getTraineeForTest = async (testid, traineeid, projection = null) => {
    return TraineeEnterModel.findOne({ _id: traineeid, testid }, projection || {
        _id: 1,
        traineeID: 1,
        name: 1,
        emailid: 1,
        contact: 1,
        organisation: 1,
        testid: 1
    });
};

const getActiveAccommodationProfile = async (testid, traineeid, { includeScheduled = false } = {}) => {
    const profile = await AccommodationProfileModel.findOne({
        testid,
        traineeid,
        status: ACTIVE_STATUS
    }).sort({ updatedAt: -1 });

    if (!profile) {
        return null;
    }

    if (includeScheduled || isProfileCurrentlyEffective(profile)) {
        return profile;
    }

    return null;
};

const serializeAccommodationProfile = (profile) => {
    if (!profile) {
        return null;
    }

    const plain = typeof profile.toObject === 'function' ? profile.toObject() : profile;
    return {
        _id: plain._id,
        testid: plain.testid,
        traineeid: plain.traineeid,
        createdBy: plain.createdBy,
        updatedBy: plain.updatedBy,
        status: plain.status,
        reason: plain.reason || '',
        notes: plain.notes || '',
        timeAdjustments: {
            extraTimeMinutes: Number((plain.timeAdjustments && plain.timeAdjustments.extraTimeMinutes) || 0),
            customStartAt: plain.timeAdjustments && plain.timeAdjustments.customStartAt ? plain.timeAdjustments.customStartAt : null,
            customEndAt: plain.timeAdjustments && plain.timeAdjustments.customEndAt ? plain.timeAdjustments.customEndAt : null
        },
        uiAdjustments: {
            highContrastMode: Boolean(plain.uiAdjustments && plain.uiAdjustments.highContrastMode),
            largeTextMode: Boolean(plain.uiAdjustments && plain.uiAdjustments.largeTextMode),
            screenReaderAllowed: Boolean(plain.uiAdjustments && plain.uiAdjustments.screenReaderAllowed)
        },
        integrityOverrides: {
            faceVerificationExempt: Boolean(plain.integrityOverrides && plain.integrityOverrides.faceVerificationExempt),
            microphoneExempt: Boolean(plain.integrityOverrides && plain.integrityOverrides.microphoneExempt),
            screenShareExempt: Boolean(plain.integrityOverrides && plain.integrityOverrides.screenShareExempt),
            fullscreenExempt: Boolean(plain.integrityOverrides && plain.integrityOverrides.fullscreenExempt)
        },
        effectiveFrom: plain.effectiveFrom || null,
        effectiveUntil: plain.effectiveUntil || null,
        createdAt: plain.createdAt || null,
        updatedAt: plain.updatedAt || null
    };
};

const buildResolvedAccommodation = ({ test, profile }) => {
    const mode = integrityPolicy.normalizeIntegrityMode(test && test.integrityMode);
    const baseIntegrityPolicy = integrityPolicy.resolveIntegrityPolicy(mode, test && test.integrityPolicy ? test.integrityPolicy : {});
    if (!Boolean(test && test.faceRecognitionEnabled)) {
        baseIntegrityPolicy.requireFaceVerification = false;
    }

    const serializedProfile = serializeAccommodationProfile(profile);
    const timeAdjustments = serializedProfile ? serializedProfile.timeAdjustments : {
        extraTimeMinutes: 0,
        customStartAt: null,
        customEndAt: null
    };
    const uiAdjustments = serializedProfile ? serializedProfile.uiAdjustments : {
        highContrastMode: false,
        largeTextMode: false,
        screenReaderAllowed: false
    };
    const integrityOverrides = serializedProfile ? serializedProfile.integrityOverrides : {
        faceVerificationExempt: false,
        microphoneExempt: false,
        screenShareExempt: false,
        fullscreenExempt: false
    };

    const effectiveIntegrityPolicy = {
        ...baseIntegrityPolicy
    };

    if (integrityOverrides.faceVerificationExempt) {
        effectiveIntegrityPolicy.requireFaceVerification = false;
    }
    if (integrityOverrides.microphoneExempt) {
        effectiveIntegrityPolicy.requireMicrophone = false;
    }
    if (integrityOverrides.screenShareExempt) {
        effectiveIntegrityPolicy.requireScreenShare = false;
    }
    if (integrityOverrides.fullscreenExempt) {
        effectiveIntegrityPolicy.requireFullscreen = false;
    }

    const baseDurationMinutes = Number((test && test.duration) || 0);
    let effectiveDurationMinutes = baseDurationMinutes + Number(timeAdjustments.extraTimeMinutes || 0);

    if (timeAdjustments.customStartAt && timeAdjustments.customEndAt) {
        const customDurationMinutes = Math.round((new Date(timeAdjustments.customEndAt).getTime() - new Date(timeAdjustments.customStartAt).getTime()) / 60000);
        if (Number.isFinite(customDurationMinutes) && customDurationMinutes > 0) {
            effectiveDurationMinutes = customDurationMinutes;
        }
    }

    return {
        integrityMode: mode,
        preflightEnabled: typeof (test && test.preflightEnabled) === 'boolean' ? Boolean(test.preflightEnabled) : false,
        faceRecognitionEnabled: Boolean(test && test.faceRecognitionEnabled),
        baseDurationMinutes,
        effectiveDurationMinutes,
        baseIntegrityPolicy,
        effectiveIntegrityPolicy,
        effectiveUiAdjustments: uiAdjustments,
        timeAdjustments,
        accommodationProfile: serializedProfile
    };
};

const resolveEffectivePolicyDetails = async ({ testid, traineeid }) => {
    const [test, trainee, profile] = await Promise.all([
        TestPaperModel.findById(testid, {
            _id: 1,
            title: 1,
            examID: 1,
            duration: 1,
            organisation: 1,
            faceRecognitionEnabled: 1,
            integrityMode: 1,
            integrityPolicy: 1,
            preflightEnabled: 1,
            testbegins: 1,
            testconducted: 1,
            isResultgenerated: 1
        }),
        getTraineeForTest(testid, traineeid),
        getActiveAccommodationProfile(testid, traineeid)
    ]);

    if (!test || !trainee) {
        const error = new Error('Invalid test or examinee id.');
        error.code = 'INVALID_TEST_OR_TRAINEE';
        throw error;
    }

    return {
        test,
        trainee,
        profile,
        resolved: buildResolvedAccommodation({ test, profile })
    };
};

const sanitizeAccommodationInput = (body = {}) => {
    const reason = normalizeString(body.reason);
    if (!reason) {
        const error = new Error('Reason is required.');
        error.code = 'INVALID_REASON';
        throw error;
    }

    const customStartAt = normalizeDate(body.customStartAt ?? (body.timeAdjustments && body.timeAdjustments.customStartAt));
    const customEndAt = normalizeDate(body.customEndAt ?? (body.timeAdjustments && body.timeAdjustments.customEndAt));
    if (customStartAt && customEndAt && customEndAt.getTime() <= customStartAt.getTime()) {
        const error = new Error('Custom end time must be later than custom start time.');
        error.code = 'INVALID_TIME_WINDOW';
        throw error;
    }

    return {
        reason,
        notes: normalizeString(body.notes),
        timeAdjustments: {
            extraTimeMinutes: normalizeExtraTimeMinutes(body.extraTimeMinutes ?? (body.timeAdjustments && body.timeAdjustments.extraTimeMinutes)),
            customStartAt,
            customEndAt
        },
        uiAdjustments: {
            highContrastMode: normalizeBoolean(body.highContrastMode ?? (body.uiAdjustments && body.uiAdjustments.highContrastMode), false),
            largeTextMode: normalizeBoolean(body.largeTextMode ?? (body.uiAdjustments && body.uiAdjustments.largeTextMode), false),
            screenReaderAllowed: normalizeBoolean(body.screenReaderAllowed ?? (body.uiAdjustments && body.uiAdjustments.screenReaderAllowed), false)
        },
        integrityOverrides: {
            faceVerificationExempt: normalizeBoolean(body.faceVerificationExempt ?? (body.integrityOverrides && body.integrityOverrides.faceVerificationExempt), false),
            microphoneExempt: normalizeBoolean(body.microphoneExempt ?? (body.integrityOverrides && body.integrityOverrides.microphoneExempt), false),
            screenShareExempt: normalizeBoolean(body.screenShareExempt ?? (body.integrityOverrides && body.integrityOverrides.screenShareExempt), false),
            fullscreenExempt: normalizeBoolean(body.fullscreenExempt ?? (body.integrityOverrides && body.integrityOverrides.fullscreenExempt), false)
        },
        effectiveFrom: normalizeDate(body.effectiveFrom) || new Date(),
        effectiveUntil: normalizeDate(body.effectiveUntil)
    };
};

const validateTrainerAccess = async ({ trainerid, testid, traineeid }) => {
    const [test, trainee] = await Promise.all([
        getTrainerOwnedTest(trainerid, testid),
        getTraineeForTest(testid, traineeid)
    ]);

    if (!test) {
        const error = new Error('Invalid test id.');
        error.code = 'INVALID_TEST';
        throw error;
    }

    if (!trainee) {
        const error = new Error('Invalid examinee id.');
        error.code = 'INVALID_TRAINEE';
        throw error;
    }

    return { test, trainee };
};

const handleAccommodationError = (res, error, context = {}) => {
    if (error && (
        error.code === 'INVALID_TEST' ||
        error.code === 'INVALID_TRAINEE' ||
        error.code === 'INVALID_REASON' ||
        error.code === 'INVALID_TIME_WINDOW' ||
        error.code === 'INVALID_TEST_OR_TRAINEE'
    )) {
        return res.json({
            success: false,
            message: error.message
        });
    }

    logger.error('accommodation_request_failed', {
        ...context,
        error: logger.normalizeError(error)
    });
    return res.status(500).json({
        success: false,
        message: 'Unable to process accommodation request.'
    });
};

const buildAccommodationResponse = ({ test, trainee, profile }) => ({
    test: {
        _id: test._id,
        title: test.title || '',
        examID: test.examID || '',
        duration: Number(test.duration || 0),
        organisation: test.organisation || ''
    },
    trainee: {
        _id: trainee._id,
        traineeID: trainee.traineeID || '',
        name: trainee.name || '',
        emailid: trainee.emailid || '',
        organisation: trainee.organisation || ''
    },
    resolved: buildResolvedAccommodation({ test, profile })
});

const upsertAccommodationProfile = async (req, res) => {
    if (!req.user || req.user.type !== 'TRAINER') {
        return res.status(401).json({
            success: false,
            message: 'Permissions not granted!'
        });
    }

    const testid = req.body.testid;
    const traineeid = req.body.traineeid;

    try {
        const input = sanitizeAccommodationInput(req.body || {});
        const { test, trainee } = await validateTrainerAccess({ trainerid: req.user._id, testid, traineeid });
        const existing = await getActiveAccommodationProfile(testid, traineeid, { includeScheduled: true });

        const payload = {
            testid,
            traineeid,
            createdBy: existing ? existing.createdBy : req.user._id,
            updatedBy: req.user._id,
            status: ACTIVE_STATUS,
            reason: input.reason,
            notes: input.notes,
            timeAdjustments: input.timeAdjustments,
            uiAdjustments: input.uiAdjustments,
            integrityOverrides: input.integrityOverrides,
            effectiveFrom: input.effectiveFrom,
            effectiveUntil: input.effectiveUntil
        };

        const profile = existing
            ? await AccommodationProfileModel.findOneAndUpdate({ _id: existing._id }, payload, { new: true })
            : await AccommodationProfileModel.create(payload);

        return res.json({
            success: true,
            message: existing ? 'Accommodation updated.' : 'Accommodation saved.',
            data: buildAccommodationResponse({ test, trainee, profile })
        });
    } catch (error) {
        return handleAccommodationError(res, error, {
            trainerId: req.user && req.user._id,
            testId: testid,
            traineeId: traineeid
        });
    }
};

const getAccommodationProfile = async (req, res) => {
    if (!req.user || req.user.type !== 'TRAINER') {
        return res.status(401).json({
            success: false,
            message: 'Permissions not granted!'
        });
    }

    const testid = req.body.testid;
    const traineeid = req.body.traineeid;

    try {
        const { test, trainee } = await validateTrainerAccess({ trainerid: req.user._id, testid, traineeid });
        const profile = await getActiveAccommodationProfile(testid, traineeid, { includeScheduled: true });

        return res.json({
            success: true,
            message: 'Accommodation details.',
            data: buildAccommodationResponse({ test, trainee, profile })
        });
    } catch (error) {
        return handleAccommodationError(res, error, {
            trainerId: req.user && req.user._id,
            testId: testid,
            traineeId: traineeid
        });
    }
};

const listAccommodationProfiles = async (req, res) => {
    if (!req.user || req.user.type !== 'TRAINER') {
        return res.status(401).json({
            success: false,
            message: 'Permissions not granted!'
        });
    }

    const testid = req.body.testid;

    try {
        const test = await getTrainerOwnedTest(req.user._id, testid, { _id: 1, title: 1, examID: 1, duration: 1, organisation: 1 });
        if (!test) {
            return res.json({
                success: false,
                message: 'Invalid test id.'
            });
        }

        const profiles = await AccommodationProfileModel.find({ testid, status: ACTIVE_STATUS })
            .populate('traineeid', 'traineeID name emailid organisation')
            .sort({ updatedAt: -1 })
            .lean();

        return res.json({
            success: true,
            message: 'Accommodation list.',
            data: {
                test,
                items: profiles.map((profile) => ({
                    ...serializeAccommodationProfile(profile),
                    isCurrentlyEffective: isProfileCurrentlyEffective(profile),
                    trainee: profile.traineeid ? {
                        _id: profile.traineeid._id,
                        traineeID: profile.traineeid.traineeID || '',
                        name: profile.traineeid.name || '',
                        emailid: profile.traineeid.emailid || '',
                        organisation: profile.traineeid.organisation || ''
                    } : null
                }))
            }
        });
    } catch (error) {
        return handleAccommodationError(res, error, {
            trainerId: req.user && req.user._id,
            testId: testid
        });
    }
};

const revokeAccommodationProfile = async (req, res) => {
    if (!req.user || req.user.type !== 'TRAINER') {
        return res.status(401).json({
            success: false,
            message: 'Permissions not granted!'
        });
    }

    const testid = req.body.testid;
    const traineeid = req.body.traineeid;
    const revokeReason = normalizeString(req.body.reason);

    if (!revokeReason) {
        return res.json({
            success: false,
            message: 'Reason is required.'
        });
    }

    try {
        const { test, trainee } = await validateTrainerAccess({ trainerid: req.user._id, testid, traineeid });
        const profile = await getActiveAccommodationProfile(testid, traineeid, { includeScheduled: true });
        if (!profile) {
            return res.json({
                success: false,
                message: 'No active accommodation found for this candidate.'
            });
        }

        profile.status = REVOKED_STATUS;
        profile.updatedBy = req.user._id;
        profile.notes = [normalizeString(profile.notes), `Revoked: ${revokeReason}`].filter(Boolean).join('\n');
        await profile.save();

        return res.json({
            success: true,
            message: 'Accommodation revoked.',
            data: buildAccommodationResponse({ test, trainee, profile: null })
        });
    } catch (error) {
        return handleAccommodationError(res, error, {
            trainerId: req.user && req.user._id,
            testId: testid,
            traineeId: traineeid
        });
    }
};

const getEffectivePolicy = async (req, res) => {
    const testid = req.body.testid;
    const traineeid = req.body.traineeid || req.body.userid;

    if (!testid || !traineeid) {
        return res.json({
            success: false,
            message: 'Test id and examinee id are required.'
        });
    }

    try {
        const { test, trainee, profile } = await resolveEffectivePolicyDetails({ testid, traineeid });

        return res.json({
            success: true,
            message: 'Effective session policy.',
            data: buildAccommodationResponse({ test, trainee, profile })
        });
    } catch (error) {
        return handleAccommodationError(res, error, {
            testId: testid,
            traineeId: traineeid
        });
    }
};

module.exports = {
    ACTIVE_STATUS,
    REVOKED_STATUS,
    isProfileCurrentlyEffective,
    getActiveAccommodationProfile,
    serializeAccommodationProfile,
    buildResolvedAccommodation,
    resolveEffectivePolicyDetails,
    upsertAccommodationProfile,
    getAccommodationProfile,
    listAccommodationProfiles,
    revokeAccommodationProfile,
    getEffectivePolicy
};
