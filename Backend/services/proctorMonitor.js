const timeline = require('./proctorTimeline');
const logger = require('./logger');
const TestPaperModel = require('../models/testpaper');
const ProctorEventModel = require('../models/proctorEvent');

const parseOptionalDate = (value) => timeline.toDate(value);

const ensureTrainer = (req, res) => {
  if (!req.user || req.user.type !== 'TRAINER') {
    res.status(401).json({
      success: false,
      message: 'Permissions not granted!'
    });
    return false;
  }
  return true;
};

const ensureTrainerOwnsTest = async (req, res, testid) => {
  const ownedTest = await TestPaperModel.findOne(
    { _id: testid, createdBy: req.user._id },
    { _id: 1 }
  ).lean();

  if (!ownedTest) {
    res.json({
      success: false,
      message: 'Invalid test id.'
    });
    return false;
  }

  return true;
};

const findOwnedEvent = async (req, res, eventId) => {
  const event = await ProctorEventModel.findOne({ eventId }, { testid: 1 }).lean();
  if (!event) {
    res.json({
      success: false,
      message: 'Event not found.'
    });
    return null;
  }

  const ownsTest = await ensureTrainerOwnsTest(req, res, event.testid);
  if (!ownsTest) {
    return null;
  }

  return event;
};

const getSummary = async (req, res) => {
  if (!ensureTrainer(req, res)) return;

  const testid = req.body.testid || req.body.id;
  if (!testid) {
    return res.status(400).json({
      success: false,
      message: 'Test id is required.'
    });
  }

  try {
    if (!(await ensureTrainerOwnsTest(req, res, testid))) {
      return;
    }
    const traineeIds = Array.isArray(req.body.traineeids) ? req.body.traineeids : [];
    const data = await timeline.listSummary({ testid, traineeIds });
    return res.json({
      success: true,
      message: 'Proctor summary fetched.',
      data
    });
  } catch (error) {
    logger.error('proctor_summary_failed', {
      testId: testid,
      trainerId: req.user && req.user._id,
      error: logger.normalizeError(error)
    });
    return res.status(500).json({
      success: false,
      message: 'Unable to fetch proctor summary.'
    });
  }
};

const getEvents = async (req, res) => {
  if (!ensureTrainer(req, res)) return;

  const testid = req.body.testid || req.body.id;
  if (!testid) {
    return res.status(400).json({
      success: false,
      message: 'Test id is required.'
    });
  }

  try {
    if (!(await ensureTrainerOwnsTest(req, res, testid))) {
      return;
    }
    const data = await timeline.listEvents({
      testid,
      traineeid: req.body.traineeid || '',
      from: parseOptionalDate(req.body.from),
      to: parseOptionalDate(req.body.to),
      severity: req.body.severity || '',
      eventType: req.body.eventType || '',
      page: req.body.page,
      limit: req.body.limit
    });

    return res.json({
      success: true,
      message: 'Proctor timeline fetched.',
      data
    });
  } catch (error) {
    logger.error('proctor_events_failed', {
      testId: testid,
      traineeId: req.body.traineeid,
      trainerId: req.user && req.user._id,
      error: logger.normalizeError(error)
    });
    return res.status(500).json({
      success: false,
      message: 'Unable to fetch proctor timeline.'
    });
  }
};

const acknowledgeEvent = async (req, res) => {
  if (!ensureTrainer(req, res)) return;

  const eventId = req.body.eventId;
  if (!eventId) {
    return res.status(400).json({
      success: false,
      message: 'Event id is required.'
    });
  }

  try {
    const ownedEvent = await findOwnedEvent(req, res, eventId);
    if (!ownedEvent) {
      return;
    }
    const event = await timeline.acknowledgeEvent({
      eventId,
      ackedBy: req.user._id,
      note: req.body.note || ''
    });

    if (!event) {
      return res.json({
        success: false,
        message: 'Event not found.'
      });
    }

    return res.json({
      success: true,
      message: 'Event acknowledged.',
      data: timeline.serializeEvent(event)
    });
  } catch (error) {
    logger.error('proctor_ack_failed', {
      eventId,
      trainerId: req.user && req.user._id,
      error: logger.normalizeError(error)
    });
    return res.status(500).json({
      success: false,
      message: 'Unable to acknowledge event.'
    });
  }
};

const escalateEvent = async (req, res) => {
  if (!ensureTrainer(req, res)) return;

  const eventId = req.body.eventId;
  const severityLevel = String(req.body.severityLevel || 'HIGH_RISK').toUpperCase();
  if (!eventId) {
    return res.status(400).json({
      success: false,
      message: 'Event id is required.'
    });
  }

  try {
    const ownedEvent = await findOwnedEvent(req, res, eventId);
    if (!ownedEvent) {
      return;
    }
    const event = await timeline.escalateEvent({
      eventId,
      escalatedBy: String(req.user._id),
      severityLevel,
      note: req.body.note || ''
    });

    if (!event) {
      return res.json({
        success: false,
        message: 'Event not found.'
      });
    }

    return res.json({
      success: true,
      message: 'Event escalated.',
      data: {
        eventId,
        severityLevel
      }
    });
  } catch (error) {
    logger.error('proctor_escalate_failed', {
      eventId,
      trainerId: req.user && req.user._id,
      error: logger.normalizeError(error)
    });
    return res.status(500).json({
      success: false,
      message: 'Unable to escalate event.'
    });
  }
};

module.exports = {
  getSummary,
  getEvents,
  acknowledgeEvent,
  escalateEvent
};
