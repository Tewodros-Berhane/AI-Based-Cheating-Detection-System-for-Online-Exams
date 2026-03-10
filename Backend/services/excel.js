var Excel = require('exceljs');
var path = require('path');
var fs = require('fs');
const appRoot = require('app-root-path');
var ResultModel = require('../models/results');
var TestpaperModel = require('../models/testpaper');
var AnswersheetModel = require('../models/answersheet');
var ModerationActionModel = require('../models/moderationAction');
var generateResults = require('./generateResults');
const reportingSummary = require('./reportingSummary');

let result = async (testid, MaxMarks) => {
  var workbook = new Excel.Workbook();
  var test = await TestpaperModel.findOne(
    { _id: testid, testconducted: true },
    { testconducted: 1, type: 1, title: 1, duration: 1, integrityMode: 1, integrityPolicy: 1, faceRecognitionEnabled: 1 }
  );
  if (!test) {
    throw new Error('Invalid test id or exam not conducted');
  }

  await generateResults.ensureResultsForTest(testid);

  var results = await ResultModel.find({ testid: testid }, { score: 1, userid: 1, testid: 1, answerSheetid: 1 })
    .populate('userid')
    .populate('testid');

  const userIds = results
    .map((entry) => entry.userid && entry.userid._id)
    .filter(Boolean);
  const answerSheetIds = results
    .map((entry) => entry.answerSheetid)
    .filter(Boolean);

  const [answerSheets, moderationActions] = await Promise.all([
    AnswersheetModel.find(
      { _id: { $in: answerSheetIds } },
      {
        userid: 1,
        completionReason: 1,
        moderationStatus: 1,
        lastModerationActionAt: 1,
        grantedExtraTimeMinutes: 1,
        effectiveDurationMinutes: 1,
        effectiveIntegrityPolicy: 1,
        effectiveUiAdjustments: 1
      }
    ).lean(),
    ModerationActionModel.find(
      { testid, traineeid: { $in: userIds } },
      { traineeid: 1, actionType: 1, reason: 1, visibleToCandidate: 1, createdAt: 1, payload: 1 }
    )
      .sort({ createdAt: -1 })
      .lean()
  ]);

  const answerSheetByUser = new Map(answerSheets.map((sheet) => [String(sheet.userid), sheet]));
  const actionsByUser = moderationActions.reduce((accumulator, action) => {
    const key = String(action.traineeid);
    if (!accumulator.has(key)) {
      accumulator.set(key, []);
    }
    accumulator.get(key).push(action);
    return accumulator;
  }, new Map());

  var maxMarks = await MaxMarks(testid);
  var worksheet = workbook.addWorksheet('Results', { pageSetup: { paperSize: 9, orientation: 'landscape' } });

  worksheet.columns = [
    { header: 'Type', key: 'Type', width: 20 },
    { header: 'Test-Title', key: 'Title', width: 28 },
    { header: 'Name', key: 'Name', width: 30 },
    { header: 'Email', key: 'Email', width: 36 },
    { header: 'Contact', key: 'Contact', width: 18 },
    { header: 'Organisation', key: 'Organisation', width: 24 },
    { header: 'Score', key: 'Score', width: 12 },
    { header: 'Max Marks', key: 'Outof', width: 12 },
    { header: 'Support Applied', key: 'SupportApplied', width: 34 },
    { header: 'Trainer Review', key: 'TrainerReview', width: 34 },
    { header: 'Final Disposition', key: 'FinalDisposition', width: 28 },
    { header: 'Last Trainer Update', key: 'LastTrainerUpdate', width: 24 }
  ];

  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).alignment = { vertical: 'middle' };

  results.forEach((entry) => {
    const userId = entry.userid && entry.userid._id ? String(entry.userid._id) : '';
    const candidateSummary = reportingSummary.summarizeCandidateReporting({
      test,
      answerSheet: answerSheetByUser.get(userId) || null,
      actions: actionsByUser.get(userId) || []
    });

    const row = worksheet.addRow({
      Name: entry.userid.name,
      Email: entry.userid.emailid,
      Contact: entry.userid.contact,
      Organisation: entry.userid.organisation,
      Type: entry.testid.type,
      Title: entry.testid.title,
      Score: entry.score,
      Outof: maxMarks,
      SupportApplied: candidateSummary.support.summaryLine,
      TrainerReview: candidateSummary.moderation.summaryLine,
      FinalDisposition: candidateSummary.finalDisposition.label,
      LastTrainerUpdate: candidateSummary.moderation.lastActionAt
        ? new Date(candidateSummary.moderation.lastActionAt).toLocaleString()
        : '-'
    });

    row.alignment = { vertical: 'top', wrapText: true };
  });

  const resultDir = path.join(appRoot.path, 'public', 'result');
  const outputFile = path.join(resultDir, `result-${testid}.xlsx`);
  await fs.promises.mkdir(resultDir, { recursive: true });
  await workbook.xlsx.writeFile(outputFile);
  return 'Done';
};

module.exports = { result };
