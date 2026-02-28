const EventEmitter = require('events');

const logger = require('../logger');

class RelayBus {
  constructor({ redisUrl = '', channelPrefix = 'exam-shield' } = {}) {
    this.channelPrefix = channelPrefix;
    this.redisUrl = redisUrl;
    this.localEmitter = new EventEmitter();
    this.localEmitter.setMaxListeners(100);
    this.redisPub = null;
    this.redisSub = null;
    this.redisReady = false;
    this.redisSubscriptions = new Set();

    this.bootstrapRedis();
  }

  async bootstrapRedis() {
    if (!this.redisUrl) return;

    let redisLib;
    try {
      redisLib = require('redis');
    } catch (error) {
      logger.warn('Redis URL configured but redis package is unavailable; using local relay bus only', {
        error: logger.normalizeError(error)
      });
      return;
    }

    try {
      this.redisPub = redisLib.createClient({ url: this.redisUrl });
      this.redisSub = this.redisPub.duplicate();
      this.redisPub.on('error', (error) => {
        logger.error('Relay bus redis publisher error', { error: logger.normalizeError(error) });
      });
      this.redisSub.on('error', (error) => {
        logger.error('Relay bus redis subscriber error', { error: logger.normalizeError(error) });
      });
      await this.redisPub.connect();
      await this.redisSub.connect();
      this.redisReady = true;
      logger.info('Relay bus redis mode enabled');
    } catch (error) {
      this.redisReady = false;
      logger.error('Failed to initialize redis relay bus; falling back to local bus', {
        error: logger.normalizeError(error)
      });
    }
  }

  topicName(topic) {
    return `${this.channelPrefix}:${topic}`;
  }

  async subscribe(topic, handler) {
    this.localEmitter.on(topic, handler);

    if (!this.redisReady || !this.redisSub) return;

    const redisTopic = this.topicName(topic);
    if (this.redisSubscriptions.has(redisTopic)) return;

    this.redisSubscriptions.add(redisTopic);
    await this.redisSub.subscribe(redisTopic, (raw) => {
      try {
        const payload = JSON.parse(raw);
        handler(payload);
      } catch (error) {
        logger.warn('Invalid redis relay payload', { topic: redisTopic, raw });
      }
    });
  }

  async publish(topic, payload) {
    this.localEmitter.emit(topic, payload);

    if (!this.redisReady || !this.redisPub) return;

    try {
      await this.redisPub.publish(this.topicName(topic), JSON.stringify(payload));
    } catch (error) {
      logger.error('Failed to publish relay payload to redis', {
        topic,
        error: logger.normalizeError(error)
      });
    }
  }
}

module.exports = RelayBus;

