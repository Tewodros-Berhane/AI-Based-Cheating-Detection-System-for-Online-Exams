import React from 'react';
import { Table, Icon, Tag, Skeleton, Descriptions, Modal, Button, Row, Col, Empty } from 'antd-compat';
import './answer.css';
import { connect } from 'react-redux';
import { Post } from '../../../services/axiosCall';
import apis from '../../../services/Apis';
import Alert from '../../common/alert';
import { Typography } from 'antd-compat';
import { Eye } from 'lucide-react';
import Feedback from './feedback';
import { FeedbackStatus } from '../../../actions/traineeAction';

const { Title } = Typography;

class Answer extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            loading: false,
            data: [],
            TotalScore: null,
            Mvisible: false,
            ActiveQuestionId: null,
            loadError: '',
        };
    }

    componentDidMount() {
        this.loadSummary();
    }

    loadSummary = async () => {
        const { traineeid, testid } = this.props.trainee;
        this.setState({
            loading: true,
            loadError: '',
        });

        const p1 = Post({
            url: apis.FETCH_OWN_RESULT,
            data: {
                userid: traineeid,
                testid: testid,
            },
        });
        const p2 = Post({
            url: `${apis.FETCH_TRAINEE_TEST_QUESTION}`,
            data: {
                id: testid,
            },
        });
        const p3 = Post({
            url: `${apis.FEEDBACK_STATUS_CHECK}`,
            data: {
                userid: traineeid,
                testid: testid,
            },
        });

        const [resultRes, questionsRes, feedbackRes] = await Promise.allSettled([p1, p2, p3]);

        if (feedbackRes.status === 'fulfilled' && feedbackRes.value.data && feedbackRes.value.data.success) {
            this.props.FeedbackStatus(feedbackRes.value.data.status);
        }

        if (resultRes.status !== 'fulfilled' || !resultRes.value.data || !resultRes.value.data.success) {
            const message = resultRes.status === 'fulfilled'
                ? (resultRes.value.data && resultRes.value.data.message) || 'Unable to load results.'
                : 'Server Error';
            this.setState({
                loading: false,
                loadError: message,
            });
            Alert('error', 'Error!', message);
            return;
        }

        if (questionsRes.status !== 'fulfilled' || !questionsRes.value.data || !questionsRes.value.data.success) {
            const message = questionsRes.status === 'fulfilled'
                ? (questionsRes.value.data && questionsRes.value.data.message) || 'Unable to load question paper.'
                : 'Server Error';
            this.setState({
                loading: false,
                loadError: message,
            });
            Alert('error', 'Error!', message);
            return;
        }

        const questionRows = questionsRes.value.data.data || [];
        const resultRows = (resultRes.value.data.result && resultRes.value.data.result.result) || [];
        const questionById = questionRows.reduce((acc, item) => {
            if (item && item._id) {
                acc[String(item._id)] = item;
            }
            return acc;
        }, {});

        const mergedRows = resultRows.map((item, index) => {
            const qid = item && item.qid ? String(item.qid) : '';
            const question = questionById[qid] || questionRows[index] || {};
            return {
                ...question,
                ...item,
                qid: qid || question._id || `row-${index}`,
                correctAnswer: Array.isArray(item && item.correctAnswer) ? item.correctAnswer : [],
                givenAnswer: Array.isArray(item && item.givenAnswer) ? item.givenAnswer : [],
            };
        });

        this.setState({
            loading: false,
            data: mergedRows,
            TotalScore: resultRes.value.data.result ? resultRes.value.data.result.score : null,
            loadError: '',
        });
    };

    handleCancel = () => {
        this.setState({
            Mvisible: false,
        });
    };

    OpenModel = (qid) => {
        this.setState({
            ActiveQuestionId: qid,
            Mvisible: true,
        });
    };

    render() {
        const renderAnswerTags = (tags, color) => {
            if (!Array.isArray(tags) || tags.length === 0) {
                return <span className="result-tag-empty">-</span>;
            }
            return (
                <span>
                    {tags.map((tag) => (
                        <Tag color={color} key={`${color}-${tag}`}>
                            {String(tag).toUpperCase()}
                        </Tag>
                    ))}
                </span>
            );
        };

        const columns = [
            {
                title: '',
                key: 'action',
                width: 60,
                render: (_, record) => (
                    <Button
                        shape="circle"
                        type="primary"
                        size="small"
                        className="result-preview-button"
                        onClick={() => {
                            this.OpenModel(record.qid);
                        }}
                    >
                        <Eye size={14} strokeWidth={2.2} />
                    </Button>
                ),
            },
            {
                title: '#',
                key: 'index',
                width: 60,
                render: (text, record, index) => <span className="result-index">{index + 1}</span>,
            },
            {
                title: 'Question',
                dataIndex: 'body',
                key: 'body',
                render: (value) => (
                    <div className="result-question-cell" title={value || '-'}>
                        {value || '-'}
                    </div>
                ),
            },
            {
                title: 'Correct',
                key: 'correctAnswer',
                dataIndex: 'correctAnswer',
                render: (tags) => renderAnswerTags(tags, 'green'),
            },
            {
                title: 'Your Answer',
                key: 'givenAnswer',
                dataIndex: 'givenAnswer',
                render: (tags) => renderAnswerTags(tags, 'blue'),
            },
            {
                title: 'Marks',
                dataIndex: 'weightage',
                key: 'weightage',
                width: 90,
                align: 'center',
                render: (value) => <span className="result-marks">{value || 0}</span>,
            },
            {
                title: 'Status',
                dataIndex: 'iscorrect',
                key: 'iscorrect',
                width: 100,
                align: 'center',
                render: (value) => (
                    <span className={`result-status-pill ${value ? 'is-correct' : 'is-incorrect'}`}>
                        <Icon type={value ? 'check-circle' : 'close-circle'} />
                    </span>
                ),
            },
        ];
        let td = this.props.trainee.traineeDetails;
        const totalQuestions = this.state.data.length;
        const correctAnswers = this.state.data.filter((item) => item.iscorrect).length;
        const incorrectAnswers = totalQuestions - correctAnswers;
        const scorePct = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
        return (
            <div className="answer-table-outer">
                <Title style={{color:'#fff'}} className="answer-table-heading" level={3}>
                    Exam Result Summary
                </Title>
                <div className="answer-table-wrapper">
                    <Descriptions
                        bordered
                        title={null}
                        size="small"
                        column={{ xxl: 1, xl: 1, lg: 1, md: 1, sm: 1, xs: 1 }}
                        className="result-meta"
                    >
                        <Descriptions.Item label="Candidate">{td.name}</Descriptions.Item>
                        <Descriptions.Item label="Email">{td.emailid}</Descriptions.Item>
                        <Descriptions.Item label="Contact">{td.contact}</Descriptions.Item>
                        <Descriptions.Item label="Total Score">{this.state.TotalScore}</Descriptions.Item>
                    </Descriptions>
                    <Row gutter={[12, 12]} className="result-metrics">
                        <Col xs={12} md={6}><div className="result-summary-card"><span>Questions</span><strong>{totalQuestions}</strong></div></Col>
                        <Col xs={12} md={6}><div className="result-summary-card"><span>Correct</span><strong>{correctAnswers}</strong></div></Col>
                        <Col xs={12} md={6}><div className="result-summary-card"><span>Incorrect</span><strong>{incorrectAnswers}</strong></div></Col>
                        <Col xs={12} md={6}><div className="result-summary-card"><span>Accuracy</span><strong>{scorePct}%</strong></div></Col>
                    </Row>
                    <div className="result-table-shell">
                        {this.state.loadError && !this.state.loading ? (
                            <div className="result-error-box">
                                <p>{this.state.loadError}</p>
                                <Button type="default" onClick={this.loadSummary}>Retry</Button>
                            </div>
                        ) : (
                            <Table
                                size="small"
                                rowKey="qid"
                                loading={this.state.loading}
                                columns={columns}
                                dataSource={this.state.data}
                                pagination={false}
                                className="result-table"
                                locale={{
                                    emptyText: this.state.loading ? 'Loading result...' : <Empty description="No result rows found." />
                                }}
                            />
                        )}
                    </div>
                    {this.props.trainee.hasGivenFeedBack ? null : <Feedback />}
                    <Modal
                        destroyOnClose={true}
                        width={900}
                        style={{ top: '30px' }}
                        title="Question Details"
                        open={this.state.Mvisible}
                        onOk={this.handleCancel}
                        onCancel={this.handleCancel}
                        footer={null}
                        className="result-question-modal"
                    >
                        <SingleQuestionDetails qid={this.state.ActiveQuestionId} />
                    </Modal>
                </div>
            </div>
        );
    }
}

