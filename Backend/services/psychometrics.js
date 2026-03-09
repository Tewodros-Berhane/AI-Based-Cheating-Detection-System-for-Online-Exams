var TestPaperModel = require("../models/testpaper");
var AnswersheetModel = require("../models/answersheet");
var QuestionModel = require("../models/questions");
var options = require("../models/option");
var SubjectModel = require("../models/subject");
var PsychometricMetricModel = require("../models/psychometricMetric");
var aggregation = require("./psychometricAggregation");
var logger = require("./logger");

const isExactAnswerMatch = (selectedOptionIds = [], correctOptionIds = []) => {
    if (selectedOptionIds.length !== correctOptionIds.length) {
        return false;
    }

    const selectedSet = new Set(selectedOptionIds.map((id) => String(id)));
    return correctOptionIds.every((optionId) => selectedSet.has(String(optionId)));
};

const buildCandidateAnswerMap = (answers = []) => {
    const answerMap = new Map();
    answers.forEach((answer) => {
        answerMap.set(
            String(answer.questionid),
            Array.isArray(answer.chosenOption) ? answer.chosenOption.map((choice) => String(choice)) : []
        );
    });
    return answerMap;
};

const loadCompletedTest = async (testid) => {
    return TestPaperModel.findById(testid)
        .populate({
            path: 'questions',
            model: QuestionModel,
            select: { body: 1, weightage: 1, subject: 1, options: 1 },
            populate: [
                {
                    path: 'options',
                    model: options,
                    select: { optbody: 1, optimg: 1, isAnswer: 1 }
                },
                {
                    path: 'subject',
                    model: SubjectModel,
                    select: { topic: 1 }
                }
            ]
        });
};

const buildQuestionMetrics = ({ questions, candidates, sampleSize, maxScore }) => {
    return questions.map((question, questionIndex) => {
        const questionId = String(question._id);
        const weightage = Number(question.weightage || 1);
        const correctOptionIds = (question.options || [])
            .filter((optionDoc) => optionDoc.isAnswer)
            .map((optionDoc) => String(optionDoc._id));

        const optionSelectionRates = (question.options || []).map((optionDoc, optionIndex) => {
            const optionId = String(optionDoc._id);
            const count = candidates.filter((candidate) => {
                const selected = candidate.answerMap.get(questionId) || [];
                return selected.includes(optionId);
            }).length;
            return {
                optionid: optionDoc._id,
                label: String.fromCharCode(65 + optionIndex),
                text: optionDoc.optbody || '',
                isCorrect: Boolean(optionDoc.isAnswer),
                count,
                rate: sampleSize ? aggregation.roundNumber(count / sampleSize) : 0
            };
        });

        const binaryScores = candidates.map((candidate) => Number(candidate.itemScores[questionIndex] || 0));
        const selectedAnswerSets = candidates.map((candidate) => candidate.answerMap.get(questionId) || []);
        const correctCount = binaryScores.filter((value) => value === 1).length;
        const skippedCount = selectedAnswerSets.filter((selected) => !selected.length).length;
        const incorrectCount = Math.max(sampleSize - correctCount - skippedCount, 0);
        const difficultyIndex = sampleSize ? aggregation.roundNumber(correctCount / sampleSize) : null;
        const discriminationIndex = aggregation.computeDiscriminationIndex(binaryScores, candidates.map((candidate) => candidate.score));
        const pointBiserial = aggregation.computePointBiserial(
            binaryScores,
            candidates.map((candidate) => candidate.score - (candidate.itemScores[questionIndex] ? weightage : 0))
        );
        const qualityFlags = aggregation.computeQualityFlags({
            difficultyIndex,
            discriminationIndex,
            pointBiserial,
            optionSelectionRates
        });

        return {
            questionid: question._id,
            questionNumber: questionIndex + 1,
            questionBody: question.body || '',
            subjectid: question.subject ? question.subject._id : null,
            subjectLabel: question.subject && question.subject.topic ? question.subject.topic : 'Unassigned',
            weightage,
            correctCount,
            incorrectCount,
            skippedCount,
            difficultyIndex,
            discriminationIndex,
            pointBiserial,
            optionSelectionRates,
            flagLowQuality: qualityFlags.length > 0,
            qualityFlags
        };
    }).sort((left, right) => left.questionNumber - right.questionNumber);
};

