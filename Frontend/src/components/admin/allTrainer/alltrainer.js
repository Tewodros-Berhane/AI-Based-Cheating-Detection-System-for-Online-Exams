import React, { Component } from 'react';
import { Input, Button, Popconfirm, Tag, Tooltip, Pagination, Spin } from 'antd-compat';
import Highlighter from 'react-highlight-words';
import { connect } from 'react-redux';
import {
  ChangeTrainerSearchText,
  ChangeTrainerTableData,
  ChangeTrainerModalState
} from '../../../actions/adminAction';
import './alltrainer.css';
import Alert from '../../../components/common/alert';
import { SecurePost } from '../../../services/axiosCall';
import apis from '../../../services/Apis';
import NewTrainerForm from '../newTrainer/newtrainer';
import AppModal from '../../common/AppModal';
import { Pencil, Search, Trash2, UserPlus } from 'lucide-react';

class AllTrainer extends Component {
  constructor(props) {
    super(props);
    this.state = {
      page: 1,
      pageSize: 7
    };
  }

  componentDidMount() {
    this.props.ChangeTrainerTableData();
  }

  openModal = (id, mode) => {
    this.props.ChangeTrainerModalState(true, id, mode);
  };

  closeModal = () => {
    this.props.ChangeTrainerModalState(false, null, 'Register');
  };

  deleteTrainer = (id) => {
    SecurePost({
      url: apis.DELETE_TRAINER,
      data: { _id: id }
    })
      .then((response) => {
        if (response.data.success) {
          Alert('success', 'Success', response.data.message);
          this.props.ChangeTrainerTableData();
          return;
        }
        Alert('warning', 'Warning!', response.data.message);
      })
      .catch(() => {
        Alert('error', 'Error!', 'Something went wrong. Please try again.');
      });
  };

  handleSearch = (event) => {
    this.setState({ page: 1 });
    this.props.ChangeTrainerSearchText(event.target.value);
  };

  getFilteredData = () => {
    const trainers = this.props.admin.trainerTableData || [];
    const query = (this.props.admin.TrainersearchText || '').trim().toLowerCase();

    if (!query) {
      return trainers;
    }

    return trainers.filter((trainer) =>
      ['name', 'emailid', 'contact'].some((key) =>
        String(trainer[key] || '')
          .toLowerCase()
          .includes(query)
      )
    );
  };

  changePage = (page, pageSize) => {
    this.setState({ page, pageSize });
  };

  renderCellText = (value) => (
    <Highlighter
      highlightStyle={{ backgroundColor: 'rgba(59,130,246,0.25)', padding: 0, borderRadius: 4 }}
      searchWords={[this.props.admin.TrainersearchText || '']}
      autoEscape
      textToHighlight={String(value || '')}
    />
  );

  render() {
    const isEditing = this.props.admin.Trainermode === 'Save Changes';
    const filteredData = this.getFilteredData();
    const total = filteredData.length;
    const start = (this.state.page - 1) * this.state.pageSize;
    const end = start + this.state.pageSize;
    const visibleRows = filteredData.slice(start, end);

    return (
      <div className="admin-modern-shell">
        <div className="admin-modern-headline">
          <div className="admin-modern-title-group">
            <h3>Examiner Directory</h3>
            <p>Manage examiner accounts, contact details, and profile updates from one workspace.</p>
          </div>
          <div className="admin-modern-headline-right">
            <Tag className="admin-modern-chip">{total} Examiners</Tag>
            <Button
              type="primary"
              icon={<UserPlus size={16} strokeWidth={2.2} />}
              className="admin-modern-primary-btn"
              onClick={() => this.openModal(null, 'Register')}
            >
              Add Examiner
            </Button>
          </div>
        </div>

        <div className="admin-modern-table-wrap">
          <div className="admin-table-toolbar">
            <Input
              className="admin-table-search"
              allowClear
              value={this.props.admin.TrainersearchText}
              onChange={this.handleSearch}
              placeholder="Search examiners by name, email, or contact"
              prefix={<Search size={16} strokeWidth={2.2} style={{ color: 'var(--text-muted)' }} />}
            />
            <span className="admin-table-meta">
              {this.props.admin.trainerTableLoadingStatus ? 'Loading records...' : `${total} records found`}
            </span>
          </div>

          <div className="admin-data-grid-shell">
            <div className="admin-data-grid-scroll">
              <table className="admin-data-grid">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Contact</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {this.props.admin.trainerTableLoadingStatus ? (
                    <tr className="admin-empty-row">
                      <td colSpan={4}>
                        <Spin />
                      </td>
                    </tr>
                  ) : visibleRows.length === 0 ? (
                    <tr className="admin-empty-row">
                      <td colSpan={4}>No examiners match your current search.</td>
                    </tr>
                  ) : (
                    visibleRows.map((trainer) => (
                      <tr className="admin-data-row" key={trainer._id}>
                        <td>
                          <div className="admin-row-title">{this.renderCellText(trainer.name)}</div>
                        </td>
                        <td>{this.renderCellText(trainer.emailid)}</td>
                        <td>{this.renderCellText(trainer.contact)}</td>
                        <td>
                          <div className="admin-row-actions">
                            <Tooltip title="Edit examiner">
                              <Button
                                className="admin-icon-btn"
                                shape="circle"
                                onClick={() => this.openModal(trainer._id, 'Save Changes')}
                              >
                                <Pencil size={16} strokeWidth={2.3} />
                              </Button>
                            </Tooltip>
                            <Popconfirm
                              title="Remove this examiner?"
                              cancelText="No"
                              okText="Yes"
                              onConfirm={() => this.deleteTrainer(trainer._id)}
                              icon={<Trash2 size={16} strokeWidth={2.3} style={{ color: 'var(--danger)' }} />}
                            >
                              <Button className="admin-icon-btn admin-icon-btn-danger" shape="circle">
                                <Trash2 size={16} strokeWidth={2.3} />
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
          open={this.props.admin.TrainermodalOpened}
          onClose={this.closeModal}
          width={700}
          title={isEditing ? 'Update Examiner' : 'Register Examiner'}
          subtitle={
            isEditing
              ? 'Edit examiner details and save changes instantly.'
              : 'Create a new examiner account and send secure access credentials.'
          }
        >
          <NewTrainerForm />
        </AppModal>
      </div>
    );
  }
}

const mapStateToProps = (state) => ({
  admin: state.admin
});

export default connect(mapStateToProps, {
  ChangeTrainerSearchText,
  ChangeTrainerTableData,
  ChangeTrainerModalState
})(AllTrainer);
