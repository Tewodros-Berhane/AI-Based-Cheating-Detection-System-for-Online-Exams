import React, { Component } from 'react';
import './testdetails.css';
import { Row, Col, Skeleton } from 'antd-compat';
import { Bar, Doughnut } from 'react-chartjs-2';
import { ArcElement, BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip } from 'chart.js';
import { bgcolor, bordercolor } from '../../../services/bgcolor';
import { SecurePost } from '../../../services/axiosCall';
import apis from '../../../services/Apis';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

const ratioPercent = (value) => (value === null || value === undefined ? '--' : `${(Number(value) * 100).toFixed(1)}%`);
const directPercent = (value) => (value === null || value === undefined ? '--' : `${Number(value).toFixed(1)}%`);
const metricValue = (value, digits = 2) => (value === null || value === undefined ? '--' : Number(value).toFixed(digits));

export default class Stats extends Component {
    constructor(props){
        super(props);
        this.state={
            id:this.props.id,
            stats:this.props.stats || [],
            Scorelable:[],
            Scoredata:[],
            bgColor1:[],
            borcolor1:[],
            maxmMarks:this.props.maxmMarks,
            passData:[0,0],
            passLable:['Fail','Pass'],
            stat:['91% to 100%','81% to 90%','71% to 80%','61% to 70%','50% to 60%','Below 50%'],
            statdata:[0,0,0,0,0,0],
            psychometricOverview:null,
            questionMetrics:[],
            analyticsLoading:true,
            analyticsError:''
        } 
    }

    extractFileName = (url = '') => {
        try {
            const clean = String(url).split('?')[0];
            return clean.substring(clean.lastIndexOf('/') + 1) || 'exam-results.xlsx';
        } catch (error) {
            return 'exam-results.xlsx';
        }
    }

    downloadExcel = async () => {
        const fileUrl = this.props.file;
        if (!fileUrl) {
            return;
        }

        try {
            const response = await fetch(fileUrl, { method: 'GET' });
            if (!response.ok) {
                throw new Error(`Download failed with status ${response.status}`);
            }

            const blob = await response.blob();
            const objectUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = objectUrl;
            link.download = this.extractFileName(fileUrl);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(objectUrl);
        } catch (error) {
            window.open(fileUrl, '_blank', 'noopener,noreferrer');
        }
    }

    prepareLegacyCharts = () => {
        let { bgColor1, borcolor1 } = this.state;
        let maxi = -1;
        let p = 0;
        let f = 0;
        let p90_100 = 0;
        let p80_90 = 0;
        let p70_80 = 0;
        let p60_70 = 0;
        let p50_60 = 0;
        let below50 = 0;

        this.state.stats.forEach((entry) => {
            const safeMaxMarks = this.state.maxmMarks > 0 ? this.state.maxmMarks : 1;
            const percent = (entry.score / safeMaxMarks) * 100;
            if(percent >= 91){
                p90_100++;
            }
            else if(percent >= 81){
                p80_90++;
            }
            else if(percent >= 71){
                p70_80++;
            }
            else if(percent >= 61){
                p60_70++;
            }
            else if(percent >= 50){
                p50_60++;
            }
            else{
                below50++;
            }

            if(entry.score >= this.state.maxmMarks / 2){
                p++;
            }
            else{
                f++;
            }
            if(entry.score > maxi){
                maxi = entry.score;
            }
        });

        var scorePoints = [];
        var labels = [];
        for(let index = 0; index <= maxi; index++){
            scorePoints.push(0);
            labels.push(index);
            bgColor1.push(bgcolor[index]);
            borcolor1.push(bordercolor[index]);
        }

        this.state.stats.forEach((entry) => {
            scorePoints[entry.score]++;
        });

        this.setState({
            Scorelable:labels,
            Scoredata:scorePoints,
            bgColor1:bgColor1,
            borcolor1:borcolor1,
            passData:[f,p],
            statdata:[p90_100,p80_90,p70_80,p60_70,p50_60,below50]
        });
    }

    loadPsychometrics = async () => {
        try {
            const [overviewResponse, questionsResponse] = await Promise.all([
                SecurePost({
                    url: apis.GET_TEST_PSYCHOMETRIC_OVERVIEW,
                    data: { testid: this.state.id }
                }),
                SecurePost({
                    url: apis.GET_TEST_PSYCHOMETRIC_QUESTIONS,
                    data: { testid: this.state.id }
                })
            ]);

            if (!overviewResponse.data.success) {
                throw new Error(overviewResponse.data.message || 'Unable to load the exam quality overview.');
            }

            if (!questionsResponse.data.success) {
                throw new Error(questionsResponse.data.message || 'Unable to load question analytics.');
            }

            this.setState({
                psychometricOverview: overviewResponse.data.data,
                questionMetrics: questionsResponse.data.data.questionMetrics || [],
                analyticsLoading: false,
                analyticsError: ''
            });
        } catch (error) {
            this.setState({
                analyticsLoading: false,
                analyticsError: error && error.message ? error.message : 'Unable to load exam quality insights.'
            });
        }
    }

