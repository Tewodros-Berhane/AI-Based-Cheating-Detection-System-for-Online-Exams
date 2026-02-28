const trainerUser = {
  _id: 'trainer-001',
  name: 'Smoke Trainer',
  emailid: 'trainer@example.com',
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
        user: trainerUser,
        token: 'smoke-token'
      }
    }).as('login');

    cy.intercept('GET', '**/api/v1/user/details*', {
      statusCode: 200,
      body: {
        success: true,
        user: trainerUser
      }
    }).as('userDetails');

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
        feedbacks: []
      }
    }).as('dashboard');

    cy.visit('/');
    cy.get('input[placeholder="Email"]').type('trainer@example.com');
    cy.get('input[placeholder="Password"]').type('password123');
    cy.contains('button', 'Login').click();

    cy.wait('@login');
    cy.wait('@userDetails');
    cy.wait('@dashboard');

    cy.url().should('include', '/user/home');
    cy.contains('Dashboard Overview').should('be.visible');
  });

  it('smoke: trainee registration', () => {
    cy.intercept('POST', '**/api/v1/trainee/enter', {
      statusCode: 200,
      body: {
        success: true,
        message: 'Trainee registered successfully!',
        user: {
          _id: 'trainee-001',
          emailid: 'student@example.com'
        }
      }
    }).as('register');

    cy.visit('/trainee/register?testid=test-001');

    cy.get('input[placeholder="Name"]').type('Student One');
    cy.get('input[placeholder="Email Id"]').type('student@example.com');
    cy.get('input[type="tel"]').first().type('251900000000', { force: true });
    cy.get('input[placeholder="Organisation"]').type('Mekelle University');
    cy.get('input[placeholder="Location"]').type('Mekelle');

    cy.get('input[type="file"]').selectFile('cypress/fixtures/face.jpg', { force: true });
    cy.contains('button', 'Register').click();

    cy.wait('@register');
    cy.contains('An email containing your test link has been sent').should('be.visible');
  });

  it('smoke: trainer can start and end exam', () => {
    cy.intercept('GET', '**/api/v1/user/details*', {
      statusCode: 200,
      body: {
        success: true,
        user: trainerUser
      }
    }).as('userDetails');

    cy.intercept('POST', '**/api/v1/test/basic/details*', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          isRegistrationavailable: true,
          testbegins: false,
          testconducted: false,
          isResultgenerated: false
        }
      }
    }).as('basicDetails');

    cy.intercept('POST', '**/api/v1/test/candidates*', {
      statusCode: 200,
      body: {
        success: true,
        data: []
      }
    }).as('candidates');

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
    cy.wait('@candidates');

    cy.contains('button', 'Start Exam').click();
    cy.wait('@startExam');

    cy.contains('button', 'Start Exam').should('be.disabled');
    cy.contains('button', 'End Exam').should('not.be.disabled').click();
    cy.wait('@endExam');
  });

  it('smoke: trainee result generation screen', () => {
    cy.intercept('POST', '**/api/v1/trainee/details*', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          _id: 'trainee-001',
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
          testconducted: false,
          completed: true,
          pending: 0
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

    cy.visit('/trainee/taketest?testid=test-001&traineeid=trainee-001');

    cy.wait('@traineeDetails');
    cy.wait('@flags');
    cy.wait('@result');
    cy.wait('@questions');
    cy.wait('@feedbackStatus');

    cy.contains('Result').should('be.visible');
    cy.contains('Score').should('be.visible');
  });
});
