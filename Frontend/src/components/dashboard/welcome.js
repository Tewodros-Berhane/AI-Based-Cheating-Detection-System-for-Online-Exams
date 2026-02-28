import React, { useState, useEffect } from 'react';
import { connect } from 'react-redux';
import './welcome.css';
import { Card, Statistic, Row, Col, Spin, Alert, Tag } from 'antd-compat';
import { loadDashboard } from '../../services/dashboard'; 

function Welcome({ user }) {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  
  let userType = 'User';
  if (user && user.userDetails && user.userDetails.type) {
    userType = user.userDetails.type;
  }

  
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const data = await loadDashboard();
        setDashboard(data);
      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return <Spin tip="Loading dashboard..." style={{ margin: '100px auto', display: 'block' }} />;
  }

  if (error) {
    return <Alert type="error" message={error} style={{ margin: '20px' }} />;
  }

  if (!dashboard) {
    return null;
  }

  
  const stats = userType === 'ADMIN'
    ? [
        { title: 'Active Exams', value: dashboard.stats.totalExams, suffix: 'live' },
        { title: 'Question Bank', value: dashboard.stats.totalQuestions, suffix: 'items' },
        { title: 'Examiners', value: dashboard.stats.totalTrainers, suffix: 'members' },
        { title: 'Courses', value: dashboard.stats.totalCourses, suffix: 'tracks' },
      ]
    : userType === 'TRAINER'
      ? [
          { title: 'My Exams', value: dashboard.stats.myExamCount, suffix: 'active' },
          { title: 'Questions Added', value: dashboard.stats.questionsAdded, suffix: 'total' },
          { title: 'Candidates', value: dashboard.stats.myTraineesCount, suffix: 'registered' },
        ]
      : [];

  
  const recentTrainers = (dashboard.recentTrainers || []).map(t => ({
    key: t._id,
    name: t.name,
  }));

  const recentCourses = (dashboard.recentCourses || []).map(c => ({
    key: c._id,
    name: c.topic,
  }));

  const recentExams = (dashboard.recentExams || []).map(e => ({
    key: e._id,
    name: e.title,
  }));

  const myTrainees = (dashboard.myTrainees || []).map(tr => ({
    key: tr._id,
    name: tr.name,
    email: tr.emailid
  }));

  const feedbacks = (dashboard.feedbacks || []).map(fb => ({
    id: fb._id,
    author: fb.trainee.name,
    text: fb.feedback
  }));

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
              rows.map((row, rowIndex) => (
                <tr className="dashboard-data-row" key={row.key || rowIndex}>
                  {columns.map((column) => (
                    <td key={column.key}>
                      {column.emphasis ? (
                        <span className="dashboard-cell-strong">{row[column.key] || '-'}</span>
                      ) : (
                        row[column.key] || '-'
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

  
  const renderStats = () => (
    <Row gutter={[16, 16]}>
      {stats.map((stat, idx) => (
        <Col key={idx} xs={24} sm={12} md={6}>
          <Card className="welcome-stat-card">
            <Statistic title={stat.title} value={stat.value} valueStyle={{ color: '#dbeafe' }} />
            <Tag className="welcome-stat-tag">{stat.suffix}</Tag>
          </Card>
        </Col>
      ))}
    </Row>
  );

  
  const renderExtraSections = () => {
    if (userType === 'TRAINER') {
      const traineeColumns = [
        { title: 'Name', key: 'name', emphasis: true },
        { title: 'Email', key: 'email' }
      ];
      return (
        <Row className="welcome-sections-row" gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <h3 className="section-title">Recent Students</h3>
            {renderDataGrid({
              columns: traineeColumns,
              rows: myTrainees,
              emptyText: 'No student records available.'
            })}
          </Col>
          <Col xs={24} md={12}>
            <h3 className="section-title">Recent Feedback</h3>
            {feedbacks.length === 0 ? (
              <Card className="comment-card comment-card-empty">No feedback has been submitted yet.</Card>
            ) : feedbacks.map(c => (
              <Card key={c.id} className="comment-card" style={{ marginBottom: 8 }}>
                <p><strong>{c.author}:</strong> {c.text}</p>
              </Card>
            ))}
          </Col>
        </Row>
      );
    }

    if (userType === 'ADMIN') {
      const simpleNameColumns = [{ title: 'Name', key: 'name', emphasis: true }];
      return (
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
      );
    }

    return null;
  };

  return (
    <div className="welcome-container welcome-dashboard">
      <Card className="welcome-hero-card">
        <h2 className="dashboard-title">Exam Operations Overview</h2>
        <p className="dashboard-subtitle">
          Monitor exam volume, candidate activity, and recent platform updates from a single command view.
        </p>
      </Card>
      {renderStats()}
      {renderExtraSections()}
    </div>
  );
}

const mapStateToProps = state => ({
  user: state.user
});

export default connect(mapStateToProps)(Welcome);