    componentDidMount(){
        this.prepareLegacyCharts();
        this.loadPsychometrics();
    }

    renderPsychometricOverview(){
        const { analyticsLoading, analyticsError, psychometricOverview } = this.state;
        if (analyticsLoading) {
            return (
                <section className="testdetails-block">
                    <Skeleton active />
                </section>
            );
        }

        if (analyticsError) {
            return (
                <section className="testdetails-block">
                    <div className="testdetails-block-head">
                        <h4>Exam Quality Overview</h4>
                        <p>We could not load the exam quality summary for this exam.</p>
                    </div>
                    <div className="testdetails-empty">{analyticsError}</div>
                </section>
            );
        }

        if (!psychometricOverview) {
            return null;
        }

        const { summary, qualityDistribution, subjectMetrics, topFlaggedQuestions, interpretation, sampleSize, maxScore } = psychometricOverview;
        const qualityChart = {
            labels: ['Healthy items', 'Flagged items'],
            datasets: [{
                label: 'Question quality',
                data: [qualityDistribution.healthy, qualityDistribution.flagged],
                backgroundColor: ['rgba(37, 99, 235, 0.68)', 'rgba(239, 68, 68, 0.72)'],
                borderColor: ['rgba(96, 165, 250, 0.95)', 'rgba(248, 113, 113, 0.92)'],
                borderWidth: 1
            }]
        };
        const subjectChart = {
            labels: (subjectMetrics || []).slice(0, 6).map((entry) => entry.subjectLabel),
            datasets: [{
                label: 'Flagged questions',
                data: (subjectMetrics || []).slice(0, 6).map((entry) => entry.flaggedQuestionCount),
                backgroundColor: 'rgba(59, 130, 246, 0.66)',
                borderColor: 'rgba(96, 165, 250, 0.95)',
                borderWidth: 1,
                borderRadius: 8
            }]
        };
        const difficultyProfile = {
            labels: this.state.questionMetrics.slice(0, 12).map((metric) => `Q${metric.questionNumber}`),
            datasets: [{
                label: 'Difficulty index',
                data: this.state.questionMetrics.slice(0, 12).map((metric) => Number(metric.difficultyIndex || 0) * 100),
                backgroundColor: 'rgba(14, 165, 233, 0.6)',
                borderColor: 'rgba(56, 189, 248, 0.95)',
                borderWidth: 1,
                borderRadius: 8
            }]
        };
        const summaryCards = [
            { label: 'Average Score', value: `${metricValue(summary.averageScore, 1)} / ${metricValue(maxScore, 0)}`, caption: `${directPercent(summary.averagePercent)} cohort average` },
            { label: 'Median Score', value: `${metricValue(summary.medianScore, 1)} / ${metricValue(maxScore, 0)}`, caption: `${directPercent(summary.medianPercent)} midpoint examinee` },
            { label: 'Pass Rate', value: ratioPercent(summary.passRate), caption: 'Examinees at or above 50%' },
            { label: 'Reliability', value: metricValue(summary.reliabilityAlpha, 2), caption: 'Internal consistency signal' },
            { label: 'Flagged Questions', value: String(summary.flaggedQuestionCount || 0), caption: 'Items that need review' },
            { label: 'Sample Size', value: String(sampleSize || 0), caption: 'Completed examinee attempts' }
        ];

        return (
            <section className="testdetails-block">
                <div className="testdetails-block-head">
                    <h4>Exam Quality Overview</h4>
                    <p>Use these signals to review question quality, consistency, and cohort performance.</p>
                </div>

                <div className="testdetails-psych-note">{interpretation && interpretation.message}</div>

                <div className="testdetails-psych-grid">
                    {summaryCards.map((card) => (
                        <article key={card.label} className="testdetails-psych-card">
                            <span className="testdetails-meta-label">{card.label}</span>
                            <strong className="testdetails-psych-value">{card.value}</strong>
                            <span className="testdetails-psych-caption">{card.caption}</span>
                        </article>
                    ))}
                </div>

                <Row gutter={16}>
                    <Col xs={24} lg={8}>
                        <div className="testdetails-chart-block">
                            <div className="testdetails-block-head">
                                <h4>Question Quality</h4>
                                <p>Healthy versus flagged items in this exam.</p>
                            </div>
                            <div className="testdetails-chart-wrap">
                                <Doughnut data={qualityChart} />
                            </div>
                        </div>
                    </Col>
                    <Col xs={24} lg={8}>
                        <div className="testdetails-chart-block">
                            <div className="testdetails-block-head">
                                <h4>Difficulty Profile</h4>
                                <p>First twelve questions by difficulty index.</p>
                            </div>
                            <div className="testdetails-chart-wrap">
                                <Bar
                                    data={difficultyProfile}
                                    options={{
                                        maintainAspectRatio: false,
                                        scales: {
                                            y: {
                                                beginAtZero: true,
                                                max: 100
                                            }
                                        },
                                        plugins: {
                                            legend: { display: false }
                                        }
                                    }}
                                />
                            </div>
                        </div>
                    </Col>
                    <Col xs={24} lg={8}>
                        <div className="testdetails-chart-block">
                            <div className="testdetails-block-head">
                                <h4>Subjects Under Review</h4>
                                <p>Course areas with the most flagged questions.</p>
                            </div>
                            <div className="testdetails-chart-wrap">
                                <Bar
                                    data={subjectChart}
                                    options={{
                                        maintainAspectRatio: false,
                                        indexAxis: 'y',
                                        plugins: {
                                            legend: { display: false }
                                        },
                                        scales: {
                                            x: {
                                                beginAtZero: true,
                                                ticks: {
                                                    precision: 0
                                                }
                                            }
                                        }
                                    }}
                                />
                            </div>
                        </div>
                    </Col>
                </Row>

                <div className="testdetails-flagged-list">
                    <div className="testdetails-block-head">
                        <h4>Priority Questions</h4>
                        <p>Start your review with the items that triggered the most quality flags.</p>
                    </div>
                    {(topFlaggedQuestions || []).length ? (topFlaggedQuestions || []).map((metric) => (
                        <article className="testdetails-flagged-card" key={metric.questionid}>
                            <div>
                                <strong>{`Q${metric.questionNumber}`}</strong>
                                <p>{metric.questionBody}</p>
                            </div>
                            <div className="testdetails-flagged-tags">
                                {metric.qualityFlags.map((flag) => (
                                    <span key={`${metric.questionid}-${flag}`} className="testdetails-quality-pill flagged">{flag}</span>
                                ))}
                            </div>
                        </article>
                    )) : <div className="testdetails-empty">No flagged questions were detected for this exam.</div>}
                </div>
            </section>
        );
    }

