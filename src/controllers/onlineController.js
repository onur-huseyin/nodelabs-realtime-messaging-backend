const socketService = require('../services/socketService');
const redisClient = require('../config/redis');
const User = require('../models/User');
const logger = require('../utils/logger');

// Online kullanıcı sayısını getir
const getOnlineUserCount = async (req, res) => {
  try {
    const count = await socketService.getOnlineUserCount();

    res.json({
      success: true,
      data: {
        onlineCount: count,
      },
    });
  } catch (error) {
    logger.error('Get online user count error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get online user count',
    });
  }
};

// Online kullanıcı listesini getir
const getOnlineUsers = async (req, res) => {
  try {
    const onlineUserIds = await socketService.getOnlineUsers();

    // Kullanıcı detaylarını getir
    const onlineUsers = await User.find({
      _id: { $in: onlineUserIds },
    }).select('username email profile lastSeen');

    res.json({
      success: true,
      data: {
        onlineUsers,
        count: onlineUsers.length,
      },
    });
  } catch (error) {
    logger.error('Get online users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get online users',
    });
  }
};

// Belirli kullanıcının online durumunu kontrol et
const checkUserOnlineStatus = async (req, res) => {
  try {
    const { userId } = req.params;

    // Kullanıcının var olup olmadığını kontrol et
    const user = await User.findById(userId).select(
      'username email profile lastSeen'
    );
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Online durumunu kontrol et
    const isOnline = await socketService.isUserOnline(userId);

    // Son görülme zamanına göre de kontrol et (5 dakika içinde aktif sayılır)
    const lastSeenThreshold = new Date(Date.now() - 5 * 60 * 1000); // 5 dakika önce
    const isRecentlyActive = user.lastSeen && user.lastSeen > lastSeenThreshold;

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          profile: user.profile,
          lastSeen: user.lastSeen,
        },
        isOnline,
        isRecentlyActive,
        lastSeenThreshold: lastSeenThreshold,
      },
    });
  } catch (error) {
    logger.error('Check user online status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check user online status',
    });
  }
};

// Tüm kullanıcıların online durumunu getir
const getAllUsersOnlineStatus = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    // Aktif kullanıcıları getir
    const users = await User.find({ isActive: true })
      .select('username email profile lastSeen')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ lastSeen: -1 });

    // Online kullanıcı ID'lerini getir
    const onlineUserIds = await socketService.getOnlineUsers();

    // Her kullanıcı için online durumunu ekle
    const usersWithStatus = users.map((user) => ({
      id: user._id,
      username: user.username,
      email: user.email,
      profile: user.profile,
      lastSeen: user.lastSeen,
      isOnline: onlineUserIds.includes(user._id.toString()),
    }));

    // Toplam kullanıcı sayısını getir
    const totalUsers = await User.countDocuments({ isActive: true });

    res.json({
      success: true,
      data: {
        users: usersWithStatus,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalUsers / limit),
          totalUsers,
          hasNextPage: page * limit < totalUsers,
          hasPrevPage: page > 1,
        },
      },
    });
  } catch (error) {
    logger.error('Get all users online status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get users online status',
    });
  }
};

// Sistem istatistiklerini getir
const getSystemStats = async (req, res) => {
  try {
    const onlineCount = await socketService.getOnlineUserCount();
    const totalUsers = await User.countDocuments({ isActive: true });
    const totalMessages = await require('../models/Message').countDocuments();
    const totalConversations =
      await require('../models/Conversation').countDocuments({
        isActive: true,
      });

    res.json({
      success: true,
      data: {
        stats: {
          onlineUsers: onlineCount,
          totalUsers,
          totalMessages,
          totalConversations,
          onlinePercentage:
            totalUsers > 0 ? ((onlineCount / totalUsers) * 100).toFixed(2) : 0,
        },
        timestamp: new Date(),
      },
    });
  } catch (error) {
    logger.error('Get system stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get system stats',
    });
  }
};

// Test için kullanıcıyı online yap (Sadece development)
const simulateUserLogin = async (req, res) => {
  try {
    // Sadece development ortamında çalışsın
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        message: 'This endpoint is only available in development mode',
      });
    }

    const userId = req.user._id.toString();

    // Redis'e online kullanıcı olarak ekle
    await redisClient.sadd('online_users', userId);

    // Son görülme zamanını güncelle
    await User.findByIdAndUpdate(userId, { lastSeen: new Date() });

    // Online durumunu kontrol et
    const isOnline = await socketService.isUserOnline(userId);

    logger.info(`Test login: User ${req.user.username} (${userId}) marked as online`);

    res.json({
      success: true,
      message: 'User marked as online for testing',
      data: {
        userId,
        isOnline,
        lastSeen: new Date(),
      },
    });
  } catch (error) {
    logger.error('Simulate user login error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to simulate user login',
    });
  }
};

// Mevcut kullanıcının socket bağlantı durumunu kontrol et
const checkConnectionStatus = async (req, res) => {
  try {
    const userId = req.user._id.toString();

    // Socket.IO bağlantısını kontrol et
    const socketId = socketService.connectedUsers.get(userId);
    const isConnected = !!socketId;

    // Redis'te online durumunu kontrol et
    const isOnline = await socketService.isUserOnline(userId);

    let message = '';
    if (isConnected && isOnline) {
      message = 'User is fully connected via Socket.IO and marked as online';
    } else if (isConnected && !isOnline) {
      message = 'User has Socket.IO connection but not marked as online in Redis';
    } else if (!isConnected && isOnline) {
      message = 'User is marked as online in Redis but no active Socket.IO connection';
    } else {
      message = 'User has no Socket.IO connection and not marked as online';
    }

    res.json({
      success: true,
      data: {
        isConnected,
        isOnline,
        socketId: socketId || null,
        message,
        userId,
      },
    });
  } catch (error) {
    logger.error('Check connection status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check connection status',
    });
  }
};

module.exports = {
  getOnlineUserCount,
  getOnlineUsers,
  checkUserOnlineStatus,
  getAllUsersOnlineStatus,
  getSystemStats,
  simulateUserLogin,
  checkConnectionStatus,
};
