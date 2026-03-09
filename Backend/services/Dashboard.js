const mongoose = require('mongoose');
const TestModel = require('../models/testpaper');
const UserModel = require('../models/user');
const SubjectModel = require('../models/subject');
const TraineeModel = require('../models/trainee');
const FeedbackModel = require('../models/feedback');
const QuestionModel = require('../models/questions');
const PsychometricMetricModel = require('../models/psychometricMetric');
const psychometrics = require('./psychometrics');

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

const averageDefined = (values = [], digits = 2) => {
  const filtered = values
    .filter((value) => value !== null && value !== undefined)
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));

  if (!filtered.length) {
    return null;
  }

  const total = filtered.reduce((sum, value) => sum + value, 0);
  return Number((total / filtered.length).toFixed(digits));
};

const compactExamTitle = (title = '', length = 24) => {
  const clean = String(title || '').trim();
  if (clean.length <= length) {
    return clean || 'Untitled Exam';
  }
  return `${clean.slice(0, Math.max(length - 3, 1)).trimEnd()}...`;
};

const computeAverageDifficulty = (questionMetrics = []) => {
  const difficulties = (questionMetrics || [])
    .map((metric) => metric && metric.difficultyIndex)
    .filter((value) => value !== null && value !== undefined);

  if (!difficulties.length) {
    return null;
  }

  return Number((difficulties.reduce((sum, value) => sum + Number(value || 0), 0) / difficulties.length * 100).toFixed(2));
};

