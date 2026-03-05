const mongoose = require('mongoose');
// const TestModel = mongoose.model('TestModel', require('../schemas/testpaper'));       
const TestModel = require('../models/testpaper');                
const UserModel = require('../models/user');                
const SubjectModel = require('../models/subject');    
const TraineeModel = require('../models/trainee');    
const FeedbackModel = require('../models/feedback');  
const QuestionModel = require('../models/questions');   

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const buildLastNMonthBuckets = (n) => {
  const now = new Date();
  const buckets = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const key = `${year}-${String(month).padStart(2, '0')}`;
    const label = `${MONTH_NAMES[month - 1]} ${String(year).slice(-2)}`;
    buckets.push({ year, month, key, label });
  }
  return buckets;
};

const foldMonthlyCounts = (buckets, rows = []) => {
  const lookup = {};
  rows.forEach((row) => {
    const y = row?._id?.year;
    const m = row?._id?.month;
    if (!y || !m) return;
    lookup[`${y}-${String(m).padStart(2, '0')}`] = row.count || 0;
  });
  return buckets.map((bucket) => lookup[bucket.key] || 0);
};

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
  const objectId = userId instanceof mongoose.Types.ObjectId
    ? userId
    : new mongoose.Types.ObjectId(String(userId));

  const monthBuckets = buildLastNMonthBuckets(6);

  const [
    myExams,
    questionsAdded,
    myTrainees,
    myTraineesCountAgg,
    feedbacks,
    registrationsByMonth,
    questionsByMonth,
    ratingsAgg,
    ratingAverageAgg,
    topExamsByRegistrations
  ] = await Promise.all([
    TestModel.find({ createdBy: objectId })
      .sort({ createdAt: -1 })
      .select('title createdBy createdAt testbegins testconducted isRegistrationavailable isResultgenerated'),

    QuestionModel.countDocuments({ createdBy: objectId }),

    TraineeModel.aggregate([
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
    ]),

    TraineeModel.aggregate([
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
      { $count: 'total' }
    ]),

    FeedbackModel.aggregate([
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
    ]),

    TraineeModel.aggregate([
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
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]),

    QuestionModel.aggregate([
      { $match: { createdBy: objectId } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]),

    FeedbackModel.aggregate([
      {
        $lookup: {
          from: 'testpapermodels',
          localField: 'testid',
          foreignField: '_id',
          as: 'test'
        }
      },
      { $unwind: '$test' },
      { $match: { 'test.createdBy': objectId, rating: { $gte: 1, $lte: 5 } } },
      {
        $group: {
          _id: '$rating',
          count: { $sum: 1 }
        }
      }
    ]),

    FeedbackModel.aggregate([
      {
        $lookup: {
          from: 'testpapermodels',
          localField: 'testid',
          foreignField: '_id',
          as: 'test'
        }
      },
      { $unwind: '$test' },
      { $match: { 'test.createdBy': objectId, rating: { $gte: 1, $lte: 5 } } },
      {
        $group: {
          _id: null,
          avgRating: { $avg: '$rating' },
          total: { $sum: 1 }
        }
      }
    ]),

    TraineeModel.aggregate([
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
        $group: {
          _id: '$testid',
          examTitle: { $first: '$test.title' },
          registrations: { $sum: 1 },
          testconducted: { $first: '$test.testconducted' },
          testbegins: { $first: '$test.testbegins' }
        }
      },
      { $sort: { registrations: -1, examTitle: 1 } },
      { $limit: 5 }
    ])
  ]);

  const myTraineesCount = myTraineesCountAgg[0]?.total || 0;
  const examsCompleted = myExams.filter((exam) => Boolean(exam.testconducted)).length;
  const examsLive = myExams.filter((exam) => Boolean(exam.testbegins) && !Boolean(exam.testconducted)).length;
  const examsScheduled = myExams.filter((exam) => !Boolean(exam.testbegins) && !Boolean(exam.testconducted)).length;
  const registrationsOpen = myExams.filter((exam) => Boolean(exam.isRegistrationavailable) && !Boolean(exam.testconducted)).length;
  const resultsPublished = myExams.filter((exam) => Boolean(exam.isResultgenerated)).length;

  const registrationTrendValues = foldMonthlyCounts(monthBuckets, registrationsByMonth);
  const questionTrendValues = foldMonthlyCounts(monthBuckets, questionsByMonth);
  const monthlyLabels = monthBuckets.map((bucket) => bucket.label);

  const ratingMap = {};
  ratingsAgg.forEach((row) => {
    if (row && typeof row._id === 'number') {
      ratingMap[row._id] = row.count || 0;
    }
  });
  const ratingDistribution = [1, 2, 3, 4, 5].map((score) => ratingMap[score] || 0);
  const averageRating = ratingAverageAgg[0]?.avgRating || 0;
  const ratingsCount = ratingAverageAgg[0]?.total || 0;

  return {
    stats: {
      myExamCount: myExams.length,
      questionsAdded,
      myTraineesCount,
      examsLive,
      examsCompleted,
      registrationsOpen,
      resultsPublished,
      averageRating: Number(averageRating.toFixed(2)),
      feedbackCount: ratingsCount
    },
    myExams,
    myTrainees,
    feedbacks,
    analytics: {
      examStatus: {
        scheduled: examsScheduled,
        live: examsLive,
        completed: examsCompleted
      },
      pipeline: {
        registrationOpen: registrationsOpen,
        inProgress: examsLive,
        resultPublished: resultsPublished
      },
      monthly: {
        labels: monthlyLabels,
        registrations: registrationTrendValues,
        questions: questionTrendValues
      },
      ratings: {
        labels: ['1 Star', '2 Stars', '3 Stars', '4 Stars', '5 Stars'],
        distribution: ratingDistribution,
        average: Number(averageRating.toFixed(2)),
        total: ratingsCount
      },
      topExamsByRegistrations: topExamsByRegistrations.map((exam) => ({
        _id: exam._id,
        title: exam.examTitle || 'Untitled Exam',
        registrations: exam.registrations || 0,
        status: exam.testconducted ? 'Completed' : (exam.testbegins ? 'Live' : 'Scheduled')
      }))
    }
  };
}

module.exports = {
  getAdminDashboard,
  getTrainerDashboard
};
