var express = require("express");
var router = express.Router();
var trainee = require("../services/trainee");
var TraineeEnterModel = require("../models/trainee");
let TestPaperModel = require("../models/testpaper");
const { upload } = require("./fileUpload");


router.post('/enter',
  upload.single('faceImageUrl'),
  trainee.traineeenter
);
router.post('/feedback',trainee.feedback);
router.post('/resend/testlink',trainee.resendmail);
router.post('/correct/answers',trainee.correctAnswers);
router.post('/answersheet',trainee.Answersheet);
router.post('/flags',trainee.flags);
router.post('/details',trainee.TraineeDetails);
router.post('/paper/questions',trainee.Testquestions);
router.post('/chosen/options',trainee.chosenOptions);
router.post('/update/answer',trainee.UpdateAnswers);
router.post('/end/test',trainee.EndTest);
router.post('/get/question',trainee.getQuestion);
router.post('/feedback/status',trainee.checkFeedback);


router.post('/fetch-trainee-by-traineeid', async (req, res) => {
  const { traineeID } = req.body;
  const trainee = await TraineeEnterModel.findOne({ traineeID });
  console.log(trainee);
  if (!trainee) {
    return res.status(404).json({ 
      success: false, 
      message: "Trainee not found" 
    });
  }

  res.json({ 
    success: true, 
    data: {
      _id: trainee._id,  // <<< MUST match frontend expectation
      // Other fields if needed
    }
  });
  
});

router.post('/fetch-test-by-examid', async (req, res) => {
  console.log('Received examID:', req.body.examID); // Debug log
  const { examID } = req.body;
  const test = await TestPaperModel.findOne({ examID });
  
  console.log('Found test:', test); // Debug log
  
  if (!test) {
    return res.status(404).json({ 
      success: false, 
      message: "Test not found" 
    });
  }

  res.json({ 
    success: true, 
    data: {
      _id: test._id,
      // Include other required fields
    }
  });
});


module.exports = router;