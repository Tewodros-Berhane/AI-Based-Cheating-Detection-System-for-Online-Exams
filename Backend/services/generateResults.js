var options = require("../models/option");
var AnswersheetModel = require("../models/answersheet");
var subResultsModel = require("../models/subResults");
var ResultModel = require("../models/results");

const ANSWER_LABELS = ['A', 'B', 'C', 'D', 'E'];

let generateResults = async (req,res,next)=>{
    const userid = req.body.userid;
    const testid = req.body.testid;

    try {
        const result = await gresult(userid, testid);
        res.json({
            success:true,
            message:"Result generated successfully",
            result:result
        });
    } catch (error) {
        console.log(error);
        const message = error && error.message === "invalid Inputs"
            ? "Result is not available for this candidate/test."
            : "Unable to generate result";
        res.status(500).json({
            success:false,
            message: message,
        });
    }
}

const buildQuestionResultRows = (answersheet) => {
    let score = 0;
    const questions = answersheet.questions || [];
    const answers = answersheet.answers || [];

    const subResults = questions.map((question, index) => {
        const answerDoc = answers.find((answer) => String(answer.questionid) === String(question._id)) || null;
        const chosenOptionIds = Array.isArray(answerDoc && answerDoc.chosenOption) ? answerDoc.chosenOption : [];
        const correctAns = [];
        const givenAns = [];

        (question.options || []).forEach((optionDoc, optionIndex) => {
            const optionLabel = ANSWER_LABELS[optionIndex] || `Option ${optionIndex + 1}`;
            if (optionDoc.isAnswer) {
                correctAns.push(optionLabel);
            }
            if (chosenOptionIds.some((selectedId) => String(selectedId) === String(optionDoc._id))) {
                givenAns.push(optionLabel);
            }
        });

        let iscorrect = false;
        if (correctAns.length === givenAns.length) {
            iscorrect = correctAns.every((label) => givenAns.includes(label));
        }

        if (iscorrect) {
            score += Number(question.weightage || 0);
        }

        return {
            qid: question._id,
            weightage: question.weightage,
            correctAnswer: correctAns,
            givenAnswer: givenAns,
            iscorrect,
            selectedOptionIds: chosenOptionIds,
            isSkipped: chosenOptionIds.length === 0,
            timeSpentSeconds: null
        };
    });

    return {
        score,
        subResults
    };
};

const fetchCompletedAnswersheet = async (uid, tid) => {
    return AnswersheetModel.findOne(
        { userid: uid, testid: tid, completed: true },
        { testid: 0, userid: 0, startTime: 0, completed: 0 }
    )
    .populate({
        path: 'questions',
        select: {
            weightage: 1,
            body: 1
        },
        populate: {
            path: 'options',
            model: options,
            select: {
                isAnswer: 1
            }
        }
    })
    .populate('answers', 'questionid chosenOption');
};

const gresult = async (uid, tid) => {
    const existing = await ResultModel.findOne({ userid: uid, testid: tid }).populate('result');
    if (existing) {
        return existing;
    }

    const answersheet = await fetchCompletedAnswersheet(uid, tid);
    if (!answersheet) {
        throw new Error("invalid Inputs");
    }

    const { score, subResults } = buildQuestionResultRows(answersheet);
    const insertedSubResults = subResults.length ? await subResultsModel.insertMany(subResults) : [];
    const resultDoc = await ResultModel.create({
        testid: tid,
        userid: uid,
        answerSheetid: answersheet._id,
        result: insertedSubResults.map((row) => row._id),
        score: score
    });

    return ResultModel.findById(resultDoc._id).populate('result');
}

const ensureResultsForTest = async (testid) => {
    const completedSheets = await AnswersheetModel.find(
        { testid, completed: true },
        { _id: 1, userid: 1 }
    );

    if (!completedSheets.length) {
        return [];
    }

    const existingResults = await ResultModel.find({ testid }, { userid: 1 });
    const existingUserIds = new Set(existingResults.map((row) => String(row.userid)));
    const missingSheets = completedSheets.filter((sheet) => !existingUserIds.has(String(sheet.userid)));

    if (!missingSheets.length) {
        return [];
    }

    return Promise.all(missingSheets.map((sheet) => gresult(sheet.userid, testid)));
};

module.exports = {
    generateResults,
    gresult,
    ensureResultsForTest,
    buildQuestionResultRows
}