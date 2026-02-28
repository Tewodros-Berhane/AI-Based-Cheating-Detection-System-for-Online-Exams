const config = require('config');
const createRelayServer = require('./services/relay/createRelayServer');

const SIGNALING_PORT =
  process.env.WS_SIGNALING_PORT ||
  (config.has('services.wsSignalingPort') ? config.get('services.wsSignalingPort') : 8080);

module.exports = createRelayServer({
  name: 'signaling',
  port: SIGNALING_PORT,
  roleRoutes: {
    trainee: ['trainer', 'proctor'],
    trainer: ['trainee'],
    proctor: ['trainee']
  }
});

