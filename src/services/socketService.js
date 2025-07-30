const { Server } = require('socket.io');
const { verifyAccessToken } = require('../utils/jwt');
const User = require('../models/User');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const redisClient = require('../config/redis');
const logger = require('../utils/logger');

class SocketService {
  constructor() {
    this.io = null;
    this.connectedUsers = new Map(); // userId -> socketId
  }

  initialize(server) {
    this.io = new Server(server, {
      cors: {
        origin:
          process.env.NODE_ENV === 'production'
            ? process.env.FRONTEND_URL
            : 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });

    this.setupMiddleware();
    this.setupEventHandlers();

    logger.info('Socket.IO server initialized');
  }

  // Socket.IO middleware - JWT authentication
  setupMiddleware() {
    this.io.use(async (socket, next) => {
      try {
        const token =
          socket.handshake.auth.token ||
          socket.handshake.headers.authorization?.split(' ')[1];

        if (!token) {
          return next(new Error('Authentication token required'));
        }

        // JWT token'ı doğrula
        const decoded = verifyAccessToken(token);

        // Kullanıcıyı veritabanından bul
        const user = await User.findById(decoded.userId).select('-password');

        if (!user || !user.isActive) {
          return next(new Error('Invalid user'));
        }

        // Kullanıcı bilgilerini socket'e ekle
        socket.user = user;
        next();
      } catch (error) {
        logger.error('Socket authentication error:', error);
        next(new Error('Authentication failed'));
      }
    });
  }

  // Event handlers
  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      this.handleConnection(socket);
    });
  }

  // Kullanıcı bağlantısı
  async handleConnection(socket) {
    const user = socket.user;
    const userId = user._id.toString();

    try {
      // Kullanıcıyı bağlı kullanıcılar listesine ekle
      this.connectedUsers.set(userId, socket.id);

      // Redis'e online kullanıcı olarak ekle
      await redisClient.sadd('online_users', userId);

      // Son görülme zamanını güncelle
      await User.findByIdAndUpdate(userId, { lastSeen: new Date() });

      logger.info(`User connected: ${user.username} (${userId})`);

      // Kullanıcıya başarılı bağlantı bildirimi gönder
      socket.emit('connection_success', {
        message: 'Connected successfully',
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
        },
      });

      // Diğer kullanıcılara online durumu bildir
      socket.broadcast.emit('user_online', {
        userId: user._id,
        username: user.username,
        lastSeen: new Date(),
      });

      // Mesaj gönderme eventi
      socket.on('send_message', async (data) => {
        await this.handleSendMessage(socket, data);
      });

      // Typing eventi
      socket.on('typing_start', (data) => {
        this.handleTypingStart(socket, data);
      });

      socket.on('typing_stop', (data) => {
        this.handleTypingStop(socket, data);
      });

      // Mesaj okundu eventi
      socket.on('mark_as_read', async (data) => {
        await this.handleMarkAsRead(socket, data);
      });

      // Bağlantı kesme eventi
      socket.on('disconnect', async () => {
        await this.handleDisconnect(socket);
      });
    } catch (error) {
      logger.error('Connection setup error:', error);
      socket.disconnect();
    }
  }

  // Mesaj gönderme
  async handleSendMessage(socket, data) {
    try {
      const { receiverId, content, messageType = 'text', metadata = {} } = data;
      const sender = socket.user;

      // Alıcıyı kontrol et
      const receiver = await User.findById(receiverId);
      if (!receiver || !receiver.isActive) {
        socket.emit('message_error', {
          message: 'Receiver not found or inactive',
        });
        return;
      }

      // Mesajı veritabanına kaydet
      const message = new Message({
        sender: sender._id,
        receiver: receiverId,
        content,
        messageType,
        metadata,
      });

      await message.save();

      // Konuşmayı bul veya oluştur
      const conversation = await Conversation.findOrCreateConversation(
        sender._id,
        receiverId
      );

      // Konuşma bilgilerini güncelle
      await conversation.updateLastMessage(message._id, message.createdAt);
      await conversation.incrementUnreadCount(receiverId);

      // Mesajı alıcıya gönder
      const receiverSocketId = this.connectedUsers.get(receiverId);
      if (receiverSocketId) {
        this.io.to(receiverSocketId).emit('message_received', {
          message: {
            id: message._id,
            sender: {
              id: sender._id,
              username: sender.username,
            },
            receiver: {
              id: receiver._id,
              username: receiver.username,
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
        });
      }

      // Göndericiye onay gönder
      socket.emit('message_sent', {
        messageId: message._id,
        timestamp: message.createdAt,
      });

      logger.info(
        `Message sent from ${sender.username} to ${receiver.username}`
      );
    } catch (error) {
      logger.error('Send message error:', error);
      socket.emit('message_error', {
        message: 'Failed to send message',
      });
    }
  }

  // Typing başladı
  handleTypingStart(socket, data) {
    const { receiverId } = data;
    const sender = socket.user;

    const receiverSocketId = this.connectedUsers.get(receiverId);
    if (receiverSocketId) {
      this.io.to(receiverSocketId).emit('user_typing', {
        userId: sender._id,
        username: sender.username,
        isTyping: true,
      });
    }
  }

  // Typing durdu
  handleTypingStop(socket, data) {
    const { receiverId } = data;
    const sender = socket.user;

    const receiverSocketId = this.connectedUsers.get(receiverId);
    if (receiverSocketId) {
      this.io.to(receiverSocketId).emit('user_typing', {
        userId: sender._id,
        username: sender.username,
        isTyping: false,
      });
    }
  }

  // Mesaj okundu işaretleme
  async handleMarkAsRead(socket, data) {
    try {
      const { messageId, senderId } = data;
      const user = socket.user;

      // Mesajı bul ve okundu olarak işaretle
      const message = await Message.findById(messageId);
      if (!message || message.receiver.toString() !== user._id.toString()) {
        return;
      }

      await message.markAsRead();

      // Konuşmadaki okunmamış mesaj sayısını sıfırla
      const conversation = await Conversation.findOne({
        participants: { $all: [user._id, senderId] },
        isActive: true,
      });

      if (conversation) {
        await conversation.resetUnreadCount(user._id);
      }

      // Göndericiye okundu bildirimi gönder
      const senderSocketId = this.connectedUsers.get(senderId);
      if (senderSocketId) {
        this.io.to(senderSocketId).emit('message_read', {
          messageId: message._id,
          readBy: {
            id: user._id,
            username: user.username,
          },
          readAt: message.readAt,
        });
      }
    } catch (error) {
      logger.error('Mark as read error:', error);
    }
  }

  // Bağlantı kesme
  async handleDisconnect(socket) {
    const user = socket.user;
    const userId = user._id.toString();

    try {
      // Kullanıcıyı bağlı kullanıcılar listesinden çıkar
      this.connectedUsers.delete(userId);

      // Redis'ten online kullanıcı listesinden çıkar
      await redisClient.srem('online_users', userId);

      // Son görülme zamanını güncelle
      await User.findByIdAndUpdate(userId, { lastSeen: new Date() });

      logger.info(`User disconnected: ${user.username} (${userId})`);

      // Diğer kullanıcılara offline durumu bildir
      socket.broadcast.emit('user_offline', {
        userId: user._id,
        username: user.username,
        lastSeen: new Date(),
      });
    } catch (error) {
      logger.error('Disconnect error:', error);
    }
  }

  // Kullanıcıya mesaj gönderme (RabbitMQ consumer için)
  sendMessageToUser(userId, event, data) {
    const socketId = this.connectedUsers.get(userId);
    if (socketId) {
      this.io.to(socketId).emit(event, data);
      return true;
    }
    return false;
  }

  // Tüm kullanıcılara broadcast
  broadcastToAll(event, data) {
    this.io.emit(event, data);
  }

  // Online kullanıcı sayısını getir
  async getOnlineUserCount() {
    return await redisClient.scard('online_users');
  }

  // Online kullanıcı listesini getir
  async getOnlineUsers() {
    return await redisClient.smembers('online_users');
  }

  // Kullanıcının online olup olmadığını kontrol et
  async isUserOnline(userId) {
    return await redisClient.sismember('online_users', userId);
  }

  // Kullanıcının socket bağlantısını kontrol et
  isUserConnected(userId) {
    return this.connectedUsers.has(userId);
  }

  // Kullanıcının socket ID'sini getir
  getUserSocketId(userId) {
    return this.connectedUsers.get(userId);
  }
}

module.exports = new SocketService();
