var Excel = require('exceljs');
var path = require('path');
var fs = require('fs');
const appRoot = require('app-root-path');
var ResultModel = require('../models/results');
var TestpaperModel = require('../models/testpaper');
var generateResults = require('./generateResults');

let result = async (testid, MaxMarks) => {
  var workbook = new Excel.Workbook();
  var test = await TestpaperModel.findOne({ _id: testid, testconducted: true }, { testconducted: 1, type: 1, title: 1 });
  if (!test) {
    throw new Error('Invalid test id or exam not conducted');
  }

  await generateResults.ensureResultsForTest(testid);

  var results = await ResultModel.find({ testid: testid }, { score: 1, userid: 1, testid: 1 })
    .populate('userid')
    .populate('testid');

  var maxMarks = await MaxMarks(testid);
  var worksheet = workbook.addWorksheet('Results', { pageSetup: { paperSize: 9, orientation: 'landscape' } });

  worksheet.columns = [
    { header: 'Type', key: 'Type', width: 20 },
    { header: 'Test-Title', key: 'Title', width: 20 },
    { header: 'Name', key: 'Name', width: 30 },
    { header: 'Email', key: 'Email', width: 70 },
    { header: 'Contact', key: 'Contact', width: 35, outlineLevel: 1 },
    { header: 'Organisation', key: 'Organisation', width: 70 },
    { header: 'Score', key: 'Score', width: 20 },
    { header: 'Max Marks', key: 'Outof', width: 20 }
  ];

  results.forEach((entry) => {
    worksheet.addRow({
      Name: entry.userid.name,
      Email: entry.userid.emailid,
      Contact: entry.userid.contact,
      Organisation: entry.userid.organisation,
      Type: entry.testid.type,
      Title: entry.testid.title,
      Score: entry.score,
      Outof: maxMarks
    });
  });

  const resultDir = path.join(appRoot.path, 'public', 'result');
  const outputFile = path.join(resultDir, `result-${testid}.xlsx`);
  await fs.promises.mkdir(resultDir, { recursive: true });
  await workbook.xlsx.writeFile(outputFile);
  return 'Done';
};

module.exports = { result };