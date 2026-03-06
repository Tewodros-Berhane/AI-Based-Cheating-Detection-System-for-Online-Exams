import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Tooltip } from 'antd-compat';
import { History } from 'lucide-react';
import { SecurePost } from '../../../services/axiosCall';
import apis from '../../../services/Apis';
import ProctorTimelineModal from '../conducttest/ProctorTimelineModal';

export default function Trainee(props) {
  const maxMarks = props.maxmMarks || 2;
  const rows = useMemo(() => props.stats || [], [props.stats]);
  const testId = props.id;
  const [riskByTrainee, setRiskByTrainee] = useState({});
  const [timelineVisible, setTimelineVisible] = useState(false);
  const [timelineCandidate, setTimelineCandidate] = useState(null);

  const refreshRiskSummary = useCallback(async () => {
    if (!testId) {
      setRiskByTrainee({});
      return;
    }

    try {
      const response = await SecurePost({
        url: apis.GET_PROCTOR_SUMMARY,
        data: {
          testid: testId
        }
      });

      if (!response.data || !response.data.success) {
        setRiskByTrainee({});
        return;
      }

      const items = Array.isArray(response.data.data) ? response.data.data : [];
      const nextMap = items.reduce((accumulator, item) => {
        accumulator[item.traineeid] = item;
        return accumulator;
      }, {});
      setRiskByTrainee(nextMap);
    } catch (error) {
      setRiskByTrainee({});
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
          snapshot: candidate && candidate._id ? riskByTrainee[String(candidate._id)] || null : null
        };
      }),
    [rows, riskByTrainee]
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

  return (
    <section className="testdetails-block">
      <div className="testdetails-block-head">
        <h4>Student Performance</h4>
        <p>Review each candidate outcome, scoring status, and behavior audit trail.</p>
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
                <th>Audit</th>
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
                  const hasAuditData = Boolean(row.snapshot);

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
                        <span className={`testdetails-status-pill ${passed ? 'pass' : 'fail'}`}>
                          {passed ? 'Pass' : 'Fail'}
                        </span>
                      </td>
                      <td data-label="Audit">
                        <div className="admin-row-actions testdetails-audit-actions">
                          <Tooltip
                            title={hasAuditData ? 'Open behavior audit' : 'Open behavior audit timeline'}
                          >
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
