import React, { Component } from 'react';
import { Table, Input, Button, Icon, Typography, Modal, Tag, Popconfirm, Divider } from 'antd';
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

class AllTests extends Component {

    openModal = (id) => {
        this.props.ChangeTestDetailsModalState(true, id);
    }
    
    closeModal = () => {
        this.props.ChangeTestDetailsModalState(false, null);
    }
    
    componentDidMount() {
      this.props.ChangeTestTableData();
    }

    getColumnSearchProps = dataIndex => ({
        filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }) => (
          <div style={{ padding: 8 }}>
            <Input
              ref={node => {
                this.searchInput = node;
              }}
              placeholder={`Search ${dataIndex}`}
              value={selectedKeys[0]}
              onChange={e => setSelectedKeys(e.target.value ? [e.target.value] : [])}
              onPressEnter={() => this.handleSearch(selectedKeys, confirm)}
              style={{ width: 188, marginBottom: 8, display: 'block' }}
            />
            <Button
              type="primary"
              onClick={() => this.handleSearch(selectedKeys, confirm)}
              icon="search"
              size="small"
              style={{ width: 90, marginRight: 8 }}
            >
              Search
            </Button>
            <Button onClick={() => this.handleReset(clearFilters)} size="small" style={{ width: 90 }}>
              Reset
            </Button>
          </div>
        ),
        filterIcon: filtered => (
          <Icon type="search" style={{ color: filtered ? '#1890ff' : undefined }} />
        ),
        onFilter: (value, record) =>
          record[dataIndex]
            .toString()
            .toLowerCase()
            .includes(value.toLowerCase()),
        onFilterDropdownVisibleChange: visible => {
          if (visible) {
            setTimeout(() => this.searchInput.select());
          }
        },
        render: (text, record) => (
          <Highlighter
            highlightStyle={{ backgroundColor: '#ffc069', padding: 0 }}
            searchWords={[this.props.trainer.TestsearchText]}
            autoEscape
            // String(undefined) === "undefined", so you might still want to guard empty
            textToHighlight={String(text || '')}
          />
        ),

      });
    
    handleSearch = (selectedKeys, confirm) => {
        confirm();
        this.props.ChangeTestSearchText(selectedKeys[0]);
    };
    
    handleReset = clearFilters => {
        clearFilters();
        this.props.ChangeTestSearchText('');
    };

    deleteTest = (id) => {
        SecurePost({
          url: `${apis.DELETE_TEST}`,
          data: {
              _id: id
          }
        }).then((response) => {
          if(response.data.success){
            Alert('success', 'Success', response.data.message);
            this.props.ChangeTestTableData();
          } else {
            Alert('warning', 'Warning!', response.data.message);
          }
        }).catch((error) => {
          Alert('error', 'Error!', 'Server Error');
        });
    }

    render() {
      const { Title } = Typography;
      const columns = [
        {
          title: 'Name',
          dataIndex: 'title',
          key: 'title',
          ...this.getColumnSearchProps('title'),
        },
        {
          title: 'Subjects',
          dataIndex: 'subjects',
          key: 'subjects._id',
          render: tags => (
            <span>
              {tags.map(tag => {
                let color = 'geekblue';
                return (
                  <Tag color={color} key={tag._id}>
                    {tag.topic.toUpperCase()}
                  </Tag>
                );
              })}
            </span>
          )
        },
        {
          title: 'Created on',
          dataIndex: 'createdAt',
          key: 'createdAt',
          ...this.getColumnSearchProps('createdAt'),
          render: date => (
            <span>
              {moment(date).format("DD/ MM/YYYY")}
            </span>
          )
        },
        {
          title: 'Action',
          key: '_id',
          dataIndex: '_id',
          render: (key) => (
            <span>
              <Button type="primary" shape="circle" icon="info-circle" onClick={() => this.openModal(key)} />
              <Divider type="vertical" />
              <Popconfirm
                  title="Are you sure？"
                  cancelText="No"
                  okText="Yes"
                  onConfirm={() => this.deleteTest(key)}
                  icon={<Icon type="delete" style={{ color: 'red' }} />}
                >
                  <Button type="danger" shape="circle" icon="delete" />
              </Popconfirm>
            </span>
          ),
        },
      ];
      
      return (
        <div className="admin-table-container alltests-dashboard">
          <div className="register-trainer-form-header">
            <Title level={4} style={{color:'#fff', textAlign:'center'}}>List of Exams</Title>
          </div>
          <Table 
            bordered
            columns={columns} 
            dataSource={this.props.trainer.TestTableData} 
            size="medium" 
            pagination={{ pageSize: 5 }}
            loading={this.props.trainer.TestTableLoading}
            rowKey="_id" 
          />
          <Modal
            visible={this.props.trainer.TestDetailsmodalOpened}
            title="Test details"
            onOk={this.handleOk}
            onCancel={this.closeModal}
            afterClose={this.closeModal}
            style={{ top: '20px', padding: '0px', backgroundColor: 'rgb(167, 155, 190)' }}
            width="90%"
            destroyOnClose
            footer={[]}
          >
            <TestDetails />
          </Modal>
        </div>
      );
    }
}

const mapStateToProps = state => ({
    trainer: state.trainer
});

export default connect(mapStateToProps, {
    ChangeTestSearchText,
    ChangeTestTableData,
    ChangeTestDetailsModalState
})(AllTests);
