let QuestionModel = require("../models/questions");
let TestPaperModel = require("../models/testpaper");
let TraineeEnterModel = require("../models/trainee");
let tool = require("./tool");
let options = require("../models/option");
let SubjectModel = require("../models/subject");
let result  =require("../services/excel").result;
let ResultModel = require("../models/results");
let AnswersheetModel = require("../models/answersheet");
let logger = require("./logger");
const { canApplyAction, ExamActions, deriveExamState } = require("./examStateMachine");
const integrityPolicy = require("./integrityPolicy");
const proctorTimeline = require("./proctorTimeline");
const sessionResilience = require("./sessionResilience");
const generateResults = require("./generateResults");
const psychometrics = require("./psychometrics");


let finalizeCandidateSession = async ({ answerSheet, testid, traineeid, completionReason, trigger, message }) => {
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

    return answerSheet;
};

let createEditTest = (req,res,next)=>{
    var _id = req.body._id || null;
    if(req.user.type==='TRAINER'){
    req.check('title', 'enter title').notEmpty();
    req.check('questions', 'enter questions').notEmpty();

    var errors = req.validationErrors()
    if(errors){
        res.json({
            success : false,
            message : 'Invalid inputs',
            errors : errors
        })
    }
    else {
        var title =  req.body.title;
        var questions = req.body.questions;
        if(_id!=null){
            var updatePayload = {
                title : title,
                questions : questions
            };

            if (req.body.integrityMode !== undefined) {
                const nextMode = integrityPolicy.normalizeIntegrityMode(req.body.integrityMode);
                updatePayload.integrityMode = nextMode;
                updatePayload.integrityPolicy = integrityPolicy.resolveIntegrityPolicy(
                    nextMode,
                    req.body.integrityPolicy || {}
                );
            }

            if (typeof req.body.preflightEnabled === 'boolean') {
                updatePayload.preflightEnabled = req.body.preflightEnabled;
            }

            TestPaperModel.findOneAndUpdate({
                _id : _id,
            },
            updatePayload).then(()=>{
                res.json({
                    success: true,
                    message :  "Testpaper has been updated!"
                })
            }).catch((err)=>{
                res.status(500).json({
                    success : false,
                    message : "Unable to update testpaper!"
            })
        })
      }
    else{
        var title =  req.body.title;
        var questionsid =  req.body.questions;
        var difficulty =  req.body.difficulty || null;
        var organisation = req.body.organisation;
        var duration = req.body.duration;
        var subjects = req.body.subjects;
        var integrityMode = integrityPolicy.normalizeIntegrityMode(req.body.integrityMode);
        var integrityPolicySnapshot = integrityPolicy.resolveIntegrityPolicy(
            integrityMode,
            req.body.integrityPolicy || {}
        );
        var preflightEnabled = typeof req.body.preflightEnabled === 'boolean'
            ? req.body.preflightEnabled
            : true;
        async function generateUniqueExamID() {
            let examID;
            let exists = true;
            while (exists) {
                examID = Math.floor(100000 + Math.random() * 900000).toString();
                exists = await TestPaperModel.exists({ examID: examID });
            }
            return examID;
        }
        examID = generateUniqueExamID();

            TestPaperModel.findOne({ title : title,testbegins : 0 },{status:0})
            .then(async (info)=>{
                if(!info){
                    let examID = await  generateUniqueExamID();
                    var tempdata = TestPaperModel({
                        title : title,
                        questions : questionsid,
                        difficulty : difficulty,
                        organisation : organisation,
                        duration :duration,
                        createdBy : req.user._id,
                        subjects : subjects,
                        examID : examID,
                        integrityMode : integrityMode,
                        integrityPolicy : integrityPolicySnapshot,
                        preflightEnabled : preflightEnabled,
                    
                    })
                    tempdata.save().then((d)=>{
                        res.json({
                            success : true,
                            message : `New testpaper created successfully!`,
                            testid : d._id
                        })
                    }).catch((err)=>{
                        console.log(err);
                        res.status(500).json({
                            success : false,
                            message : "Unable to create new testpaper!"
                        })
                    })
                }
                else{
                    res.json({
                        success : false,
                        message : `This testpaper already exists!`
                    })
                }   

            })
        
        }
     }
  }
    else{
        res.status(401).json({
            success : false,
            message : "Permissions not granted!"
        })

    }
}

