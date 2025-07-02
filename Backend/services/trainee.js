const path = require('path');
var TraineeEnterModel = require("../models/trainee");
var TestPaperModel = require("../models/testpaper");
var FeedbackModel = require("../models/feedback");
var sendmail = require("../services/mail").sendmail;
var QuestionModel = require("../models/questions");
var options = require("../models/option");
var AnswersheetModel = require("../models/answersheet");
var AnswersModel = require("../models/answers");

let traineeenter = (req, res, next) => {
  // ── Validate incoming fields ──────────────────────────────────────────────
  req.check('emailid', `Invalid email address.`).isEmail().notEmpty();
  req.check('name', 'This field is required.').notEmpty();
  req.check('contact', 'Invalid contact.')
     .isNumeric({ no_symbols: false });

  const errors = req.validationErrors();
  if (errors) {
    return res.json({ success: false, message: 'Invalid inputs', errors });
  }

  // ── Destructure form fields ────────────────────────────────────────────────
  const { name, emailid, contact, organisation, testid, location } = req.body;

  // ── Build faceImageUrl if a file was uploaded ────────────────────────────
  let faceImageUrl = null;
  if (req.file) {
    // strip off the `public/` so the URL matches your static mount
    faceImageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  }

  async function generateUniqueTraineeID() {
            let traineeID;
            let exists = true;

            while (exists) {
                traineeID = Math.floor(100000 + Math.random() * 900000).toString();
                exists = await TraineeEnterModel.exists({ traineeID: traineeID });
            }

            return traineeID;
        }


  // ── Check test registration availability ──────────────────────────────────
  TestPaperModel
    .findOne({ _id: testid, isRegistrationavailable: true })
    .then(info => {
      if (!info) {
        return res.json({ success: false, message: 'Registration for this test has been closed!' });
      }
      // ── Prevent double‐registration ────────────────────────────────────────
      return TraineeEnterModel.findOne({
        $or: [
          { emailid: emailid, testid: testid },
          { contact: contact, testid: testid }
        ]
      });
    })
    .then(existing => {
      if (existing) {
        return res.json({ success: false, message: 'This id has already been registered for this test!' });
      }
      return generateUniqueTraineeID();
    })
    .then((traineeID) => {

      const tempdata = new TraineeEnterModel({
        name,
        emailid,
        contact,
        organisation,
        testid,
        location,
        faceImageUrl,
        traineeID
      });
      return tempdata.save();
      })

    .then(u => {
      // ── Send confirmation email ────────────────────────────────────────────
      if (u) {
        TestPaperModel.findById(testid).then(test => {
        if (!test) {
            console.error('Test data not found.');
            return;
        }

        const testLink = `${req.protocol}://localhost:3000/trainee/taketest?testid=${testid}&traineeid=${u._id}`;
        // const logoUrl = `${req.protocol}://${req.get('host')}/logo.jpg`;
        const examID = test.examID;
        const traineeID = u.traineeID;
        console.log(examID);
        console.log(traineeID);
        

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
                <p> This is your id: <strong> ${traineeID} </strong> </p>
                <p> This is the exam id: <strong> ${examID} </strong> </p>
                </div>

                <h3 style="color: #58a6ff; margin-top: 25px;">Important Instructions</h3>
                <p>Please download and keep the attached file named <strong>trainee_exam_config.seb</strong>. This file is essential to launch and authenticate your test environment.</p>
                <ul style="padding-left: 20px; line-height: 1.6;">
                <li>You must download this file to start taking the Exam.</li>
                <li>After you download this file you will open it and you will be asked to enter a password.</li>
                <li>The password is: <strong>123123123</strong></li>
                <li>After you enter the password, You will be asked to enter your ID and the Exam ID that is given to you above.</li>
                <li>Do not rename or alter the file in any way.</li>
                <li>Keep it secure and do not share it with anyone.</li>
                <li>If you lose this file, you may not be able to proceed with the test.</li>
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
            'You’ve been registered—please view this email in HTML format.',
            htmlContent,
            [
                {
                    filename: 'trainee_exam_config.seb',
                    path: path.join(__dirname, '../config/trainee_exam_config.seb') 
                },
                {
                    filename: 'logo.jpg',
                    path: path.join(__dirname, '../public/logo.jpg'),
                    cid: 'examshieldlogo' 
                }
            ]
        ).catch(console.log);
        });


        return res.json({
          success: true,
          message: 'Trainee registered successfully!',
          user: u
        });
      }
    })
    .catch(err => {
      console.error(err);
      res.status(500).json({ success: false, message: 'Server error!' });
    });
};

