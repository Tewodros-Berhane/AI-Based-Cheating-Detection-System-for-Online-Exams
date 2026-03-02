import React from 'react';
import { Button, Switch, message } from 'antd-compat';
import {
  changeTestRegisterLink,
  updateCurrentTestBasicDetails,
  changeTestRegisterStatus,
  changeTestStatus
} from '../../../actions/conductTest';
import { connect } from 'react-redux';
import { SecurePost } from '../../../services/axiosCall';
import apis from '../../../services/Apis';
import Alert from '../../common/alert';
import { Copy, PlayCircle, Power, UserRoundCheck } from 'lucide-react';

class TestDetails extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      testMetaLoading: false,
      testMeta: null,
      faceRecognitionSaving: false
    };
  }

  componentDidMount() {
    this.refreshBaseDetails();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.conduct.id !== this.props.conduct.id) {
      this.refreshBaseDetails();
    }
  }

  refreshBaseDetails = () => {
    if (!this.props.conduct.id) {
      return;
    }
    const base = `${window.location.protocol}//${window.location.host}/`;
    const registerLink = `${base}trainee/register?testid=${this.props.conduct.id}`;
    this.props.changeTestRegisterLink(registerLink);
    this.props.updateCurrentTestBasicDetails(this.props.conduct.id);

    this.setState({ testMetaLoading: true });
    SecurePost({
      url: apis.GET_SINGLE_TEST,
      data: {
        id: this.props.conduct.id
      }
    })
      .then((response) => {
        if (response.data.success) {
          this.setState({ testMeta: response.data.data || null });
        }
      })
      .finally(() => {
        this.setState({ testMetaLoading: false });
      });
  };

  copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      message.success('Link Copied to clipboard');
    } catch (error) {
      message.error('Unable to copy link');
    }
  };

  changeRegistrationStatus = (nextState) => {
    SecurePost({
      url: `${apis.STOP_REGISTRATION}`,
      data: {
        id: this.props.conduct.id,
        status: nextState
      }
    })
      .then((response) => {
        if (response.data.success) {
          this.props.changeTestRegisterStatus(nextState);
          Alert('success', 'Success!', 'Registration status changed');
        } else {
          Alert('error', 'Error!', response.data.message);
        }
      })
      .catch(() => {
        Alert('error', 'Error!', 'Server Error');
      });
  };

  startExam = () => {
    SecurePost({
      url: `${apis.START_TEST_BY_TRAINER}`,
      data: {
        id: this.props.conduct.id
      }
    })
      .then((response) => {
        if (response.data.success) {
          this.props.changeTestStatus(response.data.data);
          Alert('success', 'Success!', 'Exam has started');
        } else {
          Alert('error', 'Error!', response.data.message);
        }
      })
      .catch(() => {
        Alert('error', 'Error!', 'Server Error');
      });
  };

  endExam = () => {
    SecurePost({
      url: `${apis.END_TEST_BY_TRAINER}`,
      data: {
        id: this.props.conduct.id
      }
    })
      .then((response) => {
        if (response.data.success) {
          this.props.changeTestStatus(response.data.data);
          Alert('success', 'Success!', 'Exam has ended');
        } else {
          Alert('error', 'Error!', response.data.message);
        }
      })
      .catch(() => {
        Alert('error', 'Error!', 'Server Error');
      });
  };

  toggleFaceRecognition = (enabled) => {
    const examLive = Boolean(this.props.conduct.basictestdetails && this.props.conduct.basictestdetails.testbegins);
    if (examLive) {
      return;
    }

    this.setState({ faceRecognitionSaving: true });
    SecurePost({
      url: apis.TOGGLE_FACE_RECOGNITION,
      data: {
        id: this.props.conduct.id,
        enabled: Boolean(enabled)
      }
    })
      .then((response) => {
        if (response.data.success) {
          const nextDetails = {
            ...(this.props.conduct.basictestdetails || {}),
            ...(response.data.data || {}),
            faceRecognitionEnabled: Boolean(enabled)
          };
          this.props.changeTestStatus(nextDetails);
          this.setState((prev) => ({
            testMeta: prev.testMeta
              ? { ...prev.testMeta, faceRecognitionEnabled: Boolean(enabled) }
              : prev.testMeta
          }));
          Alert(
            'success',
            'Success!',
            `Face recognition ${enabled ? 'enabled' : 'disabled'} for this exam.`
          );
        } else {
          Alert('error', 'Error!', response.data.message);
        }
      })
      .catch(() => {
        Alert('error', 'Error!', 'Server Error');
      })
      .finally(() => {
        this.setState({ faceRecognitionSaving: false });
      });
  };

  render() {
    const basic = this.props.conduct.basictestdetails || {};
    const registrationOpen = Boolean(basic.isRegistrationavailable);
    const examLive = Boolean(basic.testbegins);
    const registerLink = this.props.conduct.testRegisterLink || '';
    const testMeta = this.state.testMeta || {};
    const courseTitle = (testMeta.subjects || [])
      .map((item) => item && item.topic)
      .filter(Boolean)
      .join(', ') || '-';
    const examTitle = testMeta.title || '-';
    const examDuration = testMeta.duration ? `${testMeta.duration} min` : '-';
    const organization = testMeta.organisation || '-';
    const faceRecognitionEnabled =
      typeof basic.faceRecognitionEnabled === 'boolean'
        ? basic.faceRecognitionEnabled
        : Boolean(testMeta.faceRecognitionEnabled);

    return (
      <section className="conduct-details-wrap">
        <div className="conduct-details-head">
          <h4>Exam Control Snapshot</h4>
          <p>Review exam metadata, registration posture, and session runtime controls.</p>
        </div>

        <div className="conduct-details-grid">
          <article className="conduct-details-card">
            <span className="conduct-details-label">Exam Title</span>
            <span className="conduct-details-value">{examTitle}</span>
          </article>

          <article className="conduct-details-card">
            <span className="conduct-details-label">Course</span>
            <span className="conduct-details-value">{courseTitle}</span>
          </article>

          <article className="conduct-details-card">
            <span className="conduct-details-label">Duration</span>
            <span className="conduct-details-value">{examDuration}</span>
          </article>

          <article className="conduct-details-card">
            <span className="conduct-details-label">Organization</span>
            <span className="conduct-details-value">{organization}</span>
          </article>

          <article className="conduct-details-card">
            <span className="conduct-details-label">Exam ID</span>
            <span className="conduct-details-value conduct-details-value-id">{this.props.conduct.id || '-'}</span>
          </article>

          <article className="conduct-details-card conduct-details-card-wide">
            <span className="conduct-details-label">Registration Link</span>
            <div className="conduct-link-row">
              <input readOnly value={registerLink} />
              <button
                type="button"
                className="conduct-link-copy"
                onClick={() => this.copyToClipboard(registerLink)}
                aria-label="Copy registration link"
              >
                <Copy size={14} strokeWidth={2.3} />
              </button>
            </div>
          </article>

          <article className="conduct-details-card">
            <span className="conduct-details-label">Registration</span>
            <span className={`conduct-status-badge ${registrationOpen ? 'open' : 'closed'}`}>
              {registrationOpen ? 'Open' : 'Closed'}
            </span>
          </article>

          <article className="conduct-details-card">
            <span className="conduct-details-label">Session</span>
            <span className={`conduct-status-badge ${examLive ? 'live' : 'idle'}`}>
              {examLive ? 'In Progress' : 'Not Started'}
            </span>
          </article>

          <article className="conduct-details-card">
            <span className="conduct-details-label">Face Detection</span>
            <div className="conduct-face-toggle-row">
              <span className={`conduct-status-badge ${faceRecognitionEnabled ? 'open' : 'idle'}`}>
                {faceRecognitionEnabled ? 'Enabled' : 'Disabled'}
              </span>
              <Switch
                checked={faceRecognitionEnabled}
                checkedChildren="On"
                unCheckedChildren="Off"
                disabled={examLive || this.state.faceRecognitionSaving}
                loading={this.state.faceRecognitionSaving}
                onChange={this.toggleFaceRecognition}
              />
            </div>
            <span className="conduct-details-hint">
              Enable face recognition detection before exam start. This setting locks once the session starts.
            </span>
          </article>

          <article className="conduct-details-card conduct-controls-card">
            <span className="conduct-details-label">Session Controls</span>
            <div className="conduct-controls-stack">
              <Button
                className={`conduct-action-btn ${registrationOpen ? 'registration-stop' : 'registration-open'}`}
                disabled={examLive}
                onClick={() => this.changeRegistrationStatus(!registrationOpen)}
              >
                <UserRoundCheck size={15} strokeWidth={2.2} />
                {registrationOpen ? 'Stop Registration' : 'Open Registration'}
              </Button>

              <Button className="conduct-action-btn conduct-start-btn" disabled={examLive} onClick={this.startExam}>
                <PlayCircle size={15} strokeWidth={2.2} />
                Start Exam
              </Button>

              <Button className="conduct-action-btn conduct-end-btn" disabled={!examLive} onClick={this.endExam}>
                <Power size={15} strokeWidth={2.2} />
                End Exam
              </Button>
            </div>
          </article>
        </div>

        {this.state.testMetaLoading ? (
          <div className="conduct-meta-loading">Refreshing exam metadata...</div>
        ) : null}
      </section>
    );
  }
}

const mapStateToProps = (state) => ({
  conduct: state.conduct
});

export default connect(mapStateToProps, {
  changeTestRegisterLink,
  updateCurrentTestBasicDetails,
  changeTestRegisterStatus,
  changeTestStatus
})(TestDetails);