let getSingletest = (req,res,next)=>{
    let id = req.params._id;
    console.log(id);
    TestPaperModel.find({_id: id,status : 1},{createdAt: 0, updatedAt : 0,status : 0})
    .populate('createdBy', 'name')
    .populate('questions' , 'body')
    .populate({
        path: 'subjects',
        model : SubjectModel
    })
    .populate({ path: 'questions', 
        populate: {  
            path: 'options',
            model: options,
        }
    })
    .exec(function (err, testpaper) {
        if (err){
            console.log(err)
            res.status(500).json({
                success : false,
                message : "Unable to fetch data"
            })
        }
        else{
            res.json({
                success : true,
                message : `Success`,
                data : testpaper
            })   
        }
    })        
}

let getAlltests = (req,res,next)=>{
    if(req.user.type==='TRAINER'){
        const body = req.body || {};
        const title = typeof body.title === 'string' ? body.title.trim() : '';
        const query = { createdBy: req.user._id, status: 1 };

        if (title) {
            query.title = { $regex: title, $options: 'i' };
        }

            TestPaperModel.find(query,{status : 0})
            .populate('questions' , 'body')
            .populate({
                path: 'subjects',
                model : SubjectModel
            })
            .populate({ path: 'questions', 
            populate: {  
                path: 'options',
                model: options
            }

        })
        
            .exec(function (err, testpaper) {
                if (err){
                    console.log(err)
                    res.status(500).json({
                        success : false,
                        message : "Unable to fetch data"
                    })
                }
                else{
                    res.json({
                        success : true,
                        message : `Success`,
                        data : testpaper
                    })
                }
            })        
        
        }
    else{
        res.status(401).json({
            success : false,
            message : "Permissions not granted!"
        })
    } 
}   

let deleteTest = (req,res,next)=>{
    if(req.user.type==='TRAINER'){
        var _id =  req.body._id;
        TestPaperModel.deleteOne({
            _id : _id
        }).then(()=>{
            res.json({
                success: true,
                message :  "Test has been deleted"
            })
        }).catch((err)=>{
            res.status(500).json({
                success : false,
                message : "Unable to delete test"
            })
        })
    }
    else{
        res.status(401).json({
            success : false,
            message : "Permissions not granted!"
        })
    } 
}
let TestDetails = (req,res,next)=>{
    if(req.user.type === 'TRAINER'){
        let testid = req.body.id;
        TestPaperModel.findOne({_id:testid,createdBy : req.user._id},{isResultgenerated:0,isRegistrationavailable:0,createdBy:0,status:0,testbegins:0,questions : 0})
        .populate('subjects', 'topic')
        .exec(function(err,TestDetails){
                if(err){
                    console.log(err)
                    res.status(500).json({
                        success : false,
                        message : "Unable to fetch details"
                    })
                }else{
                    if(!TestDetails){
                        res.json({
                            success : false,
                            message : 'Invalid test id.'
                        })
                    }else{
                        res.json({
                            success : true,
                            message : 'Success',
                            data : TestDetails
                        })

                    }
                }
        })
    }else{
        res.status(401).json({
            success : false,
            message : "Permissions not granted!"
        })
    }
}