const buildSubjectMetrics = (questionMetrics = []) => {
    const grouped = new Map();

    questionMetrics.forEach((metric) => {
        const key = metric.subjectid ? String(metric.subjectid) : 'unassigned';
        if (!grouped.has(key)) {
            grouped.set(key, {
                subjectid: metric.subjectid || null,
                subjectLabel: metric.subjectLabel || 'Unassigned',
                questionCount: 0,
                flaggedQuestionCount: 0,
                difficultySamples: []
            });
        }

        const current = grouped.get(key);
        current.questionCount += 1;
        if (metric.flagLowQuality) {
            current.flaggedQuestionCount += 1;
        }
        if (metric.difficultyIndex !== null) {
            current.difficultySamples.push(metric.difficultyIndex);
        }
    });

    return Array.from(grouped.values())
        .map((entry) => ({
            subjectid: entry.subjectid,
            subjectLabel: entry.subjectLabel,
            questionCount: entry.questionCount,
            flaggedQuestionCount: entry.flaggedQuestionCount,
            averageDifficultyIndex: entry.difficultySamples.length
                ? aggregation.roundNumber(aggregation.computeMean(entry.difficultySamples))
                : 0
        }))
        .sort((left, right) => right.flaggedQuestionCount - left.flaggedQuestionCount || left.subjectLabel.localeCompare(right.subjectLabel));
};

const buildPsychometricSnapshot = async ({ testid }) => {
    const test = await loadCompletedTest(testid);
    if (!test) {
        const error = new Error('Invalid test id.');
        error.code = 'INVALID_TEST';
        throw error;
    }

    const answerSheets = await AnswersheetModel.find({ testid, completed: true })
        .populate('answers', 'questionid chosenOption');

    const questions = Array.isArray(test.questions) ? test.questions : [];
    const sampleSize = answerSheets.length;
    const maxScore = questions.reduce((sum, question) => sum + Number(question.weightage || 1), 0);

    const candidates = answerSheets.map((answerSheet) => {
        const answerMap = buildCandidateAnswerMap(answerSheet.answers || []);
        const itemScores = questions.map((question) => {
            const correctOptionIds = (question.options || [])
                .filter((optionDoc) => optionDoc.isAnswer)
                .map((optionDoc) => String(optionDoc._id));
            const selectedOptionIds = answerMap.get(String(question._id)) || [];
            return isExactAnswerMatch(selectedOptionIds, correctOptionIds) ? 1 : 0;
        });

        const score = questions.reduce((sum, question, questionIndex) => {
            return sum + (itemScores[questionIndex] ? Number(question.weightage || 1) : 0);
        }, 0);

        return {
            userid: answerSheet.userid,
            answerMap,
            itemScores,
            score,
            percent: aggregation.computePercent(score, maxScore)
        };
    });

    const scores = candidates.map((candidate) => candidate.score);
    const percentages = candidates.map((candidate) => candidate.percent);
    const questionMetrics = buildQuestionMetrics({
        questions,
        candidates,
        sampleSize,
        maxScore
    });

    const flaggedQuestionCount = questionMetrics.filter((metric) => metric.flagLowQuality).length;
    const difficultQuestionCount = questionMetrics.filter((metric) => metric.difficultyIndex !== null && metric.difficultyIndex < 0.2).length;
    const easyQuestionCount = questionMetrics.filter((metric) => metric.difficultyIndex !== null && metric.difficultyIndex > 0.9).length;
    const lowDiscriminationCount = questionMetrics.filter((metric) => metric.discriminationIndex !== null && metric.discriminationIndex < 0.15).length;

    const snapshot = {
        testid: test._id,
        computedAt: new Date(),
        sampleSize,
        questionCount: questions.length,
        maxScore,
        summary: {
            averageScore: aggregation.roundNumber(aggregation.computeMean(scores), 2) || 0,
            averagePercent: aggregation.roundNumber(aggregation.computeMean(percentages), 2) || 0,
            medianScore: aggregation.roundNumber(aggregation.computeMedian(scores), 2) || 0,
            medianPercent: aggregation.roundNumber(aggregation.computeMedian(percentages), 2) || 0,
            passRate: sampleSize
                ? aggregation.roundNumber(candidates.filter((candidate) => candidate.percent >= 50).length / sampleSize, 4)
                : 0,
            reliabilityAlpha: aggregation.computeReliabilityAlpha(candidates.map((candidate) => candidate.itemScores)),
            flaggedQuestionCount,
            difficultQuestionCount,
            easyQuestionCount,
            lowDiscriminationCount
        },
        qualityDistribution: {
            healthy: Math.max(questionMetrics.length - flaggedQuestionCount, 0),
            flagged: flaggedQuestionCount
        },
        scoreDistribution: aggregation.buildScoreDistribution(percentages),
        subjectMetrics: buildSubjectMetrics(questionMetrics),
        topFlaggedQuestions: questionMetrics
            .filter((metric) => metric.flagLowQuality)
            .sort((left, right) => right.qualityFlags.length - left.qualityFlags.length || left.questionNumber - right.questionNumber)
            .slice(0, 5),
        questionMetrics
    };

    return snapshot;
};

