import React from 'react';
import { Table, Icon, Tag, Skeleton, Descriptions, Modal, Button, Row, Col } from 'antd-compat';
import './answer.css';
import './answermobileview.css';
import './individualquestion_mobileview.css';
import { connect } from 'react-redux';
import { Post } from '../../../services/axiosCall';
import apis from '../../../services/Apis';
import Alert from '../../common/alert';
import { Typography } from 'antd-compat';
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
        };
    }

    componentDidMount() {
        let { traineeid, testid } = this.props.trainee;
        this.setState({
            loading: true,
        });
        let p1 = Post({
            url: apis.FETCH_OWN_RESULT,
            data: {
                userid: traineeid,
                testid: testid,
            },
        });
        let p2 = Post({
            url: `${apis.FETCH_TRAINEE_TEST_QUESTION}`,
            data: {
                id: testid,
            },
        });
        let p3 = Post({
            url: `${apis.FEEDBACK_STATUS_CHECK}`,
            data: {
                userid: traineeid,
                testid: testid,
            },
        });
        Promise.all([p1, p2, p3])
            .then((d) => {
                console.log(d);
                this.setState({
                    loading: false,
                });
                if (d[0].data.success && d[1].data.success) {
                    let v = d[1].data.data;
                    let r = d[0].data.result.result.map((dd, i) => {
                        return {
                            ...dd,
                            ...v[i],
                        };
                    });
                    console.log(r);
                    this.setState({
                        data: r,
                        TotalScore: d[0].data.result.score,
                    });
                    if (d[2].data.success) {
                        this.props.FeedbackStatus(d[2].data.status);
                    }
                } else {
                    Alert('error', 'Error!', `${d[0].data.success ? '' : d[0].data.message} and ${d[1].data.success ? '' : d[1].data.message}`);
                }
            })
            .catch((err) => {
                console.log(err);
                this.setState({
                    loading: false,
                });
                Alert('error', 'Error!', 'Server Error');
            });
    }

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
        const columns = [
            {
                title: 'Preview',
                key: 'action',
                render: (text, record) => (
                    <Button shape="circle" icon="info" type="primary" size="small" onClick={() => { this.OpenModel(text.qid); }}></Button>
                ),
            },
            {
                title: 'Question',
                dataIndex: 'body',
                key: 'body',
            },
            {
                title: 'Correct',
                key: 'correctAnswer',
                dataIndex: 'correctAnswer',
                render: (tags) => (
                    <span>
                        {tags.map((tag) => {
                            return (
                                <Tag color="green" key={tag}>
                                    {tag.toUpperCase()}
                                </Tag>
                            );
                        })}
                    </span>
                ),
            },
            {
                title: 'Your Answer',
                key: 'givenAnswer',
                dataIndex: 'givenAnswer',
                render: (tags) => (
                    <span>
                        {tags.map((tag) => {
                            return (
                                <Tag color="blue" key={tag}>
                                    {tag.toUpperCase()}
                                </Tag>
                            );
                        })}
                    </span>
                ),
            },
            {
                title: 'Marks',
                dataIndex: 'weightage',
                key: 'weightage',
            },
            {
                title: 'Status',
                dataIndex: 'iscorrect',
                key: 'iscorrect',
                render: (tags) => (
                    <span>
                        {tags ? (
                            <Icon type="check-circle" theme="twoTone" twoToneColor="#52c41a" />
                        ) : (
                            <Icon type="close-circle" theme="twoTone" twoToneColor="red" />
                        )}
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
                    <Descriptions bordered title={null} border size="small" column={{ xxl: 1, xl: 1, lg: 1, md: 1, sm: 1, xs: 1 }} className="result-meta">
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
                    <Table size="small" rowKey="qid" loading={this.state.loading} columns={columns} dataSource={this.state.data} pagination={false} className="result-table" />
                    {this.props.trainee.hasGivenFeedBack ? null : <Feedback />}
                    <Modal destroyOnClose={true} width="70%" style={{ top: '30px' }} title="Question details" open={this.state.Mvisible} onOk={this.handleCancel} onCancel={this.handleCancel} footer={null}>
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
        this.setState({
            fetching: true,
        });
        Post({
            url: apis.FETCH_SINGLE_QUESTION_BY_TRAINEE,
            data: {
                qid: this.props.qid,
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
    }

    render() {
        const optn = ['A', 'B', 'C', 'D', 'E'];
        let Optiondata = this.state.qdetails;
        if (Optiondata !== null) {
            return (
                <div>
                    <div className="mainQuestionDetailsContaine">
                        <div className="questionDetailsBody">{Optiondata.body}</div>
                        {Optiondata.quesimg ? (
                            <div className="questionDetailsImageContainer">
                                <img alt="Unable to load" className="questionDetailsImage" src={Optiondata.quesimg} />
                            </div>
                        ) : null}
                        <div>
                            {Optiondata.options.map((d, i) => {
                                return (
                                    <div key={i}>
                                        <Row type="flex" justify="center" className="QuestionDetailsOptions">
                                            <Col span={2}>
                                                {d.isAnswer ? <Button className="green" shape="circle">{optn[i]}</Button> : <Button type="primary" shape="circle">{optn[i]}</Button>}
                                            </Col>
                                            {d.optimg ? (
                                                <Col span={6} style={{ padding: '5px' }}>
                                                    <img alt="Unable to load" className="questionDetailsImage" src={d.optimg} />
                                                </Col>
                                            ) : null}
                                            {d.optimg ? <Col span={14}>{d.optbody}</Col> : <Col span={20}>{d.optbody}</Col>}
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
                <div className="skeletor-wrapper">
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