let basicTestdetails = (req,res,next)=>{
    if(req.user.type==='TRAINER'){
        let testid = req.body.id;
        TestPaperModel.findById(testid,{questions:0})
        .populate('createdBy', 'name')
        .populate('subjects', 'topic')
        .exec(function (err, basicTestdetails){
            if(err){
                console.log(err)
                res.status(500).json({
                    success : false,
                    message : "Unable to fetch details"
                })
            }
            else{
                if(!basicTestdetails){
                    res.json({
                        success : false,
                        message : 'Invalid test id.'
                    })

                }
                else{
                    res.json({
                        success : true,
                        message : 'Success',
                        data : {
                            ...basicTestdetails.toObject(),
                            examState: deriveExamState(basicTestdetails)
                        }
                    })

                }
            }

        })
    }
    else{
        res.status(401).json({
            success : false,
            message : "Permissions not granted!"
        })
    }
    

}

 let getTestquestions = (req,res,next)=>{
     if(req.user.type==="TRAINER"){
         var testid = req.body.id;
         TestPaperModel.findById(testid,{title:0,subjects:0,duration:0,organisation:0,difficulty:0,testbegins:0,status:0,createdBy:0,isRegistrationavailable:0})
        .populate('questions','body')
        .populate({ 
          path: 'questions',
          model: QuestionModel,
          select : {'body': 1,'quesimg' : 1,'weightage':1,'anscount': 1},
            populate: {  
                path: 'options',
                model: options
            }

    })
        .exec(function (err, getTestquestions){
            if(err){
                console.log(err)
                res.status(500).json({
                    success : false,
                    message : "Unable to fetch details"
                })
            }
            else{
                if(!getTestquestions){
                    res.json({
                        success : false,
                        message : 'Invalid test id.'
                    })

                }
                else{
                    res.json({
                        success : true,
                        message : 'Success',
                        data : getTestquestions.questions
                    })

                }
            }

        })
    }
    else{
        res.status(401).json({
            success : false,
            message : "Permissions not granted!"
        })
    }
     
 }

 let getCandidateDetails = async (req,res,next)=>{
    if(req.user.type!=="TRAINER"){
        return res.status(401).json({
            success : false,
            message : "Permissions not granted!"
        })
    }

    try{
        var testid = req.body.testid;
        await generateResults.ensureResultsForTest(testid);
        const candidateDetails = await ResultModel.find({testid : testid},{score : 1, userid : 1})
            .populate('userid');

        return res.json({
            success : true,
            message:'Candidate details',
            data : candidateDetails
        });
    }catch(err){
        console.log(err)
        return res.status(500).json({
            success : false,
            message : "Unable to fetch details"
        })
    }
 }


 let getCandidates = async (req,res,next)=>{
    if(req.user.type!=="TRAINER"){
        return res.status(401).json({
            success : false,
            message : "Permissions not granted!"
        })
    }

    var testid = req.body.id;
    try{
        const test = await TestPaperModel.findOne(
            {_id:testid,createdBy:req.user._id},
            {duration:1,testbegins:1,testconducted:1,isResultgenerated:1}
        );

        if(!test){
            return res.json({
                success : false,
                message : "Invalid test id."
            });
        }

        const candidates = await TraineeEnterModel.find({testid:testid},{testid:0});
        if(!candidates.length){
            return res.json({
                success: true,
                message :  "success",
                data : []
            });
        }

        const candidateIds = candidates.map((candidate)=>candidate._id);
        const sheets = await AnswersheetModel.find(
            {testid:testid, userid: {$in: candidateIds}},
            {_id:1,userid:1,startTime:1,completed:1,lastHeartbeatAt:1,graceWindowUntil:1,disconnectCount:1,completionReason:1,lastSavedQuestionIndex:1}
        );

        const now = Date.now();
        const sheetByUser = new Map();
        const completionUpdates = [];

        sheets.forEach((sheet)=>{
            const userKey = String(sheet.userid);
            const hasTimedOut = !sheet.completed && sessionResilience.hasSessionTimedOut({
                startTime: sheet.startTime,
                durationMinutes: test.duration,
                now
            });
            const graceExpired = !hasTimedOut && !sheet.completed && sessionResilience.hasGraceWindowExpired(sheet, now);

            if (hasTimedOut) {
                completionUpdates.push(finalizeCandidateSession({
                    answerSheet: sheet,
                    testid,
                    traineeid: sheet.userid,
                    completionReason: 'TIMEOUT',
                    trigger: 'timeout',
                    message: 'Exam ended because the session timer reached zero.'
                }));
            } else if (graceExpired) {
                completionUpdates.push(finalizeCandidateSession({
                    answerSheet: sheet,
                    testid,
                    traineeid: sheet.userid,
                    completionReason: 'AUTO_TERMINATED',
                    trigger: 'grace_expired',
                    message: 'Exam ended because the connection was unavailable for too long.'
                }));
            }

            sheetByUser.set(userKey, sheet);
        });

        if (completionUpdates.length) {
            await Promise.all(completionUpdates);
        }

        const data = candidates.map((candidate)=>{
            const sheet = sheetByUser.get(String(candidate._id));
            const startedWriting = Boolean(sheet);
            const completed = Boolean(sheet && sheet.completed);
            const pendingSeconds = sheet && !completed
                ? sessionResilience.computeRemainingSeconds({ startTime: sheet.startTime, durationMinutes: test.duration, now })
                : null;

            let status = 'not_started';
            if (completed) status = 'finished';
            else if (startedWriting) status = 'in_progress';

            return {
                ...candidate.toObject(),
                examProgress: {
                    status,
                    startedWriting,
                    completed,
                    pendingSeconds,
                    connectionStatus: sessionResilience.getSessionConnectionStatus(sheet, now),
                    disconnectCount: sheet ? Number(sheet.disconnectCount || 0) : 0,
                    lastHeartbeatAt: sheet && sheet.lastHeartbeatAt ? sheet.lastHeartbeatAt : null,
                    graceWindowUntil: sheet && sheet.graceWindowUntil ? sheet.graceWindowUntil : null,
                    completionReason: sheet && sheet.completionReason ? sheet.completionReason : null,
                    lastSavedQuestionIndex: sheet ? Number(sheet.lastSavedQuestionIndex || 0) : 0
                }
            };
        });

        return res.json({
            success: true,
            message :  "success",
            data
        });
    }catch(err){
        logger.error('get_candidates_failed', {
            testId: testid,
            trainerId: req.user && req.user._id,
            error: logger.normalizeError(err)
        });
        return res.status(500).json({
            success : false,
            message : "Unable to get candidates!"
        });
    }
 }

