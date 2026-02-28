const ExamStates = {
  SCHEDULED: 'SCHEDULED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  INVALID: 'INVALID'
};

const ExamActions = {
  OPEN_REGISTRATION: 'OPEN_REGISTRATION',
  CLOSE_REGISTRATION: 'CLOSE_REGISTRATION',
  START_EXAM: 'START_EXAM',
  END_EXAM: 'END_EXAM',
  TRAINEE_START: 'TRAINEE_START',
  TRAINEE_UPDATE_ANSWER: 'TRAINEE_UPDATE_ANSWER',
  TRAINEE_SUBMIT: 'TRAINEE_SUBMIT'
};

const deriveExamState = (test) => {
  if (!test) return ExamStates.INVALID;

  const testBegins = Boolean(test.testbegins);
  const testConducted = Boolean(test.testconducted);
  const resultGenerated = Boolean(test.isResultgenerated);

  if (!testBegins && !testConducted) return ExamStates.SCHEDULED;
  if (testBegins && !testConducted && !resultGenerated) return ExamStates.IN_PROGRESS;
  if (!testBegins && testConducted && resultGenerated) return ExamStates.COMPLETED;
  return ExamStates.INVALID;
};

const isRegistrationAction = (action) =>
  action === ExamActions.OPEN_REGISTRATION || action === ExamActions.CLOSE_REGISTRATION;

const canApplyAction = (test, action) => {
  const state = deriveExamState(test);
  if (state === ExamStates.INVALID) {
    return {
      ok: false,
      state,
      reason: 'Exam has an invalid state combination; manual intervention required.'
    };
  }

  if (isRegistrationAction(action)) {
    if (state !== ExamStates.SCHEDULED) {
      return {
        ok: false,
        state,
        reason: 'Registration can only be changed before the exam starts.'
      };
    }
    return { ok: true, state };
  }

  if (action === ExamActions.START_EXAM) {
    if (state !== ExamStates.SCHEDULED) {
      return {
        ok: false,
        state,
        reason: 'Exam can only start from SCHEDULED state.'
      };
    }
    return { ok: true, state };
  }

  if (action === ExamActions.END_EXAM) {
    if (state !== ExamStates.IN_PROGRESS) {
      return {
        ok: false,
        state,
        reason: 'Exam can only end from IN_PROGRESS state.'
      };
    }
    return { ok: true, state };
  }

  if (
    action === ExamActions.TRAINEE_START ||
    action === ExamActions.TRAINEE_UPDATE_ANSWER ||
    action === ExamActions.TRAINEE_SUBMIT
  ) {
    if (state !== ExamStates.IN_PROGRESS) {
      return {
        ok: false,
        state,
        reason: 'Trainee actions are only allowed while exam is IN_PROGRESS.'
      };
    }
    return { ok: true, state };
  }

  return { ok: true, state };
};

module.exports = {
  ExamStates,
  ExamActions,
  deriveExamState,
  canApplyAction
};