    renderSupportReviewOverview(){
        const reportingRows = (this.state.stats || [])
            .map((row) => row.reportingSummary)
            .filter(Boolean);

        const supportCount = reportingRows.filter((item) => item.support && item.support.hasAdjustments).length;
        const moderatedCount = reportingRows.filter((item) => Number(item.moderation && item.moderation.actionCount) > 0).length;
        const warningCount = reportingRows.reduce((sum, item) => {
            const counts = item.moderation && item.moderation.counts ? item.moderation.counts : {};
            return sum + Number(counts.WARN_CANDIDATE || 0);
        }, 0);
        const forceSubmitCount = reportingRows.filter((item) => item.finalDisposition && item.finalDisposition.label === 'Force submitted by examiner').length;

        const cards = [
            { label: 'Support Plans', value: supportCount, caption: 'Examinees with active or applied support adjustments' },
            { label: 'Examiner Reviews', value: moderatedCount, caption: 'Examinees with one or more examiner actions logged' },
            { label: 'Warnings Sent', value: warningCount, caption: 'Visible session warnings issued during the exam' },
            { label: 'Force Submits', value: forceSubmitCount, caption: 'Sessions closed directly by the examiner' }
        ];

        return (
            <section className="testdetails-block">
                <div className="testdetails-block-head">
                    <h4>Support and Review Summary</h4>
                    <p>Track examinee support plans and examiner interventions alongside the score report.</p>
                </div>
                <div className="testdetails-reporting-grid">
                    {cards.map((card) => (
                        <article className="testdetails-reporting-card" key={card.label}>
                            <span className="testdetails-meta-label">{card.label}</span>
                            <strong className="testdetails-psych-value">{card.value}</strong>
                            <span className="testdetails-psych-caption">{card.caption}</span>
                        </article>
                    ))}
                </div>
            </section>
        );
    }

