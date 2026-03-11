import React, { Component } from 'react';
import {
  Input,
  Button,
  Icon,
  Popconfirm,
  Select,
  Tag,
  Tooltip,
  Pagination,
  Spin
} from 'antd-compat';
import Highlighter from 'react-highlight-words';
import { connect } from 'react-redux';
import {
  ChangeQuestionModalState,
  ChangeQuestionTableData,
  ChangeQuestionSearchText,
  ChangeSelectedSubjects
} from '../../../actions/trainerAction';
import { ChangeSubjectTableData } from '../../../actions/adminAction';
import './allquestion.css';
import Alert from '../../../components/common/alert';
import { SecurePost } from '../../../services/axiosCall';
import apis from '../../../services/Apis';
import NewQuestionForm from '../newquestion/newquestion';
import QuestionDetails from '../questionDetails/questiondetails';
import AppModal from '../../common/AppModal';
import { Eye } from 'lucide-react';

class AllQuestions extends Component {
  constructor(props) {
    super(props);
    this.state = {
      questiondetailsId: null,
      questiondetailsModelVisible: false,
      page: 1,
      pageSize: 8
    };
  }

  componentDidMount() {
    this.props.ChangeSubjectTableData();
    this.props.ChangeQuestionTableData(this.props.trainer.selectedSubjects);
  }

  openDetailsModal = (id) => {
    this.setState({
      questiondetailsId: id,
      questiondetailsModelVisible: true
    });
  };

  closeDetailsModal = () => {
    this.setState({
      questiondetailsId: null,
      questiondetailsModelVisible: false
    });
  };

  openNewModal = () => {
    this.props.ChangeQuestionModalState(true);
  };

  closeNewModal = () => {
    this.props.ChangeQuestionModalState(false);
  };

  handleSubjectChange = (subjectId) => {
    const nextSubject = subjectId || [];
    this.setState({ page: 1 });
    this.props.ChangeSelectedSubjects(nextSubject);
    this.props.ChangeQuestionTableData(nextSubject);
  };

  handleSearch = (event) => {
    this.setState({ page: 1 });
    this.props.ChangeQuestionSearchText(event.target.value);
  };

  changePage = (page, pageSize) => {
    this.setState({ page, pageSize });
  };

  deleteQuestion = (id) => {
    SecurePost({
      url: apis.DELETE_QUESTION,
      data: {
        _id: id
      }
    })
      .then((response) => {
        if (response.data.success) {
          Alert('success', 'Success', response.data.message);
          this.props.ChangeQuestionTableData(this.props.trainer.selectedSubjects);
          return;
        }
        Alert('warning', 'Warning!', response.data.message);
      })
      .catch(() => {
        Alert('error', 'Error!', 'Something went wrong. Please try again.');
      });
  };

  getFilteredData = () => {
    const questions = [...(this.props.trainer.QuestionTableData || [])].sort((a, b) => {
      const aTime = new Date(a && a.createdAt ? a.createdAt : 0).getTime();
      const bTime = new Date(b && b.createdAt ? b.createdAt : 0).getTime();
      return bTime - aTime;
    });
    const query = (this.props.trainer.QuestionsearchText || '').trim().toLowerCase();

    if (!query) {
      return questions;
    }

    return questions.filter((question) =>
      [
        question.body,
        question.subject && question.subject.topic,
        question.createdBy && question.createdBy.name
      ]
        .map((value) => String(value || '').toLowerCase())
        .some((value) => value.includes(query))
    );
  };

  renderHighlighted = (value) => (
    <Highlighter
      highlightStyle={{ backgroundColor: 'rgba(59,130,246,0.25)', padding: 0, borderRadius: 4 }}
      searchWords={[this.props.trainer.QuestionsearchText || '']}
      autoEscape
      textToHighlight={String(value || '')}
    />
  );

