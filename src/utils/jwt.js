const jwt = require('jsonwebtoken');
const logger = require('./logger');

// Access token oluşturma
const generateAccessToken = (userId) => {
  try {
    return jwt.sign({ userId }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    });
  } catch (error) {
    logger.error('Access token generation error:', error);
    throw new Error('Token generation failed');
  }
};

// Refresh token oluşturma
const generateRefreshToken = (userId) => {
  try {
    return jwt.sign(
      { userId, type: 'refresh' },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
    );
  } catch (error) {
    logger.error('Refresh token generation error:', error);
    throw new Error('Refresh token generation failed');
  }
};

// Token doğrulama
const verifyToken = (token, secret = process.env.JWT_SECRET) => {
  try {
    return jwt.verify(token, secret);
  } catch (error) {
    logger.error('Token verification error:', error);
    throw new Error('Invalid token');
  }
};

// Access token doğrulama
const verifyAccessToken = (token) => {
  return verifyToken(token, process.env.JWT_SECRET);
};

// Refresh token doğrulama
const verifyRefreshToken = (token) => {
  return verifyToken(token, process.env.JWT_REFRESH_SECRET);
};

// Token'dan userId çıkarma
const getUserIdFromToken = (token) => {
  try {
    const decoded = jwt.decode(token);
    return decoded?.userId;
  } catch (error) {
    logger.error('Token decode error:', error);
    return null;
  }
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  getUserIdFromToken,
};
