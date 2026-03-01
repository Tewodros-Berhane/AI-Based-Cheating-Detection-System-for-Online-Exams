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
            TestPaperModel.findOneAndUpdate({
                _id : _id,
            },
            {
                title : title,
                questions : questions
            }).then(()=>{
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

 let getCandidateDetails = (req,res,next)=>{
    if(req.user.type==="TRAINER"){
        var testid = req.body.testid;
       ResultModel.find({testid : testid},{score : 1, userid : 1})
       .populate('userid')
       .exec(function(err,getCandidateDetails){
        if(err){
            console.log(err)
            res.status(500).json({
                success : false,
                message : "Unable to fetch details"
            })
        }else{
            if(getCandidateDetails.length==null){
                res.json({
                    success : false,
                    message: 'Invalid testid!'
                })
            }else{
                res.json({
                    success : true,
                    message:'Candidate details',
                    data : getCandidateDetails
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
            {_id:1,userid:1,startTime:1,completed:1}
        );

        const now = Date.now();
        const durationSeconds = Number(test.duration || 0) * 60;
        const sheetByUser = new Map();
        const expiredSheetIds = [];

        sheets.forEach((sheet)=>{
            const userKey = String(sheet.userid);
            const startTimeMs = Number(sheet.startTime || 0);
            const elapsedSeconds = startTimeMs > 0 ? (now - startTimeMs) / 1000 : 0;
            const hasExpired = !sheet.completed && durationSeconds > 0 && elapsedSeconds >= durationSeconds;

            if (hasExpired) {
                sheet.completed = true;
                expiredSheetIds.push(sheet._id);
            }

            sheetByUser.set(userKey, sheet);
        });

        if (expiredSheetIds.length) {
            await AnswersheetModel.updateMany(
                {_id: {$in: expiredSheetIds}},
                {completed: true}
            );
        }

        const data = candidates.map((candidate)=>{
            const sheet = sheetByUser.get(String(candidate._id));
            const startedWriting = Boolean(sheet);
            const completed = Boolean(sheet && sheet.completed);

            let pendingSeconds = null;
            if (sheet && !completed && durationSeconds > 0) {
                const elapsedSeconds = (now - Number(sheet.startTime || 0)) / 1000;
                pendingSeconds = Math.max(0, Math.floor(durationSeconds - elapsedSeconds));
            }

            let status = 'not_started';
            if (completed) status = 'finished';
            else if (startedWriting) status = 'in_progress';

            return {
                ...candidate.toObject(),
                examProgress: {
                    status,
                    startedWriting,
                    completed,
                    pendingSeconds
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
        const test = await TestPaperModel.findOne({_id:id,createdBy:req.user._id},{testbegins:1,testconducted:1,isResultgenerated:1,isRegistrationavailable:1});
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
        const test = await TestPaperModel.findOne({_id:id,createdBy:req.user._id},{testbegins:1,testconducted:1,isResultgenerated:1,isRegistrationavailable:1});
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

        await result(id,MaxMarks);

        return res.json({
            success : true,
            message : 'The exam has ended.',
            data : {
                isRegistrationavailable : info.isRegistrationavailable,
                testbegins : info.testbegins,
                testconducted : info.testconducted,
                isResultgenerated : info.isResultgenerated,
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
 

 
 

module.exports = {checkTestName,createEditTest,getSingletest,getAlltests,deleteTest,MaxMarks,MM,getCandidateDetails,basicTestdetails,TestDetails,getTestquestions,getCandidates,beginTest,endTest}
