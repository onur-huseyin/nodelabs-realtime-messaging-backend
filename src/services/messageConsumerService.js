const rabbitMQClient = require('../config/rabbitmq');
const AutoMessage = require('../models/AutoMessage');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const socketService = require('./socketService');
const logger = require('../utils/logger');

class MessageConsumerService {
  constructor() {
    this.isRunning = false;
  }

  // Consumer'ı başlat
  async start() {
    if (this.isRunning) {
      logger.warn('Message consumer is already running');
      return;
    }

    try {
      this.isRunning = true;

      // RabbitMQ'dan mesajları dinlemeye başla
      await rabbitMQClient.consumeMessages(
        'message_sending_queue',
        async (messageData, msg) => {
          await this.processMessage(messageData, msg);
        }
      );

      logger.info('Message consumer service started');
    } catch (error) {
      this.isRunning = false;
      logger.error('Failed to start message consumer:', error);
      throw error;
    }
  }

  // Mesajı işle
  async processMessage(messageData, msg) {
    const startTime = Date.now();

    try {
      logger.info(`Processing message: ${messageData.autoMessageId}`);

      // AutoMessage'ı bul
      const autoMessage = await AutoMessage.findById(
        messageData.autoMessageId
      ).populate('sender receiver', 'username email');

      if (!autoMessage) {
        logger.error(`AutoMessage not found: ${messageData.autoMessageId}`);
        await rabbitMQClient.acknowledgeMessage(msg);
        return;
      }

      // Mesaj zaten gönderilmiş mi kontrol et
      if (autoMessage.isSent) {
        logger.info(`Message already sent: ${messageData.autoMessageId}`);
        await rabbitMQClient.acknowledgeMessage(msg);
        return;
      }

      // Yeni Message dökümanı oluştur
      const message = new Message({
        sender: autoMessage.sender._id,
        receiver: autoMessage.receiver._id,
        content: autoMessage.content,
        messageType: messageData.messageType || 'text',
        metadata: messageData.metadata || {},
      });

      await message.save();

      // Konuşmayı bul veya oluştur
      const conversation = await Conversation.findOrCreateConversation(
        autoMessage.sender._id,
        autoMessage.receiver._id
      );

      // Konuşma bilgilerini güncelle
      await conversation.updateLastMessage(message._id, message.createdAt);
      await conversation.incrementUnreadCount(autoMessage.receiver._id);

      // AutoMessage'ı gönderildi olarak işaretle
      await autoMessage.markAsSent(message._id);

      // Socket.IO üzerinden alıcıya bildirim gönder
      const sent = socketService.sendMessageToUser(
        autoMessage.receiver._id.toString(),
        'message_received',
        {
          message: {
            id: message._id,
            sender: {
              id: autoMessage.sender._id,
              username: autoMessage.sender.username,
            },
            receiver: {
              id: autoMessage.receiver._id,
              username: autoMessage.receiver.username,
            },
            content: message.content,
            messageType: message.messageType,
            metadata: message.metadata,
            createdAt: message.createdAt,
          },
          conversation: {
            id: conversation._id,
            lastMessage: message._id,
            lastMessageAt: message.createdAt,
          },
        }
      );

      // Mesajı onayla
      await rabbitMQClient.acknowledgeMessage(msg);

      const endTime = Date.now();
      const duration = endTime - startTime;

      logger.info(
        `Message processed successfully: ${autoMessage.sender.username} -> ${autoMessage.receiver.username} (${duration}ms) - Socket notification: ${sent ? 'sent' : 'not sent'}`
      );
    } catch (error) {
      logger.error(
        `Error processing message ${messageData.autoMessageId}:`,
        error
      );

      // AutoMessage'ı bul ve retry sayısını artır
      try {
        const autoMessage = await AutoMessage.findById(
          messageData.autoMessageId
        );
        if (autoMessage) {
          await autoMessage.incrementRetry(error.message);
        }
      } catch (retryError) {
        logger.error('Failed to update retry count:', retryError);
      }

      // Mesajı tekrar kuyruğa ekle (retry mekanizması)
      if (messageData.retryCount < 3) {
        messageData.retryCount = (messageData.retryCount || 0) + 1;

        // Mesajı onayla ve tekrar kuyruğa ekle
        await rabbitMQClient.acknowledgeMessage(msg);

        // 5 saniye sonra tekrar kuyruğa ekle
        setTimeout(async () => {
          try {
            await rabbitMQClient.sendMessage(
              'message_sending_queue',
              messageData
            );
            logger.info(
              `Message requeued for retry ${messageData.retryCount}: ${messageData.autoMessageId}`
            );
          } catch (requeueError) {
            logger.error('Failed to requeue message:', requeueError);
          }
        }, 5000);
      } else {
        // Maksimum retry sayısına ulaşıldı, mesajı onayla
        await rabbitMQClient.acknowledgeMessage(msg);
        logger.error(
          `Message failed after ${messageData.retryCount} retries: ${messageData.autoMessageId}`
        );
      }
    }
  }

  // Consumer'ı durdur
  async stop() {
    this.isRunning = false;
    logger.info('Message consumer service stopped');
  }

  // Consumer durumunu kontrol et
  isConsumerRunning() {
    return this.isRunning;
  }

  // Test mesajı gönder
  async sendTestMessage(senderId, receiverId, content) {
    try {
      const messageData = {
        autoMessageId: 'test-' + Date.now(),
        senderId: senderId.toString(),
        receiverId: receiverId.toString(),
        content,
        messageType: 'text',
        metadata: {
          messageType: 'test',
          generatedAt: new Date(),
        },
        retryCount: 0,
        timestamp: new Date(),
      };

      const success = await rabbitMQClient.sendMessage(
        'message_sending_queue',
        messageData
      );

      if (success) {
        logger.info('Test message sent to queue');
        return true;
      } else {
        logger.error('Failed to send test message to queue');
        return false;
      }
    } catch (error) {
      logger.error('Send test message error:', error);
      return false;
    }
  }
}

module.exports = new MessageConsumerService();