module.exports = traineeenter;


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

        const testLink = `${req.protocol}://localhost:3000/trainee/taketest?testid=${info.testid}&traineeid=${info._id}`;
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
                <p>Please download and keep the attached file named <strong>trainee_exam_config.seb</strong>. This file is essential to launch and authenticate your test environment.</p>
                <ul style="padding-left: 20px; line-height: 1.6;">
                <li>You must download this file to start taking the Exam.</li>
                <li>After you download this file you will open it and you will be asked to enter a password.</li>
                <li>The password is: <strong>123123123</strong></li>
                <li>After you enter the password, You will be asked to enter your ID and the Exam ID that is given to you above.</li>
                <li>Do not rename or alter the file in any way.</li>
                <li>Keep it secure and do not share it with anyone.</li>
                <li>If you lose this file, you may not be able to proceed with the test.</li>
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
                filename: 'trainee_exam_config.seb',
                path: path.join(__dirname, '../config/trainee_exam_config.seb')
            },
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

let Answersheet = (req,res,next)=>{
    var userid = req.body.userid;
    var testid = req.body.testid;
    var p1= TraineeEnterModel.find({_id:userid,testid:testid});
    var p2 = TestPaperModel.find({_id:testid,testbegins : true, testconducted : false});
    
    Promise.all([p1,p2]).then((info)=>{
        if(info[0].length && info[1].length){
            AnswersheetModel.find({userid:userid,testid:testid}).then((data)=>{
                if(data.length){
                    res.json({
                        success : true,
                        message : 'Answer Sheet already exists!',
                        data : data
                    })
                }
                else{ 
                    var qus = info[1][0].questions;
                    var answer = qus.map((d,i)=>{
                        return({
                            questionid:d,
                            chosenOption:[],
                            userid:userid
                        })
                    })
                    AnswersModel.insertMany(answer,(err,ans)=>{
                        if(err){
                            console.log(err);
                            res.status(500).json({
                                success : false,
                                message : "Unable to create Answersheet!"
                            })
                        }else{
                            var startTime = new Date();
                            var tempdata = AnswersheetModel({
                                startTime:startTime,
                                questions : qus,
                                answers:ans,
                                testid:testid,
                                userid:userid
                            })
                            tempdata.save().then((Answersheet)=>{
                                res.json({
                                    success : true,
                                    message : 'Test has started!'
                                })

                            }).catch((error)=>{
                                res.status(500).json({
                                    success : false,
                                    message : "Unable to fetch details"
                                })
                            })
                        }
                    })
                }
            })
        }
        else{
            res.json({
                success : false,
                message :'Invalid URL'
            })
        }
    }).catch((err)=>{
        console.log(err)
        res.status(500).json({
            success : false,
            message : "Unable to fetch details"
        })
    })
}

