const User = require('../models/User');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} = require('../utils/jwt');
const logger = require('../utils/logger');

// Kullanıcı kayıt
const register = async (req, res) => {
  try {
    const { username, email, password, firstName, lastName } = req.body;

    // Kullanıcının zaten var olup olmadığını kontrol et
    const existingUser = await User.findOne({
      $or: [{ email }, { username }],
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message:
          existingUser.email === email
            ? 'Email already exists'
            : 'Username already exists',
      });
    }

    // Yeni kullanıcı oluştur
    const user = new User({
      username,
      email,
      password,
      profile: {
        firstName,
        lastName,
      },
    });

    await user.save();

    // Token'ları oluştur
    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // Refresh token'ı kullanıcıya kaydet
    await user.addRefreshToken(refreshToken);

    logger.info(`New user registered: ${user.username}`);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          profile: user.profile,
        },
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed',
    });
  }
};

// Kullanıcı giriş
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Kullanıcıyı bul (password dahil)
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated',
      });
    }

    // Password'ü kontrol et
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Token'ları oluştur
    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // Refresh token'ı kullanıcıya kaydet
    await user.addRefreshToken(refreshToken);

    // Son görülme zamanını güncelle
    user.lastSeen = new Date();
    await user.save();

    logger.info(`User logged in: ${user.username}`);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          profile: user.profile,
        },
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
    });
  }
};

// Token yenileme
const refreshToken = async (req, res) => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required',
      });
    }

    // Refresh token'ı doğrula
    const decoded = verifyRefreshToken(token);

    // Kullanıcıyı bul
    const user = await User.findById(decoded.userId);

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token',
      });
    }

    // Refresh token'ın kullanıcıda olup olmadığını kontrol et
    const tokenExists = user.refreshTokens.some((rt) => rt.token === token);

    if (!tokenExists) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token',
      });
    }

    // Yeni token'ları oluştur
    const newAccessToken = generateAccessToken(user._id);
    const newRefreshToken = generateRefreshToken(user._id);

    // Eski refresh token'ı sil ve yenisini ekle
    await user.removeRefreshToken(token);
    await user.addRefreshToken(newRefreshToken);

    logger.info(`Token refreshed for user: ${user.username}`);

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      },
    });
  } catch (error) {
    logger.error('Token refresh error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid refresh token',
    });
  }
};

// Çıkış yap
const logout = async (req, res) => {
  try {
    const { refreshToken: token } = req.body;
    const user = req.user;

    if (token) {
      // Refresh token'ı sil
      await user.removeRefreshToken(token);
    } else {
      // Tüm refresh token'ları sil
      await user.clearRefreshTokens();
    }

    logger.info(`User logged out: ${user.username}`);

    res.json({
      success: true,
      message: 'Logout successful',
    });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed',
    });
  }
};

// Profil bilgilerini getir
const getProfile = async (req, res) => {
  try {
    const user = req.user;

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          profile: user.profile,
          isActive: user.isActive,
          lastSeen: user.lastSeen,
          createdAt: user.createdAt,
        },
      },
    });
  } catch (error) {
    logger.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get profile',
    });
  }
};

// Profil güncelle
const updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, bio } = req.body;
    const user = req.user;

    // Profil bilgilerini güncelle
    if (firstName !== undefined) user.profile.firstName = firstName;
    if (lastName !== undefined) user.profile.lastName = lastName;
    if (bio !== undefined) user.profile.bio = bio;

    await user.save();

    logger.info(`Profile updated for user: ${user.username}`);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          profile: user.profile,
        },
      },
    });
  } catch (error) {
    logger.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
    });
  }
};

module.exports = {
  register,
  login,
  refreshToken,
  logout,
  getProfile,
  updateProfile,
};
