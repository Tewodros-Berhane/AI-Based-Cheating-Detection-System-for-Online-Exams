const mongoose = require('mongoose');
// const TestModel = mongoose.model('TestModel', require('../schemas/testpaper'));       
const TestModel = require('../models/testpaper');                
const UserModel = require('../models/user');                
const SubjectModel = require('../models/subject');    
const TraineeModel = require('../models/trainee');    
const FeedbackModel = require('../models/feedback');  
const QuestionModel = require('../models/questions');   

/**
 * Fetch admin dashboard data: stats and recent lists.
 */
async function getAdminDashboard() {
  // Stats
  const [
    totalExams,
    totalQuestions,
    totalTrainers,
    totalCourses
  ] = await Promise.all([
    TestModel.countDocuments(),
    QuestionModel.countDocuments(),
    UserModel.countDocuments({ type: 'TRAINER' }),
    SubjectModel.countDocuments()
  ]);

  // Recent items (6 each, sorted newest first)
  const [
    recentTrainers,
    recentCourses,
    recentExams
  ] = await Promise.all([
    UserModel.find({ type: 'TRAINER' })
      .sort({ createdAt: -1 })
      .limit(6)
      .select('name emailid'),

    SubjectModel.find()
      .sort({ createdAt: -1 })
      .limit(6)
      .select('topic createdBy'),

    TestModel.find()
      .sort({ createdAt: -1 })
      .limit(6)
      .select('title createdBy')
  ]);

  return {
    stats: { totalExams, totalQuestions, totalTrainers, totalCourses },
    recentTrainers,
    recentCourses,
    recentExams
  };
}

/**
 * Fetch trainer dashboard data: personal stats and related lists.
 * @param {mongoose.Types.ObjectId|string} userId - Logged-in trainer's ObjectId
 */
async function getTrainerDashboard(userId) {
  const objectId = mongoose.Types.ObjectId(userId);

  // Get all exams created by this trainer
  const myExams = await TestModel.find({ createdBy: objectId })
    .sort({ createdAt: -1 })
    .select('title createdBy');

  // Count of questions the trainer has added
  const questionsAdded = await QuestionModel.countDocuments({ createdBy: objectId });

  // Latest trainees whose test was created by this trainer
  const myTrainees = await TraineeModel.aggregate([
    {
      $lookup: {
        from: 'testpapermodels',               
        localField: 'testid',
        foreignField: '_id',
        as: 'test'
      }
    },
    { $unwind: '$test' },
    { $match: { 'test.createdBy': objectId } },
    { $project: { _id: 1, name: 1, emailid: 1, createdAt: 1 } },
    { $sort: { createdAt: -1 } },
    { $limit: 6 }
  ]);

  const myTraineesTotal = await TraineeModel.aggregate([
    {
      $lookup: {
        from: 'testpapermodels',               
        localField: 'testid',
        foreignField: '_id',
        as: 'test'
      }
    },
    { $unwind: '$test' },
    { $match: { 'test.createdBy': objectId } },
    { $project: { _id: 1, name: 1, emailid: 1, createdAt: 1 } },
    { $sort: { createdAt: -1 } }
  ]);

  // Feedbacks on this trainer's exams
  const feedbacks = await FeedbackModel.aggregate([
    {
      $lookup: {
        from: 'testpapermodels',
        localField: 'testid',
        foreignField: '_id',
        as: 'test'
      }
    },
    { $unwind: '$test' },
    { $match: { 'test.createdBy': objectId } },
    {
      $lookup: {
        from: 'traineeentermodels',           
        localField: 'userid',
        foreignField: '_id',
        as: 'trainee'
      }
    },
    { $unwind: '$trainee' },
    { $project: { _id: 1, feedback: 1, rating: 1, 'trainee.name': 1, 'trainee.emailid': 1, createdAt: 1 } },
    { $sort: { createdAt: -1 } },
    { $limit: 3 }
  ]);

  return {
    stats: { myExamCount: myExams.length, questionsAdded, myTraineesCount: myTraineesTotal.length },
    myExams,
    myTrainees,
    feedbacks
  };
}

module.exports = {
  getAdminDashboard,
  getTrainerDashboard
};
