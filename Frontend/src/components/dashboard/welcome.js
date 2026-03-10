import React, { useEffect, useMemo, useState } from 'react';
import { connect } from 'react-redux';
import './welcome.css';
import { Alert, Card, Col, Empty, Row, Spin, Statistic, Tag } from 'antd-compat';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip
} from 'chart.js';
import { loadDashboard } from '../../services/dashboard';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, LineElement, PointElement, Tooltip, Legend);

const chartTextColor = '#9fb0d0';
const chartGridColor = 'rgba(148, 163, 184, 0.2)';

const trendOptions = {
  maintainAspectRatio: false,
  responsive: true,
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        color: chartTextColor,
        boxWidth: 10,
        usePointStyle: true,
        pointStyle: 'circle'
      }
    }
  },
  scales: {
    x: {
      ticks: { color: chartTextColor },
      grid: { color: chartGridColor }
    },
    y: {
      ticks: { color: chartTextColor, precision: 0 },
      grid: { color: chartGridColor },
      beginAtZero: true
    }
  }
};

const doughnutOptions = {
  maintainAspectRatio: false,
  cutout: '62%',
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        color: chartTextColor,
        boxWidth: 10
      }
    }
  }
};

const topExamsOptions = {
  maintainAspectRatio: false,
  indexAxis: 'y',
  plugins: {
    legend: { display: false }
  },
  scales: {
    x: {
      beginAtZero: true,
      ticks: { color: chartTextColor, precision: 0 },
      grid: { color: chartGridColor }
    },
    y: {
      ticks: { color: chartTextColor },
      grid: { display: false }
    }
  }
};

const metricValue = (value, digits = 2, suffix = '') => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '--';
  }
  return `${Number(value).toFixed(digits)}${suffix}`;
};