const hydrateTrainerPsychometrics = async (exams = []) => {
  const conductedExams = exams.filter((exam) => Boolean(exam.testconducted));
  if (!conductedExams.length) {
    return {
      examsWithQualityData: 0,
      examsNeedingReview: 0,
      flaggedQuestionsTotal: 0,
      averageReliability: null,
      weakestExams: [],
      flaggedSubjects: [],
      reviewBacklog: [],
      difficultyTrend: {
        labels: [],
        averageScores: [],
        averageItemCorrectness: []
      }
    };
  }

  const examIds = conductedExams.map((exam) => exam._id);
  let snapshots = await PsychometricMetricModel.find({ testid: { $in: examIds } }).lean();
  const existingIds = new Set(snapshots.map((snapshot) => String(snapshot.testid)));
  const missingExamIds = examIds.filter((id) => !existingIds.has(String(id)));

  if (missingExamIds.length) {
    const computed = await Promise.allSettled(
      missingExamIds.map((testid) => psychometrics.computeAndPersistSnapshot({ testid }))
    );

    computed.forEach((result) => {
      if (result.status === 'fulfilled' && result.value) {
        snapshots.push(result.value);
      }
    });
  }

  const examLookup = new Map(conductedExams.map((exam) => [String(exam._id), exam]));
  const psychometricRows = snapshots.map((snapshot) => {
    const exam = examLookup.get(String(snapshot.testid));
    return {
      _id: String(snapshot.testid),
      title: exam?.title || 'Untitled Exam',
      compactTitle: compactExamTitle(exam?.title),
      createdAt: exam?.createdAt || snapshot.computedAt,
      sampleSize: Number(snapshot.sampleSize || 0),
      flaggedQuestionCount: Number(snapshot.summary?.flaggedQuestionCount || 0),
      averagePercent: Number(snapshot.summary?.averagePercent || 0),
      averageReliability: snapshot.summary?.reliabilityAlpha !== null && snapshot.summary?.reliabilityAlpha !== undefined
        ? Number(snapshot.summary.reliabilityAlpha)
        : null,
      averageItemCorrectness: computeAverageDifficulty(snapshot.questionMetrics || []),
      difficultQuestionCount: Number(snapshot.summary?.difficultQuestionCount || 0),
      lowDiscriminationCount: Number(snapshot.summary?.lowDiscriminationCount || 0),
      topFlaggedQuestions: snapshot.topFlaggedQuestions || [],
      subjectMetrics: snapshot.subjectMetrics || []
    };
  });

  const flaggedSubjectMap = new Map();
  const reviewBacklog = [];

  psychometricRows.forEach((exam) => {
    exam.subjectMetrics.forEach((subjectMetric) => {
      const key = String(subjectMetric.subjectid || subjectMetric.subjectLabel || 'unassigned');
      if (!flaggedSubjectMap.has(key)) {
        flaggedSubjectMap.set(key, {
          subjectLabel: subjectMetric.subjectLabel || 'Unassigned',
          flaggedQuestionCount: 0,
          questionCount: 0,
          difficultySamples: []
        });
      }

      const current = flaggedSubjectMap.get(key);
      current.flaggedQuestionCount += Number(subjectMetric.flaggedQuestionCount || 0);
      current.questionCount += Number(subjectMetric.questionCount || 0);
      if (subjectMetric.averageDifficultyIndex !== null && subjectMetric.averageDifficultyIndex !== undefined) {
        current.difficultySamples.push(Number(subjectMetric.averageDifficultyIndex) * 100);
      }
    });

    exam.topFlaggedQuestions.forEach((questionMetric) => {
      reviewBacklog.push({
        key: `${exam._id}-${questionMetric.questionid}`,
        examTitle: exam.title,
        questionLabel: `Q${questionMetric.questionNumber}`,
        subjectLabel: questionMetric.subjectLabel || 'Unassigned',
        flags: questionMetric.qualityFlags || []
      });
    });
  });

  const weakestExams = psychometricRows
    .filter((exam) => exam.sampleSize > 0)
    .sort((left, right) => {
      if (right.flaggedQuestionCount !== left.flaggedQuestionCount) {
        return right.flaggedQuestionCount - left.flaggedQuestionCount;
      }
      const leftReliability = left.averageReliability === null ? Number.POSITIVE_INFINITY : left.averageReliability;
      const rightReliability = right.averageReliability === null ? Number.POSITIVE_INFINITY : right.averageReliability;
      if (leftReliability !== rightReliability) {
        return leftReliability - rightReliability;
      }
      return right.sampleSize - left.sampleSize;
    })
    .slice(0, 5)
    .map((exam) => ({
      _id: exam._id,
      title: exam.title,
      sampleSize: exam.sampleSize,
      flaggedQuestionCount: exam.flaggedQuestionCount,
      averagePercent: exam.averagePercent,
      reliabilityAlpha: exam.averageReliability
    }));

  const flaggedSubjects = Array.from(flaggedSubjectMap.values())
    .map((entry) => ({
      subjectLabel: entry.subjectLabel,
      flaggedQuestionCount: entry.flaggedQuestionCount,
      questionCount: entry.questionCount,
      averageDifficulty: averageDefined(entry.difficultySamples, 1)
    }))
    .sort((left, right) => right.flaggedQuestionCount - left.flaggedQuestionCount || left.subjectLabel.localeCompare(right.subjectLabel))
    .slice(0, 6);

  const difficultyTrendRows = psychometricRows
    .filter((exam) => exam.sampleSize > 0)
    .sort((left, right) => new Date(left.createdAt) - new Date(right.createdAt))
    .slice(-6);

  return {
    examsWithQualityData: psychometricRows.filter((exam) => exam.sampleSize > 0).length,
    examsNeedingReview: psychometricRows.filter((exam) => exam.flaggedQuestionCount > 0).length,
    flaggedQuestionsTotal: psychometricRows.reduce((sum, exam) => sum + exam.flaggedQuestionCount, 0),
    averageReliability: averageDefined(psychometricRows.map((exam) => exam.averageReliability), 2),
    weakestExams,
    flaggedSubjects,
    reviewBacklog: reviewBacklog.slice(0, 8),
    difficultyTrend: {
      labels: difficultyTrendRows.map((exam) => exam.compactTitle),
      averageScores: difficultyTrendRows.map((exam) => Number(exam.averagePercent || 0)),
      averageItemCorrectness: difficultyTrendRows.map((exam) => Number(exam.averageItemCorrectness || 0))
    }
  };
};

async function getAdminDashboard() {
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

  const psychometricRollup = await hydrateTrainerPsychometrics(myExams);

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
      feedbackCount: ratingsCount,
      examsNeedingReview: psychometricRollup.examsNeedingReview,
      averageReliability: psychometricRollup.averageReliability,
      psychometricCoverage: psychometricRollup.examsWithQualityData,
      flaggedQuestionsTotal: psychometricRollup.flaggedQuestionsTotal
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
      })),
      psychometrics: psychometricRollup
    }
  };
}

module.exports = {
  getAdminDashboard,
  getTrainerDashboard
};
