const path = require('path');
var config = require('config');
var TraineeEnterModel = require("../models/trainee");
var TestPaperModel = require("../models/testpaper");
var FeedbackModel = require("../models/feedback");
var sendmail = require("../services/mail").sendmail;
var QuestionModel = require("../models/questions");
var options = require("../models/option");
var AnswersheetModel = require("../models/answersheet");
var AnswersModel = require("../models/answers");
var PreflightRunModel = require("../models/preflightRun");
var logger = require("./logger");
const { canApplyAction, ExamActions, deriveExamState } = require("./examStateMachine");
const integrityPolicy = require("./integrityPolicy");
const proctorTimeline = require('./proctorTimeline');
const sessionResilience = require('./sessionResilience');
const accommodations = require('./accommodations');

let getFrontendBaseUrl = (req) => {
    if (config.has('services.frontendBaseUrl')) {
        let configured = config.get('services.frontendBaseUrl') || '';
        if (configured) {
            return configured.replace(/\/+$/, '');
        }
    }
    return `${req.protocol}://${req.get('host')}`;
};

let buildTestLink = (req, testid, traineeid) => {
    return `${getFrontendBaseUrl(req)}/trainee/taketest?testid=${testid}&traineeid=${traineeid}`;
};

let defaultUiAdjustments = () => ({
    highContrastMode: false,
    largeTextMode: false,
    screenReaderAllowed: false
});

let mergeIntegrityPolicy = (basePolicy, overridePolicy = null) => {
    const nextPolicy = { ...(basePolicy || {}) };
    if (!overridePolicy || typeof overridePolicy !== 'object') {
        return nextPolicy;
    }

    Object.keys(nextPolicy).forEach((key) => {
        if (overridePolicy[key] !== null && overridePolicy[key] !== undefined) {
            nextPolicy[key] = overridePolicy[key];
        }
    });

    return nextPolicy;
};

let mergeUiAdjustments = (overrideAdjustments = null) => {
    const nextAdjustments = defaultUiAdjustments();
    if (!overrideAdjustments || typeof overrideAdjustments !== 'object') {
        return nextAdjustments;
    }

    Object.keys(nextAdjustments).forEach((key) => {
        if (overrideAdjustments[key] !== null && overrideAdjustments[key] !== undefined) {
            nextAdjustments[key] = Boolean(overrideAdjustments[key]);
        }
    });

    return nextAdjustments;
};

let hasStoredIntegritySnapshot = (answerSheet) => {
    if (!answerSheet || !answerSheet.effectiveIntegrityPolicy) {
        return false;
    }

    const policy = typeof answerSheet.effectiveIntegrityPolicy.toObject === 'function'
        ? answerSheet.effectiveIntegrityPolicy.toObject()
        : answerSheet.effectiveIntegrityPolicy;

    return Object.values(policy || {}).some((value) => value !== null && value !== undefined);
};

let resolveTestIntegrity = (test, runtimeContext = null) => {
    const mode = integrityPolicy.normalizeIntegrityMode(test && test.integrityMode);
    const basePolicy = integrityPolicy.resolveIntegrityPolicy(mode, test && test.integrityPolicy ? test.integrityPolicy : {});
    if (!Boolean(test && test.faceRecognitionEnabled)) {
        basePolicy.requireFaceVerification = false;
    }

    return {
        mode,
        policy: mergeIntegrityPolicy(basePolicy, runtimeContext && runtimeContext.effectiveIntegrityPolicy ? runtimeContext.effectiveIntegrityPolicy : null),
        preflightEnabled: typeof (test && test.preflightEnabled) === "boolean"
            ? Boolean(test.preflightEnabled)
            : false
    };
};

let normalizeAnswerIds = (values) => {
    if (!Array.isArray(values)) {
        return [];
    }

    return Array.from(
        new Set(
            values
                .filter(Boolean)
                .map((value) => String(value))
        )
    );
};

let buildRuntimeContext = ({ test, answerSheet = null, resolvedAccommodation = null }) => {
    const snapshotDuration = answerSheet && Number.isFinite(Number(answerSheet.effectiveDurationMinutes)) && Number(answerSheet.effectiveDurationMinutes) > 0
        ? Number(answerSheet.effectiveDurationMinutes)
        : null;
    const effectiveDurationMinutes = snapshotDuration
        || (resolvedAccommodation && Number.isFinite(Number(resolvedAccommodation.effectiveDurationMinutes)) && Number(resolvedAccommodation.effectiveDurationMinutes) > 0
            ? Number(resolvedAccommodation.effectiveDurationMinutes)
            : Number((test && test.duration) || 0));

    const effectiveIntegrityPolicy = hasStoredIntegritySnapshot(answerSheet)
        ? (typeof answerSheet.effectiveIntegrityPolicy.toObject === 'function'
            ? answerSheet.effectiveIntegrityPolicy.toObject()
            : answerSheet.effectiveIntegrityPolicy)
        : (resolvedAccommodation && resolvedAccommodation.effectiveIntegrityPolicy
            ? { ...resolvedAccommodation.effectiveIntegrityPolicy }
            : null);

    const effectiveUiAdjustments = answerSheet && answerSheet.effectiveUiAdjustments
        ? mergeUiAdjustments(
            typeof answerSheet.effectiveUiAdjustments.toObject === 'function'
                ? answerSheet.effectiveUiAdjustments.toObject()
                : answerSheet.effectiveUiAdjustments
        )
        : mergeUiAdjustments(resolvedAccommodation && resolvedAccommodation.effectiveUiAdjustments
            ? resolvedAccommodation.effectiveUiAdjustments
            : null);

    const grantedExtraTimeMinutes = answerSheet && Number.isFinite(Number(answerSheet.grantedExtraTimeMinutes))
        ? Number(answerSheet.grantedExtraTimeMinutes)
        : Number((resolvedAccommodation && resolvedAccommodation.timeAdjustments && resolvedAccommodation.timeAdjustments.extraTimeMinutes) || 0);

    return {
        effectiveDurationMinutes,
        effectiveIntegrityPolicy,
        effectiveUiAdjustments,
        grantedExtraTimeMinutes
    };
};

let getEffectiveDurationMinutes = (test, answerSheet = null, resolvedAccommodation = null) =>
    buildRuntimeContext({ test, answerSheet, resolvedAccommodation }).effectiveDurationMinutes;

