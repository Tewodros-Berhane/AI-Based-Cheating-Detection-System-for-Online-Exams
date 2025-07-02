import React, { useState, useEffect } from 'react';
import { connect } from 'react-redux';
import './welcome.css';
import { Card, Statistic, Row, Col, Table, Spin, Alert } from 'antd';
import { loadDashboard } from '../../services/dashboard'; // adjust path as needed

function Welcome({ user }) {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Determine user type
  let userType = 'User';
  if (user && user.userDetails && user.userDetails.type) {
    userType = user.userDetails.type;
  }

  // Fetch dashboard data once
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

  // Build stats array based on userType
  const stats = userType === 'ADMIN'
    ? [
        { title: 'Total Exams', value: dashboard.stats.totalExams },
        { title: 'Total Questions', value: dashboard.stats.totalQuestions },
        { title: 'Total Examiners', value: dashboard.stats.totalTrainers },
        { title: 'Total Courses', value: dashboard.stats.totalCourses },
      ]
    : userType === 'TRAINER'
      ? [
          { title: 'My Exams', value: dashboard.stats.myExamCount },
          { title: 'Questions Added', value: dashboard.stats.questionsAdded },
          { title: 'My Students', value: dashboard.stats.myTraineesCount },
        ]
      : [];

  // Columns definition for tables
  const columns = userType === 'ADMIN'
    ? [
        { title: 'Name', dataIndex: 'name', key: 'name' },
      ]
    : [
        { title: 'Name', dataIndex: 'name', key: 'name' },
        { title: 'Email', dataIndex: 'email', key: 'email' },
      ];

  // Map backend data to table-friendly structures
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

  // Render statistic cards
  const renderStats = () => (
    <Row gutter={[16, 16]}>
      {stats.map((stat, idx) => (
        <Col key={idx} xs={24} sm={12} md={6}>
          <Card>
            <Statistic title={stat.title} value={stat.value} valueStyle={{ color: '#58a6ff' }} />
          </Card>
        </Col>
      ))}
    </Row>
  );

  // Render tables and feedback sections
  const renderExtraSections = () => {
    if (userType === 'TRAINER') {
      return (
        <Row style={{ marginTop: 32 }} gutter={16}>
          <Col span={12}>
            <h3 className="section-title">Recent Students</h3>
            <Table dataSource={myTrainees} columns={columns} pagination={false} bordered size="small" />
          </Col>
          <Col span={12}>
            <h3 className="section-title">Recent Feedbacks</h3>
            {feedbacks.map(c => (
              <Card key={c.id} className="comment-card" style={{ marginBottom: 8 }}>
                <p><strong>{c.author}:</strong> {c.text}</p>
              </Card>
            ))}
          </Col>
        </Row>
      );
    }

    if (userType === 'ADMIN') {
      return (
        <Row style={{ marginTop: 32 }} gutter={16}>
          <Col span={8}>
            <h3 className="section-title">Recent Examiners</h3>
            <Table dataSource={recentTrainers} columns={columns} pagination={false} bordered size="small" />
          </Col>
          <Col span={8}>
            <h3 className="section-title">Recent Courses</h3>
            <Table dataSource={recentCourses} columns={columns} pagination={false} bordered size="small" />
          </Col>
          <Col span={8}>
            <h3 className="section-title">Recent Exams</h3>
            <Table dataSource={recentExams} columns={columns} pagination={false} bordered size="small" />
          </Col>
        </Row>
      );
    }

    return null;
  };

  return (
    <div className="welcome-container welcome-dashboard">
      <h2 className="dashboard-title">Dashboard Overview</h2>
      {renderStats()}
      {renderExtraSections()}
    </div>
  );
}

const mapStateToProps = state => ({
  user: state.user
});

export default connect(mapStateToProps)(Welcome);
