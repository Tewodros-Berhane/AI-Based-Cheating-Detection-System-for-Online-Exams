import React, { Component } from 'react'
import { connect } from 'react-redux';
import { Form, InputNumber , Input, Button,Select, Switch } from 'antd-compat';
import { changeStep,changeBasicNewTestDetails } from '../../../actions/testAction';
import { SecurePost } from '../../../services/axiosCall';
import './newtest.css';
import apis from '../../../services/Apis'


class BasicTestFormO extends Component {
    constructor(props){
        super(props);
        this.state={
            checkingName:""
        }
    }

    handleSubmit = e => {
        e.preventDefault();
        this.props.form.validateFields((err, values) => {
            if (!err) {
                console.log(values)
                this.props.changeBasicNewTestDetails({
                    testTitle: values.title,
                    testDuration : values.duration,
                    OrganisationName:values.organisation,
                    testSubject:values.subjects,
                    integrityMode: values.integrityMode,
                    preflightEnabled: Boolean(values.preflightEnabled)
                })
                this.props.changeStep(1);
            }
        });
    };

    validateTestName = (rule, value, callback) => {
        if(value.length>=5){
            this.setState({
                checkingName:"validating"
            })
            SecurePost({
                url:apis.CHECK_TEST_NAME,
                data:{
                    testname:value
                }
            }).then((data)=>{
                console.log(data);
                if(data.data.success){
                    if(data.data.can_use){
                        this.setState({
                            checkingName:"success"
                        })
                        callback();
                    }
                    else{
                        this.setState({
                            checkingName:"error"
                        })
                        callback('Another exam exist with same name.');
                    }
                }
                else{
                    this.setState({
                        checkingName:"success"
                    })
                    callback()
                }
            }).catch((ee)=>{
                console.log(ee);
                this.setState({
                    checkingName:"success"
                })
                callback()
            })
        }
        else{
            callback();
        }        
    };


    render() {
        const { getFieldDecorator } = this.props.form;
        return (
            <section className="newtest-stage-card basic-test-form-outer">
                <div className="newtest-stage-head">
                    <h4>Basic Info</h4>
                    <p>Set core details before moving to question selection.</p>
                </div>
                <div className="basic-test-form-inner">
                    <Form className="newtest-form-grid" layout="vertical" hideRequiredMark onSubmit={this.handleSubmit}> 
                        <Form.Item validateStatus={this.state.checkingName}>
                            <div className="admin-field-label">Exam Title</div>
                            {getFieldDecorator('title', {
                                initialValue : this.props.test.newtestFormData.testTitle,
                                rules: [
                                    { required: true, message: 'Please give the exam title' },
                                    { min:5, message: 'Title should be atleast 5 character long' },
                                    { validator: this.validateTestName }
                                ],
                                
                            })(
                                <Input placeholder="Exam Title" />
                            )}
                        </Form.Item>
                        <Form.Item>
                            <div className="admin-field-label">Course</div>
                            {getFieldDecorator('subjects', {
                                initialValue : this.props.test.newtestFormData.testSubject,
                                rules: [{ required: true, message: 'Please select a Exam type' }],
                            })(
                                <Select
                                mode="single"
                                placeholder="Select a Course"
                                style={{ width: '100%' }}
                                allowClear={true}
                                optionFilterProp="s"
                                >
                                    {this.props.admin.subjectTableData.map(item => (
                                        <Select.Option key={item._id} value={item._id} s={item.topic}>
                                        {item.topic}
                                        </Select.Option>
                                    ))}
                                </Select>
                            )}
                        </Form.Item>
                        <Form.Item>
                            <div className="admin-field-label">Exam Duration (Minutes)</div>
                            {getFieldDecorator('duration', {
                                initialValue : this.props.test.newtestFormData.testDuration,
                                rules: [{ required: true, message: 'Please give exam duration' }],
                            })(
                                <InputNumber style={{width:'100%'}}  placeholder="Exam Duration" min={1} max={180}/>
                            )}
                        </Form.Item> 
                        <Form.Item>
                            <div className="admin-field-label">Organization Name</div>
                            {getFieldDecorator('organisation', {
                                initialValue : this.props.test.newtestFormData.OrganisationName
                            })(
                                <Input placeholder="Organisation Name" />
                            )}
                        </Form.Item>
                        <Form.Item>
                            <div className="admin-field-label">Security Level</div>
                            {getFieldDecorator('integrityMode', {
                                initialValue : this.props.test.newtestFormData.integrityMode || 'STANDARD',
                                rules: [{ required: true, message: 'Please choose a security level' }],
                            })(
                                    <Select placeholder="Select security level">
                                    <Select.Option value="LIGHT">Basic - minimal checks</Select.Option>
                                    <Select.Option value="STANDARD">Balanced - camera and microphone checks</Select.Option>
                                    <Select.Option value="STRICT">High Security - fullscreen and screen sharing required</Select.Option>
                                </Select>
                            )}
                        </Form.Item>
                        <Form.Item>
                            <div className="admin-field-label">Entry Check</div>
                            {getFieldDecorator('preflightEnabled', {
                                valuePropName: 'checked',
                                initialValue: typeof this.props.test.newtestFormData.preflightEnabled === 'boolean'
                                    ? this.props.test.newtestFormData.preflightEnabled
                                    : true
                            })(
                                <Switch checkedChildren="Required" unCheckedChildren="Optional" />
                            )}
                            <div className="newtest-inline-hint">
                                When enabled, examinees must complete a quick device check before entering the exam.
                            </div>
                        </Form.Item>
                        <Form.Item className="newtest-form-actions">
                            <Button type="primary" htmlType="submit" className="admin-submit-btn newtest-primary-btn">
                                Continue to Question Selection
                            </Button>
                        </Form.Item>
                    </Form>
                </div>
            </section>
        )
    }
}
const BasicTestForm = Form.create({ name: 'Basic Form' })(BasicTestFormO);

const mapStateToProps = state => ({
    test : state.test,
    admin:state.admin
});

export default connect(mapStateToProps,{
    changeStep,
    changeBasicNewTestDetails
})(BasicTestForm);
