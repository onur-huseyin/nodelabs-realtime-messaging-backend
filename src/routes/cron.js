const express = require('express');
const { body } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const validate = require('../middleware/validation');
const {
  getSystemStatus,
  triggerMessagePlanning,
  triggerQueueManagement,
  getQueueStatus,
  retryFailedMessages,
  sendTestMessage,
  getServiceStatus,
} = require('../controllers/cronController');

const router = express.Router();

// Tüm route'lar authentication gerektirir
router.use(authenticateToken);

// Validation rules
const sendTestMessageValidation = [
  body('senderId').isMongoId().withMessage('Invalid sender ID'),
  body('receiverId').isMongoId().withMessage('Invalid receiver ID'),
  body('content')
    .isLength({ min: 1, max: 1000 })
    .withMessage('Message content must be between 1 and 1000 characters'),
];

/**
 * @swagger
 * /cron/status:
 *   get:
 *     summary: Sistem durumu
 *     tags: [Cron Services]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sistem durumu başarıyla getirildi
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
 *                     services:
 *                       type: object
 *                       properties:
 *                         isStarted:
 *                           type: boolean
 *                         messagePlanning:
 *                           type: object
 *                           properties:
 *                             isRunning:
 *                               type: boolean
 *                         queueManagement:
 *                           type: object
 *                           properties:
 *                             isRunning:
 *                               type: boolean
 *                         messageConsumer:
 *                           type: object
 *                           properties:
 *                             isRunning:
 *                               type: boolean
 *                     queue:
 *                       type: object
 *                       properties:
 *                         pending:
 *                           type: integer
 *                         queued:
 *                           type: integer
 *                         sent:
 *                           type: integer
 *                         failed:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 */
router.get('/status', getSystemStatus);

/**
 * @swagger
 * /cron/services:
 *   get:
 *     summary: Servis durumları
 *     tags: [Cron Services]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Servis durumları başarıyla getirildi
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
 *                     isStarted:
 *                       type: boolean
 *                     messagePlanning:
 *                       type: object
 *                       properties:
 *                         isRunning:
 *                           type: boolean
 *                     queueManagement:
 *                       type: object
 *                       properties:
 *                         isRunning:
 *                           type: boolean
 *                     messageConsumer:
 *                       type: object
 *                       properties:
 *                         isRunning:
 *                           type: boolean
 */
router.get('/services', getServiceStatus);

/**
 * @swagger
 * /cron/queue:
 *   get:
 *     summary: Kuyruk durumu
 *     tags: [Cron Services]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Kuyruk durumu başarıyla getirildi
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
 *                     pending:
 *                       type: integer
 *                       description: Bekleyen mesaj sayısı
 *                     queued:
 *                       type: integer
 *                       description: Kuyruğa alınan mesaj sayısı
 *                     sent:
 *                       type: integer
 *                       description: Gönderilen mesaj sayısı
 *                     failed:
 *                       type: integer
 *                       description: Başarısız mesaj sayısı
 *                     total:
 *                       type: integer
 *                       description: Toplam mesaj sayısı
 */
router.get('/queue', getQueueStatus);

/**
 * @swagger
 * /cron/trigger/planning:
 *   post:
 *     summary: Mesaj planlama servisini tetikleme
 *     tags: [Cron Services]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Mesaj planlama başarıyla tetiklendi
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
 *                     plannedMessages:
 *                       type: integer
 *                       description: Planlanan mesaj sayısı
 */
router.post('/trigger/planning', triggerMessagePlanning);

/**
 * @swagger
 * /cron/trigger/queue:
 *   post:
 *     summary: Kuyruk yönetimi servisini tetikleme
 *     tags: [Cron Services]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Kuyruk yönetimi başarıyla tetiklendi
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
 *                     processedMessages:
 *                       type: integer
 *                       description: İşlenen mesaj sayısı
 */
router.post('/trigger/queue', triggerQueueManagement);

/**
 * @swagger
 * /cron/retry/failed:
 *   post:
 *     summary: Başarısız mesajları yeniden deneme
 *     tags: [Cron Services]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Başarısız mesajlar başarıyla yeniden denendi
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
 *                     retriedMessages:
 *                       type: integer
 *                       description: Yeniden denen mesaj sayısı
 */
router.post('/retry/failed', retryFailedMessages);

/**
 * @swagger
 * /cron/test/message:
 *   post:
 *     summary: Test mesajı gönderme
 *     tags: [Cron Services]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - senderId
 *               - receiverId
 *               - content
 *             properties:
 *               senderId:
 *                 type: string
 *                 description: Gönderen kullanıcı ID
 *               receiverId:
 *                 type: string
 *                 description: Alıcı kullanıcı ID
 *               content:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 1000
 *                 description: Mesaj içeriği
 *     responses:
 *       200:
 *         description: Test mesajı başarıyla gönderildi
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
 *                     messageId:
 *                       type: string
 *                       description: Gönderilen mesaj ID'si
 */
router.post(
  '/test/message',
  sendTestMessageValidation,
  validate,
  sendTestMessage
);

module.exports = router;