let beginTest = async (req,res,next)=>{
    if(req.user.type!=="TRAINER"){
        return res.status(401).json({
            success : false,
            message : "Permissions not granted!"
        });
    }

    var id = req.body.id;
    try{
        const test = await TestPaperModel.findOne({_id:id,createdBy:req.user._id},{testbegins:1,testconducted:1,isResultgenerated:1,isRegistrationavailable:1,faceRecognitionEnabled:1});
        if(!test){
            return res.json({
                success : false,
                message : "Invalid test id."
            });
        }

        const gate = canApplyAction(test, ExamActions.START_EXAM);
        if(!gate.ok){
            return res.json({
                success : false,
                message : gate.reason,
                state : gate.state
            });
        }

        const data = await TestPaperModel.findOneAndUpdate(
            {_id:id,createdBy:req.user._id},
            {testbegins:true,isRegistrationavailable:false,isResultgenerated:false},
            {new: true}
        );

        return res.json({
            success : true,
            message : 'Exam has been started.',
            data : {
                isRegistrationavailable: data.isRegistrationavailable,
                testbegins : data.testbegins,
                testconducted : data.testconducted,
                isResultgenerated : data.isResultgenerated,
                faceRecognitionEnabled: Boolean(data.faceRecognitionEnabled),
                integrityMode: integrityPolicy.normalizeIntegrityMode(data.integrityMode),
                integrityPolicy: integrityPolicy.resolveIntegrityPolicy(
                    data.integrityMode,
                    data.integrityPolicy || {}
                ),
                preflightEnabled: Boolean(data.preflightEnabled),
                examState: deriveExamState(data)
            }
        });
    }catch(err){
        logger.error('begin_test_failed', { testId: id, trainerId: req.user && req.user._id, error: logger.normalizeError(err) });
        return res.status(500).json({
            success : false,
            message : "Server Error"
        });
    }
 }

