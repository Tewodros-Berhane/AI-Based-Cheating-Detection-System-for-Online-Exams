import React, { Component } from 'react';
import { Button, Skeleton,Modal,Form,InputNumber,Transfer } from 'antd-compat';
import { connect } from 'react-redux';
import { changeMode,changeBasicNewTestDetails,fetchSubjectWiseQuestion,pushQuestionToQueue } from '../../../actions/testAction';
import './newtest.css';
import Alert from '../../common/alert';
import apis from '../../../services/Apis';
import { Post } from '../../../services/axiosCall';
import { CircleHelp, Sparkles } from 'lucide-react';

class GeneraterandomQuestionO extends Component {
    constructor(props){
        super(props);
        this.state={
            generating:false,
            autogenerate:true,
            ActiveQuestionId:null,
            Mvisible:false
        }
        this.props.changeMode(this.props.mode);
    }

    componentDidMount(){
        this.props.fetchSubjectWiseQuestion(this.props.test.newtestFormData.testSubject);
    }

    handleSubmit = e => {
        e.preventDefault();
        this.props.form.validateFields((err, values) => {
            if (!err) {
                console.log(values);
                // ...existing code...
                if(values.no<=this.props.test.questionsAvailablebasedonSubject.length){
                    let qus = [];
                    let allquestions = [...this.props.test.questionsAvailablebasedonSubject];
                    for(let i = 0; i < values.no; i++){
                        let r = Math.floor(Math.random() * allquestions.length);
                        qus.push(allquestions[r]._id);
                        allquestions.splice(r, 1);
                    }
                    this.props.pushQuestionToQueue(qus);
                    this.setState({
                        autogenerate : false
                    })
                }
                // ...existing code...
                else{
                    Alert('error','Error!',"You don't have enough questions to select." );
                } 
            }
        });
    };

    renderItem = item => {
        const customLabel = (
          <span className="newtest-transfer-item">
                <Button className="newtest-info-btn" shape="circle" size="small" onClick={()=>{this.OpenModel(item._id)}}>
                    <CircleHelp size={13} strokeWidth={2.2} />
                </Button>
                <span className="newtest-transfer-item-text">{item.body}</span>
          </span>
        )
        return {
            label: customLabel, 
            value: item._id, 
        }
    }

    OpenModel=(qid)=>{
        this.setState({
            ActiveQuestionId:qid,
            Mvisible:true
        })
    }
    handleCancel=()=>{
        this.setState({
            Mvisible:false
        })
    }

    handleChange = (targetKeys, direction, moveKeys) => {
        this.props.pushQuestionToQueue(targetKeys);
    };


    render() {
        const { getFieldDecorator } = this.props.form;
        return (
            <div className={`newtest-question-picker ${this.props.mode === "manual" ? "is-manual" : "is-random"}`}>
                <div className={`random-question-generation newtest-random-panel ${this.props.mode ==="random"? "notblind" : "blind"}`}>
                    <div className="newtest-random-head">
                        <h5>Auto Generate</h5>
                        <p>Pick a random subset from your available question pool.</p>
                    </div>
                    <Form className="newtest-form-grid newtest-random-form" layout="vertical" hideRequiredMark onSubmit={this.handleSubmit} >
                        <Form.Item>
                                    <div className="admin-field-label">Number of Questions</div>
                                    {getFieldDecorator('no', {
                                        rules: [{ required: true, message: 'Please enter no. of question' }],
                                    })(
                                        <InputNumber style={{width:'100%'}}  placeholder="No of question"/>
                                    )}
                                </Form.Item> 
                        <Form.Item>
                            <Button type="primary" htmlType="submit" className="admin-submit-btn newtest-primary-btn" block disabled={!this.state.autogenerate}>
                                <Sparkles size={14} strokeWidth={2.3} /> Generate Questions
                            </Button>
                        </Form.Item>
                    </Form>
                </div>

                <div className="newtest-transfer-shell">
                    <Transfer
                        disabled={this.props.mode ==="random"? true : false}
                        rowKey={record => record._id}
                        dataSource={this.props.test.questionsAvailablebasedonSubject}
                        listStyle={{
                            width: '48%',
                            height: 470
                        }}
                        targetKeys={this.props.test.newtestFormData.testQuestions}
                        render={this.renderItem}
                        onChange={this.handleChange}
                    />
                </div>

                <Modal
                    destroyOnClose={true}
                    width="70%"
                    style={{top:'30px'}}
                    wrapClassName="newtest-question-preview-modal"
                    title="Question details"
                    visible={this.state.Mvisible}
                    onOk={this.handleCancel}
                    onCancel={this.handleCancel}
                    footer={null}
                    >
                    <SingleQuestionDetails qid={this.state.ActiveQuestionId}/>
                </Modal>  
            </div>
        )
    }
}

const GeneraterandomQuestion = Form.create({ name: 'Basic Form' })(GeneraterandomQuestionO);

const mapStateToProps = state => ({
    test : state.test
});

export default connect(mapStateToProps,{
    changeBasicNewTestDetails,
    fetchSubjectWiseQuestion,
    pushQuestionToQueue,
    changeMode
})(GeneraterandomQuestion);



class SingleQuestionDetails extends React.Component{
    constructor(props){
        super(props);
        this.state={
            fetching:false,
            qdetails:null
        }
    }

    componentDidMount(){
        this.setState({
            fetching:true
        })
        Post({
            url:apis.FETCH_SINGLE_QUESTION_BY_TRAINEE,
            data:{
                qid:this.props.qid
            }
        }).then((response)=>{
            console.log(response)
            if(response.data.success){
                this.setState({
                    qdetails:response.data.data[0]
                })
            }
            else{
                Alert('error','Error !',response.data.message);
            }
            this.setState({
                fetching:false
            })
        }).catch((error)=>{
            this.setState({
                fetching:false
            })
            console.log(error)
            Alert('error','Error !',"Server Error");
        })
    }
    
    render(){
        const optn =['A','B','C','D','E'];
        let Optiondata=this.state.qdetails;
        if(Optiondata!==null){
            return (
                <div className="newtest-preview-details">
                    <div className="newtest-preview-question">{Optiondata.body}</div>
                    {Optiondata.quesimg?
                        <div className="newtest-preview-image-wrap">
                            <img alt="Question" className="newtest-preview-image" src={Optiondata.quesimg} />  
                        </div>
                        : null
                    }
                    <div className="newtest-preview-options">
                        {(Optiondata.options || []).map((d,i)=>{
                            return(
                                <div key={i} className={`newtest-preview-option${d.isAnswer ? ' is-answer' : ''}`}>
                                    <span className="newtest-preview-option-index">{optn[i] || i + 1}</span>
                                    <div className="newtest-preview-option-content">
                                        <p>{d.optbody || '-'}</p>
                                        {d.optimg?
                                            <img alt="options" className="newtest-preview-option-image" src={d.optimg} />
                                        : null}
                                    </div>
                                    {d.isAnswer ? <span className="newtest-preview-option-badge">Correct</span> : null}
                                </div>
                            )
                        })}
                    </div>
                </div>
            )
        }
        else{
            return(
                <div className="skeletor-wrapper">
                    <Skeleton active />
                    <Skeleton active />
                </div>
            )
        }
        
    }
}
