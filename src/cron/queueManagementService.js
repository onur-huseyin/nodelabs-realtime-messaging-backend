const cron = require('node-cron');
const AutoMessage = require('../models/AutoMessage');
const rabbitMQClient = require('../config/rabbitmq');
const logger = require('../utils/logger');

class QueueManagementService {
  constructor() {
    this.isRunning = false;
  }

  // Servisi başlat
  start() {
    // Her dakika çalış
    cron.schedule(
      '* * * * *',
      async () => {
        await this.processReadyMessages();
      },
      {
        scheduled: true,
        timezone: 'Europe/Istanbul',
      }
    );

    logger.info('Queue management service started - runs every minute');
  }

  // Gönderilmeye hazır mesajları işle
  async processReadyMessages() {
    if (this.isRunning) {
      logger.warn('Queue management is already running, skipping...');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      logger.info('Starting queue management process...');

      // Gönderilmeye hazır mesajları bul
      const readyMessages = await AutoMessage.find({
        sendDate: { $lte: new Date() },
        isQueued: false,
        isSent: false,
        retryCount: { $lt: 3 }, // Maksimum 3 deneme
      }).populate('sender receiver', 'username email');

      if (readyMessages.length === 0) {
        logger.info('No ready messages found');
        return;
      }

      logger.info(`Found ${readyMessages.length} ready messages`);

      // Her mesajı kuyruğa ekle
      let queuedCount = 0;
      for (const message of readyMessages) {
        const success = await this.queueMessage(message);
        if (success) {
          queuedCount++;
        }
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      logger.info(
        `Queue management completed: ${queuedCount}/${readyMessages.length} messages queued in ${duration}ms`
      );
    } catch (error) {
      logger.error('Queue management error:', error);
    } finally {
      this.isRunning = false;
    }
  }

  // Mesajı kuyruğa ekle
  async queueMessage(autoMessage) {
    try {
      // RabbitMQ'ya mesaj gönder
      const messageData = {
        autoMessageId: autoMessage._id.toString(),
        senderId: autoMessage.sender._id.toString(),
        receiverId: autoMessage.receiver._id.toString(),
        content: autoMessage.content,
        messageType: 'text',
        metadata: autoMessage.metadata,
        timestamp: new Date(),
      };

      const success = await rabbitMQClient.sendMessage(
        'message_sending_queue',
        messageData
      );

      if (success) {
        // Mesajı kuyruğa eklendi olarak işaretle
        await autoMessage.markAsQueued();

        logger.info(
          `Message queued: ${autoMessage.sender.username} -> ${autoMessage.receiver.username}`
        );
        return true;
      } else {
        // Hata durumunda retry sayısını artır
        await autoMessage.incrementRetry('Failed to queue message');
        logger.error(`Failed to queue message: ${autoMessage._id}`);
        return false;
      }
    } catch (error) {
      logger.error(`Error queuing message ${autoMessage._id}:`, error);

      // Hata durumunda retry sayısını artır
      await autoMessage.incrementRetry(error.message);
      return false;
    }
  }

  // Manuel olarak kuyruk yönetimi (test için)
  async processReadyMessagesManually() {
    logger.info('Manual queue management triggered');
    await this.processReadyMessages();
  }

  // Kuyruk durumunu kontrol et
  async getQueueStatus() {
    try {
      const pendingCount = await AutoMessage.countDocuments({
        sendDate: { $lte: new Date() },
        isQueued: false,
        isSent: false,
        retryCount: { $lt: 3 },
      });

      const queuedCount = await AutoMessage.countDocuments({
        isQueued: true,
        isSent: false,
      });

      const sentCount = await AutoMessage.countDocuments({
        isSent: true,
      });

      const failedCount = await AutoMessage.countDocuments({
        retryCount: { $gte: 3 },
        isSent: false,
      });

      return {
        pending: pendingCount,
        queued: queuedCount,
        sent: sentCount,
        failed: failedCount,
        total: pendingCount + queuedCount + sentCount + failedCount,
      };
    } catch (error) {
      logger.error('Get queue status error:', error);
      return null;
    }
  }

  // Başarısız mesajları yeniden deneme
  async retryFailedMessages() {
    try {
      logger.info('Retrying failed messages...');

      const failedMessages = await AutoMessage.find({
        retryCount: { $gte: 3 },
        isSent: false,
        errorMessage: { $exists: true },
      });

      if (failedMessages.length === 0) {
        logger.info('No failed messages to retry');
        return;
      }

      logger.info(`Found ${failedMessages.length} failed messages to retry`);

      let retryCount = 0;
      for (const message of failedMessages) {
        // Retry sayısını sıfırla
        message.retryCount = 0;
        message.errorMessage = null;
        await message.save();

        // Mesajı tekrar kuyruğa ekle
        const success = await this.queueMessage(message);
        if (success) {
          retryCount++;
        }
      }

      logger.info(
        `Retried ${retryCount}/${failedMessages.length} failed messages`
      );
    } catch (error) {
      logger.error('Retry failed messages error:', error);
    }
  }

  // Servisi durdur
  stop() {
    this.isRunning = false;
    logger.info('Queue management service stopped');
  }
}

module.exports = new QueueManagementService();
