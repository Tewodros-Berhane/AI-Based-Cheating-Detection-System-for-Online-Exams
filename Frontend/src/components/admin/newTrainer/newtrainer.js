import React, { Component } from 'react'
import './newtrainer.css';
import {
    Form,
    Input,
    Button,
    Select
} from 'antd';
import {SecurePost} from '../../../services/axiosCall';
import apis from '../../../services/Apis';
import { connect } from 'react-redux';
import { 
    ChangeTrainerConfirmDirty,
    ChangeTrainerModalState,
    ChangeTrainerTableData
} from '../../../actions/adminAction';
import Alert from '../../../components/common/alert';
import 'react-phone-input-2/lib/style.css';
import PhoneInput from 'react-phone-input-2';
const { Option } = Select;
class NewTrainer extends Component {

    compareToFirstPassword = (rule, value, callback) => {
        const form = this.props.form;
        if (value && value !== form.getFieldValue('password')) {
            callback('passwords are not same !');
        } else {
            callback();
        }
    };

    validateToNextPassword = (rule, value, callback) => {
        const form = this.props.form;
        if (value && this.props.admin.TrainerconfirmDirty) {
            form.validateFields(['confirm'], { force: true });
        }
        callback();
    };
    


    handleSubmit = e => {
        e.preventDefault();
        this.props.form.validateFieldsAndScroll((err, values) => {
            if (!err) {
                // console.log('Received values of form: ', values);
                
                    SecurePost({
                        url : `${apis.CREATE_TRAINER}`,
                        data : {
                            _id : this.props.admin.trainerId,
                            name :values.name,
                            password : values.password,
                            emailid : values.emailid,
                            contact : values.contact
                        }
                    }).then((response)=>{
                        if(response.data.success){
                            this.props.ChangeTrainerModalState(false,null,'Register');
                            Alert('success','Success',response.data.message);
                            this.props.ChangeTrainerTableData();
                        }
                        else{
                            // console.log(response.data);
                            this.props.ChangeTrainerModalState(false,null,'Register');
                            return Alert('warning','Warning!',response.data.message);
                        }
                    }).catch((error)=>{
                        this.props.ChangeTrainerModalState(false,null,'Register');
                        return Alert('error','Error!','Server Error');
                    })
                
            }
        });
    };

    render() {
        const { getFieldDecorator } = this.props.form;
        
        return (
            <div className="register-trainer-form">
                <div className="register-trainer-form-body">
                    <Form  onSubmit={this.handleSubmit}>
                        <Form.Item label="Name" hasFeedback className="input-admin-trainer">
                            {getFieldDecorator('name', {
                                initialValue : this.props.admin.trainerdetails.name,
                                rules: [{ required: true, message: 'Please input your name!', whitespace: true }],
                            })(<Input placeholder='Name' />)}
                        </Form.Item>
                    
                        { !this.props.admin.trainerId ? <Form.Item label="E-mail" hasFeedback className="input-admin-trainer">
                            {getFieldDecorator('emailid', {
                                initialValue : this.props.admin.trainerdetails.emailid,
                                rules: [
                                    {
                                        type: 'email',
                                        message: 'The input is not valid E-mail!',
                                    },
                                    {
                                        required: true,
                                        message: 'Please input your E-mail!',
                                    },
                                ],
                            })(<Input placeholder='E-mail' />)}
                        </Form.Item> : null }

                        <Form.Item label="Phone Number" className="input-admin-trainer" hasFeedback>
                            {getFieldDecorator('contact', {
                                initialValue: this.props.admin.trainerdetails.contact || '',
                                rules: [
                                    {
                                        required: true,
                                        message: 'Please input your phone number!',
                                    }
                                ],
                            })(
                                <PhoneInput
                                    country={'et'}
                                    enableSearch
                                    inputStyle={{ width: '100%' }}
                                    specialLabel={null}
                                    placeholder='Phone Number'
                                />
                            )}
                        </Form.Item>

                        { !this.props.admin.trainerId ? <div><Form.Item label="Password" hasFeedback className="input-admin-trainer">
                                {getFieldDecorator('password', {
                                    initialValue : this.props.admin.trainerdetails.password,
                                    rules: [
                                        {
                                            required: true,
                                            message: 'Please input your password!',
                                        },
                                        {
                                            validator: this.validateToNextPassword,
                                        },
                                    ],
                                })(<Input.Password placeholder='Password' />)}
                            </Form.Item>
                        
                            <Form.Item label="Confirm Password" hasFeedback className="input-admin-trainer">
                                {getFieldDecorator('confirm', {
                                    initialValue : this.props.admin.trainerdetails.confirmpassword,
                                    rules: [
                                    {
                                        required: true,
                                        message: 'Please confirm your password!',
                                    },
                                    {
                                        validator: this.compareToFirstPassword,
                                    },
                                    ],
                                })(<Input.Password onBlur={this.handleConfirmBlur} placeholder='Confirm Password' />)}
                            </Form.Item></div> : null}
                        <Form.Item>
                            <Button type="primary" htmlType="submit" block>
                                {this.props.admin.Trainermode}
                            </Button>
                        </Form.Item>
                    </Form>
                </div>
            </div>
        )
    }
}

const mapStateToProps = state => ({
    admin : state.admin
});



const NewTrainerForm = Form.create({ name: 'register' })(NewTrainer);

export default connect(mapStateToProps,{
    ChangeTrainerConfirmDirty,
    ChangeTrainerModalState,
    ChangeTrainerTableData
})(NewTrainerForm);

