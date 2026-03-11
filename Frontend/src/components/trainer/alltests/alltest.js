import React, { Component } from 'react';
import { Input, Button, Tag, Popconfirm, Tooltip, Pagination, Spin } from 'antd-compat';
import Highlighter from 'react-highlight-words';
import { connect } from 'react-redux';
import {
  ChangeTestSearchText,
  ChangeTestTableData,
  ChangeTestDetailsModalState
} from '../../../actions/trainerAction';
import './alltest.css';
import moment from 'moment';
import { SecurePost } from '../../../services/axiosCall';
import apis from '../../../services/Apis';
import Alert from '../../../components/common/alert';
import TestDetails from '../testdetails/testdetails';
import AppModal from '../../common/AppModal';
import { Search, Eye, Trash2 } from 'lucide-react';

class AllTests extends Component {
  constructor(props) {
    super(props);
    this.state = {
      page: 1,
      pageSize: 8
    };
  }

  componentDidMount() {
    this.props.ChangeTestTableData();
  }

  openModal = (id) => {
    this.props.ChangeTestDetailsModalState(true, id);
  };

  closeModal = () => {
    this.props.ChangeTestDetailsModalState(false, null);
  };

  handleSearch = (event) => {
    this.setState({ page: 1 });
    this.props.ChangeTestSearchText(event.target.value);
  };

  changePage = (page, pageSize) => {
    this.setState({ page, pageSize });
  };

  deleteTest = (id) => {
    SecurePost({
      url: apis.DELETE_TEST,
      data: {
        _id: id
      }
    })
      .then((response) => {
        if (response.data.success) {
          Alert('success', 'Success', response.data.message);
          this.props.ChangeTestTableData();
          return;
        }
        Alert('warning', 'Warning!', response.data.message);
      })
      .catch(() => {
        Alert('error', 'Error!', 'Something went wrong. Please try again.');
      });
  };

  getFilteredData = () => {
    const tests = [...(this.props.trainer.TestTableData || [])].sort((a, b) => {
      const aTime = new Date(a && a.createdAt ? a.createdAt : 0).getTime();
      const bTime = new Date(b && b.createdAt ? b.createdAt : 0).getTime();
      return bTime - aTime;
    });
    const query = (this.props.trainer.TestsearchText || '').trim().toLowerCase();
    if (!query) {
      return tests;
    }

    return tests.filter((test) => {
      const subjectNames = (test.subjects || []).map((subject) => subject && subject.topic).join(' ');
      return [test.title, test.examID, subjectNames]
        .map((value) => String(value || '').toLowerCase())
        .some((value) => value.includes(query));
    });
  };

  renderHighlighted = (value) => (
    <Highlighter
      highlightStyle={{ backgroundColor: 'rgba(59,130,246,0.25)', padding: 0, borderRadius: 4 }}
      searchWords={[this.props.trainer.TestsearchText || '']}
      autoEscape
      textToHighlight={String(value || '')}
    />
  );

  getExamState = (test) => {
    if (test.testconducted) {
      return { label: 'Ended', tone: 'ended' };
    }
    if (test.testbegins) {
      return { label: 'Live', tone: 'live' };
    }
    if (test.isRegistrationavailable) {
      return { label: 'Registration Open', tone: 'pending' };
    }
    return { label: 'Draft', tone: 'pending' };
  };