let endTest = async (req,res,next)=>{
    if(req.user.type!=="TRAINER"){
        return res.status(401).json({
            success : false,
            message : "Permissions not granted!"
        });
    }

    var id = req.body.id;
    try{
        const test = await TestPaperModel.findOne({_id:id,createdBy:req.user._id},{testbegins:1,testconducted:1,isResultgenerated:1,isRegistrationavailable:1,faceRecognitionEnabled:1});
        if(!test){
            return res.json({
                success : false,
                message : "Invalid test id."
            });
        }

        const gate = canApplyAction(test, ExamActions.END_EXAM);
        if(!gate.ok){
            return res.json({
                success : false,
                message : gate.reason,
                state : gate.state
            });
        }

        const info = await TestPaperModel.findOneAndUpdate(
            {_id:id,createdBy:req.user._id},
            {testbegins:false,testconducted:true,isResultgenerated:true,isRegistrationavailable:false},
            {new: true}
        );

        await AnswersheetModel.updateMany({ testid: id, completed: false }, { completed: true, completionReason: 'FORCED_BY_TRAINER', lastHeartbeatAt: new Date() });

        const candidates = await TraineeEnterModel.find({ testid: id }, { _id: 1 });
        await Promise.all(
            candidates.map((candidate) =>
                proctorTimeline.recordSystemEvent({
                    testid: id,
                    traineeid: candidate._id,
                    sessionId: proctorTimeline.buildSessionId(id, candidate._id),
                    eventType: 'EXAM_FINISHED',
                    message: 'Exam was ended by the examiner.',
                    payload: {
                        trigger: 'trainer_end'
                    },
                    dedupeKey: `session-finish:${id}:${candidate._id}:trainer_end`
                }).catch((error) => {
                    logger.warn('trainer_finish_event_failed', {
                        testId: id,
                        traineeId: candidate._id,
                        error: logger.normalizeError(error)
                    });
                })
            )
        );

        await result(id,MaxMarks);
        await psychometrics.computeAndPersistSnapshot({ testid: id }).catch((error) => {
            logger.warn('psychometric_snapshot_after_end_failed', {
                testId: id,
                trainerId: req.user && req.user._id,
                error: logger.normalizeError(error)
            });
        });

        return res.json({
            success : true,
            message : 'The exam has ended.',
            data : {
                isRegistrationavailable : info.isRegistrationavailable,
                testbegins : info.testbegins,
                testconducted : info.testconducted,
                isResultgenerated : info.isResultgenerated,
                faceRecognitionEnabled: Boolean(info.faceRecognitionEnabled),
                integrityMode: integrityPolicy.normalizeIntegrityMode(info.integrityMode),
                integrityPolicy: integrityPolicy.resolveIntegrityPolicy(
                    info.integrityMode,
                    info.integrityPolicy || {}
                ),
                preflightEnabled: Boolean(info.preflightEnabled),
                examState: deriveExamState(info)
            }
        });
    }catch(err){
        logger.error('end_test_failed', { testId: id, trainerId: req.user && req.user._id, error: logger.normalizeError(err) });
        return res.status(500).json({
            success : false,
            message : "Server Error"
        });
    }
 }

 let MaxMarks = (testid)=>{
    return new Promise((resolve,reject)=>{
        TestPaperModel.findOne({_id:testid},{questions:1})
        .populate({
            path : 'questions',
            model : QuestionModel,
            select : {'weightage' : 1}
        })
        .exec(function(err,Ma){
            if(err){
                console.log(err)
                reject(err)
            }else{
                if(!Ma){
                    reject(new Error('Invalid testid'))
                }else{
                    let m = 0;
                    Ma.questions.map((d,i)=>{
                        m+=d.weightage;
                    })
                    console.log(m)
                    resolve(m)
                }
            }
        })

    })
}

