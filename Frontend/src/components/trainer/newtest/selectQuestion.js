import React from 'react'
import { connect } from 'react-redux';
import { Tabs,Button, Tag } from 'antd-compat';
import { changeStep } from '../../../actions/testAction';
import GeneraterandomQuestion from'./generaterandomquestion';
import './newtest.css';
import { Layers3, Wand2 } from 'lucide-react';
const { TabPane } = Tabs;



function SelectQuestion(props){
    const totalSelected = props.test.newtestFormData.testQuestions.length;
    const questionCount = <Tag className="admin-modern-chip">{totalSelected} Selected</Tag>;
    return (
        <section className='newtest-stage-card selectQuestion'>
            <div className="newtest-stage-head">
                <h4>Select Questions</h4>
                <p>Generate a random set or manually curate from the available pool.</p>
            </div>
            <Tabs
                className="newtest-mode-tabs"
                defaultActiveKey="1"
                tabBarExtraContent={questionCount}
            >
                <TabPane tab={<span className="newtest-mode-tab"><Wand2 size={14} strokeWidth={2.2} /> Random</span>} key="1">
                    <GeneraterandomQuestion mode="random"/>
                </TabPane>
                <TabPane tab={<span className="newtest-mode-tab"><Layers3 size={14} strokeWidth={2.2} /> Manual</span>} key="2">
                    <GeneraterandomQuestion mode="manual" />
                </TabPane>
            </Tabs>
            <div className="newtest-stage-actions">
                <Button type="primary" className="admin-submit-btn newtest-primary-btn" onClick={()=>props.changeStep(2)}>
                    Continue to Finalize
                </Button>
            </div>
        </section>
    )  
}


const mapStateToProps = state => ({
    test : state.test
});

export default connect(mapStateToProps,{
    changeStep
})(SelectQuestion);
