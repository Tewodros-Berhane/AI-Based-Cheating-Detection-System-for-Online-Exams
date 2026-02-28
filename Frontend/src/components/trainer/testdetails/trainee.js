import React from 'react';

export default function Trainee(props) {
  const maxMarks = props.maxmMarks || 2;
  const rows = props.stats || [];

  return (
    <section className="testdetails-block">
      <div className="testdetails-block-head">
        <h4>Student Performance</h4>
        <p>Review each candidate outcome and scoring status.</p>
      </div>

      <div className="admin-data-grid-shell">
        <div className="admin-data-grid-scroll">
          <table className="admin-data-grid testdetails-student-grid">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Contact</th>
                <th>Organization</th>
                <th>Score</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr className="admin-empty-row">
                  <td colSpan={6}>No students are available.</td>
                </tr>
              ) : (
                rows.map((row) => {
                  const score = Number(row.score || 0);
                  const passed = score >= maxMarks / 2;
                  return (
                    <tr className="admin-data-row" key={row._id}>
                      <td><span className="admin-row-title">{row.userid && row.userid.name}</span></td>
                      <td>{row.userid && row.userid.emailid}</td>
                      <td>{row.userid && row.userid.contact}</td>
                      <td>{row.userid && row.userid.organisation}</td>
                      <td>{score}</td>
                      <td>
                        <span className={`testdetails-status-pill ${passed ? 'pass' : 'fail'}`}>
                          {passed ? 'Pass' : 'Fail'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