let buildEmptyExamMeta = () => ({
    title: '',
    organisation: '',
    duration: 0,
    baseDuration: 0,
    totalQuestions: 0,
    examID: '',
    faceRecognitionEnabled: false,
    integrityMode: 'STANDARD',
    integrityPolicy: integrityPolicy.resolveIntegrityPolicy('STANDARD', {}),
    preflightEnabled: false,
    grantedExtraTimeMinutes: 0,
    uiAdjustments: defaultUiAdjustments()
});

let serializeAnswersForClient = (answers = []) =>
    answers.map((answerDoc) => {
        const plain = typeof answerDoc.toObject === 'function' ? answerDoc.toObject() : answerDoc;
        const chosenOption = normalizeAnswerIds(plain && plain.chosenOption ? plain.chosenOption : []);
        return {
            ...plain,
            chosenOption
        };
    });

let buildExamMeta = (test, runtimeContext = null) => {
    if (!test) {
        return buildEmptyExamMeta();
    }

    const context = runtimeContext || buildRuntimeContext({ test });
    const integrity = resolveTestIntegrity(test, context);
    return {
        title: test.title || '',
        organisation: test.organisation || '',
        duration: Number(context.effectiveDurationMinutes || 0),
        baseDuration: Number(test.duration || 0),
        totalQuestions: Array.isArray(test.questions) ? test.questions.length : 0,
        examID: test.examID || '',
        faceRecognitionEnabled: Boolean(test.faceRecognitionEnabled && integrity.policy.requireFaceVerification),
        integrityMode: integrity.mode,
        integrityPolicy: integrity.policy,
        preflightEnabled: integrity.preflightEnabled,
        grantedExtraTimeMinutes: Number(context.grantedExtraTimeMinutes || 0),
        uiAdjustments: mergeUiAdjustments(context.effectiveUiAdjustments)
    };
};

let buildSessionResponse = ({ test, answerSheet, answers = [], now = Date.now(), resolvedAccommodation = null }) => {
    const runtimeContext = buildRuntimeContext({ test, answerSheet, resolvedAccommodation });
    const examMeta = buildExamMeta(test, runtimeContext);
    const remainingSeconds = answerSheet
        ? sessionResilience.computeRemainingSeconds({
            startTime: answerSheet.startTime,
            durationMinutes: runtimeContext.effectiveDurationMinutes,
            now
        })
        : null;
    const completed = Boolean(answerSheet && answerSheet.completed);
    const startedWriting = Boolean(answerSheet);

    return {
        testbegins: Boolean(test && test.testbegins),
        testconducted: Boolean(test && test.testconducted),
        startedWriting,
        completed,
        pending: completed || remainingSeconds === null ? null : remainingSeconds,
        m_left: completed || remainingSeconds === null ? 0 : Math.floor(remainingSeconds / 60),
        s_left: completed || remainingSeconds === null ? 0 : remainingSeconds % 60,
        faceRecognitionEnabled: examMeta.faceRecognitionEnabled,
        preflightEnabled: examMeta.preflightEnabled,
        integrityMode: examMeta.integrityMode,
        examMeta,
        examState: deriveExamState(test),
        sessionVersion: answerSheet ? Number(answerSheet.sessionVersion || 0) : 0,
        disconnectCount: answerSheet ? Number(answerSheet.disconnectCount || 0) : 0,
        graceWindowUntil: answerSheet && answerSheet.graceWindowUntil ? answerSheet.graceWindowUntil : null,
        completionReason: answerSheet && answerSheet.completionReason ? answerSheet.completionReason : null,
        lastSavedQuestionIndex: answerSheet ? Number(answerSheet.lastSavedQuestionIndex || 0) : 0,
        lastHeartbeatAt: answerSheet && answerSheet.lastHeartbeatAt ? answerSheet.lastHeartbeatAt : null,
        lastClientSyncAt: answerSheet && answerSheet.lastClientSyncAt ? answerSheet.lastClientSyncAt : null,
        sessionConnectionStatus: sessionResilience.getSessionConnectionStatus(answerSheet, now),
        heartbeatIntervalMs: sessionResilience.getHeartbeatIntervalMs(),
        graceWindowMs: sessionResilience.getGraceWindowMs(),
        answers: serializeAnswersForClient(answers)
    };
};

let recordExamFinishedEvent = async ({ testid, traineeid, trigger, message }) => {
    await proctorTimeline.recordSystemEvent({
        testid,
        traineeid,
        sessionId: proctorTimeline.buildSessionId(testid, traineeid),
        eventType: 'EXAM_FINISHED',
        message,
        payload: {
            trigger
        },
        dedupeKey: `session-finish:${testid}:${traineeid}:${trigger}`
    });
};

let markAnswerSheetCompleted = async ({ answerSheet, testid, traineeid, completionReason, trigger, message }) => {
    if (!answerSheet) {
        return null;
    }

    const needsUpdate = !answerSheet.completed || answerSheet.completionReason !== completionReason;
    if (needsUpdate) {
        const completedAt = new Date();
        await AnswersheetModel.updateOne(
            { _id: answerSheet._id },
            {
                $set: {
                    completed: true,
                    completionReason,
                    lastHeartbeatAt: completedAt
                }
            }
        );
        answerSheet.completed = true;
        answerSheet.completionReason = completionReason;
        answerSheet.lastHeartbeatAt = completedAt;
    }

    await recordExamFinishedEvent({
        testid,
        traineeid,
        trigger,
        message
    });

    return answerSheet;
};

