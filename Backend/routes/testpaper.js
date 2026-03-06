var express = require("express");
var router = express.Router();

var testpaper = require("../services/testpaper");
var proctorMonitor = require("../services/proctorMonitor");

router.post('/new/name/check',testpaper.checkTestName)
router.post('/create',testpaper.createEditTest);
router.get('/details/:_id',testpaper.getSingletest);
router.post('/details/all',testpaper.getAlltests);
router.post('/delete',testpaper.deleteTest);
router.post('/basic/details',testpaper.basicTestdetails);
router.post('/questions',testpaper.getTestquestions);
router.post('/candidates',testpaper.getCandidates);
router.post('/begin',testpaper.beginTest);
router.post('/end',testpaper.endTest);
router.post('/face-recognition', testpaper.updateFaceRecognitionSetting);
router.post('/integrity/config', testpaper.updateIntegrityConfig);
router.post('/integrity/details', testpaper.getIntegrityConfig);
router.post('/trainer/details',testpaper.TestDetails);
router.post('/candidates/details',testpaper.getCandidateDetails);
router.post('/proctor/summary', proctorMonitor.getSummary);
router.post('/proctor/events', proctorMonitor.getEvents);
router.post('/proctor/event/ack', proctorMonitor.acknowledgeEvent);
router.post('/proctor/event/escalate', proctorMonitor.escalateEvent);
router.post('/max/marks',testpaper.MM);


module.exports = router;
