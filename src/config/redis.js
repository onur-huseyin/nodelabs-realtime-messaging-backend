const redis = require('redis');
const logger = require('../utils/logger');

class RedisClient {
  constructor() {
    this.client = null;
  }

  async connect() {
    try {
      this.client = redis.createClient({
        url: process.env.REDIS_URL,
        password: process.env.REDIS_PASSWORD || undefined,
      });

      this.client.on('error', (err) => {
        logger.error('Redis Client Error:', err);
      });

      this.client.on('connect', () => {
        logger.info('Redis Client Connected');
      });

      await this.client.connect();
    } catch (error) {
      logger.error('Redis connection error:', error);
      process.exit(1);
    }
  }

  async get(key) {
    try {
      return await this.client.get(key);
    } catch (error) {
      logger.error('Redis GET error:', error);
      return null;
    }
  }

  async set(key, value, expireTime = null) {
    try {
      if (expireTime) {
        await this.client.setEx(key, expireTime, value);
      } else {
        await this.client.set(key, value);
      }
      return true;
    } catch (error) {
      logger.error('Redis SET error:', error);
      return false;
    }
  }

  async del(key) {
    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      logger.error('Redis DEL error:', error);
      return false;
    }
  }

  async sadd(key, ...members) {
    try {
      return await this.client.sAdd(key, members);
    } catch (error) {
      logger.error('Redis SADD error:', error);
      return 0;
    }
  }

  async srem(key, ...members) {
    try {
      return await this.client.sRem(key, members);
    } catch (error) {
      logger.error('Redis SREM error:', error);
      return 0;
    }
  }

  async smembers(key) {
    try {
      return await this.client.sMembers(key);
    } catch (error) {
      logger.error('Redis SMEMBERS error:', error);
      return [];
    }
  }

  async scard(key) {
    try {
      return await this.client.sCard(key);
    } catch (error) {
      logger.error('Redis SCARD error:', error);
      return 0;
    }
  }

  async sismember(key, member) {
    try {
      return await this.client.sIsMember(key, member);
    } catch (error) {
      logger.error('Redis SISMEMBER error:', error);
      return false;
    }
  }
}

module.exports = new RedisClient();
