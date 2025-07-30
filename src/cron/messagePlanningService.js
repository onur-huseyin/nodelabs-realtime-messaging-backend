const cron = require('node-cron');
const User = require('../models/User');
const AutoMessage = require('../models/AutoMessage');
const logger = require('../utils/logger');

class MessagePlanningService {
  constructor() {
    this.isRunning = false;
  }

  // Servisi başlat
  start() {
    // Her gece saat 02:00'da çalış
    cron.schedule(
      '0 2 * * *',
      async () => {
        await this.planMessages();
      },
      {
        scheduled: true,
        timezone: 'Europe/Istanbul',
      }
    );

    logger.info('Message planning service started - runs daily at 02:00');
  }

  // Mesaj planlama işlemi
  async planMessages() {
    if (this.isRunning) {
      logger.warn('Message planning is already running, skipping...');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      logger.info('Starting message planning process...');

      // Aktif kullanıcıları getir
      const activeUsers = await User.find({ isActive: true })
        .select('_id username email')
        .lean();

      if (activeUsers.length < 2) {
        logger.info('Not enough active users for message planning');
        return;
      }

      logger.info(`Found ${activeUsers.length} active users`);

      // Kullanıcı listesini karıştır
      const shuffledUsers = this.shuffleArray([...activeUsers]);

      // İkişerli gruplara ayır
      const userPairs = this.createUserPairs(shuffledUsers);

      logger.info(`Created ${userPairs.length} user pairs`);

      // Her çift için otomatik mesaj oluştur
      const autoMessages = [];
      for (const pair of userPairs) {
        const message = await this.createAutoMessage(
          pair.sender,
          pair.receiver
        );
        if (message) {
          autoMessages.push(message);
        }
      }

      logger.info(`Created ${autoMessages.length} auto messages`);

      const endTime = Date.now();
      const duration = endTime - startTime;

      logger.info(`Message planning completed in ${duration}ms`);
    } catch (error) {
      logger.error('Message planning error:', error);
    } finally {
      this.isRunning = false;
    }
  }

  // Array'i karıştır
  shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  // Kullanıcı çiftleri oluştur
  createUserPairs(users) {
    const pairs = [];

    for (let i = 0; i < users.length - 1; i += 2) {
      pairs.push({
        sender: users[i],
        receiver: users[i + 1],
      });
    }

    // Eğer tek kullanıcı kaldıysa, ilk kullanıcı ile eşleştir
    if (users.length % 2 === 1) {
      pairs.push({
        sender: users[users.length - 1],
        receiver: users[0],
      });
    }

    return pairs;
  }

  // Otomatik mesaj oluştur
  async createAutoMessage(sender, receiver) {
    try {
      // Rastgele mesaj içeriği oluştur
      const content = this.generateRandomMessage();

      // Gönderim tarihini belirle (bugünden 1-7 gün sonra)
      const sendDate = this.generateRandomSendDate();

      // AutoMessage oluştur
      const autoMessage = new AutoMessage({
        sender: sender._id,
        receiver: receiver._id,
        content,
        sendDate,
        metadata: {
          messageType: 'auto',
          generatedAt: new Date(),
        },
      });

      await autoMessage.save();

      logger.info(
        `Auto message created: ${sender.username} -> ${receiver.username} (${sendDate})`
      );

      return autoMessage;
    } catch (error) {
      logger.error(
        `Failed to create auto message for ${sender.username} -> ${receiver.username}:`,
        error
      );
      return null;
    }
  }

  // Rastgele mesaj içeriği oluştur
  generateRandomMessage() {
    const messages = [
      'Merhaba! Nasılsın?',
      'Günaydın! Bugün nasıl geçiyor?',
      'Selam! Uzun zamandır görüşemedik.',
      'Hey! Ne haber?',
      'Merhaba! Nasıl gidiyor hayat?',
      'Selamlar! Bugün hava nasıl?',
      'Hey! Uzun zamandır konuşmamıştık.',
      'Merhaba! Nasıl gidiyor?',
      'Selam! Ne yapıyorsun?',
      'Hey! Nasılsın?',
      'Merhaba! Bugün nasıl?',
      'Selam! Uzun zamandır yoktun.',
      'Hey! Nasıl gidiyor?',
      'Merhaba! Ne haber?',
      'Selam! Bugün nasıl geçiyor?',
    ];

    return messages[Math.floor(Math.random() * messages.length)];
  }

  // Rastgele gönderim tarihi oluştur (bugünden 1-7 gün sonra)
  generateRandomSendDate() {
    const today = new Date();
    const daysToAdd = Math.floor(Math.random() * 7) + 1; // 1-7 gün
    const sendDate = new Date(today);
    sendDate.setDate(today.getDate() + daysToAdd);

    // Saat olarak 9:00-21:00 arası rastgele
    const hour = Math.floor(Math.random() * 12) + 9; // 9-20 arası
    const minute = Math.floor(Math.random() * 60);

    sendDate.setHours(hour, minute, 0, 0);

    return sendDate;
  }

  // Manuel olarak mesaj planlama (test için)
  async planMessagesManually() {
    logger.info('Manual message planning triggered');
    await this.planMessages();
  }

  // Servisi durdur
  stop() {
    this.isRunning = false;
    logger.info('Message planning service stopped');
  }
}

module.exports = new MessagePlanningService();
