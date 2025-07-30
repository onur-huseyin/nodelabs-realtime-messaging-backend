const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const {
  getOnlineUserCount,
  getOnlineUsers,
  checkUserOnlineStatus,
  getAllUsersOnlineStatus,
  getSystemStats,
  simulateUserLogin,
  checkConnectionStatus,
} = require('../controllers/onlineController');

const router = express.Router();

// Tüm route'lar authentication gerektirir
router.use(authenticateToken);

/**
 * @swagger
 * /online/test-login:
 *   post:
 *     summary: Test için kullanıcıyı online yap (Sadece development)
 *     tags: [Online Status]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Kullanıcı başarıyla online yapıldı
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: string
 *                     isOnline:
 *                       type: boolean
 */
router.post('/test-login', simulateUserLogin);

/**
 * @swagger
 * /online/count:
 *   get:
 *     summary: Online kullanıcı sayısı
 *     tags: [Online Status]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Online kullanıcı sayısı başarıyla getirildi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     onlineCount:
 *                       type: integer
 *                       description: Online kullanıcı sayısı
 */
router.get('/count', getOnlineUserCount);

/**
 * @swagger
 * /online/users:
 *   get:
 *     summary: Online kullanıcılar listesi
 *     tags: [Online Status]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Online kullanıcılar listesi başarıyla getirildi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     onlineUsers:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/User'
 */
router.get('/users', getOnlineUsers);

/**
 * @swagger
 * /online/users/{userId}/status:
 *   get:
 *     summary: Kullanıcının online durumu
 *     tags: [Online Status]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: Kullanıcı ID'si
 *     responses:
 *       200:
 *         description: Kullanıcının online durumu başarıyla getirildi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     isOnline:
 *                       type: boolean
 *                       description: Kullanıcının online durumu
 *                     lastSeen:
 *                       type: string
 *                       format: date-time
 *                       description: Son görülme zamanı
 */
router.get('/users/:userId/status', checkUserOnlineStatus);

/**
 * @swagger
 * /online/all-users:
 *   get:
 *     summary: Tüm kullanıcıların online durumu
 *     tags: [Online Status]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Sayfa numarası
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Sayfa başına kullanıcı sayısı
 *     responses:
 *       200:
 *         description: Tüm kullanıcıların online durumu başarıyla getirildi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     users:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           user:
 *                             $ref: '#/components/schemas/User'
 *                           isOnline:
 *                             type: boolean
 *                           lastSeen:
 *                             type: string
 *                             format: date-time
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         currentPage:
 *                           type: integer
 *                         totalPages:
 *                           type: integer
 *                         totalUsers:
 *                           type: integer
 *                         hasNextPage:
 *                           type: boolean
 *                         hasPrevPage:
 *                           type: boolean
 */
router.get('/all-users', getAllUsersOnlineStatus);

/**
 * @swagger
 * /online/stats:
 *   get:
 *     summary: Sistem istatistikleri
 *     tags: [Online Status]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sistem istatistikleri başarıyla getirildi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalUsers:
 *                       type: integer
 *                       description: Toplam kullanıcı sayısı
 *                     onlineUsers:
 *                       type: integer
 *                       description: Online kullanıcı sayısı
 *                     totalMessages:
 *                       type: integer
 *                       description: Toplam mesaj sayısı
 *                     totalConversations:
 *                       type: integer
 *                       description: Toplam konuşma sayısı
 *                     systemUptime:
 *                       type: number
 *                       description: Sistem çalışma süresi (saniye)
 */
router.get('/stats', getSystemStats);

/**
 * @swagger
 * /online/connection-status:
 *   get:
 *     summary: Mevcut kullanıcının socket bağlantı durumu
 *     tags: [Online Status]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Socket bağlantı durumu başarıyla getirildi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     isConnected:
 *                       type: boolean
 *                       description: Socket.IO bağlantısı var mı
 *                     isOnline:
 *                       type: boolean
 *                       description: Redis'te online olarak işaretli mi
 *                     socketId:
 *                       type: string
 *                       description: Socket ID (varsa)
 *                     message:
 *                       type: string
 *                       description: Bağlantı durumu açıklaması
 */
router.get('/connection-status', checkConnectionStatus);

module.exports = router;
