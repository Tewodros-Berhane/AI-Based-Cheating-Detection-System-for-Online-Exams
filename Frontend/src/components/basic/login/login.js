import React from "react";
import { Form, Input, Icon, Button } from "antd";
import "./login.css";
import { connect } from "react-redux";
import { login, logout } from "../../../actions/loginAction";
import auth from "../../../services/AuthServices";
import Alert from "../../common/alert";
import { Redirect } from "react-router-dom";

class Login extends React.Component {
  constructor(props) {
    super(props);
    this.state = { isLoggedIn: false };
  }

  handleSubmit = (e) => {
    e.preventDefault();
    this.props.form.validateFields((err, values) => {
      if (!err) {
        auth
          .LoginAuth(values.email, values.password)
          .then((response) => {
            if (response.data.success) {
              this.props.login(response.data.user);
              auth.storeToken(response.data.token);
              this.setState({ isLoggedIn: true });
            } else {
              Alert("error", "Error!", response.data.message);
            }
          })
          .catch(() => {
            Alert("error", "Error!", "Server Error");
          });
      }
    });
  };

  render() {
    const { getFieldDecorator } = this.props.form;
    if (this.state.isLoggedIn) {
      return <Redirect to={this.props.user.userOptions[0].link} />;
    }
    return (
      <div className="login-wrapper">
        <img
          src={require("./main.jpg")}
          alt="logo"
          className="login-logo"
        />
        <p className="site-title"><b>Exam Shield</b></p>
        <div className="login-container">
          <div className="login-inner">
            <Form onSubmit={this.handleSubmit}>
              <Form.Item label="Email" hasFeedback>
                {getFieldDecorator("email", {
                  rules: [
                    { type: "email", message: "The input is not valid E-mail!" },
                    // { required: true, message: "Please input your E-mail!" },
                  ],
                })(
                  <Input
                    prefix={<Icon type="user" style={{ color: "#238636" }} />}
                    placeholder="Email"
                  />
                )}
              </Form.Item>

              <Form.Item label="Password" hasFeedback>
                {getFieldDecorator("password", {
                  rules: [
                    // { required: true, message: "Please input your Password!" }
                  ],
                })(
                  <Input
                    prefix={<Icon type="lock" style={{ color: "#238636" }} />}
                    type="password"
                    placeholder="Password"
                  />
                )}
              </Form.Item>

              <Form.Item>
                <Button type="primary" htmlType="submit" block>
                  Login
                </Button>
              </Form.Item>
            </Form>
          </div>
        </div>
      </div>
    );
  }
}

const LoginForm = Form.create({ name: "login" })(Login);

const mapStateToProps = (state) => ({ user: state.user });

export default connect(mapStateToProps, { login, logout })(LoginForm);
