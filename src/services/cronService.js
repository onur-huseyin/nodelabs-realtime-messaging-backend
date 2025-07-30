const messagePlanningService = require('../cron/messagePlanningService');
const queueManagementService = require('../cron/queueManagementService');
const messageConsumerService = require('./messageConsumerService');
const logger = require('../utils/logger');

class CronService {
  constructor() {
    this.services = {
      messagePlanning: messagePlanningService,
      queueManagement: queueManagementService,
      messageConsumer: messageConsumerService,
    };
    this.isStarted = false;
  }

  // Tüm cron servislerini başlat
  async start() {
    if (this.isStarted) {
      logger.warn('Cron services are already started');
      return;
    }

    try {
      logger.info('Starting cron services...');

      // Mesaj planlama servisini başlat (gece 02:00)
      this.services.messagePlanning.start();

      // Kuyruk yönetimi servisini başlat (dakikada bir)
      this.services.queueManagement.start();

      // Mesaj consumer servisini başlat
      await this.services.messageConsumer.start();

      this.isStarted = true;
      logger.info('All cron services started successfully');
    } catch (error) {
      logger.error('Failed to start cron services:', error);
      throw error;
    }
  }

  // Tüm cron servislerini durdur
  async stop() {
    if (!this.isStarted) {
      logger.warn('Cron services are not running');
      return;
    }

    try {
      logger.info('Stopping cron services...');

      // Mesaj planlama servisini durdur
      this.services.messagePlanning.stop();

      // Kuyruk yönetimi servisini durdur
      this.services.queueManagement.stop();

      // Mesaj consumer servisini durdur
      await this.services.messageConsumer.stop();

      this.isStarted = false;
      logger.info('All cron services stopped successfully');
    } catch (error) {
      logger.error('Failed to stop cron services:', error);
      throw error;
    }
  }

  // Servis durumlarını kontrol et
  getServiceStatus() {
    return {
      isStarted: this.isStarted,
      messagePlanning: {
        isRunning: this.services.messagePlanning.isRunning,
      },
      queueManagement: {
        isRunning: this.services.queueManagement.isRunning,
      },
      messageConsumer: {
        isRunning: this.services.messageConsumer.isConsumerRunning(),
      },
    };
  }

  // Manuel olarak mesaj planlama tetikle
  async triggerMessagePlanning() {
    try {
      await this.services.messagePlanning.planMessagesManually();
      return {
        success: true,
        message: 'Message planning triggered successfully',
      };
    } catch (error) {
      logger.error('Manual message planning failed:', error);
      return { success: false, message: 'Failed to trigger message planning' };
    }
  }

  // Manuel olarak kuyruk yönetimi tetikle
  async triggerQueueManagement() {
    try {
      await this.services.queueManagement.processReadyMessagesManually();
      return {
        success: true,
        message: 'Queue management triggered successfully',
      };
    } catch (error) {
      logger.error('Manual queue management failed:', error);
      return { success: false, message: 'Failed to trigger queue management' };
    }
  }

  // Kuyruk durumunu getir
  async getQueueStatus() {
    try {
      return await this.services.queueManagement.getQueueStatus();
    } catch (error) {
      logger.error('Failed to get queue status:', error);
      return null;
    }
  }

  // Başarısız mesajları yeniden dene
  async retryFailedMessages() {
    try {
      await this.services.queueManagement.retryFailedMessages();
      return {
        success: true,
        message: 'Failed messages retry triggered successfully',
      };
    } catch (error) {
      logger.error('Failed messages retry failed:', error);
      return { success: false, message: 'Failed to retry failed messages' };
    }
  }

  // Test mesajı gönder
  async sendTestMessage(senderId, receiverId, content) {
    try {
      const success = await this.services.messageConsumer.sendTestMessage(
        senderId,
        receiverId,
        content
      );
      return {
        success,
        message: success
          ? 'Test message sent successfully'
          : 'Failed to send test message',
      };
    } catch (error) {
      logger.error('Send test message failed:', error);
      return { success: false, message: 'Failed to send test message' };
    }
  }

  // Sistem durumunu getir
  async getSystemStatus() {
    try {
      const queueStatus = await this.getQueueStatus();
      const serviceStatus = this.getServiceStatus();

      return {
        services: serviceStatus,
        queue: queueStatus,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error('Failed to get system status:', error);
      return null;
    }
  }
}

module.exports = new CronService();
