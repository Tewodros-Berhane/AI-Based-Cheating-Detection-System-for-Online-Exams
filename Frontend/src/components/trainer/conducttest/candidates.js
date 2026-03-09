import React, { Component } from 'react';
import { connect } from 'react-redux';
import { Input, Button, Pagination, Tooltip, message, Spin } from 'antd-compat';
import Highlighter from 'react-highlight-words';
import { Copy, Eye, RefreshCw, Search } from 'lucide-react';
import { updateCandidatesTest } from '../../../actions/conductTest';
import { SecurePost } from '../../../services/axiosCall';
import apis from '../../../services/Apis';
import Alert from '../../common/alert';
import AppModal from '../../common/AppModal';
import TrainerLivePreview from '../TrainerLivePreview';
import TrainerResultPreview from '../TrainerResultPreview';
import ProctorTimelineModal from './ProctorTimelineModal';
import './conducttes.css';

class Candidates extends Component {
  constructor(props) {
    super(props);
    this.state = {
      loading: false,
      searchText: '',
      previewVisible: false,
      previewCandidate: null,
      timelineVisible: false,
      timelineCandidate: null,
      riskByTrainee: {},
      page: 1,
      pageSize: 6
    };
  }

  componentDidMount() {
    this.refreshUserList();
    this.autoRefreshTimer = setInterval(() => {
      this.refreshUserList();
    }, 5000);
  }

  componentWillUnmount() {
    if (this.autoRefreshTimer) {
      clearInterval(this.autoRefreshTimer);
      this.autoRefreshTimer = null;
    }
  }

  componentDidUpdate(prevProps) {
    if (prevProps.conduct.id !== this.props.conduct.id) {
      this.setState({ page: 1, searchText: '' });
      this.refreshUserList();
    }
  }

  refreshUserList = () => {
    if (!this.props.conduct.id) {
      this.props.updateCandidatesTest([]);
      this.setState({ riskByTrainee: {} });
      return;
    }

    this.setState({ loading: true });
    Promise.allSettled([
      SecurePost({
        url: apis.GET_TEST_CANDIDATES,
        data: { id: this.props.conduct.id }
      }),
      SecurePost({
        url: apis.GET_PROCTOR_SUMMARY,
        data: { testid: this.props.conduct.id }
      })
    ])
      .then(([candidateResult, summaryResult]) => {
        if (candidateResult.status === 'fulfilled') {
          const response = candidateResult.value;
          if (response.data.success) {
            this.props.updateCandidatesTest(response.data.data || []);
          } else {
            Alert('error', 'Error!', response.data.message);
          }
        } else {
          Alert('error', 'Error!', 'Server Error');
        }

        if (summaryResult.status === 'fulfilled' && summaryResult.value.data && summaryResult.value.data.success) {
          const summaryItems = Array.isArray(summaryResult.value.data.data) ? summaryResult.value.data.data : [];
          const riskByTrainee = summaryItems.reduce((accumulator, item) => {
            accumulator[item.traineeid] = item;
            return accumulator;
          }, {});
          this.setState({ riskByTrainee });
        } else {
          this.setState({ riskByTrainee: {} });
        }
      })
      .finally(() => {
        this.setState({ loading: false });
      });
  };

  handleSearch = (event) => {
    this.setState({
      searchText: event.target.value,
      page: 1
    });
  };

  changePage = (page, pageSize) => {
    this.setState({ page, pageSize });
  };

  openPreview = (candidate) => {
    this.setState({
      previewVisible: true,
      previewCandidate: candidate
    });
  };

  closePreview = () => {
    this.setState({
      previewVisible: false,
      previewCandidate: null
    });
  };

  openTimeline = (candidate) => {
    this.setState({
      timelineVisible: true,
      timelineCandidate: candidate
    });
  };

  closeTimeline = () => {
    this.setState({
      timelineVisible: false,
      timelineCandidate: null
    });
  };

  getExamLink = (traineeId) => {
    const base = apis.BASE_LOCAL_URL || window.location.origin;
    return `${base}/trainee/taketest?testid=${this.props.conduct.id}&traineeid=${traineeId}`;
  };

  copyToClipboard = async (value) => {
    try {
      await navigator.clipboard.writeText(value);
      message.success('Link copied to clipboard');
    } catch (error) {
      message.error('Unable to copy link');
    }
  };

  getFilteredData = () => {
    const candidates = this.props.conduct.registeredCandidates || [];
    const query = (this.state.searchText || '').trim().toLowerCase();
    if (!query) {
      return candidates;
    }

    return candidates.filter((candidate) =>
      ['name', 'emailid', 'contact'].some((key) =>
        String(candidate[key] || '')
          .toLowerCase()
          .includes(query)
      )
    );
  };

  getConnectionLabel = (status) => {
    switch (String(status || '').toLowerCase()) {
      case 'online':
        return 'Connected';
      case 'reconnecting':
        return 'Reconnecting';
      case 'disconnected':
        return 'Disconnected';
      case 'finished':
        return 'Finished';
      default:
        return 'Not started';
    }
  };

  renderHighlighted = (value) => (
    <Highlighter
      highlightStyle={{ backgroundColor: 'rgba(59,130,246,0.25)', padding: 0, borderRadius: 4 }}
      searchWords={[this.state.searchText || '']}
      autoEscape
      textToHighlight={String(value || '')}
    />
  );