    renderQuestionAnalytics(){
        const { analyticsLoading, analyticsError, questionMetrics } = this.state;
        if (analyticsLoading || analyticsError) {
            return null;
        }

        return (
            <section className="testdetails-block">
                <div className="testdetails-block-head">
                    <h4>Question Analytics</h4>
                    <p>Inspect item-level quality, answer-choice performance, and correction priorities.</p>
                </div>
                {!questionMetrics.length ? (
                    <div className="testdetails-empty">No completed attempts are available yet for question-level analytics.</div>
                ) : (
                    <div className="testdetails-table-wrap">
                        <table className="testdetails-psych-table">
                            <thead>
                                <tr>
                                    <th>Question</th>
                                    <th>Difficulty</th>
                                    <th>Discrimination</th>
                                    <th>Point-biserial</th>
                                    <th>Attempts</th>
                                    <th>Quality</th>
                                </tr>
                            </thead>
                            <tbody>
                                {questionMetrics.map((metric) => (
                                    <tr key={metric.questionid}>
                                        <td>
                                            <div className="testdetails-psych-question">
                                                <strong>{`Q${metric.questionNumber}`}</strong>
                                                <p>{metric.questionBody}</p>
                                                <span>{`${metric.subjectLabel} | ${metric.weightage} mark${Number(metric.weightage) === 1 ? '' : 's'}`}</span>
                                            </div>
                                        </td>
                                        <td>{ratioPercent(metric.difficultyIndex)}</td>
                                        <td>{metricValue(metric.discriminationIndex, 2)}</td>
                                        <td>{metricValue(metric.pointBiserial, 2)}</td>
                                        <td>{`${metric.correctCount}/${metric.correctCount + metric.incorrectCount + metric.skippedCount} correct`}</td>
                                        <td>
                                            <div className="testdetails-quality-list">
                                                {metric.flagLowQuality ? metric.qualityFlags.map((flag) => (
                                                    <span key={`${metric.questionid}-${flag}`} className="testdetails-quality-pill flagged">{flag}</span>
                                                )) : <span className="testdetails-quality-pill healthy">Healthy</span>}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        );
    }

    render() {
        let barData={
            labels:this.state.Scorelable,
            datasets:[{
                label: 'Scores',
                data: this.state.Scoredata,
                backgroundColor:this.state.bgColor1,
                borderColor:this.state.borcolor1,
                borderWidth: 1
            }]
        }
        let DoughNutData1={
            labels:this.state.passLable,
            datasets:[{
                label: 'Pass/Fail',
                data: this.state.passData,
                backgroundColor:[bgcolor[0],bgcolor[1]],
                borderColor:[bordercolor[0],bordercolor[1]],
                borderWidth: 1
            }]
        }
        let DoughNutData2={
            labels:this.state.stat,
            datasets:[{
                label: 'Percentage wise category',
                data: this.state.statdata,
                backgroundColor:[bgcolor[0],bgcolor[1],bgcolor[2],bgcolor[3],bgcolor[4],bgcolor[5]],
                borderColor:[bordercolor[0],bordercolor[1],bordercolor[2],bordercolor[3],bordercolor[4],bordercolor[5]],
                borderWidth: 1
            }]
        }
        return (
            <div className="testdetails-stats-stack">
                {this.renderPsychometricOverview()}
                {this.renderQuestionAnalytics()}
                {this.renderSupportReviewOverview()}

                <section className="testdetails-block">
                    <div className="testdetails-block-head">
                        <h4>Result Export</h4>
                        <p>Download the generated score report with support settings and examiner review details.</p>
                    </div>
                    <div className="testdetails-export-note">Includes support adjustments, examiner actions, final disposition, and the last examiner update for each examinee.</div>
                    <div className="download-section">
                        <button type="button" className="download-xlsx" onClick={this.downloadExcel}>Download Excel</button>
                    </div>
                </section>

                <section className="testdetails-block">
                    <div className="testdetails-block-head">
                        <h4>Score Distribution</h4>
                        <p>Compare score spread against examinee count.</p>
                    </div>
                    <div className="testdetails-chart-wrap testdetails-chart-wrap-bar">
                        <Bar
                            data={barData}
                            options={{
                                maintainAspectRatio: false,
                                plugins: {
                                    legend: { display: false }
                                }
                            }}
                        />
                    </div>
                </section>

                <section className="testdetails-block">
                    <Row gutter={16}>
                        <Col xs={24} md={12}>
                            <div className="testdetails-chart-block">
                                <div className="testdetails-block-head">
                                    <h4>Pass / Fail</h4>
                                    <p>Outcome split based on 50% threshold.</p>
                                </div>
                                <div className="testdetails-chart-wrap">
                                    <Doughnut data={DoughNutData1} />
                                </div>
                            </div>
                        </Col>
                        <Col xs={24} md={12}>
                            <div className="testdetails-chart-block">
                                <div className="testdetails-block-head">
                                    <h4>Score Bands</h4>
                                    <p>Examinee distribution by percentage range.</p>
                                </div>
                                <div className="testdetails-chart-wrap">
                                    <Doughnut data={DoughNutData2} />
                                </div>
                            </div>
                        </Col>
                    </Row>
                </section>
            </div>
        )
    }
}