import React, { Component } from 'react';
import { Skeleton, Icon, Tabs, Alert } from 'antd-compat';
import './questiondetails.css';
import apis from '../../../services/Apis';
import { SecureGet } from '../../../services/axiosCall';
import moment from 'moment';
const { TabPane } = Tabs;

export default class QuestionDetails extends Component {
    constructor(props){
        super(props);
        this.state={
            loading : true,
            details:null,
            errorMessage: null
        }
    }

    fetchDetails = ()=>{
        var ID = this.props.id;
        this.setState({
            loading: true,
            details: null,
            errorMessage: null
        });
        SecureGet({
            url: `${apis.FETCH_SINGLE_QUESTION}/${ID}`,
        }).then((response)=>{
            const responseData = response && response.data ? response.data : {};
            const details = Array.isArray(responseData.data) ? responseData.data[0] : responseData.data;
            if(responseData.success && details){
                this.setState({
                    details : details,
                    loading:false,
                    errorMessage: null
                });
                return;
            }

            this.setState({
                loading: false,
                details: null,
                errorMessage: responseData.message || 'Unable to load question details.'
            });
        }).catch((error)=>{
            const errorMessage =
                (error && error.response && error.response.data && error.response.data.message) ||
                'Unable to load question details.';
            this.setState({
                loading: false,
                details: null,
                errorMessage
            });
        });
    }

    componentDidMount(){
        this.fetchDetails();
    }

    componentDidUpdate(prevProps){
        if(prevProps.id !== this.props.id){
            this.fetchDetails();
        }
    }

    render() {
        if(this.state.loading){
            return (
                <div className="question-details-dashboard">
                    <Skeleton loading active avatar />
                </div>
            );
        }

        if(this.state.errorMessage){
            return (
                <div className="question-details-dashboard">
                    <Alert
                        type="error"
                        showIcon
                        message="Question details unavailable"
                        description={this.state.errorMessage}
                    />
                </div>
            );
        }

        if(!this.state.details){
            return (
                <div className="question-details-dashboard">
                    <Alert
                        type="warning"
                        showIcon
                        message="No details found"
                        description="This question could not be found."
                    />
                </div>
            );
        }

        return (
            <div className="question-details-dashboard">
                <Tabs defaultActiveKey="1">
                    <TabPane tab={ <span><Icon type="home" />Basic Info</span> } key="1">
                        <Tab1 id={this.props.id} details={this.state.details}/>
                    </TabPane>
                    <TabPane tab={ <span><Icon type="question-circle" />Question</span> } key="2">
                        <Tab2 details={this.state.details} />
                    </TabPane>
                </Tabs>
            </div>
        )
    }
}







function Tab1(props) {
    if(!props.details){
        return null;
    }
    const details = props.details;
    const infoItems = [
        { label: 'Question Id', value: props.id || '-' },
        { label: 'Subject', value: (details.subject && details.subject.topic) || '-' },
        { label: 'Correct Answers', value: details.anscount || 0 },
        { label: 'Weightage', value: details.weightage || 0 },
        { label: 'Created On', value: details.createdAt ? moment(details.createdAt).format('DD MMM YYYY, hh:mm A') : '-' }
    ];

    return (
        <div className="question-details-panel">
            <div className="question-details-panel-head">
                <h4>Question Metadata</h4>
                <p>Core identifiers and scoring context for this item.</p>
            </div>
            <div className="question-details-info-grid">
                {infoItems.map((item) => (
                    <div className="question-details-info-card" key={item.label}>
                        <span className="question-details-info-label">{item.label}</span>
                        <span className="question-details-info-value">{item.value}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}


function Tab2(props){
    const optn =['A','B','C','D','E']
    const Optiondata = props.details;
    if(!Optiondata){
        return null;
    }
    return(
        <div className="question-details-panel">
            <div className="question-details-panel-head">
                <h4>Question Content</h4>
                <p>Prompt, attachments, and evaluated answer options.</p>
            </div>
            <div className="question-details-body">
                {Optiondata.body || '-'}
            </div>
            {Optiondata.quesimg?
                <div className="question-details-image-container">
                    <img alt="unable to load" className="question-details-image" src={Optiondata.quesimg} />
                </div>
                : null
            }
            <div className="question-options-list">
                {(Optiondata.options || []).map((d,i)=>{
                    const isAnswer = Boolean(d && d.isAnswer);
                    return(
                        <div key={i} className={`question-option-row${isAnswer ? ' is-answer' : ''}`}>
                            <div className="question-option-leading">
                                <span className="question-option-index">{optn[i] || i + 1}</span>
                            </div>
                            <div className="question-option-content">
                                <p className="question-option-text">{(d && d.optbody) || '-'}</p>
                                {d.optimg?
                                    <div className="question-option-image-wrap">
                                        <img alt="unable to load" className="question-option-image" src={d.optimg} />
                                    </div>
                                : null}
                            </div>
                            {isAnswer ? (
                                <div className="question-option-trailing">
                                    <span className="question-option-badge">Correct</span>
                                </div>
                            ) : null}
                        </div>
                    )
                })}
            </div>
        </div>
        )
}


