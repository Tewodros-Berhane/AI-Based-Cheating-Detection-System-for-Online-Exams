import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Tooltip } from 'antd-compat';
import { History, SlidersHorizontal } from 'lucide-react';
import { SecurePost } from '../../../services/axiosCall';
import apis from '../../../services/Apis';
import CandidateSupportModal from '../common/CandidateSupportModal';
import ProctorTimelineModal from '../conducttest/ProctorTimelineModal';

export default function Trainee(props) {
  const maxMarks = props.maxmMarks || 2;
  const rows = useMemo(() => props.stats || [], [props.stats]);
  const testId = props.id;
  const [riskByTrainee, setRiskByTrainee] = useState({});
  const [supportByTrainee, setSupportByTrainee] = useState({});
  const [timelineVisible, setTimelineVisible] = useState(false);
  const [timelineCandidate, setTimelineCandidate] = useState(null);
  const [supportVisible, setSupportVisible] = useState(false);
  const [supportCandidate, setSupportCandidate] = useState(null);

  const refreshRiskSummary = useCallback(async () => {
    if (!testId) {
      setRiskByTrainee({});
      setSupportByTrainee({});
      return;
    }

    try {
      const [summaryResponse, supportResponse] = await Promise.all([
        SecurePost({
          url: apis.GET_PROCTOR_SUMMARY,
          data: {
            testid: testId
          }
        }),
        SecurePost({
          url: apis.LIST_TEST_ACCOMMODATIONS,
          data: {
            testid: testId
          }
        })
      ]);

      if (summaryResponse.data && summaryResponse.data.success) {
        const items = Array.isArray(summaryResponse.data.data) ? summaryResponse.data.data : [];
        const nextMap = items.reduce((accumulator, item) => {
          accumulator[item.traineeid] = item;
          return accumulator;
        }, {});
        setRiskByTrainee(nextMap);
      } else {
        setRiskByTrainee({});
      }

      if (supportResponse.data && supportResponse.data.success) {
        const supportItems = supportResponse.data.data && Array.isArray(supportResponse.data.data.items)
          ? supportResponse.data.data.items
          : [];
        const nextSupportMap = supportItems.reduce((accumulator, item) => {
          if (item && item.trainee && item.trainee._id) {
            accumulator[item.trainee._id] = item;
          }
          return accumulator;
        }, {});
        setSupportByTrainee(nextSupportMap);
      } else {
        setSupportByTrainee({});
      }
    } catch (error) {
      setRiskByTrainee({});
      setSupportByTrainee({});
    }
  }, [testId]);

  useEffect(() => {
    refreshRiskSummary();
  }, [refreshRiskSummary]);

  const normalizedRows = useMemo(
    () =>
      rows.map((row) => {
        const candidate = row.userid || {};
        return {
          ...row,
          candidate,
          candidateId: candidate && candidate._id ? String(candidate._id) : '',
          snapshot: candidate && candidate._id ? riskByTrainee[String(candidate._id)] || null : null,
          supportProfile: candidate && candidate._id ? supportByTrainee[String(candidate._id)] || null : null
        };
      }),
    [rows, riskByTrainee, supportByTrainee]
  );

  const openTimeline = (candidate) => {
    if (!candidate || !candidate._id) {
      return;
    }
    setTimelineCandidate(candidate);
    setTimelineVisible(true);
  };

  const closeTimeline = () => {
    setTimelineVisible(false);
    setTimelineCandidate(null);
  };

  const openSupport = (candidate) => {
    if (!candidate || !candidate._id) {
      return;
    }
    setSupportCandidate(candidate);
    setSupportVisible(true);
  };

  const closeSupport = () => {
    setSupportVisible(false);
    setSupportCandidate(null);
  };

  const getSupportBadge = (profile) => {
    if (!profile) {
      return null;
    }

    const extraTime = Number(profile.timeAdjustments && profile.timeAdjustments.extraTimeMinutes) || 0;
    const hasCheckAdjustments = Object.values((profile.integrityOverrides || {})).some(Boolean);
    return profile.isCurrentlyEffective
      ? (extraTime > 0 ? `Support active | +${extraTime} min` : (hasCheckAdjustments ? 'Support active | adjusted checks' : 'Support active'))
      : 'Support scheduled';
  };

  const getReviewBadge = (reporting) => {
    if (!reporting) {
      return null;
    }

    const actionCount = Number(reporting.moderation && reporting.moderation.actionCount) || 0;
    const disposition = reporting.finalDisposition || {};

    if (disposition.label === 'Force submitted by examiner') {
      return { label: 'Force submitted', tone: 'critical' };
    }

    if (actionCount > 0) {
      return {
        label: actionCount === 1 ? '1 trainer update' : `${actionCount} trainer updates`,
        tone: disposition.tone || 'monitoring'
      };
    }

    if (disposition.label && disposition.label !== 'Completed normally') {
      return { label: disposition.label, tone: disposition.tone || 'monitoring' };
    }

    return null;
  };

  return (
    <section className="testdetails-block">
      <div className="testdetails-block-head">
        <h4>Student Performance</h4>
        <p>Review each candidate outcome, scoring status, support plan, and behavior audit trail.</p>
      </div>

      <div className="admin-data-grid-shell">
        <div className="admin-data-grid-scroll">
          <table className="admin-data-grid testdetails-student-grid">
            <thead>
              <tr>
                <th>Student</th>
                <th>Contact</th>
                <th>Organization</th>
                <th>Score</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {normalizedRows.length === 0 ? (
                <tr className="admin-empty-row">
                  <td colSpan={6}>No students are available.</td>
                </tr>
              ) : (
                normalizedRows.map((row) => {
                  const score = Number(row.score || 0);
                  const passed = score >= maxMarks / 2;
                  const candidate = row.candidate || {};
                  const supportBadge = getSupportBadge(row.supportProfile);
                  const reviewBadge = getReviewBadge(row.reportingSummary);
                  const reviewSummary = row.reportingSummary && row.reportingSummary.moderation
                    ? row.reportingSummary.moderation.summaryLine
                    : '';

                  return (
                    <tr className="admin-data-row" key={row._id}>
                      <td data-label="Student">
                        <div className="admin-row-title">{candidate.name || '-'}</div>
                        <div className="admin-row-subtext testdetails-student-subtext">
                          {candidate.emailid || 'No email'}
                        </div>
                      </td>
                      <td data-label="Contact">{candidate.contact || '-'}</td>
                      <td data-label="Organization">{candidate.organisation || '-'}</td>
                      <td data-label="Score">{score}</td>
                      <td data-label="Status">
                        <div className="testdetails-status-stack">
                          <span className={`testdetails-status-pill ${passed ? 'pass' : 'fail'}`}>
                            {passed ? 'Pass' : 'Fail'}
                          </span>
                          {supportBadge ? (
                            <span className={`testdetails-support-pill ${row.supportProfile && row.supportProfile.isCurrentlyEffective ? 'active' : 'scheduled'}`}>
                              {supportBadge}
                            </span>
                          ) : null}
                          {reviewBadge ? (
                            <span className={`testdetails-support-pill review ${reviewBadge.tone}`}>
                              {reviewBadge.label}
                            </span>
                          ) : null}
                          {reviewBadge && reviewSummary ? (
                            <div className="admin-row-subtext testdetails-student-subtext">
                              {reviewSummary}
                            </div>
                          ) : null}
                        </div>
                      </td>
                      <td data-label="Actions">
                        <div className="admin-row-actions testdetails-audit-actions">
                          <Tooltip title="Open support settings and trainer actions">
                            <Button
                              className="admin-icon-btn"
                              shape="circle"
                              disabled={!row.candidateId}
                              onClick={() => openSupport(candidate)}
                            >
                              <SlidersHorizontal size={16} strokeWidth={2.3} />
                            </Button>
                          </Tooltip>
                          <Tooltip title="Open behavior audit">
                            <Button
                              className="admin-icon-btn"
                              shape="circle"
                              disabled={!row.candidateId}
                              onClick={() => openTimeline(candidate)}
                            >
                              <History size={16} strokeWidth={2.3} />
                            </Button>
                          </Tooltip>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CandidateSupportModal
        open={supportVisible}
        candidate={supportCandidate}
        testId={testId}
        onClose={closeSupport}
        onChanged={refreshRiskSummary}
      />

      <ProctorTimelineModal
        open={timelineVisible}
        candidate={timelineCandidate}
        testId={testId}
        onClose={closeTimeline}
        onChanged={refreshRiskSummary}
        showTimeFilter={false}
      />
    </section>
  );
}
