let TestPaperModel = require("../models/testpaper");
const appRoot = require("app-root-path");
let FeedbackModel=require("../models/feedback");
let logger = require("./logger");
let fs = require("fs");
let path = require("path");
let buildExcelResult = require("./excel").result;
let MaxMarks = require("./testpaper").MaxMarks;
const { canApplyAction, ExamActions, deriveExamState } = require("./examStateMachine");

let stopRegistration = async (req,res,next)=>{
    if(req.user.type==='TRAINER'){
        var id  =  req.body.id;
        var s = req.body.status;
        try{
            const test = await TestPaperModel.findOne({_id:id,createdBy:req.user._id},{testbegins:1,testconducted:1,isResultgenerated:1,isRegistrationavailable:1});
            if(!test){
                return res.json({
                    success : false,
                    message : "Invalid test id."
                });
            }

            const action = s ? ExamActions.OPEN_REGISTRATION : ExamActions.CLOSE_REGISTRATION;
            const gate = canApplyAction(test, action);
            if(!gate.ok){
                return res.json({
                    success : false,
                    message : gate.reason,
                    state : gate.state
                });
            }

            const updated = await TestPaperModel.findOneAndUpdate(
                {_id : id,createdBy:req.user._id},
                {isRegistrationavailable : s},
                {new: true}
            );
            return res.json({
                success : true,
                message : `Registration status changed!`,
                currentStatus : s,
                examState: deriveExamState(updated)
            });
        }catch(e){
            logger.error('registration_toggle_failed', {
                testId: id,
                trainerId: req.user && req.user._id,
                desiredStatus: s,
                error: logger.normalizeError(e)
            });
            res.status(500).json({
                success : false,
                message : "Unable to change registration status"
            });
        }
    }
 
    else{
        res.status(401).json({
            success : false,
            message : "Permissions not granted!"
        })
    }
}
/*
let Download = (req,res,next)=>{
    var testid = req.body.id;
    if(req.user.type === 'TRAINER'){
        const file = `${appRoot}/public/result/result-${testid}.xlsx`;
        res.download(file);
    }else{
       res.status(401).json({
           success : false,
           message : "Permissions not granted!"
       })
    }

}
*/
let Download = async (req,res,next)=>{
    var testid = req.body.id;
    if(req.user.type !== 'TRAINER'){
       return res.status(401).json({
           success : false,
           message : "Permissions not granted!"
       });
    }

    if(!testid){
        return res.status(400).json({
            success : false,
            message : "Invalid test id."
        });
    }

    try{
        const test = await TestPaperModel.findOne(
            { _id: testid, createdBy: req.user._id },
            { testconducted: 1 }
        );

        if(!test){
            return res.status(404).json({
                success : false,
                message : "Invalid test id."
            });
        }

        if(!test.testconducted){
            return res.status(400).json({
                success : false,
                message : "Exam must be completed before downloading results."
            });
        }

        const fileName = `result-${testid}.xlsx`;
        const localFilePath = path.join(appRoot.path, "public", "result", fileName);

        if(!fs.existsSync(localFilePath)){
            await buildExcelResult(testid, MaxMarks);
        }

        if(!fs.existsSync(localFilePath)){
            return res.status(500).json({
                success : false,
                message : "Unable to prepare the result file. Please try again."
            });
        }

        const file = `${req.protocol}://${req.get('host')}/result/${fileName}`;
        return res.json({
            success : true,
            message : 'File prepared successfully',
            file : file
        });
    }catch(error){
        logger.error('result_file_prepare_failed', {
            testId: testid,
            trainerId: req.user && req.user._id,
            error: logger.normalizeError(error)
        });
        return res.status(500).json({
            success : false,
            message : "Server Error"
        });
    }
}




let getFeedBack =(req,res,next)=>{
    var testid = req.body.testid;
    if(req.user.type === 'TRAINER'){
        FeedbackModel.find({testid:testid})
        .populate('userid')
        .exec((err,data)=>{
            if(err){
                console.log(err);
                res.status(500).json({
                    success:false,
                    message:"Server Error"
                })
            }
            else{
                res.json({
                    success:true,
                    message:"Feedbacks Sent Successfully",
                    data:data
                })
            } 
        })
    }else{
       res.status(401).json({
           success : false,
           message : "Permissions not granted!"
       })
    }
}

module.exports = {stopRegistration,Download,getFeedBack}