  render() {
    const filteredCandidates = this.getFilteredData();
    const total = filteredCandidates.length;
    const start = (this.state.page - 1) * this.state.pageSize;
    const end = start + this.state.pageSize;
    const visibleRows = filteredCandidates.slice(start, end);
    const previewCandidate = this.state.previewCandidate;
    const timelineCandidate = this.state.timelineCandidate;

    return (
      <section className="conduct-candidates-wrap">
        <div className="conduct-candidates-head">
          <h4>Registered Students Monitor</h4>
          <p>Track enrollment, share direct exam links, and open live candidate preview.</p>
        </div>

        <div className="admin-table-toolbar conduct-candidates-toolbar">
          <Input
            className="admin-table-search conduct-candidate-search"
            value={this.state.searchText}
            onChange={this.handleSearch}
            allowClear
            placeholder="Search students by name, email, or contact"
            prefix={<Search size={15} strokeWidth={2.3} style={{ color: 'var(--text-muted)' }} />}
          />
          <div className="conduct-candidate-toolbar-actions">
            <Button
              className="conduct-reload-btn"
              onClick={this.refreshUserList}
              loading={this.state.loading}
            >
              <RefreshCw size={14} strokeWidth={2.3} />
              Refresh
            </Button>
            <span className="admin-table-meta">
              {this.state.loading ? 'Refreshing records...' : `${total} records found`}
            </span>
          </div>
        </div>

        <div className="admin-data-grid-shell">
          <div className="admin-data-grid-scroll">
            <table className="admin-data-grid conduct-candidates-grid">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Contact</th>
                  <th>Exam Link</th>
                  <th>Alerts</th>
                  <th>Preview</th>
                </tr>
              </thead>
              <tbody>
                {this.state.loading ? (
                  <tr className="admin-empty-row">
                    <td colSpan={5}>
                      <Spin />
                    </td>
                  </tr>
                ) : visibleRows.length === 0 ? (
                  <tr className="admin-empty-row">
                    <td colSpan={5}>No students are available for this exam yet.</td>
                  </tr>
                ) : (
                  visibleRows.map((candidate) => {
                    const examLink = this.getExamLink(candidate._id);
                    return (
                      <tr className="admin-data-row" key={candidate._id}>
                        <td data-label="Student">
                          <div className="admin-row-title">{this.renderHighlighted(candidate.name)}</div>
                          <div className="admin-row-subtext">{this.renderHighlighted(candidate.emailid)}</div>
                          <div className={`conduct-session-pill ${candidate?.examProgress?.connectionStatus || 'not_started'}`}>{this.getConnectionLabel(candidate?.examProgress?.connectionStatus)}</div>
                        </td>
                        <td data-label="Contact">{this.renderHighlighted(candidate.contact || '-')}</td>
                        <td data-label="Exam Link">
                          <div className="conduct-link-cell">
                            <input readOnly value={examLink} />
                            <button
                              type="button"
                              className="conduct-link-copy-btn"
                              onClick={() => this.copyToClipboard(examLink)}
                              aria-label="Copy student exam link"
                            >
                              <Copy size={14} strokeWidth={2.3} />
                            </button>
                          </div>
                        </td>
                        <td data-label="Alerts">
                          <div className="conduct-alert-cell">
                            <TrainerResultPreview
                              snapshot={this.state.riskByTrainee[candidate._id] || null}
                              statusFallback={candidate?.examProgress?.status}
                              onOpenTimeline={() => this.openTimeline(candidate)}
                            />
                          </div>
                        </td>
                        <td data-label="Preview">
                          <div className="admin-row-actions">
                            <Tooltip title="Open live preview">
                              <Button
                                className="admin-icon-btn"
                                shape="circle"
                                onClick={() => this.openPreview(candidate)}
                              >
                                <Eye size={16} strokeWidth={2.3} />
                              </Button>
                            </Tooltip>
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

        <AppModal
          open={this.state.previewVisible}
          onClose={this.closePreview}
          width={980}
          title="Student Live Feed"
          subtitle={
            previewCandidate
              ? `${previewCandidate.name || 'Student'}${previewCandidate.emailid ? `  |  ${previewCandidate.emailid}` : ''}`
              : 'Monitor candidate camera stream in real time.'
          }
        >
          {previewCandidate ? (
            <div className="conduct-preview-shell">
              <div className="conduct-preview-meta">
                <span className="conduct-preview-chip">{previewCandidate.contact || 'No contact'}</span>
                <span className="conduct-preview-chip conduct-preview-chip-id">{previewCandidate._id}</span>
              </div>
              <div className="conduct-preview-video-shell">
                <TrainerLivePreview traineeId={previewCandidate._id} testId={this.props.conduct.id} />
              </div>
            </div>
          ) : (
            <div className="conduct-preview-empty">No candidate selected.</div>
          )}
        </AppModal>

        <ProctorTimelineModal
          open={this.state.timelineVisible}
          candidate={timelineCandidate}
          testId={this.props.conduct.id}
          onClose={this.closeTimeline}
          onChanged={this.refreshUserList}
        />
      </section>
    );
  }
}

const mapStateToProps = (state) => ({
  conduct: state.conduct
});

export default connect(mapStateToProps, {
  updateCandidatesTest
})(Candidates);