const computeAndPersistSnapshot = async ({ testid }) => {
    const snapshot = await buildPsychometricSnapshot({ testid });
    await PsychometricMetricModel.findOneAndUpdate(
        { testid },
        snapshot,
        { upsert: true, setDefaultsOnInsert: true, new: true }
    );

    return snapshot;
};

const validateTrainerAccess = async (trainerid, testid) => {
    const test = await TestPaperModel.findOne({ _id: testid, createdBy: trainerid }, { _id: 1, testconducted: 1 });
    if (!test) {
        const error = new Error('Invalid test id.');
        error.code = 'INVALID_TEST';
        throw error;
    }

    if (!test.testconducted) {
        const error = new Error('Analytics become available after the exam is completed.');
        error.code = 'TEST_NOT_CONDUCTED';
        throw error;
    }

    return test;
};

const buildInterpretation = (sampleSize) => {
    if (sampleSize >= 20) {
        return {
            limited: false,
            message: 'Cohort size is sufficient for directional psychometric interpretation.'
        };
    }

    if (sampleSize >= 10) {
        return {
            limited: true,
            message: 'Cohort size is modest. Read discrimination and reliability signals carefully.'
        };
    }

    return {
        limited: true,
        message: 'Cohort size is small. Use these metrics as directional quality signals only.'
    };
};

const handlePsychometricError = (res, error) => {
    if (error && (error.code === 'INVALID_TEST' || error.code === 'TEST_NOT_CONDUCTED')) {
        return res.json({
            success: false,
            message: error.message
        });
    }

    logger.error('psychometric_request_failed', {
        error: logger.normalizeError(error)
    });
    return res.status(500).json({
        success: false,
        message: 'Unable to load psychometric analytics.'
    });
};

const getOverview = async (req, res) => {
    if (req.user.type !== 'TRAINER') {
        return res.status(401).json({
            success: false,
            message: 'Permissions not granted!'
        });
    }

    try {
        const testid = req.body.testid || req.body.id;
        await validateTrainerAccess(req.user._id, testid);
        const snapshot = await computeAndPersistSnapshot({ testid });

        return res.json({
            success: true,
            message: 'Psychometric overview',
            data: {
                testid: snapshot.testid,
                computedAt: snapshot.computedAt,
                sampleSize: snapshot.sampleSize,
                questionCount: snapshot.questionCount,
                maxScore: snapshot.maxScore,
                summary: snapshot.summary,
                qualityDistribution: snapshot.qualityDistribution,
                scoreDistribution: snapshot.scoreDistribution,
                subjectMetrics: snapshot.subjectMetrics,
                topFlaggedQuestions: snapshot.topFlaggedQuestions,
                interpretation: buildInterpretation(snapshot.sampleSize)
            }
        });
    } catch (error) {
        return handlePsychometricError(res, error);
    }
};

const getQuestionMetrics = async (req, res) => {
    if (req.user.type !== 'TRAINER') {
        return res.status(401).json({
            success: false,
            message: 'Permissions not granted!'
        });
    }

    try {
        const testid = req.body.testid || req.body.id;
        await validateTrainerAccess(req.user._id, testid);
        const snapshot = await computeAndPersistSnapshot({ testid });

        return res.json({
            success: true,
            message: 'Psychometric question metrics',
            data: {
                testid: snapshot.testid,
                computedAt: snapshot.computedAt,
                sampleSize: snapshot.sampleSize,
                questionCount: snapshot.questionCount,
                questionMetrics: snapshot.questionMetrics,
                interpretation: buildInterpretation(snapshot.sampleSize)
            }
        });
    } catch (error) {
        return handlePsychometricError(res, error);
    }
};

module.exports = {
    buildPsychometricSnapshot,
    computeAndPersistSnapshot,
    getOverview,
    getQuestionMetrics
};