function Welcome({ user }) {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const userType = user?.userDetails?.type || 'USER';

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const data = await loadDashboard();
        setDashboard(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const adminStats = useMemo(
    () => [
      { title: 'Active Exams', value: dashboard?.stats?.totalExams || 0, suffix: 'live' },
      { title: 'Question Bank', value: dashboard?.stats?.totalQuestions || 0, suffix: 'items' },
      { title: 'Examiners', value: dashboard?.stats?.totalTrainers || 0, suffix: 'members' },
      { title: 'Courses', value: dashboard?.stats?.totalCourses || 0, suffix: 'tracks' }
    ],
    [dashboard]
  );

  const psychometricAnalytics = dashboard?.analytics?.psychometrics || {
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

  const trainerStats = useMemo(() => {
    const stats = dashboard?.stats || {};
    return [
      { title: 'Total Exams', value: stats.myExamCount || 0, suffix: 'managed', kind: 'primary' },
      { title: 'Live Sessions', value: stats.examsLive || 0, suffix: 'active now', kind: 'warning' },
      { title: 'Candidates', value: stats.myTraineesCount || 0, suffix: 'registered', kind: 'success' },
      { title: 'Review Queue', value: stats.examsNeedingReview || 0, suffix: 'exams need attention', kind: 'danger' },
      { title: 'Avg Reliability', value: stats.averageReliability ?? 0, suffix: `${stats.psychometricCoverage || 0} exams analyzed`, precision: stats.averageReliability === null ? 0 : 2, kind: 'neutral', display: stats.averageReliability === null ? '--' : undefined },
      { title: 'Average Rating', value: stats.averageRating || 0, suffix: `${stats.feedbackCount || 0} ratings`, precision: 2, kind: 'neutral' }
    ];
  }, [dashboard]);

  const recentTrainers = (dashboard?.recentTrainers || []).map((trainer) => ({
    key: trainer._id,
    name: trainer.name
  }));

  const recentCourses = (dashboard?.recentCourses || []).map((course) => ({
    key: course._id,
    name: course.topic
  }));

  const recentExams = (dashboard?.recentExams || []).map((exam) => ({
    key: exam._id,
    name: exam.title
  }));

  const trainerTrainees = (dashboard?.myTrainees || []).map((trainee) => ({
    key: trainee._id,
    name: trainee.name,
    email: trainee.emailid
  }));

  const feedbacks = (dashboard?.feedbacks || []).map((feedback) => ({
    key: feedback._id,
    author: feedback?.trainee?.name || 'Anonymous',
    email: feedback?.trainee?.emailid || '-',
    rating: feedback?.rating || 0,
    text: feedback.feedback || ''
  }));

  const analytics = dashboard?.analytics || {};
  const monthlyLabels = analytics?.monthly?.labels || [];
  const monthlyRegistrations = analytics?.monthly?.registrations || [];
  const monthlyQuestions = analytics?.monthly?.questions || [];
  const examStatus = analytics?.examStatus || { scheduled: 0, live: 0, completed: 0 };
  const pipeline = analytics?.pipeline || { registrationOpen: 0, inProgress: 0, resultPublished: 0 };
  const ratings = analytics?.ratings || { labels: ['1 Star', '2 Stars', '3 Stars', '4 Stars', '5 Stars'], distribution: [0, 0, 0, 0, 0], average: 0, total: 0 };
  const topExamsByRegistrations = analytics?.topExamsByRegistrations || [];

  const trendData = {
    labels: monthlyLabels,
    datasets: [
      {
        label: 'Registrations',
        data: monthlyRegistrations,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        tension: 0.34,
        pointRadius: 3
      },
      {
        label: 'Questions Added',
        data: monthlyQuestions,
        borderColor: '#22c55e',
        backgroundColor: 'rgba(34, 197, 94, 0.2)',
        tension: 0.34,
        pointRadius: 3
      }
    ]
  };

  const examLifecycleData = {
    labels: ['Scheduled', 'Live', 'Completed'],
    datasets: [
      {
        data: [examStatus.scheduled || 0, examStatus.live || 0, examStatus.completed || 0],
        backgroundColor: ['#60a5fa', '#f59e0b', '#34d399'],
        borderColor: ['#93c5fd', '#fbbf24', '#6ee7b7'],
        borderWidth: 1
      }
    ]
  };

  const ratingData = {
    labels: ratings.labels || ['1 Star', '2 Stars', '3 Stars', '4 Stars', '5 Stars'],
    datasets: [
      {
        data: ratings.distribution || [0, 0, 0, 0, 0],
        backgroundColor: ['#ef4444', '#f97316', '#facc15', '#38bdf8', '#34d399'],
        borderColor: ['#fca5a5', '#fdba74', '#fde68a', '#bae6fd', '#a7f3d0'],
        borderWidth: 1
      }
    ]
  };

  const topExamChartData = {
    labels: topExamsByRegistrations.map((exam) => exam.title),
    datasets: [
      {
        label: 'Registrations',
        data: topExamsByRegistrations.map((exam) => exam.registrations),
        backgroundColor: 'rgba(59, 130, 246, 0.45)',
        borderColor: '#60a5fa',
        borderWidth: 1,
        borderRadius: 8,
        maxBarThickness: 20
      }
    ]
  };

  const psychometricTrendData = {
    labels: psychometricAnalytics.difficultyTrend.labels || [],
    datasets: [
      {
        label: 'Average Score %',
        data: psychometricAnalytics.difficultyTrend.averageScores || [],
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.18)',
        tension: 0.34,
        pointRadius: 3
      },
      {
        label: 'Average Item Correctness %',
        data: psychometricAnalytics.difficultyTrend.averageItemCorrectness || [],
        borderColor: '#22c55e',
        backgroundColor: 'rgba(34, 197, 94, 0.18)',
        tension: 0.34,
        pointRadius: 3
      }
    ]
  };

  const flaggedSubjectsData = {
    labels: (psychometricAnalytics.flaggedSubjects || []).map((subject) => subject.subjectLabel),
    datasets: [
      {
        label: 'Flagged questions',
        data: (psychometricAnalytics.flaggedSubjects || []).map((subject) => subject.flaggedQuestionCount),
        backgroundColor: 'rgba(244, 114, 182, 0.42)',
        borderColor: '#f472b6',
        borderWidth: 1,
        borderRadius: 8,
        maxBarThickness: 22
      }
    ]
  };

  const reviewCoverageData = {
    labels: ['Healthy exams', 'Exams needing review'],
    datasets: [
      {
        data: [
          Math.max((dashboard?.stats?.psychometricCoverage || 0) - (dashboard?.stats?.examsNeedingReview || 0), 0),
          dashboard?.stats?.examsNeedingReview || 0
        ],
        backgroundColor: ['#38bdf8', '#fb7185'],
        borderColor: ['#7dd3fc', '#fda4af'],
        borderWidth: 1
      }
    ]
  };

  const renderDataGrid = ({ columns, rows, emptyText }) => (
    <div className="dashboard-data-grid-shell">
      <div className="dashboard-data-grid-scroll">
        <table className="dashboard-data-grid">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key}>{column.title}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr className="dashboard-empty-row">
                <td colSpan={columns.length}>{emptyText}</td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr className="dashboard-data-row" key={row.key || row._id || index}>
                  {columns.map((column) => (
                    <td key={column.key}>
                      {column.render ? column.render(row) : (
                        column.emphasis ? (
                          <span className="dashboard-cell-strong">{row[column.key] || '-'}</span>
                        ) : (
                          row[column.key] || '-'
                        )
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderStats = (stats) => (
    <Row gutter={[16, 16]}>
      {stats.map((stat, idx) => (
        <Col key={idx} xs={24} sm={12} xl={8} xxl={4}>
          <Card className={`welcome-stat-card welcome-stat-card-${stat.kind || 'primary'}`}>
            <Statistic
              title={stat.title}
              value={stat.display !== undefined ? stat.display : stat.value}
              precision={stat.display !== undefined ? undefined : stat.precision}
              valueStyle={{ color: '#dbeafe' }}
            />
            <Tag className="welcome-stat-tag">{stat.suffix}</Tag>
          </Card>
        </Col>
      ))}
    </Row>
  );

  const renderAdminView = () => {
    const simpleNameColumns = [{ title: 'Name', key: 'name', emphasis: true }];
    return (
      <>
        <Card className="welcome-hero-card">
          <h2 className="dashboard-title">Exam Operations Overview</h2>
          <p className="dashboard-subtitle">
            Monitor exam volume, candidate activity, and platform updates from one place.
          </p>
        </Card>
        {renderStats(adminStats)}
        <Row className="welcome-sections-row" gutter={[16, 16]}>
          <Col xs={24} md={12} xl={8}>
            <h3 className="section-title">Recent Examiners</h3>
            {renderDataGrid({
              columns: simpleNameColumns,
              rows: recentTrainers,
              emptyText: 'No examiners found.'
            })}
          </Col>
          <Col xs={24} md={12} xl={8}>
            <h3 className="section-title">Recent Courses</h3>
            {renderDataGrid({
              columns: simpleNameColumns,
              rows: recentCourses,
              emptyText: 'No courses found.'
            })}
          </Col>
          <Col xs={24} md={24} xl={8}>
            <h3 className="section-title">Recent Exams</h3>
            {renderDataGrid({
              columns: simpleNameColumns,
              rows: recentExams,
              emptyText: 'No exams found.'
            })}
          </Col>
        </Row>
      </>
    );
  };

  const renderTrainerView = () => (
    <>
      <Card className="welcome-hero-card trainer-hero-card">
        <div className="trainer-hero-content">
          <div>
            <h2 className="dashboard-title">Instructor Analytics Hub</h2>
            <p className="dashboard-subtitle">
              Track enrollment flow, session readiness, assessment quality, and learner feedback in a single control view.
            </p>
          </div>
          <div className="trainer-hero-chips">
            <Tag className="welcome-stat-tag">Live sessions: {dashboard?.stats?.examsLive || 0}</Tag>
            <Tag className="welcome-stat-tag">Open registration: {dashboard?.stats?.registrationsOpen || 0}</Tag>
            <Tag className="welcome-stat-tag">Flagged questions: {dashboard?.stats?.flaggedQuestionsTotal || 0}</Tag>
          </div>
        </div>
      </Card>

      {renderStats(trainerStats)}

      <Row className="welcome-sections-row trainer-chart-row" gutter={[16, 16]}>
        <Col xs={24} xl={14}>
          <Card className="trainer-analytics-card">
            <div className="trainer-card-header">
              <h3>Momentum Trend</h3>
              <p>Registrations and question authoring across the last six months.</p>
            </div>
            <div className="trainer-chart-wrap trainer-chart-line">
              {monthlyLabels.length ? <Line data={trendData} options={trendOptions} /> : <Empty description="No trend data yet" />}
            </div>
          </Card>
        </Col>
        <Col xs={24} md={12} xl={5}>
          <Card className="trainer-analytics-card">
            <div className="trainer-card-header">
              <h3>Exam Lifecycle</h3>
              <p>Current status distribution of managed exams.</p>
            </div>
            <div className="trainer-chart-wrap">
              <Doughnut data={examLifecycleData} options={doughnutOptions} />
            </div>
          </Card>
        </Col>
        <Col xs={24} md={12} xl={5}>
          <Card className="trainer-analytics-card">
            <div className="trainer-card-header">
              <h3>Feedback Pulse</h3>
              <p>{ratings.total || 0} total ratings received.</p>
            </div>
            <div className="trainer-chart-wrap">
              <Doughnut data={ratingData} options={doughnutOptions} />
            </div>
          </Card>
        </Col>
      </Row>

      <Row className="trainer-bottom-row" gutter={[16, 16]}>
        <Col xs={24} xl={14}>
          <Card className="trainer-analytics-card">
            <div className="trainer-card-header">
              <h3>Assessment Quality Trend</h3>
              <p>Cross-exam comparison of cohort score average and item correctness.</p>
            </div>
            <div className="trainer-chart-wrap trainer-chart-line">
              {psychometricAnalytics.difficultyTrend.labels.length ? (
                <Line data={psychometricTrendData} options={trendOptions} />
              ) : (
                <Empty description="No completed psychometric cohorts yet" />
              )}
            </div>
          </Card>
        </Col>
        <Col xs={24} md={12} xl={5}>
          <Card className="trainer-analytics-card">
            <div className="trainer-card-header">
              <h3>Review Coverage</h3>
              <p>{dashboard?.stats?.psychometricCoverage || 0} exams analyzed so far.</p>
            </div>
            <div className="trainer-chart-wrap">
              <Doughnut data={reviewCoverageData} options={doughnutOptions} />
            </div>
          </Card>
        </Col>
        <Col xs={24} md={12} xl={5}>
          <Card className="trainer-analytics-card trainer-pipeline-card">
            <div className="trainer-card-header">
              <h3>Execution Snapshot</h3>
              <p>Operational split across pipeline stages.</p>
            </div>
            <div className="trainer-pipeline-list">
              <div className="trainer-pipeline-item">
                <span>Registration Open</span>
                <strong>{pipeline.registrationOpen || 0}</strong>
              </div>
              <div className="trainer-pipeline-item">
                <span>In Progress</span>
                <strong>{pipeline.inProgress || 0}</strong>
              </div>
              <div className="trainer-pipeline-item">
                <span>Result Published</span>
                <strong>{pipeline.resultPublished || 0}</strong>
              </div>
            </div>
            <div className="trainer-insight-note">
              Focus next: {(dashboard?.stats?.examsNeedingReview || 0) > 0
                ? 'Some exams need question review before you reuse them.'
                : (pipeline.inProgress > 0 ? 'Monitor active sessions and candidate alerts.' : 'Publish results and open the next exam window.')}
            </div>
          </Card>
        </Col>
      </Row>

      <Row className="trainer-bottom-row" gutter={[16, 16]}>
        <Col xs={24} xl={12}>
          <Card className="trainer-analytics-card">
            <div className="trainer-card-header">
              <h3>Subjects Under Review</h3>
              <p>Course areas accumulating the highest number of flagged questions.</p>
            </div>
            <div className="trainer-chart-wrap trainer-chart-bars">
              {psychometricAnalytics.flaggedSubjects.length ? (
                <Bar data={flaggedSubjectsData} options={topExamsOptions} />
              ) : (
                <Empty description="No flagged subjects yet" />
              )}
            </div>
          </Card>
        </Col>
        <Col xs={24} xl={12}>
          <Card className="trainer-analytics-card">
            <div className="trainer-card-header">
              <h3>Top Exams by Registration</h3>
              <p>Highest enrollment exams to help prioritize live monitoring.</p>
            </div>
            <div className="trainer-chart-wrap trainer-chart-bars">
              {topExamsByRegistrations.length ? (
                <Bar data={topExamChartData} options={topExamsOptions} />
              ) : (
                <Empty description="No registration data available" />
              )}
            </div>
          </Card>
        </Col>
      </Row>

      <Row className="trainer-bottom-row" gutter={[16, 16]}>
        <Col xs={24} xl={12}>
          <h3 className="section-title">Exams Needing Review</h3>
          {renderDataGrid({
            columns: [
              { title: 'Exam', key: 'title', emphasis: true },
              { title: 'Flags', key: 'flaggedQuestionCount' },
              { title: 'Score Avg', key: 'averagePercent', render: (row) => metricValue(row.averagePercent, 1, '%') },
              { title: 'Reliability', key: 'reliabilityAlpha', render: (row) => metricValue(row.reliabilityAlpha, 2) }
            ],
            rows: psychometricAnalytics.weakestExams,
            emptyText: 'No exam quality issues detected yet.'
          })}
        </Col>
        <Col xs={24} xl={12}>
          <h3 className="section-title">Question Review Queue</h3>
          {renderDataGrid({
            columns: [
              { title: 'Exam', key: 'examTitle', emphasis: true },
              { title: 'Question', key: 'questionLabel' },
              { title: 'Subject', key: 'subjectLabel' },
              { title: 'Flags', key: 'flags', render: (row) => row.flags && row.flags.length ? row.flags.join(', ') : 'Healthy' }
            ],
            rows: psychometricAnalytics.reviewBacklog,
            emptyText: 'No flagged question backlog yet.'
          })}
        </Col>
      </Row>

      <Row className="trainer-bottom-row" gutter={[16, 16]}>
        <Col xs={24} xl={14}>
          <h3 className="section-title">Recent Students</h3>
          {renderDataGrid({
            columns: [
              { title: 'Name', key: 'name', emphasis: true },
              { title: 'Email', key: 'email' }
            ],
            rows: trainerTrainees,
            emptyText: 'No student records available.'
          })}
        </Col>
        <Col xs={24} xl={10}>
          <h3 className="section-title">Latest Feedback</h3>
          {feedbacks.length === 0 ? (
            <Card className="comment-card comment-card-empty">No feedback has been submitted yet.</Card>
          ) : feedbacks.map((item) => (
            <Card key={item.key} className="comment-card feedback-card">
              <div className="feedback-card-head">
                <strong>{item.author}</strong>
                <span>{item.rating ? `${item.rating}/5` : 'No rating'}</span>
              </div>
              <p>{item.text || 'No feedback text provided.'}</p>
              <small>{item.email}</small>
            </Card>
          ))}
        </Col>
      </Row>
    </>
  );

  if (loading) {
    return <Spin tip="Loading dashboard..." style={{ margin: '100px auto', display: 'block' }} />;
  }

  if (error) {
    return <Alert type="error" message={error} style={{ margin: '20px' }} />;
  }

  if (!dashboard) {
    return null;
  }

  return (
    <div className="welcome-container welcome-dashboard">
      {userType === 'TRAINER' ? renderTrainerView() : renderAdminView()}
    </div>
  );
}

const mapStateToProps = (state) => ({
  user: state.user
});

export default connect(mapStateToProps)(Welcome);
