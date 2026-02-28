const config = require('config');
const createRelayServer = require('./services/relay/createRelayServer');

const RESULT_PORT =
  process.env.WS_RESULT_PORT ||
  (config.has('services.wsResultPort') ? config.get('services.wsResultPort') : 8081);

module.exports = createRelayServer({
  name: 'result',
  port: RESULT_PORT,
  roleRoutes: {
    trainee: ['trainer', 'proctor'],
    trainer: ['trainee'],
    proctor: ['trainee']
  }
});

