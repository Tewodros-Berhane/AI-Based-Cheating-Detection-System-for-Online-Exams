import React, { Component } from 'react'
import { Tabs, Skeleton, message } from 'antd-compat';
import { connect } from 'react-redux';
import './testdetails.css';
import Questions from '../conducttest/questions'
import {updateQuestiosnActiveTest } from '../../../actions/trainerAction';
import { SecurePost } from '../../../services/axiosCall';
import apis from '../../../services/Apis';
import moment from 'moment';
import  Alert  from '../../common/alert';
import Stats from './stats';
import Trainee from './trainee';
import FeedBacks from './feedbacks'
import { Copy, Info, ListChecks, MessageSquare, PieChart, Users } from 'lucide-react';
const { TabPane } = Tabs;


class TestDetails extends Component {
    constructor(props){
        super(props);
        this.state={
            id:this.props.trainer.DataActiveTestDetails.testDetailsId,
            testdetails:null,
            stats:null,
            file:null,
            loading:true,
            maxMarks:0,
            mainlink:'',
            feedbacks:[]
        }
        
    }
    setMainLink = () => {
        var link = window.location.href.split('/').splice(0,3);
        var mainlink="";
        link.forEach((d)=>{
            mainlink=mainlink+d+"/"
        });
        this.setState({mainlink});
    }

    loadTestDetails = async () => {
        try {
            const baseResponse = await SecurePost({
                url: `${apis.GET_SINGLE_TEST}`,
                data: {
                    id: this.state.id
                }
            });

            if (!baseResponse.data.success) {
                Alert('error', 'Error !', baseResponse.data.message || 'Unable to load exam details.');
                this.setState({ loading: false });
                return;
            }

            const testdetails = baseResponse.data.data;
            if (!testdetails.testconducted) {
                this.setState({
                    testdetails,
                    stats: [],
                    file: '',
                    maxMarks: 0,
                    feedbacks: [],
                    loading: false
                });
                return;
            }

            const responses = await Promise.allSettled([
                SecurePost({
                    url: apis.GET_STATS,
                    data: { testid: this.state.id }
                }),
                SecurePost({
                    url: apis.GET_EXCEL,
                    data: { id: this.state.id }
                }),
                SecurePost({
                    url: apis.MAX_MARKS_FETCH,
                    data: { testid: this.state.id }
                }),
                SecurePost({
                    url: apis.GET_FEEDBACKS,
                    data: { testid: this.state.id }
                })
            ]);

            const [statsResponse, excelResponse, maxMarksResponse, feedbackResponse] = responses;
            const stats =
                statsResponse.status === 'fulfilled' && statsResponse.value.data.success
                    ? statsResponse.value.data.data
                    : [];
            const file =
                excelResponse.status === 'fulfilled' && excelResponse.value.data.success
                    ? excelResponse.value.data.file
                    : '';
            const maxMarks =
                maxMarksResponse.status === 'fulfilled' && maxMarksResponse.value.data.success
                    ? maxMarksResponse.value.data.data
                    : 0;
            const feedbacks =
                feedbackResponse.status === 'fulfilled' && feedbackResponse.value.data.success
                    ? feedbackResponse.value.data.data
                    : [];

            this.setState({
                testdetails,
                stats,
                file,
                maxMarks,
                feedbacks,
                loading: false
            });
        } catch (error) {
            Alert('error', 'Error !', 'Server Error.');
            this.setState({ loading: false });
        }
    }

    copyToClipboard = async (text) => {
        try {
            await navigator.clipboard.writeText(text);
            message.success('Link Copied to clipboard');
        } catch (error) {
            message.error('Unable to copy link');
        }
    }

    componentDidMount(){
        this.setMainLink();
        this.loadTestDetails();
    }

    render() {
        if(this.state.loading){
            return(
                <div className="skeletor-wrapper">
                    <Skeleton active />
                    <Skeleton active />
                </div>
            )
        }
        else{
            let { testdetails,id }=this.state;
            if (!testdetails) {
                return null;
            }
            const examLink = `${this.state.mainlink}user/conducttest?testid=${id}`;
            const examId = this.props.trainer.DataActiveTestDetails.testDetailsId || '-';
            const courseTitle = (testdetails.subjects || [])
                .map((subject) => subject && subject.topic)
                .filter(Boolean)
                .join(', ') || 'No course mapping';
            const detailCards = [
                { label: 'Exam Title', value: testdetails.title || '-' },
                { label: 'Course Title', value: courseTitle },
                { label: 'Duration', value: `${testdetails.duration || 0} min` },
                { label: 'Created On', value: moment(testdetails.createdAt).format('DD MMM YYYY') }
            ];
            return (
                <div className='testdetails-dashboard'>
                    <Tabs defaultActiveKey="1">
                        <TabPane tab={ <span className="testdetails-tab-label"><Info size={14} strokeWidth={2.3} /> Overview</span> } key="1">
                            <section className="testdetails-overview">
                                <div className="testdetails-meta-grid">
                                    {detailCards.map((item) => (
                                        <article className="testdetails-meta-card" key={item.label}>
                                            <span className="testdetails-meta-label">{item.label}</span>
                                            <span className="testdetails-meta-value">{item.value}</span>
                                        </article>
                                    ))}
                                </div>

                                <article className="testdetails-link-card">
                                    <span className="testdetails-meta-label">Exam ID</span>
                                    <span className="testdetails-meta-value testdetails-meta-value-id">{examId}</span>
                                </article>

                                <article className="testdetails-link-card">
                                    <span className="testdetails-meta-label">Exam Link</span>
                                    <div className="testdetails-link-row">
                                        <input readOnly value={examLink} />
                                        <button
                                            type="button"
                                            className="testdetails-link-copy"
                                            onClick={() => this.copyToClipboard(examLink)}
                                            aria-label="Copy exam link"
                                        >
                                            <Copy size={14} strokeWidth={2.3} />
                                        </button>
                                    </div>
                                </article>
                            </section>
                        </TabPane>
                        {testdetails.testconducted?
                            <TabPane tab={ <span className="testdetails-tab-label"><ListChecks size={14} strokeWidth={2.3} /> Questions</span> } key="2">
                                <Questions id={this.props.trainer.DataActiveTestDetails.testDetailsId} questionsOfTest={this.props.trainer.DataActiveTestDetails.testquestions} updateQuestiosnTest={this.props.updateQuestiosnActiveTest}/>
                            </TabPane>
                        :null}
                        {testdetails.testconducted?
                            <TabPane tab={ <span className="testdetails-tab-label"><Users size={14} strokeWidth={2.3} /> Students</span> } key="3">
                                <Trainee maxmMarks={this.state.maxMarks} id={this.state.id} stats={this.state.stats}/>
                            </TabPane>
                        :null}
                        {testdetails.testconducted?
                            <TabPane tab={ <span className="testdetails-tab-label"><PieChart size={14} strokeWidth={2.3} /> Statistics</span> } key="4">
                                <Stats id={this.state.id} stats={this.state.stats} file={this.state.file} maxmMarks={this.state.maxMarks}/>
                            </TabPane>
                        :null}
                        {testdetails.testconducted?
                            <TabPane tab={ <span className="testdetails-tab-label"><MessageSquare size={14} strokeWidth={2.3} /> Feedbacks</span> } key="5">
                               <FeedBacks feedbacks={this.state.feedbacks}/>
                            </TabPane>
                        :null}
                    </Tabs>
                </div>
            )
        }
    }
}

const mapStateToProps = state => ({
    trainer : state.trainer
});

export default connect(mapStateToProps,{
    updateQuestiosnActiveTest
})(TestDetails);

