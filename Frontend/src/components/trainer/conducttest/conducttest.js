import React, { Component } from 'react';
import { connect } from 'react-redux';
import { Input, Button, Tabs, Tag } from 'antd-compat';
import { Link } from 'react-router-dom';
import './conducttes.css';
import { changeConducttestId, updateQuestiosnTest } from '../../../actions/conductTest';
import TestDetails from './details';
import Candidates from './candidates';
import Questions from './questions';
import Alert from '../../common/alert';
import { ArrowRight, ListChecks, ShieldCheck, Users } from 'lucide-react';

const { TabPane } = Tabs;

class ConductTestS extends Component {
  constructor(props) {
    super(props);
    this.state = {
      localTestId: props.testid || ''
    };
  }

  componentDidMount() {
    this.syncTestIdFromRoute(this.props.testid);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.testid !== this.props.testid) {
      this.syncTestIdFromRoute(this.props.testid);
    }
  }

  syncTestIdFromRoute = (routeTestId) => {
    const normalized = String(routeTestId || '').trim();
    this.props.changeConducttestId(normalized || null);
    if (normalized) {
      this.setState({ localTestId: normalized });
    }
  };

  ChangeLocalTestId = (event) => {
    this.setState({
      localTestId: event.target.value
    });
  };

  proceedToConductTest = () => {
    const nextId = String(this.state.localTestId || '').trim();
    if (!nextId) {
      Alert('warning', 'Warning!', 'Enter exam id before continuing.');
      return;
    }
    window.location.href = `/user/conducttest?testid=${nextId}`;
  };

  renderEntryGate = () => (
    <div className="admin-modern-shell conduct-shell">
      <div className="admin-modern-headline">
        <div className="admin-modern-title-group">
          <h3>Live Exam Operations</h3>
          <p>Enter an exam id to open session controls, candidate monitoring, and question review.</p>
        </div>
        <div className="admin-modern-headline-right">
          <Tag className="admin-modern-chip">Session Access</Tag>
        </div>
      </div>

      <section className="conduct-entry-card">
        <h4>Enter Exam ID</h4>
        <p>Paste the exam identifier generated during exam creation to begin live operations.</p>
        <div className="conduct-entry-form">
          <Input
            value={this.state.localTestId}
            onChange={this.ChangeLocalTestId}
            placeholder="e.g. 69a304d54b79b27c77bd0b09"
            className="conduct-entry-input"
          />
          <Button type="primary" className="conduct-entry-btn" onClick={this.proceedToConductTest}>
            Continue
            <ArrowRight size={16} strokeWidth={2.2} />
          </Button>
        </div>
      </section>
    </div>
  );

  renderEndedState = () => (
    <div className="admin-modern-shell conduct-shell">
      <div className="admin-modern-headline">
        <div className="admin-modern-title-group">
          <h3>Live Exam Operations</h3>
          <p>Session closed. Review outcomes and analytics from the exam library.</p>
        </div>
        <div className="admin-modern-headline-right">
          <Tag className="admin-modern-chip">{this.props.conduct.id || '-'} </Tag>
          <Tag className="conduct-state-chip ended">Ended</Tag>
        </div>
      </div>

      <section className="conduct-ended-card">
        <ShieldCheck size={20} strokeWidth={2.2} />
        <div>
          <h4>The exam has ended</h4>
          <p>Go to the exams page to inspect results, downloads, and feedback.</p>
        </div>
        <Link to="/user/listtests" className="conduct-ended-link">
          Open Exams
        </Link>
      </section>
    </div>
  );

  renderActiveSession = () => {
    const basic = this.props.conduct.basictestdetails || {};
    const registrationOpen = Boolean(basic.isRegistrationavailable);
    const live = Boolean(basic.testbegins);

    return (
      <div className="admin-modern-shell conduct-shell">
        <div className="admin-modern-headline">
          <div className="admin-modern-title-group">
            <h3>Live Exam Operations</h3>
            <p>Run exam controls, monitor students, and inspect active question sets in one workspace.</p>
          </div>
          <div className="admin-modern-headline-right">
            <Tag className="admin-modern-chip">{this.props.conduct.id || '-'}</Tag>
            <Tag className={`conduct-state-chip ${registrationOpen ? 'open' : 'closed'}`}>
              {registrationOpen ? 'Registration Open' : 'Registration Closed'}
            </Tag>
            <Tag className={`conduct-state-chip ${live ? 'live' : 'idle'}`}>
              {live ? 'Exam Live' : 'Not Started'}
            </Tag>
          </div>
        </div>

        <TestDetails />

        <section className="conduct-tabs-shell">
          <Tabs defaultActiveKey="1" className="conduct-modern-tabs">
            <TabPane
              tab={
                <span className="conduct-tab-label">
                  <Users size={14} strokeWidth={2.2} />
                  Registered Students
                </span>
              }
              key="1"
            >
              <Candidates />
            </TabPane>
            <TabPane
              tab={
                <span className="conduct-tab-label">
                  <ListChecks size={14} strokeWidth={2.2} />
                  Questions
                </span>
              }
              key="2"
            >
              <Questions
                id={this.props.conduct.id}
                questionsOfTest={this.props.conduct.questionsOfTest}
                updateQuestiosnTest={this.props.updateQuestiosnTest}
              />
            </TabPane>
          </Tabs>
        </section>
      </div>
    );
  };

  render() {
    if (!this.props.conduct.id) {
      return this.renderEntryGate();
    }

    if (this.props.conduct.basictestdetails && this.props.conduct.basictestdetails.testconducted) {
      return this.renderEndedState();
    }

    return this.renderActiveSession();
  }
}

const mapStateToProps = (state) => ({
  conduct: state.conduct
});

export default connect(mapStateToProps, {
  changeConducttestId,
  updateQuestiosnTest
})(ConductTestS);
