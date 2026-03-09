const roundNumber = (value, digits = 4) => {
    if (value === null || value === undefined) {
        return null;
    }

    const numeric = Number(value);
    if (Number.isNaN(numeric) || !Number.isFinite(numeric)) {
        return null;
    }

    const factor = Math.pow(10, digits);
    return Math.round(numeric * factor) / factor;
};

const computeMean = (values = []) => {
    if (!values.length) {
        return 0;
    }

    const total = values.reduce((sum, value) => sum + Number(value || 0), 0);
    return total / values.length;
};

const computeMedian = (values = []) => {
    if (!values.length) {
        return 0;
    }

    const ordered = values
        .map((value) => Number(value || 0))
        .sort((a, b) => a - b);
    const middle = Math.floor(ordered.length / 2);

    if (ordered.length % 2 === 0) {
        return (ordered[middle - 1] + ordered[middle]) / 2;
    }

    return ordered[middle];
};

const computeVariance = (values = [], useSample = false) => {
    if (!values.length) {
        return 0;
    }

    const mean = computeMean(values);
    const squaredDistance = values.reduce((sum, value) => {
        const distance = Number(value || 0) - mean;
        return sum + (distance * distance);
    }, 0);

    const divisor = useSample ? values.length - 1 : values.length;
    if (divisor <= 0) {
        return 0;
    }

    return squaredDistance / divisor;
};

const computePercent = (score = 0, maxScore = 0) => {
    if (!maxScore) {
        return 0;
    }

    return (Number(score || 0) / Number(maxScore || 1)) * 100;
};

const buildScoreDistribution = (percentages = []) => {
    const bands = [
        { label: '90% - 100%', minPercent: 90, maxPercent: 100 },
        { label: '80% - 89%', minPercent: 80, maxPercent: 89.9999 },
        { label: '70% - 79%', minPercent: 70, maxPercent: 79.9999 },
        { label: '60% - 69%', minPercent: 60, maxPercent: 69.9999 },
        { label: '50% - 59%', minPercent: 50, maxPercent: 59.9999 },
        { label: 'Below 50%', minPercent: 0, maxPercent: 49.9999 }
    ];

    return bands.map((band) => ({
        ...band,
        count: percentages.filter((percent) => percent >= band.minPercent && percent <= band.maxPercent).length
    }));
};

const computeDiscriminationIndex = (binaryScores = [], totalScores = []) => {
    if (binaryScores.length !== totalScores.length || binaryScores.length < 4) {
        return null;
    }

    const ranked = totalScores
        .map((score, index) => ({ score: Number(score || 0), itemScore: Number(binaryScores[index] || 0) }))
        .sort((left, right) => right.score - left.score);

    const groupSize = Math.max(1, Math.round(ranked.length * 0.27));
    const topGroup = ranked.slice(0, groupSize);
    const bottomGroup = ranked.slice(Math.max(ranked.length - groupSize, groupSize));

    if (!topGroup.length || !bottomGroup.length) {
        return null;
    }

    const topRate = computeMean(topGroup.map((entry) => entry.itemScore));
    const bottomRate = computeMean(bottomGroup.map((entry) => entry.itemScore));
    return roundNumber(topRate - bottomRate);
};

const computePointBiserial = (binaryScores = [], totalScores = []) => {
    if (binaryScores.length !== totalScores.length || binaryScores.length < 3) {
        return null;
    }

    const x = binaryScores.map((value) => Number(value || 0));
    const y = totalScores.map((value) => Number(value || 0));
    const xMean = computeMean(x);
    const yMean = computeMean(y);
    const xVariance = computeVariance(x);
    const yVariance = computeVariance(y);

    if (xVariance <= 0 || yVariance <= 0) {
        return null;
    }

    let covariance = 0;
    for (let index = 0; index < x.length; index += 1) {
        covariance += (x[index] - xMean) * (y[index] - yMean);
    }

    covariance /= x.length;
    const correlation = covariance / (Math.sqrt(xVariance) * Math.sqrt(yVariance));
    return roundNumber(correlation);
};

const computeReliabilityAlpha = (binaryMatrix = []) => {
    if (!binaryMatrix.length || !binaryMatrix[0] || binaryMatrix[0].length < 2 || binaryMatrix.length < 2) {
        return null;
    }

    const itemCount = binaryMatrix[0].length;
    const totalScores = binaryMatrix.map((row) => row.reduce((sum, value) => sum + Number(value || 0), 0));
    const totalVariance = computeVariance(totalScores, true);

    if (totalVariance <= 0) {
        return null;
    }

    const itemVariances = Array.from({ length: itemCount }).map((_, columnIndex) => {
        const column = binaryMatrix.map((row) => Number(row[columnIndex] || 0));
        return computeVariance(column, true);
    });

    const sumItemVariance = itemVariances.reduce((sum, value) => sum + value, 0);
    const alpha = (itemCount / (itemCount - 1)) * (1 - (sumItemVariance / totalVariance));
    return roundNumber(alpha);
};

const computeQualityFlags = ({ difficultyIndex, discriminationIndex, pointBiserial, optionSelectionRates }) => {
    const flags = [];

    if (difficultyIndex !== null && difficultyIndex < 0.2) {
        flags.push('Too difficult');
    }

    if (difficultyIndex !== null && difficultyIndex > 0.9) {
        flags.push('Too easy');
    }

    if (discriminationIndex !== null && discriminationIndex < 0.15) {
        flags.push('Low discrimination');
    }

    if (pointBiserial !== null && pointBiserial < 0) {
        flags.push('Negative point-biserial');
    }

    (optionSelectionRates || []).forEach((optionMetric) => {
        if (!optionMetric.isCorrect && Number(optionMetric.rate || 0) > 0 && Number(optionMetric.rate || 0) < 0.05) {
            flags.push(`Distractor ${optionMetric.label} rarely selected`);
        }
    });

    return flags;
};

module.exports = {
    roundNumber,
    computeMean,
    computeMedian,
    computeVariance,
    computePercent,
    buildScoreDistribution,
    computeDiscriminationIndex,
    computePointBiserial,
    computeReliabilityAlpha,
    computeQualityFlags
};