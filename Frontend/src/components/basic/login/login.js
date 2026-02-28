import React from "react";
import { Form, Input, Icon, Button } from "antd-compat";
import "./login.css";
import { connect } from "react-redux";
import { login, logout } from "../../../actions/loginAction";
import auth from "../../../services/AuthServices";
import apis from "../../../services/Apis";
import { Post } from "../../../services/axiosCall";
import Alert from "../../common/alert";
import { Navigate } from "react-router-dom";
import brandMark from "../../../assets/examshield-mark.svg";

const safeJsonParse = (value) => {
  if (typeof value !== "string") {
    return null;
  }
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
};

const normalizeLoginPayload = (rawData) => {
  const parsedData = typeof rawData === "string" ? safeJsonParse(rawData) : rawData;
  const payload = parsedData && typeof parsedData === "object" ? parsedData : {};
  if (payload.data && typeof payload.data === "object") {
    return payload.data;
  }
  return payload;
};

class Login extends React.Component {
  constructor(props) {
    super(props);
    this.state = { isLoggedIn: false, isSubmitting: false };
  }

  handleSubmit = (e) => {
    if (e && e.preventDefault) {
      e.preventDefault();
    }
    if (this.state.isSubmitting) {
      return;
    }
    this.props.form.validateFields((err, values) => {
      if (!err) {
        this.setState({ isSubmitting: true });
        Post({
          url: apis.LOGIN,
          data: {
            emailid: values.email,
            password: values.password
          }
        })
          .then(({ data }) => {
            const payload = normalizeLoginPayload(data);
            const token =
              payload &&
              (payload.token || payload.accessToken || payload.authToken || payload.jwt);

            if (payload && payload.success && payload.user && token) {
              this.props.login(payload.user);
              auth.storeToken(token);
              this.setState({ isLoggedIn: true, isSubmitting: false });
            } else if (payload && payload.success && payload.user && !token) {
              Alert(
                "error",
                "Error!",
                "Login succeeded but auth token is missing from server response."
              );
              this.setState({ isSubmitting: false });
            } else {
              const message =
                (payload && payload.message) ||
                "Unable to sign in due to an unexpected server response.";
              Alert("error", "Error!", message);
              this.setState({ isSubmitting: false });
            }
          })
          .catch((error) => {
            const statusCode =
              error &&
              error.response &&
              error.response.status;
            const serverMessage =
              error &&
              error.response &&
              error.response.data &&
              error.response.data.message;
            this.setState({ isSubmitting: false });
            const errorMessage =
              serverMessage ||
              (error && error.message) ||
              (statusCode
                ? `Login request failed with status ${statusCode}.`
                : "Login request failed. Check backend/API connectivity.");
            Alert("error", "Error!", errorMessage);
          });
      }
    });
  };

  render() {
    const { getFieldDecorator } = this.props.form;
    const nextRoute =
      this.props.user &&
      this.props.user.userOptions &&
      this.props.user.userOptions.length > 0
        ? this.props.user.userOptions[0].link
        : "/user/home";

    if (this.state.isLoggedIn) {
      return <Navigate to={nextRoute} replace />;
    }
    return (
      <div className="login-wrapper">
        <div className="login-container">
          <div className="login-inner">
            <div className="login-brand-row">
              <img src={brandMark} alt="Exam Shield" className="login-logo" />
              <div>
                <h1 className="site-title">Exam Shield</h1>
                <p className="site-subtitle">Secure Assessment Portal</p>
              </div>
            </div>
            <Form layout="vertical" hideRequiredMark onSubmitCapture={this.handleSubmit}>
              <Form.Item className="login-field-item">
                <div className="login-field-label">Email</div>
                {getFieldDecorator("email", {
                  rules: [
                    { type: "email", message: "The input is not valid E-mail!" },
                    { required: true, message: "Please input your E-mail!" },
                  ],
                })(
                  <Input
                    prefix={<Icon type="user" style={{ color: "#3b82f6" }} />}
                    placeholder="Email"
                  />
                )}
              </Form.Item>

              <Form.Item className="login-field-item">
                <div className="login-field-label">Password</div>
                {getFieldDecorator("password", {
                  rules: [
                    { required: true, message: "Please input your Password!" }
                  ],
                })(
                  <Input
                    prefix={<Icon type="lock" style={{ color: "#3b82f6" }} />}
                    type="password"
                    placeholder="Password"
                    onPressEnter={this.handleSubmit}
                  />
                )}
              </Form.Item>

              <Form.Item>
                <Button
                  type="primary"
                  htmlType="button"
                  block
                  loading={this.state.isSubmitting}
                  onClick={this.handleSubmit}
                >
                  {this.state.isSubmitting ? "Signing In..." : "Sign In"}
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