let updateFaceRecognitionSetting = async (req,res,next)=>{
    if(req.user.type!=="TRAINER"){
        return res.status(401).json({
            success : false,
            message : "Permissions not granted!"
        });
    }

    var id = req.body.id;
    var enabled = req.body.enabled;
    if (typeof enabled !== 'boolean') {
        return res.status(400).json({
            success: false,
            message: "Invalid payload for face recognition toggle."
        });
    }

    try{
        const test = await TestPaperModel.findOne(
            {_id:id,createdBy:req.user._id},
            {testbegins:1,testconducted:1,isResultgenerated:1,isRegistrationavailable:1,faceRecognitionEnabled:1}
        );

        if(!test){
            return res.json({
                success : false,
                message : "Invalid test id."
            });
        }

        const gate = canApplyAction(test, ExamActions.CONFIG_FACE_RECOGNITION);
        if(!gate.ok){
            return res.json({
                success : false,
                message : gate.reason,
                state : gate.state
            });
        }

        const updated = await TestPaperModel.findOneAndUpdate(
            {_id:id,createdBy:req.user._id},
            {faceRecognitionEnabled: enabled},
            {new: true}
        );

        return res.json({
            success: true,
            message: `Face recognition ${enabled ? 'enabled' : 'disabled'} for this exam.`,
            data: {
                faceRecognitionEnabled: Boolean(updated.faceRecognitionEnabled),
                testbegins: Boolean(updated.testbegins),
                testconducted: Boolean(updated.testconducted),
                isRegistrationavailable: Boolean(updated.isRegistrationavailable),
                isResultgenerated: Boolean(updated.isResultgenerated),
                examState: deriveExamState(updated)
            }
        });
    }catch(err){
        logger.error('toggle_face_recognition_failed', {
            testId: id,
            trainerId: req.user && req.user._id,
            enabled,
            error: logger.normalizeError(err)
        });
        return res.status(500).json({
            success : false,
            message : "Server Error"
        });
    }
}

let updateIntegrityConfig = async (req,res,next)=>{
    if(req.user.type!=="TRAINER"){
        return res.status(401).json({
            success : false,
            message : "Permissions not granted!"
        });
    }

    var id = req.body.id;
    if(!id){
        return res.status(400).json({
            success: false,
            message: "Invalid test id."
        });
    }

    try{
        const test = await TestPaperModel.findOne(
            {_id:id,createdBy:req.user._id},
            {testbegins:1,testconducted:1,isResultgenerated:1,integrityMode:1,integrityPolicy:1,preflightEnabled:1}
        );

        if(!test){
            return res.json({
                success : false,
                message : "Invalid test id."
            });
        }

        const gate = canApplyAction(test, ExamActions.CONFIG_INTEGRITY_POLICY);
        if(!gate.ok){
            return res.json({
                success : false,
                message : gate.reason,
                state : gate.state
            });
        }

        const nextMode = integrityPolicy.normalizeIntegrityMode(
            req.body.integrityMode !== undefined ? req.body.integrityMode : test.integrityMode
        );
        const nextPolicy = integrityPolicy.resolveIntegrityPolicy(
            nextMode,
            req.body.integrityPolicy !== undefined ? req.body.integrityPolicy : (test.integrityPolicy || {})
        );
        const nextPreflightEnabled = typeof req.body.preflightEnabled === "boolean"
            ? req.body.preflightEnabled
            : Boolean(test.preflightEnabled);

        const updated = await TestPaperModel.findOneAndUpdate(
            {_id:id,createdBy:req.user._id},
            {
                integrityMode: nextMode,
                integrityPolicy: nextPolicy,
                preflightEnabled: nextPreflightEnabled
            },
            {new: true}
        );

        return res.json({
            success: true,
            message: "Integrity configuration updated.",
            data: {
                integrityMode: updated.integrityMode,
                integrityPolicy: updated.integrityPolicy,
                preflightEnabled: Boolean(updated.preflightEnabled),
                examState: deriveExamState(updated)
            }
        });
    }catch(err){
        logger.error('update_integrity_config_failed', {
            testId: id,
            trainerId: req.user && req.user._id,
            error: logger.normalizeError(err)
        });
        return res.status(500).json({
            success: false,
            message: "Server Error"
        });
    }
}