let flags = (req,res,next)=>{
    var testid = req.body.testid;
    var traineeid = req.body.traineeid;
    const p1 = AnswersheetModel.findOne({userid : traineeid,testid : testid},{_id : 1,startTime  :1,completed : 1});
    const p2 = TraineeEnterModel.findOne({_id : traineeid , testid : testid},{_id : 1});
    const p3 = TestPaperModel.findById(testid,{testbegins : 1, testconducted : 1,duration : 1});
    var present = new Date();

    Promise.all([p1,p2,p3]).then((info)=>{
        console.log(info)
        if(info[1]===null){
            res.json({
                success : false,
                message : 'Invalid URL!'
            })
        }else{
            var startedWriting = false;
            var pending=null;
            if(info[0]!==null){
                startedWriting = true;
                pending = info[2].duration*60 - ((present - info[0].startTime)/(1000))
                if(pending<=0){
                    AnswersheetModel.findOneAndUpdate({userid : traineeid,testid : testid},{completed : true}).then((result)=>{
                        res.json({
                            success : true,
                            message : 'Successfull',
                            data : {
                                testbegins : info[2].testbegins,
                                testconducted:info[2].testconducted,
                                startedWriting:startedWriting,
                                pending : pending,
                                completed : true
                            }
                        })
                    }).catch((error)=>{
                        res.status(500).json({
                            success : false,
                            message : "Unable to fetch details"
                        })
                    })
                }else{
                    res.json({
                        success : true,
                        message : 'Successfull',
                        data : {
                            testbegins : info[2].testbegins,
                            testconducted:info[2].testconducted,
                            startedWriting:startedWriting,
                            pending : pending,
                            completed : info[0].completed
                        }
                    })
                }
            }
            else{
                res.json({
                    success : true,
                    message : 'Successfull',
                    data : {
                        testbegins : info[2].testbegins,
                        testconducted:info[2].testconducted,
                        startedWriting:startedWriting,
                        pending : pending,
                        completed : false
                    }
                })

            }
            
            
        }
        
        
    }).catch((error)=>{
        console.log(error)
        res.status(500).json({
            success : false,
            message : "Unable to fetch details"
        })
    })

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

let chosenOptions = (req,res,next)=>{
    var testid = req.body.testid;
    var userid = req.body.userid;
    AnswersheetModel.findOne({testid : testid,userid : userid},{answers : 1})
    .populate('answers')
    .exec(function(err,answersheet){
        if(err){
            res.json({
                success : false,
                message : 'Answersheet does not exist'
            })
            
        }else{
            res.json({
                success : true,
                message : 'Chosen Options',
                data : answersheet
            })
        }
    })

}

let UpdateAnswers = (req,res,next)=>{
    var testid = req.body.testid;
    var userid = req.body.userid;
    var questionid = req.body.qid;
    var newAnswer = req.body.newAnswer;
    const p1 = TestPaperModel.findById(testid,{duration : 1});
    const p2 = AnswersheetModel.findOne({testid : testid,userid:userid,completed : false},{_id:1,startTime:1});
    
    var present = new Date();
    Promise.all([p1,p2])
    .then((info)=>{
        if(info[1]){
            var pending=null;
            pending = info[0].duration*60 - ((present - info[1].startTime)/(1000))
            if(pending>0){
                AnswersModel.findOneAndUpdate({questionid : questionid,userid:userid},{chosenOption : newAnswer}).then((info)=>{
                    console.log(info)
                    if(info){
                        res.json({
                            success : true,
                            message : 'Answer Updated',
                            data : info
                        })
                    }else{
                        res.json({
                            success : false,
                            message : 'Question is required!'
                        })
                    }
                   
                }).catch((error)=>{
                    console.log(error)
                    res.status(500).json({
                        success : false,
                        message : "Error occured!"
                    })
                })
            }else{
                AnswersheetModel.findByIdAndUpdate({testid : testid,userid:userid},{completed : true}).then(()=>{
                    res.json({
                        success : false,
                        message : 'Time is up!'
                    })
                }).catch((error)=>{
                    res.status(500).json({
                        success : false,
                        message : "Error occured!"
                    })
                })
            }   
        }else{
            res.json({
                success : false,
                message : 'Unable to update answer'
            })
        }
    }).catch((error)=>{
        res.status(500).json({
            success : false,
            message : "Error occured!"
        })
    })
}

let EndTest = (req,res,next)=>{
    var testid = req.body.testid;
    var userid = req.body.userid;
    AnswersheetModel.findOneAndUpdate({testid:testid,userid:userid},{completed : true}).then((info)=>{
        if(info){
            res.json({
                success : true,
                message : 'Your answers have been submitted'
            })
        }else{
            res.json({
                success : false,
                message : 'Unable to submit answers!'
            })
        }
    }).catch((error)=>{
        res.status(500).json({
            success : false,
            message : "Error occured!"
        })
    })
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


module.exports = {traineeenter,feedback,checkFeedback,resendmail,correctAnswers,Answersheet,flags,chosenOptions,TraineeDetails,Testquestions,UpdateAnswers,EndTest,getQuestion}