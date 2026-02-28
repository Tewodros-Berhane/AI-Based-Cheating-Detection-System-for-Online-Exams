import React from 'react';
import { connect } from 'react-redux';
import { Tag } from 'antd-compat';
import {steps} from '../../../services/steps';
import { changeStep } from '../../../actions/testAction';
import './newtest.css'
import BasicTestForm from './basicForm';
import SelectQuestion from './selectQuestion';
import FinalQuestionView from './questionview';
import { 
    ChangeSubjectTableData
  } from '../../../actions/adminAction';
import { CheckCircle2, ClipboardList, FileCheck2 } from 'lucide-react';

const stepIcons = [ClipboardList, FileCheck2, CheckCircle2];

class  NewTest extends React.Component {
    componentDidMount(){
        this.props.ChangeSubjectTableData();
    }

    canNavigateToStep = (index)=>{
        return index <= this.props.test.currentStep;
    }

    renderStepTab = (item, index)=>{
        const currentStep = this.props.test.currentStep;
        const isActive = currentStep === index;
        const isCompleted = index < currentStep;
        const IconComponent = stepIcons[index] || ClipboardList;
        return (
            <button
                key={item.title}
                type="button"
                className={`newtest-step-tab${isActive ? ' is-active' : ''}${isCompleted ? ' is-completed' : ''}`}
                onClick={() => this.canNavigateToStep(index) && this.props.changeStep(index)}
                disabled={!this.canNavigateToStep(index)}
            >
                <span className="newtest-step-index">
                    <IconComponent size={14} strokeWidth={2.2} />
                </span>
                <span className="newtest-step-label">{item.title}</span>
            </button>
        );
    }

    render(){
        var torender="";
        if(this.props.test.currentStep===1){
            torender=<SelectQuestion />;
        }
        else if(this.props.test.currentStep===2){
            torender=<FinalQuestionView />;
        }
        else{
            torender=<BasicTestForm />;
        }
        const questionCount = (this.props.test.newtestFormData.testQuestions || []).length;
        const selectedSubject = this.props.test.newtestFormData.testSubject;
        const hasSubject = Array.isArray(selectedSubject) ? selectedSubject.length > 0 : Boolean(selectedSubject);
        const subjectLabel = hasSubject ? 'Course selected' : 'No course yet';
        return (
            <div className="newtest-dashboard">
                <div className="newtest-hero">
                    <div className="newtest-hero-copy">
                        <h3>Create Exam</h3>
                        <p>Configure exam details, choose your question set, and publish in a single guided flow.</p>
                    </div>
                    <div className="newtest-hero-meta">
                        <Tag className="admin-modern-chip">{questionCount} Questions</Tag>
                        <Tag className="admin-modern-chip">{subjectLabel}</Tag>
                    </div>
                </div>

                <div className="newtest-steps-holder compact">
                    {steps.map((item, index) => this.renderStepTab(item, index))}
                </div>

                <div className="new-test-form-holder">
                    {torender}
                </div>
            </div>
        )
    }  
}





const mapStateToProps = state => ({
    test : state.test
});

export default connect(mapStateToProps,{
    changeStep,
    ChangeSubjectTableData
})(NewTest);
