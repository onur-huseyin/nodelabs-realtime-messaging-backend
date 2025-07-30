const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

// Genel rate limiter
const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 dakika
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // maksimum 100 istek
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      message: 'Too many requests from this IP, please try again later.',
    });
  },
});

// Authentication endpoint'leri için özel rate limiter
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 5, // maksimum 5 başarısız giriş denemesi
  message: {
    success: false,
    message: 'Too many login attempts, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Auth rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      message: 'Too many login attempts, please try again later.',
    });
  },
  skipSuccessfulRequests: true, // Başarılı istekleri sayma
});

// Mesaj gönderme için özel rate limiter
const messageLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 dakika
  max: 30, // maksimum 30 mesaj
  message: {
    success: false,
    message: 'Too many messages sent, please slow down.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Message rate limit exceeded for user: ${req.user?.username}`);
    res.status(429).json({
      success: false,
      message: 'Too many messages sent, please slow down.',
    });
  },
});

// API endpoint'leri için özel rate limiter
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 dakika
  max: 60, // maksimum 60 istek
  message: {
    success: false,
    message: 'Too many API requests, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`API rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      message: 'Too many API requests, please try again later.',
    });
  },
});

// Socket.IO bağlantıları için rate limiter
const socketLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 dakika
  max: 10, // maksimum 10 bağlantı denemesi
  message: {
    success: false,
    message: 'Too many connection attempts, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Socket rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      message: 'Too many connection attempts, please try again later.',
    });
  },
});

module.exports = {
  generalLimiter,
  authLimiter,
  messageLimiter,
  apiLimiter,
  socketLimiter,
};