  render() {
    const filteredQuestions = this.getFilteredData();
    const total = filteredQuestions.length;
    const start = (this.state.page - 1) * this.state.pageSize;
    const end = start + this.state.pageSize;
    const visibleRows = filteredQuestions.slice(start, end);
    const selectedSubject = this.props.trainer.selectedSubjects;
    const selectedSubjectValue = Array.isArray(selectedSubject)
      ? selectedSubject[0]
      : selectedSubject;

    return (
      <div className="admin-modern-shell question-modern-shell">
        <div className="admin-modern-headline">
          <div className="admin-modern-title-group">
            <h3>Question Library</h3>
            <p>Review and manage question prompts, answer options, and subject mapping in one workspace.</p>
          </div>
          <div className="admin-modern-headline-right">
            <Tag className="admin-modern-chip">{total} Questions</Tag>
            <Button
              type="primary"
              icon={<Icon type="plus-circle" />}
              className="admin-modern-primary-btn"
              onClick={this.openNewModal}
            >
              Add Question
            </Button>
          </div>
        </div>

        <div className="admin-modern-table-wrap">
          <div className="admin-table-toolbar question-table-toolbar">
            <Input
              className="admin-table-search"
              allowClear
              value={this.props.trainer.QuestionsearchText}
              onChange={this.handleSearch}
              placeholder="Search questions by prompt, subject, or creator"
              prefix={<Icon type="search" style={{ color: 'var(--text-muted)' }} />}
            />

            <Select
              className="question-subject-filter"
              dropdownClassName="question-subject-dropdown"
              placeholder="Filter by subject"
              value={selectedSubjectValue || undefined}
              onChange={this.handleSubjectChange}
              style={{ width: 'min(300px, 100%)' }}
              allowClear
              showSearch
              optionFilterProp="children"
              getPopupContainer={(triggerNode) => triggerNode.parentNode}
            >
              {(this.props.admin.subjectTableData || []).map((item) => (
                <Select.Option key={item._id} value={item._id}>
                  {item.topic}
                </Select.Option>
              ))}
            </Select>

            <span className="admin-table-meta">
              {this.props.trainer.QuestionTableLoading ? 'Loading records...' : `${total} records found`}
            </span>
          </div>

          <div className="admin-data-grid-shell">
            <div className="admin-data-grid-scroll">
              <table className="admin-data-grid question-data-grid">
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>Question</th>
                    <th>Created By</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {this.props.trainer.QuestionTableLoading ? (
                    <tr className="admin-empty-row">
                      <td colSpan={4}>
                        <Spin />
                      </td>
                    </tr>
                  ) : visibleRows.length === 0 ? (
                    <tr className="admin-empty-row">
                      <td colSpan={4}>No questions match your current filters.</td>
                    </tr>
                  ) : (
                    visibleRows.map((question) => (
                      <tr className="admin-data-row" key={question._id}>
                        <td>
                          <span className="admin-row-title">
                            {this.renderHighlighted(question.subject && question.subject.topic)}
                          </span>
                        </td>
                        <td>
                          <div className="question-row-body">
                            {this.renderHighlighted(question.body)}
                          </div>
                        </td>
                        <td>
                          {this.renderHighlighted(question.createdBy && question.createdBy.name)}
                        </td>
                        <td>
                          <div className="admin-row-actions">
                            <Tooltip title="View question details">
                              <Button
                                className="admin-icon-btn"
                                shape="circle"
                                onClick={() => this.openDetailsModal(question._id)}
                              >
                                <Eye size={16} strokeWidth={2.3} />
                              </Button>
                            </Tooltip>
                            <Popconfirm
                              title="Delete this question?"
                              cancelText="No"
                              okText="Yes"
                              onConfirm={() => this.deleteQuestion(question._id)}
                              icon={<Icon type="delete" style={{ color: 'var(--danger)' }} />}
                            >
                              <Button className="admin-icon-btn admin-icon-btn-danger">
                                <Icon type="delete" />
                              </Button>
                            </Popconfirm>
                          </div>
                        </td>
                      </tr>
                    ))
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
          open={this.props.trainer.NewQuestionmodalOpened}
          onClose={this.closeNewModal}
          width={1100}
          title="Create Question"
          subtitle="Build a new question with options, media, and scoring weight."
        >
          <NewQuestionForm />
        </AppModal>

        <AppModal
          open={this.state.questiondetailsModelVisible}
          onClose={this.closeDetailsModal}
          width={980}
          title="Question Details"
          subtitle="Inspect question metadata and answer structure."
        >
          {this.state.questiondetailsId ? <QuestionDetails id={this.state.questiondetailsId} /> : null}
        </AppModal>
      </div>
    );
  }
}

const mapStateToProps = (state) => ({
  trainer: state.trainer,
  admin: state.admin
});

export default connect(mapStateToProps, {
  ChangeQuestionModalState,
  ChangeQuestionTableData,
  ChangeQuestionSearchText,
  ChangeSelectedSubjects,
  ChangeSubjectTableData
})(AllQuestions);
