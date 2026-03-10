import React from 'react';
import { Button, Select, Switch, message } from 'antd-compat';
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
      faceRecognitionSaving: false,
      integritySaving: false,
      integrityModeDraft: 'STANDARD',
      preflightEnabledDraft: true
    };
  }

  componentDidMount() {
    this.refreshBaseDetails();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.conduct.id !== this.props.conduct.id) {
      this.refreshBaseDetails();
    }

    if (prevProps.conduct.basictestdetails !== this.props.conduct.basictestdetails) {
      const basic = this.props.conduct.basictestdetails || {};
      this.setState({
        integrityModeDraft: basic.integrityMode || 'STANDARD',
        preflightEnabledDraft: typeof basic.preflightEnabled === 'boolean'
          ? basic.preflightEnabled
          : true
      });
    }
  }

  refreshBaseDetails = () => {
    if (!this.props.conduct.id) {
      return;
    }
    const base = `${window.location.protocol}//${window.location.host}/`;
    const registerLink = `${base}examinee/register?testid=${this.props.conduct.id}`;
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
          this.notifyExamEndedCandidates();
          Alert('success', 'Success!', 'Exam has ended');
        } else {
          Alert('error', 'Error!', response.data.message);
        }
      })
      .catch(() => {
        Alert('error', 'Error!', 'Server Error');
      });
  };

  getCandidateListForNotification = async () => {
    const existingCandidates = this.props.conduct.registeredCandidates || [];
    if (existingCandidates.length > 0) {
      return existingCandidates;
    }

    const response = await SecurePost({
      url: apis.GET_TEST_CANDIDATES,
      data: { id: this.props.conduct.id }
    });

    if (!response.data || !response.data.success) {
      return [];
    }

    return response.data.data || [];
  };

  notifySingleCandidateExamEnded = (traineeId) =>
    new Promise((resolve) => {
      if (!traineeId || !this.props.conduct.id) {
        resolve();
        return;
      }

      const params = new URLSearchParams({
        role: 'trainer',
        traineeid: traineeId,
        testid: this.props.conduct.id,
        sessionid: `${this.props.conduct.id}:${traineeId}`
      });
      const ws = new WebSocket(`${apis.WS_RESULT_URL}/?${params.toString()}`);

      let settled = false;
      const finalize = () => {
        if (settled) return;
        settled = true;
        try {
          ws.close();
        } catch (error) {
          // Ignore relay close failures on best-effort notifications.
        }
        resolve();
      };

      const timeoutId = window.setTimeout(finalize, 1500);

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            type: 'exam-ended',
            reason: 'trainer_ended',
            testId: this.props.conduct.id
          })
        );
        window.clearTimeout(timeoutId);
        window.setTimeout(finalize, 120);
      };

      ws.onerror = () => {
        window.clearTimeout(timeoutId);
        finalize();
      };

      ws.onclose = () => {
        window.clearTimeout(timeoutId);
        finalize();
      };
    });

  notifyExamEndedCandidates = async () => {
    try {
      const candidates = await this.getCandidateListForNotification();
      if (!candidates.length) {
        return;
      }

      await Promise.all(
        candidates
          .map((candidate) => candidate && candidate._id)
          .filter(Boolean)
          .map((traineeId) => this.notifySingleCandidateExamEnded(traineeId))
      );
    } catch (error) {
      console.warn('Unable to notify candidates about exam end:', error);
    }
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

  changeIntegrityModeDraft = (value) => {
    this.setState({
      integrityModeDraft: value || 'STANDARD'
    });
  };

  changePreflightDraft = (checked) => {
    this.setState({
      preflightEnabledDraft: Boolean(checked)
    });
  };

  saveIntegrityConfig = () => {
    const examLive = Boolean(this.props.conduct.basictestdetails && this.props.conduct.basictestdetails.testbegins);
    if (examLive) {
      return;
    }

    this.setState({ integritySaving: true });
    SecurePost({
      url: apis.SET_TEST_INTEGRITY_CONFIG,
      data: {
        id: this.props.conduct.id,
        integrityMode: this.state.integrityModeDraft,
        preflightEnabled: Boolean(this.state.preflightEnabledDraft)
      }
    }).then((response) => {
      if (response.data.success) {
        const nextDetails = {
          ...(this.props.conduct.basictestdetails || {}),
          ...(response.data.data || {}),
          integrityMode: this.state.integrityModeDraft,
          preflightEnabled: Boolean(this.state.preflightEnabledDraft)
        };
        this.props.changeTestStatus(nextDetails);
        Alert('success', 'Success!', 'Exam entry settings saved.');
      } else {
        Alert('error', 'Error!', response.data.message);
      }
    }).catch(() => {
      Alert('error', 'Error!', 'Server Error');
    }).finally(() => {
      this.setState({ integritySaving: false });
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
    const integrityMode = this.state.integrityModeDraft || basic.integrityMode || 'STANDARD';
    const preflightEnabled = typeof this.state.preflightEnabledDraft === 'boolean'
      ? this.state.preflightEnabledDraft
      : (typeof basic.preflightEnabled === 'boolean' ? basic.preflightEnabled : true);

    return (
      <section className="conduct-details-wrap">
        <div className="conduct-details-head">
          <h4>Exam Control Snapshot</h4>
          <p>Review exam metadata, entry rules, and session runtime controls.</p>
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

          <article className="conduct-details-card conduct-integrity-card conduct-details-card-full">
            <span className="conduct-details-label">Exam Entry Settings</span>
            <div className="conduct-integrity-config">
              <div className="conduct-integrity-field">
                <span className="conduct-integrity-field-label">Security Level</span>
                <Select
                  value={integrityMode}
                  onChange={this.changeIntegrityModeDraft}
                  disabled={examLive || this.state.integritySaving}
                  className="conduct-integrity-select"
                >
                  <Select.Option value="LIGHT">Basic</Select.Option>
                  <Select.Option value="STANDARD">Balanced</Select.Option>
                  <Select.Option value="STRICT">High Security</Select.Option>
                </Select>
              </div>
              <div className="conduct-integrity-field">
                <span className="conduct-integrity-field-label">Entry Check</span>
                <Switch
                  checked={preflightEnabled}
                  checkedChildren="Required"
                  unCheckedChildren="Optional"
                  disabled={examLive || this.state.integritySaving}
                  onChange={this.changePreflightDraft}
                />
              </div>
            </div>
            <Button
              className="conduct-action-btn conduct-save-integrity-btn"
              onClick={this.saveIntegrityConfig}
              disabled={examLive}
              loading={this.state.integritySaving}
            >
              Save Entry Settings
            </Button>
            <span className="conduct-details-hint">
              Set candidate entry rules before the exam starts.
            </span>
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