let loadActiveSession = async ({ testid, traineeid, includeAnswers = false }) => {
    const query = AnswersheetModel.findOne({ testid, userid: traineeid });
    if (includeAnswers) {
        query.populate('answers');
    }
    return query.exec();
};
let persistAnswerChanges = async ({ testid, userid, entries = [], saveVersion, lastSavedQuestionIndex }) => {
    const [test, answerSheet] = await Promise.all([
        TestPaperModel.findById(testid, { duration: 1, testbegins: 1, testconducted: 1, isResultgenerated: 1, faceRecognitionEnabled: 1, integrityMode: 1, integrityPolicy: 1, preflightEnabled: 1, title: 1, organisation: 1, examID: 1, questions: 1 }),
        loadActiveSession({ testid, traineeid: userid, includeAnswers: true })
    ]);

    if (!test) {
        return { success: false, message: 'Invalid test id.' };
    }

    const gate = canApplyAction(test, ExamActions.TRAINEE_UPDATE_ANSWER);
    if (!gate.ok) {
        return { success: false, message: gate.reason, state: gate.state };
    }

    if (!answerSheet) {
        return { success: false, message: 'Unable to update answer' };
    }

    const now = Date.now();
    if (!answerSheet.completed && sessionResilience.hasSessionTimedOut({
        startTime: answerSheet.startTime,
        durationMinutes: getEffectiveDurationMinutes(test, answerSheet),
        now
    })) {
        await markAnswerSheetCompleted({
            answerSheet,
            testid,
            traineeid: userid,
            completionReason: 'TIMEOUT',
            trigger: 'timeout',
            message: 'Exam ended because the session timer reached zero.'
        });
        return {
            success: false,
            message: 'Time is up!',
            data: buildSessionResponse({ test, answerSheet, answers: answerSheet.answers, now })
        };
    }

    if (!answerSheet.completed && sessionResilience.hasGraceWindowExpired(answerSheet, now)) {
        await markAnswerSheetCompleted({
            answerSheet,
            testid,
            traineeid: userid,
            completionReason: 'AUTO_TERMINATED',
            trigger: 'grace_expired',
            message: 'Exam ended because the connection was unavailable for too long.'
        });
        return {
            success: false,
            message: 'This exam session ended because the connection was unavailable for too long.',
            data: buildSessionResponse({ test, answerSheet, answers: answerSheet.answers, now })
        };
    }

    const currentVersion = Number(answerSheet.sessionVersion || 0);
    const requestedVersion = Number(saveVersion);
    const normalizedVersion = Number.isFinite(requestedVersion) ? requestedVersion : currentVersion;
    if (normalizedVersion < currentVersion) {
        return {
            success: false,
            staleUpdate: true,
            message: 'A newer answer state is already available. Restoring the latest version.',
            data: buildSessionResponse({ test, answerSheet, answers: answerSheet.answers, now })
        };
    }

    const sanitizedEntries = Array.from(
        new Map(
            (Array.isArray(entries) ? entries : [])
                .filter((entry) => entry && entry.qid)
                .map((entry) => [
                    String(entry.qid),
                    {
                        qid: String(entry.qid),
                        newAnswer: normalizeAnswerIds(entry.newAnswer)
                    }
                ])
        ).values()
    );

    if (sanitizedEntries.length > 0) {
        await Promise.all(
            sanitizedEntries.map((entry) =>
                AnswersModel.findOneAndUpdate(
                    { questionid: entry.qid, userid: userid },
                    { chosenOption: entry.newAnswer },
                    { new: true }
                )
            )
        );
    }

    const answerByQuestionId = new Map(
        (answerSheet.answers || []).map((answerDoc) => [String(answerDoc.questionid), answerDoc])
    );
    sanitizedEntries.forEach((entry) => {
        const answerDoc = answerByQuestionId.get(entry.qid);
        if (answerDoc) {
            answerDoc.chosenOption = entry.newAnswer;
        }
    });

    const nowDate = new Date(now);
    const resolvedQuestionIndex = Number.isInteger(Number(lastSavedQuestionIndex))
        ? Number(lastSavedQuestionIndex)
        : Number(answerSheet.lastSavedQuestionIndex || 0);
    const nextSessionVersion = sanitizedEntries.length > 0
        ? Math.max(currentVersion + 1, normalizedVersion)
        : currentVersion;

    await AnswersheetModel.updateOne(
        { _id: answerSheet._id },
        {
            $set: {
                lastClientSyncAt: nowDate,
                lastHeartbeatAt: nowDate,
                graceWindowUntil: sessionResilience.buildGraceWindowUntil(now),
                lastSavedQuestionIndex: resolvedQuestionIndex,
                sessionVersion: nextSessionVersion
            }
        }
    );

    answerSheet.lastClientSyncAt = nowDate;
    answerSheet.lastHeartbeatAt = nowDate;
    answerSheet.graceWindowUntil = sessionResilience.buildGraceWindowUntil(now);
    answerSheet.lastSavedQuestionIndex = resolvedQuestionIndex;
    answerSheet.sessionVersion = nextSessionVersion;

    return {
        success: true,
        message: sanitizedEntries.length > 0 ? 'Answers synced.' : 'Session kept alive.',
        data: buildSessionResponse({ test, answerSheet, answers: answerSheet.answers, now })
    };
};
let traineeenter = async (req, res, next) => {
  req.check('emailid', `Invalid email address.`).isEmail().notEmpty();
  req.check('name', 'This field is required.').notEmpty();
  req.check('contact', 'Invalid contact.').isNumeric({ no_symbols: false });

  const errors = req.validationErrors();
  if (errors) {
    return res.json({ success: false, message: 'Invalid inputs', errors });
  }

  const { name, emailid, contact, organisation, testid, location } = req.body;
  let faceImageUrl = null;
  if (req.file) {
    faceImageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  }

  async function generateUniqueTraineeID() {
    let traineeID;
    let exists = true;
    while (exists) {
      traineeID = Math.floor(100000 + Math.random() * 900000).toString();
      exists = await TraineeEnterModel.exists({ traineeID });
    }
    return traineeID;
  }

  try {
    const test = await TestPaperModel.findOne(
      { _id: testid, isRegistrationavailable: true },
      { title: 1, duration: 1, organisation: 1, examID: 1, faceRecognitionEnabled: 1 }
    );

    if (!test) {
      return res.json({
        success: false,
        message: 'Registration for this test has been closed!'
      });
    }

    const faceRecognitionEnabled = Boolean(test.faceRecognitionEnabled);
    if (faceRecognitionEnabled && !faceImageUrl) {
      return res.json({
        success: false,
        message: 'Face image is required for this exam.'
      });
    }

    const existing = await TraineeEnterModel.findOne({
      $or: [
        { emailid: emailid, testid: testid },
        { contact: contact, testid: testid }
      ]
    });

    if (existing) {
      return res.json({
        success: false,
        message: 'This id has already been registered for this test!'
      });
    }

    const traineeID = await generateUniqueTraineeID();
    const tempdata = new TraineeEnterModel({
      name,
      emailid,
      contact,
      organisation,
      testid,
      location,
      faceImageUrl: faceRecognitionEnabled ? faceImageUrl : null,
      traineeID
    });
    const u = await tempdata.save();

    const testLink = buildTestLink(req, testid, u._id);
    const examID = test.examID;
    const generatedTraineeID = u.traineeID;

    const htmlContent = `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0d1117; color: #c9d1d9; padding: 30px; border: 1px solid #30363d; border-radius: 10px; max-width: 600px; margin: auto;">
                <div style="text-align: center; margin-bottom: 20px;">
                <img src="cid:examshieldlogo" alt="Exam Shield Logo" style="width: 100px;" />
                <h2 style="color: #58a6ff; font-size: 24px;">Exam Shield</h2>
                </div>

                <p>Dear <strong style="color: #ffffff;">${name || 'Candidate'}</strong>,</p>
                <p>You have been successfully registered for the test.</p>

                <h3 style="color: #58a6ff;">Test Details</h3>
                <ul style="list-style: none; padding-left: 0; line-height: 1.6;">
                <li><strong>Title:</strong> ${test.title}</li>
                <li><strong>Duration:</strong> ${test.duration} minutes</li>
                <li><strong>Organisation:</strong> ${test.organisation || 'N/A'}</li>
                </ul>

                <div style="margin: 25px 0; text-align: center; border: 1px solid #30363d; padding: 10px; color: #c9d1d9;">
                <p> This is your id: <strong> ${generatedTraineeID} </strong> </p>
                <p> This is the exam id: <strong> ${examID} </strong> </p>
                </div>

                <h3 style="color: #58a6ff; margin-top: 25px;">Important Instructions</h3>
                <ul style="padding-left: 20px; line-height: 1.6;">
                <li>Use only the secure exam link below to join your exam session.</li>
                <li>Do not share this link with anyone.</li>
                <li>Join a few minutes early and verify your camera and microphone permissions.</li>
                </ul>

                <div style="margin: 25px 0; text-align: center;">
                <a href="${testLink}" style="display: inline-block; background-color: #2ea043; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                    Take the Test
                </a>
                </div>


                <p>If you have any questions, feel free to contact our support.</p>
                <p style="margin-top: 30px;">Best regards,<br/>Exam Shield Team</p>
            </div>
            `;

    sendmail(
      emailid,
      'Registered Successfully - Exam Shield',
      'You\'ve been registered-please view this email in HTML format.',
      htmlContent,
      [
        {
          filename: 'logo.jpg',
          path: path.join(__dirname, '../public/logo.jpg'),
          cid: 'examshieldlogo'
        }
      ]
    ).catch(console.log);

    return res.json({
      success: true,
      message: 'Trainee registered successfully!',
      user: u
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error!' });
  }
};

let getRegistrationConfig = async (req, res, next) => {
  const testid = req.body.testid;
  if (!testid) {
    return res.status(400).json({
      success: false,
      message: 'Test id is required.'
    });
  }

  try {
    const test = await TestPaperModel.findById(testid, {
      _id: 1,
      isRegistrationavailable: 1,
      faceRecognitionEnabled: 1,
      integrityMode: 1,
      integrityPolicy: 1,
      preflightEnabled: 1,
      title: 1,
      organisation: 1
    });

    if (!test) {
      return res.json({
        success: false,
        message: 'Invalid test id.'
      });
    }

    const integrity = resolveTestIntegrity(test);

    return res.json({
      success: true,
      message: 'Registration config fetched.',
      data: {
        testid: String(test._id),
        isRegistrationavailable: Boolean(test.isRegistrationavailable),
        faceRecognitionEnabled: Boolean(test.faceRecognitionEnabled),
        integrityMode: integrity.mode,
        integrityPolicy: integrity.policy,
        preflightEnabled: integrity.preflightEnabled,
        title: test.title || '',
        organisation: test.organisation || ''
      }
    });
  } catch (error) {
    logger.error('fetch_registration_config_failed', {
      testId: testid,
      error: logger.normalizeError(error)
    });
    return res.status(500).json({
      success: false,
      message: 'Unable to fetch registration config.'
    });
  }
};

let correctAnswers = (req,res,next)=>{
    var _id = req.body._id;
    TestPaperModel.find({_id:_id,testconducted:true},{type:0,subjects:0,duration:0,organisation:0,difficulty:0,testbegins:0,status:0,createdBy:0,isRegistrationavailable:0,testconducted:0})
    .populate('questions','body')
    .populate('questions','explanation')
    .populate({
        path:'questions',
        model : QuestionModel,
        select:{'body' : 1, 'quesimg' : 1,'weightage' : 1,'anscount' : 1},
            populate:{
                path:'options',
                model:options
            }
    }).exec(function (err, correctAnswers){
        if(err){
            console.log(err)
            res.status(500).json({
                success : false,
                message : "Unable to fetch details"
            })
        }
        else{
            if(!correctAnswers){
                res.json({
                    success : false,
                    message : 'Invalid test id.'
                })

            }
            else{
                res.json({
                    success : true,
                    message : 'Success',
                    data : correctAnswers
                })

            }
        }

    })
}

let feedback = (req,res,next)=>{
        var userid = req.body.userid;
        var testid = req.body.testid;
        var feedback =  req.body.feedback;
        var rating =  req.body.rating;
       
        var tempdata = FeedbackModel({
            feedback : feedback,
            rating : rating,
            userid : userid,
            testid : testid
        })
        tempdata.save().then(()=>{
            res.json({
                success : true,
                message : `Feedback recorded successfully!`
            })
        }).catch((err)=>{
            console.log(err);
            res.status(500).json({
                success : false,
                message : "Error occured!"
            })
        })
    }

let checkFeedback = (req,res,next)=>{
    var userid = req.body.userid;
    var testid = req.body.testid;
    FeedbackModel.findOne({userid:userid,testid:testid}).then((info)=>{
        if(!info){
            res.json({
                success : true,
                message : 'Feedback is not given by this userid.',
                status : false
            })
        }else{
            res.json({
                success : true,
                message : 'Feedback given',
                status : true
            })
        }
    }).catch((err)=>{
        console.log(err);
        res.status(500).json({
            success : false,
            message : "Error occured!"
        })
     })
}
    


let resendmail = (req, res, next) => {
  const userid = req.body.id;

  TraineeEnterModel.findById(userid, { emailid: 1, testid: 1, name: 1 })
    .then(info => {
      if (!info) {
        return res.json({
          success: false,
          message: "This user has not been registered."
        });
      }

      return TestPaperModel.findById(info.testid).then(test => {
        if (!test) {
          return res.json({
            success: false,
            message: "Test information not found!"
          });
        }

        const testLink = buildTestLink(req, info.testid, info._id);
        // const logoUrl = `${req.protocol}://${req.get('host')}/logo.jpg`;

        const htmlContent = `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0d1117; color: #c9d1d9; padding: 30px; border: 1px solid #30363d; border-radius: 10px; max-width: 600px; margin: auto;">
                <div style="text-align: center; margin-bottom: 20px;">
                <img src="cid:examshieldlogo" alt="Exam Shield Logo" style="width: 100px;" />
                <h2 style="color: #58a6ff; font-size: 24px;">Exam Shield</h2>
                </div>

                <p>Dear <strong style="color: #ffffff;">${info.name || 'Candidate'}</strong>,</p>
                <p>You have been successfully registered for the test.</p>

                <h3 style="color: #58a6ff;">Test Details</h3>
                <ul style="list-style: none; padding-left: 0; line-height: 1.6;">
                <li><strong>Title:</strong> ${test.title}</li>
                <li><strong>Duration:</strong> ${test.duration} minutes</li>
                <li><strong>Organisation:</strong> ${test.organisation || 'N/A'}</li>
                </ul>

                <div style="margin: 25px 0; text-align: center; border: 1px solid #30363d; padding: 10px; color: #c9d1d9;">
                <p> This is your id: <strong> ${info._id} </strong> </p>
                <p> This is the exam id: <strong> ${info.testid} </strong> </p>
                </div>

                <h3 style="color: #58a6ff; margin-top: 25px;">Important Instructions</h3>
                <ul style="padding-left: 20px; line-height: 1.6;">
                <li>Use only the secure exam link below to join your exam session.</li>
                <li>Do not share this link with anyone.</li>
                <li>Join a few minutes early and verify your camera and microphone permissions.</li>
                </ul>

                <div style="margin: 25px 0; text-align: center;">
                <a href="${testLink}" style="display: inline-block; background-color: #2ea043; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                    Take the Test
                </a>
                </div>


                <p style="margin-top: 30px;">Best regards,<br/>Exam Shield Team</p>
            </div>
            `;


        return sendmail(
          info.emailid,
          'Registered Successfully - Exam Shield',
          'You’ve been registered—please view this email in HTML format.',
          htmlContent,
          [
            {
                filename: 'logo.jpg',
                path: path.join(__dirname, '../public/logo.jpg'),
                cid: 'examshieldlogo'    // arbitrary unique id
            }
          ]
        ).then(() => {
          return res.json({
            success: true,
            message: 'Link sent successfully!'
          });
        }).catch(err => {
          console.error(err);
          return res.status(500).json({
            success: false,
            message: 'Email could not be sent.'
          });
        });
      });
    })
    .catch(err => {
      console.error(err);
      res.status(500).json({
        success: false,
        message: 'Server error!'
      });
    });
};



let Testquestions = (req,res,next)=>{
    var testid = req.body.id;
    TestPaperModel.findById(testid,{type:0,title:0,subjects:0,organisation:0,difficulty:0,testbegins:0,status:0,createdBy:0,isRegistrationavailable:0})
   .populate('questions','body')
   .populate({ 
     path: 'questions',
     model: QuestionModel,
     select : {'body': 1,'quesimg' : 1,'weightage':1,'anscount': 1,'duration' : 1},
       populate: {  
           path: 'options',
           select : {'optbody' : 1,'optimg' : 1}
       }

})
   .exec(function (err, Testquestions){
       if(err){
           console.log(err)
           res.status(500).json({
               success : false,
               message : "Unable to fetch details"
           })
       }
       else{
           if(!Testquestions){
               res.json({
                   success : false,
                   message : 'Invalid test id.'
               })

           }
           else{
               res.json({
                   success : true,
                   message : 'Success',
                   data : Testquestions.questions
               })

           }
       }

   })

}

let Answersheet = async (req,res,next)=>{
    var userid = req.body.userid;
    var testid = req.body.testid;

    try{
        const [trainee, test] = await Promise.all([
            TraineeEnterModel.findOne({_id:userid,testid:testid},{_id:1}),
            TestPaperModel.findById(testid,{
                questions:1,
                testbegins:1,
                testconducted:1,
                isResultgenerated:1,
                integrityMode:1,
                integrityPolicy:1,
                preflightEnabled:1,
                faceRecognitionEnabled:1,
                duration:1,
                title:1,
                organisation:1,
                examID:1
            })
        ]);

        if(!trainee || !test){
            return res.json({
                success : false,
                message :'Invalid URL'
            });
        }

        const gate = canApplyAction(test, ExamActions.TRAINEE_START);
        if(!gate.ok){
            return res.json({
                success : false,
                message : gate.reason,
                state : gate.state
            });
        }

        const accommodationProfile = await accommodations.getActiveAccommodationProfile(testid, userid);
        const resolvedAccommodation = accommodations.buildResolvedAccommodation({ test, profile: accommodationProfile });
        const integrity = {
            mode: resolvedAccommodation.integrityMode,
            policy: resolvedAccommodation.effectiveIntegrityPolicy,
            preflightEnabled: resolvedAccommodation.preflightEnabled
        };

        if (integrity.preflightEnabled) {
            const latestPassedRun = await PreflightRunModel.findOne({
                testid: testid,
                traineeid: userid,
                status: "PASSED"
            }).sort({ completedAt: -1, createdAt: -1 });

            if (!latestPassedRun) {
                return res.json({
                    success: false,
                    message: 'Preflight checks are required before entering the exam.',
                    preflightRequired: true
                });
            }
        }

        const existing = await AnswersheetModel.findOne({userid:userid,testid:testid});
        if(existing){
            if (!hasStoredIntegritySnapshot(existing) || !Number(existing.effectiveDurationMinutes || 0)) {
                existing.effectiveDurationMinutes = resolvedAccommodation.effectiveDurationMinutes;
                existing.effectiveIntegrityPolicy = resolvedAccommodation.effectiveIntegrityPolicy;
                existing.effectiveUiAdjustments = resolvedAccommodation.effectiveUiAdjustments;
                existing.grantedExtraTimeMinutes = Number((resolvedAccommodation.timeAdjustments && resolvedAccommodation.timeAdjustments.extraTimeMinutes) || 0);
                await existing.save();
            }

            return res.json({
                success : true,
                message : 'Answer Sheet already exists!',
                data : existing
            });
        }

        var qus = test.questions;
        var answer = qus.map((d)=>(
            {
                questionid:d,
                chosenOption:[],
                userid:userid
            }
        ));
        const ans = await AnswersModel.insertMany(answer);
        const startedAt = Date.now();
        const startedAtDate = new Date(startedAt);
        var tempdata = AnswersheetModel({
            startTime: startedAt,
            questions : qus,
            answers:ans,
            testid:testid,
            userid:userid,
            lastHeartbeatAt: startedAtDate,
            lastClientSyncAt: startedAtDate,
            disconnectCount: 0,
            graceWindowUntil: sessionResilience.buildGraceWindowUntil(startedAt),
            sessionVersion: 0,
            lastSavedQuestionIndex: 0,
            effectiveDurationMinutes: resolvedAccommodation.effectiveDurationMinutes,
            effectiveIntegrityPolicy: resolvedAccommodation.effectiveIntegrityPolicy,
            effectiveUiAdjustments: resolvedAccommodation.effectiveUiAdjustments,
            grantedExtraTimeMinutes: Number((resolvedAccommodation.timeAdjustments && resolvedAccommodation.timeAdjustments.extraTimeMinutes) || 0)
        });
        await tempdata.save();
        await proctorTimeline.recordSystemEvent({
            testid,
            traineeid: userid,
            sessionId: proctorTimeline.buildSessionId(testid, userid),
            eventType: 'EXAM_STARTED',
            message: 'Candidate entered the exam workspace.',
            payload: {
                trigger: 'candidate_start'
            },
            dedupeKey: 'session-start:' + testid + ':' + userid
        });
        return res.json({
            success : true,
            message : 'Test has started!'
        });
    }catch(err){
        logger.error('create_answersheet_failed', {
            userId: userid,
            testId: testid,
            error: logger.normalizeError(err)
        });
        res.status(500).json({
            success : false,
            message : "Unable to fetch details"
        });
    }
}
let flags = async (req,res,next)=>{
    var testid = req.body.testid;
    var traineeid = req.body.traineeid;

    try {
        const [answerSheet, trainee, test, accommodationProfile] = await Promise.all([
            loadActiveSession({ testid, traineeid }),
            TraineeEnterModel.findOne({_id : traineeid , testid : testid},{_id : 1}),
            TestPaperModel.findById(testid,{
                testbegins : 1,
                testconducted : 1,
                faceRecognitionEnabled: 1,
                integrityMode: 1,
                integrityPolicy: 1,
                preflightEnabled: 1,
                duration : 1,
                title : 1,
                organisation : 1,
                examID : 1,
                questions : 1,
                isResultgenerated: 1
            }),
            accommodations.getActiveAccommodationProfile(testid, traineeid)
        ]);

        if(!trainee || !test){
            return res.json({
                success : false,
                message : 'Invalid URL!'
            });
        }

        const resolvedAccommodation = accommodations.buildResolvedAccommodation({
            test,
            profile: accommodationProfile
        });

        let activeSheet = answerSheet;
        const now = Date.now();
        if (activeSheet && !activeSheet.completed && sessionResilience.hasSessionTimedOut({
            startTime: activeSheet.startTime,
            durationMinutes: getEffectiveDurationMinutes(test, activeSheet, resolvedAccommodation),
            now
        })) {
            activeSheet = await markAnswerSheetCompleted({
                answerSheet: activeSheet,
                testid,
                traineeid,
                completionReason: 'TIMEOUT',
                trigger: 'timeout',
                message: 'Exam ended because the session timer reached zero.'
            });
        }

        if (activeSheet && !activeSheet.completed && sessionResilience.hasGraceWindowExpired(activeSheet, now)) {
            activeSheet = await markAnswerSheetCompleted({
                answerSheet: activeSheet,
                testid,
                traineeid,
                completionReason: 'AUTO_TERMINATED',
                trigger: 'grace_expired',
                message: 'Exam ended because the connection was unavailable for too long.'
            });
        }

        const sessionData = buildSessionResponse({ test, answerSheet: activeSheet, now: Date.now(), resolvedAccommodation });
        return res.json({
            success : true,
            message : 'Successful',
            data : {
                testbegins : test.testbegins,
                testconducted: test.testconducted,
                startedWriting: sessionData.startedWriting,
                pending : sessionData.pending,
                completed : sessionData.completed,
                faceRecognitionEnabled: sessionData.faceRecognitionEnabled,
                preflightEnabled: sessionData.preflightEnabled,
                integrityMode: sessionData.integrityMode,
                examMeta : sessionData.examMeta,
                examState: sessionData.examState,
                sessionVersion: sessionData.sessionVersion,
                disconnectCount: sessionData.disconnectCount,
                graceWindowUntil: sessionData.graceWindowUntil,
                completionReason: sessionData.completionReason,
                lastSavedQuestionIndex: sessionData.lastSavedQuestionIndex,
                lastHeartbeatAt: sessionData.lastHeartbeatAt,
                sessionConnectionStatus: sessionData.sessionConnectionStatus,
                heartbeatIntervalMs: sessionData.heartbeatIntervalMs,
                graceWindowMs: sessionData.graceWindowMs
            }
        });
    } catch (error) {
        logger.error('fetch_trainee_flags_failed', {
            testId: testid,
            traineeId: traineeid,
            error: logger.normalizeError(error)
        });
        return res.status(500).json({
            success : false,
            message : "Unable to fetch details"
        });
    }
}
let TraineeDetails = (req,res,next)=>{
    // console.log('TraineeDetails called with body:', req.body);
    var traineeid = req.body._id;
    TraineeEnterModel.findById(traineeid,{name:1,emailid:1,contact:1,faceImageUrl:1}).then((info)=>{
        if(info){
            res.json({
                success : true,
                message : 'Trainee details',
                data : info
            })
        }else{
            res.json({
                success : false,
                message : 'This trainee does not exists'
            })
        }
    }).catch((error)=>{
        res.status(500).json({
            success : false,
            message : "Unable to fetch details"
        })
    })
}

let chosenOptions = async (req,res,next)=>{
    var testid = req.body.testid;
    var userid = req.body.userid;

    try {
        const answersheet = await AnswersheetModel.findOne(
            {testid : testid,userid : userid},
            {answers : 1, sessionVersion: 1, lastSavedQuestionIndex: 1, lastClientSyncAt: 1}
        )
        .populate('answers')
        .exec();

        if(!answersheet){
            return res.json({
                success : false,
                message : 'Answersheet does not exist'
            });
        }

        const data = typeof answersheet.toObject === 'function' ? answersheet.toObject() : answersheet;
        data.answers = serializeAnswersForClient(data.answers || []);
        return res.json({
            success : true,
            message : 'Chosen Options',
            data
        });
    } catch (error) {
        logger.error('fetch_chosen_options_failed', {
            userId: userid,
            testId: testid,
            error: logger.normalizeError(error)
        });
        return res.status(500).json({
            success : false,
            message : 'Answersheet does not exist'
        });
    }
}

let sessionHeartbeat = async (req,res,next)=>{
    const testid = req.body.testid;
    const userid = req.body.userid;
    const activeQuestionIndex = Number(req.body.activeQuestionIndex);

    try {
        const [test, answerSheet] = await Promise.all([
            TestPaperModel.findById(testid,{ duration: 1, testbegins: 1, testconducted: 1, isResultgenerated: 1, faceRecognitionEnabled: 1, integrityMode: 1, integrityPolicy: 1, preflightEnabled: 1, title: 1, organisation: 1, examID: 1, questions: 1 }),
            loadActiveSession({ testid, traineeid: userid })
        ]);

        if (!test || !answerSheet) {
            return res.json({
                success: false,
                message: 'Session not found.'
            });
        }

        if (!answerSheet.completed && sessionResilience.hasSessionTimedOut({
            startTime: answerSheet.startTime,
            durationMinutes: getEffectiveDurationMinutes(test, answerSheet),
            now: Date.now()
        })) {
            await markAnswerSheetCompleted({
                answerSheet,
                testid,
                traineeid: userid,
                completionReason: 'TIMEOUT',
                trigger: 'timeout',
                message: 'Exam ended because the session timer reached zero.'
            });
            const timedOut = buildSessionResponse({ test, answerSheet, now: Date.now() });
            return res.json({
                success: false,
                message: 'Time is up!',
                data: timedOut
            });
        }

        const now = Date.now();
        if (!answerSheet.completed && sessionResilience.hasGraceWindowExpired(answerSheet, now)) {
            await markAnswerSheetCompleted({
                answerSheet,
                testid,
                traineeid: userid,
                completionReason: 'AUTO_TERMINATED',
                trigger: 'grace_expired',
                message: 'Exam ended because the connection was unavailable for too long.'
            });
            const expired = buildSessionResponse({ test, answerSheet, now });
            return res.json({
                success: false,
                message: 'This exam session ended because the connection was unavailable for too long.',
                data: expired
            });
        }

        const heartbeatAgeMs = sessionResilience.getHeartbeatAgeMs(answerSheet, now);
        const wasDisconnected = heartbeatAgeMs !== null && heartbeatAgeMs > sessionResilience.getHeartbeatStaleMs();
        const nowDate = new Date(now);
        const nextQuestionIndex = Number.isInteger(activeQuestionIndex)
            ? activeQuestionIndex
            : Number(answerSheet.lastSavedQuestionIndex || 0);
        const nextDisconnectCount = wasDisconnected
            ? Number(answerSheet.disconnectCount || 0) + 1
            : Number(answerSheet.disconnectCount || 0);
        const nextGraceWindow = sessionResilience.buildGraceWindowUntil(now);

        await AnswersheetModel.updateOne(
            { _id: answerSheet._id },
            {
                $set: {
                    lastHeartbeatAt: nowDate,
                    graceWindowUntil: nextGraceWindow,
                    lastSavedQuestionIndex: nextQuestionIndex,
                    disconnectCount: nextDisconnectCount
                }
            }
        );

        answerSheet.lastHeartbeatAt = nowDate;
        answerSheet.graceWindowUntil = nextGraceWindow;
        answerSheet.lastSavedQuestionIndex = nextQuestionIndex;
        answerSheet.disconnectCount = nextDisconnectCount;

        return res.json({
            success: true,
            message: wasDisconnected ? 'Session restored.' : 'Heartbeat acknowledged.',
            data: {
                ...buildSessionResponse({ test, answerSheet, now }),
                resumedAfterDisconnect: wasDisconnected,
                serverTime: now
            }
        });
    } catch (error) {
        logger.error('session_heartbeat_failed', {
            userId: userid,
            testId: testid,
            error: logger.normalizeError(error)
        });
        return res.status(500).json({
            success: false,
            message: 'Unable to keep the session active.'
        });
    }
}

let resumeSession = async (req,res,next)=>{
    const testid = req.body.testid;
    const userid = req.body.userid;

    try {
        const [test, answerSheet] = await Promise.all([
            TestPaperModel.findById(testid,{ duration: 1, testbegins: 1, testconducted: 1, isResultgenerated: 1, faceRecognitionEnabled: 1, integrityMode: 1, integrityPolicy: 1, preflightEnabled: 1, title: 1, organisation: 1, examID: 1, questions: 1 }),
            loadActiveSession({ testid, traineeid: userid, includeAnswers: true })
        ]);

        if (!test || !answerSheet) {
            return res.json({
                success: false,
                message: 'Session not found.'
            });
        }

        if (!answerSheet.completed && sessionResilience.hasSessionTimedOut({
            startTime: answerSheet.startTime,
            durationMinutes: getEffectiveDurationMinutes(test, answerSheet),
            now: Date.now()
        })) {
            await markAnswerSheetCompleted({
                answerSheet,
                testid,
                traineeid: userid,
                completionReason: 'TIMEOUT',
                trigger: 'timeout',
                message: 'Exam ended because the session timer reached zero.'
            });
        }

        const now = Date.now();
        if (!answerSheet.completed && sessionResilience.hasGraceWindowExpired(answerSheet, now)) {
            await markAnswerSheetCompleted({
                answerSheet,
                testid,
                traineeid: userid,
                completionReason: 'AUTO_TERMINATED',
                trigger: 'grace_expired',
                message: 'Exam ended because the connection was unavailable for too long.'
            });
            return res.json({
                success: false,
                message: 'This exam session ended because the connection was unavailable for too long.',
                data: {
                    ...buildSessionResponse({ test, answerSheet, answers: answerSheet.answers, now }),
                    resumedAfterDisconnect: false,
                    serverTime: now
                }
            });
        }

        const heartbeatAgeMs = sessionResilience.getHeartbeatAgeMs(answerSheet, now);
        const resumedAfterDisconnect = heartbeatAgeMs !== null && heartbeatAgeMs > sessionResilience.getHeartbeatStaleMs();
        const nowDate = new Date(now);
        const nextDisconnectCount = resumedAfterDisconnect
            ? Number(answerSheet.disconnectCount || 0) + 1
            : Number(answerSheet.disconnectCount || 0);
        const nextGraceWindow = sessionResilience.buildGraceWindowUntil(now);

        await AnswersheetModel.updateOne(
            { _id: answerSheet._id },
            {
                $set: {
                    lastHeartbeatAt: nowDate,
                    graceWindowUntil: nextGraceWindow,
                    disconnectCount: nextDisconnectCount
                }
            }
        );

        answerSheet.lastHeartbeatAt = nowDate;
        answerSheet.graceWindowUntil = nextGraceWindow;
        answerSheet.disconnectCount = nextDisconnectCount;

        return res.json({
            success: true,
            message: 'Session restored.',
            data: {
                ...buildSessionResponse({ test, answerSheet, answers: answerSheet.answers, now }),
                resumedAfterDisconnect,
                serverTime: now
            }
        });
    } catch (error) {
        logger.error('session_resume_failed', {
            userId: userid,
            testId: testid,
            error: logger.normalizeError(error)
        });
        return res.status(500).json({
            success: false,
            message: 'Unable to restore the exam session.'
        });
    }
}

let batchSaveAnswers = async (req,res,next)=>{
    const testid = req.body.testid;
    const userid = req.body.userid;

    try {
        const response = await persistAnswerChanges({
            testid,
            userid,
            entries: req.body.answers,
            saveVersion: req.body.saveVersion,
            lastSavedQuestionIndex: req.body.lastSavedQuestionIndex
        });

        if (response.success) {
            return res.json(response);
        }

        const statusCode = response.staleUpdate ? 409 : 200;
        return res.status(statusCode).json(response);
    } catch (error) {
        logger.error('batch_save_answers_failed', {
            userId: userid,
            testId: testid,
            error: logger.normalizeError(error)
        });
        return res.status(500).json({
            success: false,
            message: 'Unable to save answers right now.'
        });
    }
}
let UpdateAnswers = async (req,res,next)=>{
    var testid = req.body.testid;
    var userid = req.body.userid;
    var questionid = req.body.qid;
    var newAnswer = req.body.newAnswer;

    try{
        const response = await persistAnswerChanges({
            testid,
            userid,
            entries: [
                {
                    qid: questionid,
                    newAnswer
                }
            ],
            saveVersion: req.body.saveVersion,
            lastSavedQuestionIndex: req.body.lastSavedQuestionIndex
        });

        if(response.success){
            return res.json({
                success : true,
                message : 'Answer Updated',
                data : response.data
            });
        }

        const statusCode = response.staleUpdate ? 409 : 200;
        return res.status(statusCode).json(response);
    }catch(error){
        logger.error('update_answer_failed', {
            userId: userid,
            testId: testid,
            questionId: questionid,
            error: logger.normalizeError(error)
        });
        res.status(500).json({
            success : false,
            message : "Error occured!"
        });
    }
}
let EndTest = async (req,res,next)=>{
    var testid = req.body.testid;
    var userid = req.body.userid;

    try{
        const test = await TestPaperModel.findById(testid,{testbegins:1,testconducted:1,isResultgenerated:1, duration:1, faceRecognitionEnabled:1, integrityMode:1, integrityPolicy:1, preflightEnabled:1, title:1, organisation:1, examID:1, questions:1});
        if(!test){
            return res.json({
                success : false,
                message : 'Invalid test id.'
            });
        }

        const gate = canApplyAction(test, ExamActions.TRAINEE_SUBMIT);
        if(!gate.ok){
            return res.json({
                success : false,
                message : gate.reason,
                state : gate.state
            });
        }

        const info = await loadActiveSession({ testid, traineeid: userid });
        if(info){
            await markAnswerSheetCompleted({
                answerSheet: info,
                testid,
                traineeid: userid,
                completionReason: 'SUBMITTED',
                trigger: 'candidate_submit',
                message: 'Candidate submitted the exam.'
            });
            return res.json({
                success : true,
                message : 'Your answers have been submitted'
            });
        }

        return res.json({
            success : false,
            message : 'Unable to submit answers!'
        });
    }catch(error){
        logger.error('end_test_failed', {
            userId: userid,
            testId: testid,
            error: logger.normalizeError(error)
        });
        res.status(500).json({
            success : false,
            message : "Error occured!"
        });
    }
}
 
let getQuestion = (req,res,next)=>{
    
        let qid = req.body.qid;
        
        QuestionModel.find({_id : qid , status : 1},{body : 1, options : 1,quesimg : 1})
        .populate({ 
                path: 'options',
                model: options,
                select : {'optbody' : 1,'optimg' : 1}
            
    })
        .exec(function (err, question) {
            if (err){
                console.log(err)
                res.status(500).json({
                    success : false,
                    message : "Unable to fetch data"
                })
            }
            else{
                if(question.length===0){
                    res.json({
                        success : false,
                        message : `No such question exists`,
                    })
                }
                else{
                    res.json({
                        success : true,
                        message : `Success`,
                        data : question
                    })
                }   
            }
        })        
    }


module.exports = {traineeenter,getRegistrationConfig,feedback,checkFeedback,resendmail,correctAnswers,Answersheet,flags,chosenOptions,sessionHeartbeat,resumeSession,batchSaveAnswers,TraineeDetails,Testquestions,UpdateAnswers,EndTest,getQuestion}
















