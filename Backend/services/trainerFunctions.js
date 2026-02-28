let QuestionModel = require("../models/questions");
let options = require("../models/option");
let tool = require("./tool");
let mongoose = require("mongoose");



let createQuestion = async (req,res,next)=>{
    if(req.user.type!=='TRAINER'){
        return res.status(401).json({
            success : false,
            message : "Permissions not granted!"
        });
    }

    req.check('body', `Invalid question!`).notEmpty();
    req.check('subject', 'Enter subject!').notEmpty();
    var errors = req.validationErrors();
    if(errors){
        return res.json({
            success : false,
            message : 'Invalid inputs',
            errors : errors
        });
    }

    var body = req.body.body;
    var rawOptions = Array.isArray(req.body.options) ? req.body.options : [];
    var quesimg = req.body.quesimg;
    var difficulty = req.body.difficulty;
    var subjectid = req.body.subject;
    var weightage = req.body.weightage;

    if (!mongoose.Types.ObjectId.isValid(subjectid)) {
        return res.status(400).json({
            success: false,
            message: "Invalid subject selected."
        });
    }

    if (!rawOptions.length) {
        return res.status(400).json({
            success: false,
            message: "At least one option is required."
        });
    }

    var normalizedOptions = rawOptions.map((item)=>({
        optbody: item && item.optbody ? String(item.optbody) : null,
        optimg: item && item.optimg ? String(item.optimg) : null,
        isAnswer: Boolean(item && item.isAnswer)
    }));

    var containsEmptyOption = normalizedOptions.some((item)=>!item.optbody && !item.optimg);
    if (containsEmptyOption) {
        return res.status(400).json({
            success: false,
            message: "Each option must include text or an image."
        });
    }

    var anscount = normalizedOptions.reduce((count, item)=>item.isAnswer ? count + 1 : count, 0);
    if (anscount === 0) {
        return res.status(400).json({
            success: false,
            message: "There must be at least one correct answer."
        });
    }

    try {
        var info = await QuestionModel.findOne({ body : body,status:1 },{status:0});
        if(info){
            return res.json({
                success : false,
                message : `This question already exists!`
            });
        }

        var op = await options.insertMany(normalizedOptions);
        var ra = op.filter((item)=>item.isAnswer).map((item)=>item._id);
        var tempdata = QuestionModel({
            body: body,
            quesimg : quesimg,
            subject : subjectid,
            difficulty :difficulty,
            options:op,
            createdBy : req.user._id,
            anscount:anscount,
            weightage : weightage,
            rightAnswers:ra
        });

        await tempdata.save();
        return res.json({
            success : true,
            message : `New question created successfully!`
        });
    } catch (err) {
        console.log(err);
        return res.status(500).json({
            success : false,
            message : "Unable to create new question!"
        });
    }
}


let deleteQuestion = (req,res,next)=>{
    if(req.user.type==='TRAINER'){
        var _id =  req.body._id;
        QuestionModel.deleteOne({
            _id : _id
        }).then(()=>{
            res.json({
                success: true,
                message :  "Question has been deleted"
            })
        }).catch((err)=>{
            res.status(500).json({
                success : false,
                message : "Unable to delete question"
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


let getAllQuestions = (req,res,next)=>{
    if(req.user.type==='TRAINER'){
        var subject = req.body.subject;
        if(subject.length!==0){
            QuestionModel.find({subject : subject,status : 1},{status : 0})
            .sort({ createdAt: -1 })
            .populate('createdBy', 'name')
            .populate('subject', 'topic')
            .populate('options')
            .exec(function (err, question) {
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
                        data : question
                    })
                }
            })        

        }
        else{
            QuestionModel.find({status : 1},{status : 0})
            .sort({ createdAt: -1 })
            .populate('createdBy', 'name')
            .populate('subject', 'topic')
            .populate('options')
            .exec(function (err, question) {
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
                        data : question
                    })
                }
            })        
        }
        }
    else{
        res.status(401).json({
            success : false,
            message : "Permissions not granted!"
        })
    } 
}   
 




let getSingleQuestion = (req,res,next)=>{
    if(req.user.type==='TRAINER'){
        let _id = req.params._id;
        console.log(_id);
        QuestionModel.find({_id : _id , status : 1},{status : 0})
        .populate('subject', 'topic')
        .populate('options')
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
    else{
        res.status(401).json({
            success : false,
            message : "Permissions not granted!"
        })
    }    
}
 
//create test papers

module.exports = { createQuestion, getAllQuestions, getSingleQuestion, deleteQuestion}