let getIntegrityConfig = async (req,res,next)=>{
    if(req.user.type!=="TRAINER"){
        return res.status(401).json({
            success : false,
            message : "Permissions not granted!"
        });
    }

    var id = req.body.id;
    if(!id){
        return res.status(400).json({
            success: false,
            message: "Invalid test id."
        });
    }

    try{
        const test = await TestPaperModel.findOne(
            {_id:id,createdBy:req.user._id},
            {integrityMode:1,integrityPolicy:1,preflightEnabled:1,testbegins:1,testconducted:1,isResultgenerated:1}
        );

        if(!test){
            return res.json({
                success: false,
                message: "Invalid test id."
            });
        }

        return res.json({
            success: true,
            message: "Integrity configuration fetched.",
            data: {
                integrityMode: integrityPolicy.normalizeIntegrityMode(test.integrityMode),
                integrityPolicy: integrityPolicy.resolveIntegrityPolicy(
                    test.integrityMode,
                    test.integrityPolicy || {}
                ),
                preflightEnabled: Boolean(test.preflightEnabled),
                examState: deriveExamState(test)
            }
        });
    }catch(err){
        logger.error('get_integrity_config_failed', {
            testId: id,
            trainerId: req.user && req.user._id,
            error: logger.normalizeError(err)
        });
        return res.status(500).json({
            success: false,
            message: "Server Error"
        });
    }
}

let MM = (req,res,next)=>{
    var testid = req.body.testid;
    if(req.user.type === 'TRAINER'){
        MaxMarks(testid).then((MaxM)=>{
            res.json({
                success : true,
                message : 'Maximum Marks',
                data : MaxM
            })
        }).catch((error)=>{
            res.status(500).json({
                success:false,
                message:"Unable to get Max Marks",
            })
        })
    }else{
        res.status(401).json({
            success : false,
            message : "Permissions not granted!"
        })
    }
}
 
let checkTestName =(req,res,next)=>{
    var testName = req.body.testname;
    if(req.user.type === 'TRAINER'){
        TestPaperModel.findOne({title:testName},{_id:1}).then((data)=>{
            if(data){
                res.json({
                    success:true,
                    can_use:false
                })
            }
            else{
                res.json({
                    success:true,
                    can_use:true
                })
            }
        }).catch((error)=>{
            console.log(error);
            res.status(500).json({
                success:false,
                message:"Server error"
            })
        })
    }
    else{
        res.status(401).json({
            success : false,
            message : "Permissions not granted!"
        })
    }
}
 

 
 

module.exports = {
    checkTestName,
    createEditTest,
    getSingletest,
    getAlltests,
    deleteTest,
    MaxMarks,
    MM,
    getCandidateDetails,
    basicTestdetails,
    TestDetails,
    getTestquestions,
    getCandidates,
    beginTest,
    endTest,
    updateFaceRecognitionSetting,
    updateIntegrityConfig,
    getIntegrityConfig
}



