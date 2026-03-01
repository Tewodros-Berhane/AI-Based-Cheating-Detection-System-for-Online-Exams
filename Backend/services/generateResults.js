var options = require("../models/option");
var AnswersheetModel = require("../models/answersheet");
var subResultsModel = require("../models/subResults");
var ResultModel = require("../models/results");

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

const gresult = async (uid, tid) => {
    const ansMap = ['A', 'B', 'C', 'D', 'E'];

    const existing = await ResultModel.findOne({ userid: uid, testid: tid }).populate('result');
    if (existing) {
        return existing;
    }

    const answersheet = await AnswersheetModel.findOne(
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

    if (!answersheet) {
        throw new Error("invalid Inputs");
    }

    let score = 0;
    const questions = answersheet.questions || [];
    const answers = answersheet.answers || [];

    const subResults = questions.map((question, index) => {
        const answerDoc = answers.find((a) => String(a.questionid) === String(question._id)) || answers[index];
        const chosen = Array.isArray(answerDoc && answerDoc.chosenOption) ? answerDoc.chosenOption : [];
        const correctAns = [];
        const givenAns = [];

        (question.options || []).forEach((opt, optIndex) => {
            const optionLabel = ansMap[optIndex] || String(optIndex + 1);
            if (opt.isAnswer) {
                correctAns.push(optionLabel);
            }
            if (chosen.some((selectedId) => String(selectedId) === String(opt._id))) {
                givenAns.push(optionLabel);
            }
        });

        let iscorrect = false;
        if (correctAns.length === givenAns.length) {
            iscorrect = correctAns.every((label) => givenAns.includes(label));
        }

        if (iscorrect) {
            score += question.weightage;
        }

        return {
            qid: question._id,
            weightage: question.weightage,
            correctAnswer: correctAns,
            givenAnswer: givenAns,
            iscorrect: iscorrect
        };
    });

    const insertedSubResults = await subResultsModel.insertMany(subResults);
    const resultDoc = await ResultModel.create({
        testid: tid,
        userid: uid,
        answerSheetid: answersheet._id,
        result: insertedSubResults.map((row) => row._id),
        score: score
    });

    return ResultModel.findById(resultDoc._id).populate('result');
}

module.exports = {generateResults,gresult}
