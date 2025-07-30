const amqp = require('amqplib');
const logger = require('../utils/logger');

class RabbitMQClient {
  constructor() {
    this.connection = null;
    this.channel = null;
  }

  async connect() {
    try {
      this.connection = await amqp.connect(process.env.RABBITMQ_URL);
      this.channel = await this.connection.createChannel();

      // Mesaj gönderme kuyruğunu oluştur
      await this.channel.assertQueue('message_sending_queue', {
        durable: true,
      });

      logger.info('RabbitMQ Connected');
    } catch (error) {
      logger.error('RabbitMQ connection error:', error);
      process.exit(1);
    }
  }

  async sendMessage(queue, message) {
    try {
      await this.channel.sendToQueue(
        queue,
        Buffer.from(JSON.stringify(message)),
        {
          persistent: true,
        }
      );
      logger.info(`Message sent to queue: ${queue}`);
      return true;
    } catch (error) {
      logger.error('RabbitMQ send message error:', error);
      return false;
    }
  }

  async consumeMessages(queue, callback) {
    try {
      await this.channel.consume(queue, (msg) => {
        if (msg !== null) {
          const content = JSON.parse(msg.content.toString());
          callback(content, msg);
        }
      });
      logger.info(`Started consuming messages from queue: ${queue}`);
    } catch (error) {
      logger.error('RabbitMQ consume error:', error);
    }
  }

  async acknowledgeMessage(msg) {
    try {
      await this.channel.ack(msg);
    } catch (error) {
      logger.error('RabbitMQ acknowledge error:', error);
    }
  }

  async close() {
    try {
      if (this.channel) await this.channel.close();
      if (this.connection) await this.connection.close();
      logger.info('RabbitMQ connection closed');
    } catch (error) {
      logger.error('RabbitMQ close error:', error);
    }
  }
}

module.exports = new RabbitMQClient();