  render() {
    const filteredTests = this.getFilteredData();
    const statusCounts = filteredTests.reduce(
      (accumulator, test) => {
        const status = this.getExamState(test);
        if (status.tone === 'live') {
          accumulator.live += 1;
        } else if (status.tone === 'ended') {
          accumulator.ended += 1;
        } else {
          accumulator.pending += 1;
        }
        return accumulator;
      },
      { live: 0, ended: 0, pending: 0 }
    );
    const total = filteredTests.length;
    const start = (this.state.page - 1) * this.state.pageSize;
    const end = start + this.state.pageSize;
    const visibleRows = filteredTests.slice(start, end);

    return (
      <div className="admin-modern-shell alltests-modern-shell">
        <div className="admin-modern-headline">
          <div className="admin-modern-title-group">
            <h3>Exam Control Center</h3>
            <p>Track exam readiness, inspect details, and manage test lifecycle from one workspace.</p>
          </div>
          <div className="admin-modern-headline-right">
            <Tag className="admin-modern-chip">{total} Exams</Tag>
            <Tag className="alltests-summary-chip pending">{statusCounts.pending} Draft/Open</Tag>
            <Tag className="alltests-summary-chip live">{statusCounts.live} Live</Tag>
            <Tag className="alltests-summary-chip ended">{statusCounts.ended} Ended</Tag>
          </div>
        </div>

        <div className="admin-modern-table-wrap">
          <div className="admin-table-toolbar alltests-toolbar">
            <Input
              className="admin-table-search"
              allowClear
              value={this.props.trainer.TestsearchText}
              onChange={this.handleSearch}
              placeholder="Search exams by title, exam ID, or course"
              prefix={<Search size={15} strokeWidth={2.3} style={{ color: 'var(--text-muted)' }} />}
            />
            <span className="admin-table-meta">
              {this.props.trainer.TestTableLoading ? 'Loading records...' : `${total} records found`}
            </span>
          </div>

          <div className="admin-data-grid-shell">
            <div className="admin-data-grid-scroll">
              <table className="admin-data-grid alltests-data-grid">
                <thead>
                  <tr>
                    <th>Exam</th>
                    <th>Course</th>
                    <th>Created On</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {this.props.trainer.TestTableLoading ? (
                    <tr className="admin-empty-row">
                      <td colSpan={5}>
                        <Spin />
                      </td>
                    </tr>
                  ) : visibleRows.length === 0 ? (
                    <tr className="admin-empty-row">
                      <td colSpan={5}>No exams match your current search.</td>
                    </tr>
                  ) : (
                    visibleRows.map((test) => {
                      const examState = this.getExamState(test);
                      return (
                        <tr className="admin-data-row" key={test._id}>
                          <td data-label="Exam">
                            <div className="alltests-title-cell">
                              <span className="admin-row-title">{this.renderHighlighted(test.title)}</span>
                              <span className="admin-row-subtext">
                                Exam ID: {this.renderHighlighted(test.examID || '-')}
                              </span>
                            </div>
                          </td>
                          <td data-label="Course">
                            <div className="alltests-subject-tags">
                              {(test.subjects || []).length === 0 ? (
                                <span className="admin-row-subtext">No course mapping</span>
                              ) : (test.subjects || []).map((subject) => (
                                <Tag key={subject._id} className="alltests-subject-tag">
                                  {this.renderHighlighted((subject.topic || '').toUpperCase())}
                                </Tag>
                              ))}
                            </div>
                          </td>
                          <td data-label="Created On">{moment(test.createdAt).format('DD MMM YYYY')}</td>
                          <td data-label="Status">
                            <span className={`alltests-state-badge ${examState.tone}`}>{examState.label}</span>
                          </td>
                          <td data-label="Actions">
                            <div className="admin-row-actions">
                              <Tooltip title="View exam details">
                                <Button
                                  className="admin-icon-btn"
                                  shape="circle"
                                  onClick={() => this.openModal(test._id)}
                                >
                                  <Eye size={16} strokeWidth={2.3} />
                                </Button>
                              </Tooltip>
                              <Popconfirm
                                title="Delete this exam?"
                                cancelText="No"
                                okText="Yes"
                                onConfirm={() => this.deleteTest(test._id)}
                                icon={<Trash2 size={16} strokeWidth={2.2} style={{ color: 'var(--danger)' }} />}
                              >
                                <Button className="admin-icon-btn admin-icon-btn-danger">
                                  <Trash2 size={16} strokeWidth={2.3} />
                                </Button>
                              </Popconfirm>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="admin-table-footer">
            <span className="admin-table-footer-meta">
              Showing {total === 0 ? 0 : start + 1} - {Math.min(end, total)} of {total}
            </span>
            <Pagination
              current={this.state.page}
              pageSize={this.state.pageSize}
              total={total}
              showSizeChanger={false}
              onChange={this.changePage}
            />
          </div>
        </div>

        <AppModal
          open={Boolean(this.props.trainer.TestDetailsmodalOpened)}
          onClose={this.closeModal}
          width={1240}
          title="Exam Details"
          subtitle="Inspect exam metadata, question sets, examinee activity, and outcomes."
        >
          {this.props.trainer.DataActiveTestDetails.testDetailsId ? <TestDetails /> : null}
        </AppModal>
      </div>
    );
  }
}

const mapStateToProps = (state) => ({
  trainer: state.trainer
});

export default connect(mapStateToProps, {
  ChangeTestSearchText,
  ChangeTestTableData,
  ChangeTestDetailsModalState
})(AllTests);
