# Live Alert Scoring and Acknowledge Behavior

This document explains how live alerts are currently calculated in Live Exam Operations and what happens when an examiner clicks the `Acknowledge` button.

## 1. What drives the live alert state

The alert shown for a examinee is not based on a single AI message. It is based on a combined monitoring timeline that can include:

- AI events
  - `AI_SUSPICIOUS`
  - `AI_CHEATING`
- Face events
  - `NO_FACE`
  - `MULTI_FACE`
  - `FACE_MISMATCH`
- System/browser events
  - `TAB_SWITCH`
  - `FULLSCREEN_EXIT`
  - `NETWORK_DROP`
  - `RECONNECTED`
- Exam lifecycle events
  - `EXAM_STARTED`
  - `EXAM_FINISHED`
- Examiner actions
  - `TRAINER_ACK`
  - `TRAINER_ESCALATE`

These events are stored in the backend event timeline and then summarized into a rolling risk snapshot for each examinee session.

## 2. Event score calculation

Every event gets a numeric `severityScore` between `0` and `100`.

Current formula:

```text
severityScore =
  clamp(baseScore * sourceWeight * confidenceWeight * repeatMultiplier, 0, 100)
```

### 2.1 Inputs used in the formula

#### Base score

Each event type starts with a base score:

- `AI_NORMAL = 5`
- `AI_SUSPICIOUS = 45`
- `AI_CHEATING = 85`
- `NO_FACE = 35`
- `MULTI_FACE = 70`
- `FACE_MISMATCH = 75`
- `LOOKING_AWAY = 25`
- `AUDIO_SUSPICIOUS = 40`
- `AUDIO_MULTIPLE_VOICES = 65`
- `EXAM_STARTED = 5`
- `EXAM_FINISHED = 5`
- `NETWORK_DROP = 20`
- `RECONNECTED = 10`
- `FULLSCREEN_EXIT = 60`
- `TAB_SWITCH = 45`
- `TRAINER_ESCALATE = 80`
- `TRAINER_ACK = 0`

#### Source weight

Some sources are weighted differently:

- `AI = 1`
- `FACE = 1.1`
- `SYSTEM = 1`
- `TRAINER = 1`

That means face-related events are treated slightly more strongly than equivalent AI/system events.

#### Confidence weight

Confidence is converted to:

```text
confidenceWeight = 0.6 + confidence * 0.4
```

So confidence always matters, but it does not completely dominate the result.

#### Repeat multiplier

Repeated events increase the score:

```text
repeatMultiplier = 1 + min(recentSameTypeCount, 4) * 0.18
```

This means repeated suspicious behavior in a short window becomes more serious than a single isolated event.

## 3. Severity bands

After the event score is calculated, it is mapped into a display level:

- `0-24` => `NORMAL`
- `25-49` => `SUSPICIOUS`
- `50-74` => `HIGH_RISK`
- `75-100` => `CHEATING`

Special case:

- If the event marks the exam as ended, the display state becomes `FINISHED`.

## 4. Forced escalation rules

Some combinations or repetitions override normal scoring:

- `AI_CHEATING` is forced to `CHEATING`
- `TAB_SWITCH` 3 times in 2 minutes => at least `HIGH_RISK`
- `AI_SUSPICIOUS` 3 times in 2 minutes => at least `HIGH_RISK`
- `MULTI_FACE` 2 times in 3 minutes => `CHEATING`
- `FACE_MISMATCH` plus `AUDIO_MULTIPLE_VOICES` within 60 seconds => `CHEATING`

So even if individual events are moderate, repeated or combined events can push the examinee to a much higher severity.

## 5. Rolling risk score

The examinee row in Live Exam Operations does not show only the latest event. It shows a rolling risk score.

The rolling risk logic:

- looks at the last `15 minutes` of relevant events
- ignores `TRAINER_ACK` events for risk computation
- gives newer events more weight
- still keeps a minimum weight for older events in the 15-minute window

The backend computes a weighted average of recent event scores, then makes sure the rolling score is never lower than the latest event score.

In simple terms:

- one strong event can immediately push the badge upward
- many medium events can also push the badge upward over time
- quiet periods reduce the score gradually

### Decay

If no suspicious event happened for more than `5 minutes`, the rolling score is reduced by `10`.

This is a decay rule so a examinee does not stay permanently at a high level after a brief issue that did not continue.

## 6. Snapshot used by the UI

For each examinee session, the backend stores a risk snapshot containing:

- `rollingRiskScore`
- `severityLevel`
- `lastEventType`
- `lastEventMessage`
- `lastEventAt`
- `suspiciousCount`
- `highRiskCount`
- `criticalCount`
- `isFinished`

The examiner dashboard reads that snapshot and shows:

- the current alert badge
- the numeric score
- the latest message
- the latest event time

## 7. What the examiner badge means

The badge shown in the examinee table is based on the snapshot if one exists.

If no snapshot exists yet, the UI falls back to exam progress:

- `in_progress` => `Monitoring`
- `not_started` => `Not started`
- `finished` => `Finished`

Important detail:

- `Monitoring` is mainly a UI fallback state, not a scored risk band.
- `Normal`, `Suspicious`, `High Risk`, and `Cheating` come from scored backend snapshots.

## 8. Examples

### Example A: one suspicious AI event

- event type: `AI_SUSPICIOUS`
- base score: `45`
- typical result: `SUSPICIOUS`

### Example B: one cheating AI event

- event type: `AI_CHEATING`
- base score: `85`
- result: `CHEATING`

### Example C: repeated tab switches

- one `TAB_SWITCH` is usually suspicious
- three `TAB_SWITCH` events in 2 minutes force at least `HIGH_RISK`

### Example D: face mismatch plus multiple voices

- `FACE_MISMATCH`
- `AUDIO_MULTIPLE_VOICES`

If both happen within 60 seconds, the examinee is forced to `CHEATING`.

## 9. What the Acknowledge button does

When an examiner clicks `Acknowledge` on a timeline item, the backend does three things:

1. It updates the original event:
   - `acked = true`
   - `ackedBy = examiner id`
   - `ackedAt = current time`

2. It writes a new timeline event:
   - event type: `TRAINER_ACK`
   - source: `TRAINER`
   - message: `Examiner acknowledged this event.` or the provided note

3. It refreshes the examinee snapshot.

### Important behavior of acknowledge

Acknowledging an event does **not** mean:

- the alert is cleared
- the severity score is reduced
- the examinee is considered safe again

It only means:

- the examiner has reviewed that event
- there is an audit trail showing it was seen

This is intentional. Acknowledge is a review action, not a forgiveness action.

### Why acknowledge does not reduce the score

`TRAINER_ACK` events are ignored in rolling risk computation. That means:

- they are visible in the timeline
- they are stored for audit/history
- they do not lower the risk level by themselves

So if the examinee is still at `High Risk` or `Cheating`, acknowledging the event will not automatically drop the badge.

## 10. What happens after acknowledgement in the UI

After acknowledgement:

- the event becomes marked as acknowledged
- the examiner can see that it was already reviewed
- the timeline includes a examiner acknowledgement entry
- the examinee row still reflects the actual rolling risk score

This prevents the examiner from accidentally hiding a real risk just by clicking a button.

## 11. Summary

- Alerts are based on event history, not a single AI message
- Every event gets a numeric score
- Scores are mapped into severity bands
- Repetition and event combinations can force escalation
- The examiner sees a rolling risk snapshot, not just the latest raw signal
- `Acknowledge` records examiner review, but does not clear the alert or lower the score

