import React, { Component } from 'react';
import { Input, Button, Tag, Tooltip, Pagination, Spin } from 'antd-compat';
import Highlighter from 'react-highlight-words';
import { connect } from 'react-redux';
import {
  ChangeSubjectSearchText,
  ChangeSubjectTableData,
  ChangeSubjectModalState
} from '../../../actions/adminAction';
import './alltopics.css';
import NewSubjectForm from '../newTopics/newtopics';
import AppModal from '../../common/AppModal';
import { CirclePlus, Pencil, Search } from 'lucide-react';

class AllTopics extends Component {
  constructor(props) {
    super(props);
    this.state = {
      page: 1,
      pageSize: 8
    };
  }

  componentDidMount() {
    this.props.ChangeSubjectTableData();
  }

  openModal = (id, mode) => {
    this.props.ChangeSubjectModalState(true, id, mode);
  };

  closeModal = () => {
    this.props.ChangeSubjectModalState(false, null, 'New Course');
  };

  handleSearch = (event) => {
    this.setState({ page: 1 });
    this.props.ChangeSubjectSearchText(event.target.value);
  };

  getFilteredData = () => {
    const data = this.props.admin.subjectTableData || [];
    const query = (this.props.admin.SubjectsearchText || '').trim().toLowerCase();
    if (!query) {
      return data;
    }
    return data.filter((item) =>
      String(item.topic || '')
        .toLowerCase()
        .includes(query)
    );
  };

  changePage = (page, pageSize) => {
    this.setState({ page, pageSize });
  };

  renderHighlighted = (value) => (
    <Highlighter
      highlightStyle={{ backgroundColor: 'rgba(59,130,246,0.25)', padding: 0, borderRadius: 4 }}
      searchWords={[this.props.admin.SubjectsearchText || '']}
      autoEscape
      textToHighlight={String(value || '')}
    />
  );

  render() {
    const courses = this.getFilteredData();
    const isEditing = this.props.admin.Subjectmode === 'Save Changes';
    const total = courses.length;
    const start = (this.state.page - 1) * this.state.pageSize;
    const end = start + this.state.pageSize;
    const visibleRows = courses.slice(start, end);

    return (
      <div className="admin-modern-shell">
        <div className="admin-modern-headline">
          <div className="admin-modern-title-group">
            <h3>Course Catalog</h3>
            <p>Organize exam domains and keep course taxonomy clean for question and exam creation.</p>
          </div>
          <div className="admin-modern-headline-right">
            <Tag className="admin-modern-chip">{total} Courses</Tag>
            <Button
              type="primary"
              icon={<CirclePlus size={16} strokeWidth={2.2} />}
              className="admin-modern-primary-btn"
              onClick={() => this.openModal(null, 'New Course')}
            >
              Add Course
            </Button>
          </div>
        </div>

        <div className="admin-modern-table-wrap">
          <div className="admin-table-toolbar">
            <Input
              className="admin-table-search"
              allowClear
              value={this.props.admin.SubjectsearchText}
              onChange={this.handleSearch}
              placeholder="Search courses by name"
              prefix={<Search size={16} strokeWidth={2.2} style={{ color: 'var(--text-muted)' }} />}
            />
            <span className="admin-table-meta">
              {this.props.admin.SubjectTableLoading ? 'Loading records...' : `${total} records found`}
            </span>
          </div>

          <div className="admin-data-grid-shell">
            <div className="admin-data-grid-scroll">
              <table className="admin-data-grid">
                <thead>
                  <tr>
                    <th>Course Name</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {this.props.admin.SubjectTableLoading ? (
                    <tr className="admin-empty-row">
                      <td colSpan={2}>
                        <Spin />
                      </td>
                    </tr>
                  ) : visibleRows.length === 0 ? (
                    <tr className="admin-empty-row">
                      <td colSpan={2}>No courses match your current search.</td>
                    </tr>
                  ) : (
                    visibleRows.map((course) => (
                      <tr className="admin-data-row" key={course._id}>
                        <td>
                          <div className="admin-row-title">{this.renderHighlighted(course.topic)}</div>
                        </td>
                        <td>
                          <div className="admin-row-actions">
                            <Tooltip title="Edit course">
                              <Button
                                className="admin-icon-btn"
                                shape="circle"
                                onClick={() => this.openModal(course._id, 'Save Changes')}
                              >
                                <Pencil size={16} strokeWidth={2.3} />
                              </Button>
                            </Tooltip>
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
          open={this.props.admin.SubjectmodalOpened}
          onClose={this.closeModal}
          width={700}
          title={isEditing ? 'Update Course' : 'Create Course'}
          subtitle={
            isEditing
              ? 'Rename the selected course and keep linked content intact.'
              : 'Add a new course category for upcoming exam workflows.'
          }
        >
          <NewSubjectForm />
        </AppModal>
      </div>
    );
  }
}

const mapStateToProps = (state) => ({
  admin: state.admin
});

export default connect(mapStateToProps, {
  ChangeSubjectSearchText,
  ChangeSubjectTableData,
  ChangeSubjectModalState
})(AllTopics);
