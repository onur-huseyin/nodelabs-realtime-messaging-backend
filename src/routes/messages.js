const express = require('express');
const { body } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const validate = require('../middleware/validation');
const {
  sendMessage,
  getMessageHistory,
  getConversations,
  markMessageAsRead,
  deleteMessage,
  getUnreadCount,
} = require('../controllers/messageController');

const router = express.Router();

// Tüm route'lar authentication gerektirir
router.use(authenticateToken);

// Validation rules
const sendMessageValidation = [
  body('receiverId').isMongoId().withMessage('Invalid receiver ID'),
  body('content')
    .isLength({ min: 1, max: 1000 })
    .withMessage('Message content must be between 1 and 1000 characters'),
  body('messageType')
    .optional()
    .isIn(['text', 'image', 'file', 'system'])
    .withMessage('Invalid message type'),
];

/**
 * @swagger
 * /messages/send:
 *   post:
 *     summary: Mesaj gönderme
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - receiverId
 *               - content
 *             properties:
 *               receiverId:
 *                 type: string
 *                 description: Alıcı kullanıcı ID
 *               content:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 1000
 *                 description: Mesaj içeriği
 *               messageType:
 *                 type: string
 *                 enum: [text, image, file, system]
 *                 default: text
 *                 description: Mesaj türü
 *     responses:
 *       200:
 *         description: Mesaj başarıyla gönderildi
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
 *                     message:
 *                       $ref: '#/components/schemas/Message'
 *                     conversation:
 *                       $ref: '#/components/schemas/Conversation'
 */
router.post('/send', sendMessageValidation, validate, sendMessage);

/**
 * @swagger
 * /messages/history/{userId}:
 *   get:
 *     summary: Kullanıcı ile mesaj geçmişi
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: Diğer kullanıcının ID'si
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
 *         description: Sayfa başına mesaj sayısı
 *     responses:
 *       200:
 *         description: Mesaj geçmişi başarıyla getirildi
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
 *                     messages:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Message'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         currentPage:
 *                           type: integer
 *                         totalPages:
 *                           type: integer
 *                         totalMessages:
 *                           type: integer
 *                         hasNextPage:
 *                           type: boolean
 *                         hasPrevPage:
 *                           type: boolean
 */
router.get('/history/:userId', getMessageHistory);

/**
 * @swagger
 * /messages/conversations:
 *   get:
 *     summary: Kullanıcının konuşmalar listesi
 *     tags: [Messages]
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
 *         description: Sayfa başına konuşma sayısı
 *     responses:
 *       200:
 *         description: Konuşmalar listesi başarıyla getirildi
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
 *                     conversations:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Conversation'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         currentPage:
 *                           type: integer
 *                         totalPages:
 *                           type: integer
 *                         totalConversations:
 *                           type: integer
 *                         hasNextPage:
 *                           type: boolean
 *                         hasPrevPage:
 *                           type: boolean
 */
router.get('/conversations', getConversations);

/**
 * @swagger
 * /messages/{messageId}/read:
 *   put:
 *     summary: Mesajı okundu olarak işaretleme
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *         description: Mesaj ID'si
 *     responses:
 *       200:
 *         description: Mesaj başarıyla okundu olarak işaretlendi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 */
router.put('/:messageId/read', markMessageAsRead);

/**
 * @swagger
 * /messages/{messageId}:
 *   delete:
 *     summary: Mesaj silme (soft delete)
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *         description: Mesaj ID'si
 *     responses:
 *       200:
 *         description: Mesaj başarıyla silindi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 */
router.delete('/:messageId', deleteMessage);

/**
 * @swagger
 * /messages/unread/count:
 *   get:
 *     summary: Okunmamış mesaj sayısı
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Okunmamış mesaj sayısı başarıyla getirildi
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
 *                     unreadCount:
 *                       type: integer
 *                       description: Toplam okunmamış mesaj sayısı
 */
router.get('/unread/count', getUnreadCount);

module.exports = router;