class SingleQuestionDetails extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            fetching: false,
            qdetails: null,
        };
    }

    componentDidMount() {
        this.fetchDetails(this.props.qid);
    }

    componentDidUpdate(prevProps) {
        if (prevProps.qid !== this.props.qid && this.props.qid) {
            this.fetchDetails(this.props.qid);
        }
    }

    fetchDetails = (qid) => {
        if (!qid) return;
        this.setState({
            fetching: true,
            qdetails: null,
        });
        Post({
            url: apis.FETCH_SINGLE_QUESTION_BY_TRAINEE,
            data: {
                qid: qid,
            },
        })
            .then((response) => {
                console.log(response);
                if (response.data.success) {
                    this.setState({
                        qdetails: response.data.data[0],
                    });
                } else {
                    Alert('error', 'Error !', response.data.message);
                }
                this.setState({
                    fetching: false,
                });
            })
            .catch((error) => {
                this.setState({
                    fetching: false,
                });
                console.log(error);
                Alert('error', 'Error !', 'Server Error');
            });
    };

    render() {
        const optn = ['A', 'B', 'C', 'D', 'E'];
        let Optiondata = this.state.qdetails;
        if (Optiondata !== null) {
            return (
                <div className="result-question-details">
                    <div className="mainQuestionDetailsContaine">
                        <div className="questionDetailsBody">{Optiondata.body}</div>
                        {Optiondata.quesimg ? (
                            <div className="questionDetailsImageContainer">
                                <img alt="Unable to load" className="questionDetailsImage" src={Optiondata.quesimg} />
                            </div>
                        ) : null}
                        <div>
                            {(Optiondata.options || []).map((d, i) => {
                                return (
                                    <div key={i}>
                                        <Row type="flex" justify="center" className="QuestionDetailsOptions">
                                            <Col span={3}>
                                                {d.isAnswer ? <Button className="green" shape="circle">{optn[i]}</Button> : <Button className="result-option-index" shape="circle">{optn[i]}</Button>}
                                            </Col>
                                            {d.optimg ? (
                                                <Col span={6} style={{ padding: '5px' }}>
                                                    <img alt="Unable to load" className="questionDetailsImage" src={d.optimg} />
                                                </Col>
                                            ) : null}
                                            {d.optimg ? <Col span={15}>{d.optbody}</Col> : <Col span={21}>{d.optbody}</Col>}
                                        </Row>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            );
        } else {
            return (
                <div className="result-question-skeleton">
                    <Skeleton active />
                    <Skeleton active />
                </div>
            );
        }
    }
}

const mapStateToProps = (state) => ({
    trainee: state.trainee,
});

export default connect(mapStateToProps, {
    FeedbackStatus,
})(Answer);

