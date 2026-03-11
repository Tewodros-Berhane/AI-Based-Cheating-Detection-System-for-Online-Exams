# Operator Guide

This guide is for platform operators using the admin and examiner parts of the system.

## 1. Roles

### Admin
Use the admin role to manage platform setup:
- create and edit examiner accounts
- create and edit courses
- review high-level dashboard activity

### Examiner
Use the examiner role to run assessment operations:
- create questions
- create exams
- configure security level and entry checks
- open registration
- start and end live exams
- monitor examinees
- apply support settings and moderation actions
- publish results and review exam-quality analytics

## 2. Admin Workflow

### Sign in
Use the admin login form on the homepage.

### Manage examiners
Open `Examiners` from the sidebar to:
- add examiner accounts
- edit examiner details
- remove examiner accounts

### Manage courses
Open `Courses` from the sidebar to:
- add course entries
- rename course entries
- remove unused course entries

### Review dashboard
The admin dashboard gives a platform-level summary:
- active exams
- question-bank size
- examiner count
- course count

## 3. Examiner Workflow

### Question Library
Use `Question Library` to:
- create new questions
- attach images where needed
- inspect question details
- review the question list in descending creation order

### Create Exam
Use `Create Exam` to:
1. enter basic exam details
2. choose a course
3. set duration
4. choose a security level
5. choose whether entry checks are required
6. select questions manually or randomly
7. finalize the exam

### Security Levels
The current product supports three levels:

#### Light
Use when minimal device restrictions are acceptable.
Typical behavior:
- lighter entry checks
- lower monitoring strictness
- face verification can remain off

#### Standard
Use for the normal supervised exam path.
Typical behavior:
- camera and microphone expectations
- fuller pre-entry validation
- stronger live monitoring than light mode

#### Strict
Use for the highest-control path.
Typical behavior:
- strongest entry restrictions
- stricter pre-entry validation
- screen sharing/fullscreen style controls when configured

Important operator rule:
- configure the security level before the exam starts
- once the exam is live, related entry settings are effectively locked

## 4. Registration And Entry

### Open registration
In `Live Exam Operations`, use the session controls to open registration.

### Share the registration link
Copy the registration link from the exam control snapshot or from the registered-examinee area.

### Resend email
If an examinee says the email did not arrive:
- verify SMTP is configured
- use the resend action from the registration success flow

### Entry checks
When entry checks are enabled, examinees may be asked to verify:
- camera
- microphone
- screen sharing
- environment readiness
- network readiness

The exact checks depend on exam settings and support overrides.

## 5. Live Exam Operations

The live exam workspace is used during an active exam.

### What to monitor
- registration state
- exam live/ended state
- examinee list
- live preview
- behavior timeline and severity badges
- question set in use

### Behavior timeline
Open an examinee's behavior history to review:
- monitoring events
- severity level
- timestamps
- acknowledgement state
- examiner review outcome

### What Acknowledge does
`Acknowledge` means:
- the examiner reviewed the event
- the review is written to the audit trail

`Acknowledge` does not:
- clear the alert
- reduce the score
- mark the examinee safe again

For the full scoring model, see [explanation.md](explanation.md).

## 6. Support Settings

Use the support modal during a live session when an approved exception is needed.

Available support options can include:
- extra time
- custom timing window
- larger text
- high contrast mode
- assistive reader allowance
- face verification exemption
- microphone exemption
- screen sharing exemption
- fullscreen exemption

Operator rule:
- always add a clear reason before saving a support plan
- the reason becomes part of the audit trail

## 7. Moderation Actions

Use examiner actions when live intervention is necessary.

Available actions can include:
- add note
- send warning
- add extra time
- force submit exam
- reopen session
- confirm concern
- excuse alert
- disqualify result

Guidance:
- use `Confirm concern` when an incident should count against the session review
- use `Excuse alert` when the incident was reviewed and should not count against the examinee
- use `Force submit` only when the session must be closed immediately
- use `Reopen session` only when policy allows resuming the exam after intervention

## 8. Ending Exams

There are multiple end paths:
- examinee submits normally
- timer expires
- examiner ends the exam
- examiner force-submits a specific session

Operational expectation:
- when an exam ends, live capture streams should close
- post-exam views should show results and audit history, not live-session controls

## 9. Results And Statistics

### Results
In exam details, you can review:
- scores
- pass/fail outcome
- feedback
- behavior audit for each examinee

### Statistics
The statistics tab shows exam-quality signals such as:
- score distribution
- pass rate
- item difficulty
- question flags
- answer-choice performance
- consistency indicators

Use this tab to decide:
- which questions are weak
- which exams need review before reuse
- which subjects are producing poor question quality

## 10. Admin And Examiner Checklist

### Before an exam starts
- confirm questions are correct
- confirm security level
- confirm entry-check settings
- confirm face verification preference
- open registration when ready
- test email delivery if the cohort is new

### While the exam is live
- monitor the live workspace
- review severe alerts quickly
- document support and moderation reasons clearly
- avoid changing policy-like settings after the exam has started

### After the exam ends
- generate results
- review feedback
- inspect flagged incidents
- inspect the statistics tab before reusing the exam
- export reports when needed
