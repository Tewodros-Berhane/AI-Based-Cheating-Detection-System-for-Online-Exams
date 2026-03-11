const examinerUser = {
  _id: 'examiner-001',
  name: 'Smoke Examiner',
  emailid: 'examiner@example.com',
  contact: '251911111111',
  type: 'TRAINER'
};

const withToken = (win) => {
  win.localStorage.setItem('Token', 'smoke-token');
};

describe('Smoke Flows', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
  });

  it('smoke: login', () => {
    cy.intercept('POST', '**/api/v1/login/**', {
      statusCode: 200,
      body: {
        success: true,
        message: 'login successful',
        user: examinerUser,
        token: 'smoke-token'
      }
    }).as('login');

    cy.intercept('GET', '**/api/v1/dashboard*', {
      statusCode: 200,
      body: {
        userType: 'TRAINER',
        stats: {
          myExamCount: 1,
          questionsAdded: 2,
          myTraineesCount: 3
        },
        myExams: [],
        myTrainees: [],
        feedbacks: [],
        analytics: {
          psychometrics: {
            weakestExams: [],
            flaggedSubjects: [],
            reviewBacklog: [],
            difficultyTrend: { labels: [], averageScores: [], averageItemCorrectness: [] }
          }
        }
      }
    }).as('dashboard');

    cy.visit('/');
    cy.get('input[placeholder="Email"]').type('examiner@example.com');
    cy.get('input[placeholder="Password"]').type('password123');
    cy.contains('button', 'Sign In').click();

    cy.wait('@login');
    cy.wait('@dashboard');

    cy.url().should('include', '/user/home');
    cy.contains('Command Center').should('be.visible');
  });

  it('smoke: examinee registration and resend email', () => {
    cy.intercept('POST', '**/api/v1/trainee/register/config', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          testid: 'test-001',
          isRegistrationavailable: true,
          faceRecognitionEnabled: false,
          integrityMode: 'LIGHT',
          integrityPolicy: {
            requireCamera: true,
            requireMicrophone: false,
            requireFullscreen: false,
            requireScreenShare: false,
            requireFaceVerification: false
          },
          preflightEnabled: true,
          title: 'Smoke Exam',
          organisation: 'Exam Shield'
        }
      }
    }).as('registrationConfig');

    cy.intercept('POST', '**/api/v1/trainee/enter', {
      statusCode: 200,
      body: {
        success: true,
        message: 'Registration complete.',
        emailDelivered: true,
        user: {
          _id: 'examinee-001',
          emailid: 'student@example.com'
        }
      }
    }).as('register');

    cy.intercept('POST', '**/api/v1/trainee/resend/testlink', {
      statusCode: 200,
      body: {
        success: true,
        message: 'Link sent successfully!'
      }
    }).as('resendEmail');

    cy.visit('/examinee/register?testid=test-001');
    cy.wait('@registrationConfig');

    cy.get('input[placeholder="Name"]').type('Student One');
    cy.get('input[placeholder="Email Id"]').type('student@example.com');
    cy.get('input#trainee-contact').type('251900000000', { force: true });
    cy.get('input[placeholder="Organisation"]').type('Mekelle University');
    cy.get('input[placeholder="Location"]').type('Mekelle');
    cy.contains('button', 'Register').click();

    cy.wait('@register');
    cy.contains('Your exam access email has been sent.').should('be.visible');
    cy.contains('button', 'Resend Email').click();
    cy.wait('@resendEmail');
  });

  it('smoke: examiner can start and end exam', () => {
    cy.intercept('GET', '**/api/v1/user/details*', {
      statusCode: 200,
      body: {
        success: true,
        user: examinerUser
      }
    }).as('userDetails');


    cy.intercept('POST', '**/api/v1/test/basic/details*', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          _id: 'test-001',
          isRegistrationavailable: true,
          testbegins: false,
          testconducted: false,
          isResultgenerated: false,
          faceRecognitionEnabled: false,
          integrityMode: 'STANDARD',
          preflightEnabled: true
        }
      }
    }).as('basicDetails');

    cy.intercept('POST', '**/api/v1/test/trainer/details*', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          _id: 'test-001',
          title: 'Smoke Exam',
          duration: 60,
          organisation: 'Exam Shield',
          faceRecognitionEnabled: false,
          subjects: [{ _id: 'subject-001', topic: 'Regression' }]
        }
      }
    }).as('fullDetails');

    cy.intercept('POST', '**/api/v1/test/candidates*', {
      statusCode: 200,
      body: {
        success: true,
        data: []
      }
    }).as('candidates');

    cy.intercept('POST', '**/api/v1/test/proctor/summary*', {
      statusCode: 200,
      body: {
        success: true,
        data: []
      }
    }).as('proctorSummary');

    cy.intercept('POST', '**/api/v1/test/candidate/accommodations/list*', {
      statusCode: 200,
      body: {
        success: true,
        data: []
      }
    }).as('accommodations');

    cy.intercept('POST', '**/api/v1/test/begin*', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          isRegistrationavailable: false,
          testbegins: true,
          testconducted: false,
          isResultgenerated: false
        }
      }
    }).as('startExam');

    cy.intercept('POST', '**/api/v1/test/end*', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          isRegistrationavailable: false,
          testbegins: false,
          testconducted: true,
          isResultgenerated: true
        }
      }
    }).as('endExam');

    cy.visit('/user/conducttest?testid=test-001', { onBeforeLoad: withToken });

    cy.wait('@userDetails');
    cy.wait('@basicDetails');
    cy.wait('@fullDetails');
    cy.wait('@candidates');
    cy.wait('@proctorSummary');
    cy.wait('@accommodations');

    cy.contains('Live Exam Operations').should('be.visible');
    cy.contains('button', 'Start Exam').click();
    cy.wait('@startExam');
    cy.contains('button', 'Start Exam').should('be.disabled');
    cy.contains('button', 'End Exam').should('not.be.disabled').click({ force: true });
    cy.wait('@endExam');
    cy.contains('The exam has ended').should('be.visible');
  });

  it('smoke: examinee result screen', () => {
    cy.intercept('POST', '**/api/v1/trainee/details*', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          _id: 'examinee-001',
          name: 'Student One',
          emailid: 'student@example.com',
          contact: '251900000000'
        }
      }
    }).as('traineeDetails');

    cy.intercept('POST', '**/api/v1/trainee/flags*', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          testbegins: true,
          startedWriting: true,
          testconducted: true,
          completed: true,
          pending: 0,
          faceRecognitionEnabled: false,
          examMeta: {
            title: 'Smoke Exam',
            organisation: 'Exam Shield',
            duration: 60,
            totalQuestions: 1,
            examID: '100001',
            integrityMode: 'LIGHT',
            integrityPolicy: {
              requireCamera: true,
              requireMicrophone: false,
              requireFullscreen: false,
              requireScreenShare: false,
              requireFaceVerification: false
            },
            preflightEnabled: true
          }
        }
      }
    }).as('flags');

    cy.intercept('POST', '**/api/v1/final/results*', {
      statusCode: 200,
      body: {
        success: true,
        result: {
          score: 1,
          result: [
            {
              qid: 'q1',
              correctAnswer: ['A'],
              givenAnswer: ['A'],
              weightage: 1,
              iscorrect: true
            }
          ]
        }
      }
    }).as('result');

    cy.intercept('POST', '**/api/v1/trainee/paper/questions*', {
      statusCode: 200,
      body: {
        success: true,
        data: [
          {
            _id: 'q1',
            body: 'What is 1+1?',
            weightage: 1,
            anscount: 1,
            options: [
              { _id: 'o1', optbody: '2', optimg: null, isAnswer: true }
            ]
          }
        ]
      }
    }).as('questions');

    cy.intercept('POST', '**/api/v1/trainee/feedback/status*', {
      statusCode: 200,
      body: {
        success: true,
        status: true
      }
    }).as('feedbackStatus');

    cy.visit('/examinee/taketest?testid=test-001&examineeid=examinee-001');

    cy.wait('@traineeDetails');
    cy.wait('@flags');
    cy.wait('@result');
    cy.wait('@questions');
    cy.wait('@feedbackStatus');

    cy.contains('Exam Result Summary').should('be.visible');
    cy.contains('Total Score').should('be.visible');
  });
});

