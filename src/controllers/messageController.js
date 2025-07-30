const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const logger = require('../utils/logger');

// Mesaj gönderme
const sendMessage = async (req, res) => {
  try {
    const {
      receiverId,
      content,
      messageType = 'text',
      metadata = {},
    } = req.body;
    const sender = req.user;

    // Alıcıyı kontrol et
    const receiver = await User.findById(receiverId);
    if (!receiver || !receiver.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Receiver not found or inactive',
      });
    }

    // Kendine mesaj göndermeyi engelle
    if (sender._id.toString() === receiverId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot send message to yourself',
      });
    }

    // Mesajı oluştur
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

    logger.info(
      `Message sent via API: ${sender.username} -> ${receiver.username}`
    );

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: {
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
      },
    });
  } catch (error) {
    logger.error('Send message error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message',
    });
  }
};

// Mesaj geçmişini getir
const getMessageHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUser = req.user;
    const { page = 1, limit = 50 } = req.query;

    // Diğer kullanıcıyı kontrol et
    const otherUser = await User.findById(userId);
    if (!otherUser || !otherUser.isActive) {
      return res.status(404).json({
        success: false,
        message: 'User not found or inactive',
      });
    }

    // İki kullanıcı arasındaki mesajları getir
    const messages = await Message.find({
      $or: [
        { sender: currentUser._id, receiver: userId },
        { sender: userId, receiver: currentUser._id },
      ],
      isDeleted: false,
    })
      .populate('sender', 'username profile')
      .populate('receiver', 'username profile')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Toplam mesaj sayısını getir
    const totalMessages = await Message.countDocuments({
      $or: [
        { sender: currentUser._id, receiver: userId },
        { sender: userId, receiver: currentUser._id },
      ],
      isDeleted: false,
    });

    // Mesajları tersine çevir (en eski önce)
    const reversedMessages = messages.reverse();

    // Okunmamış mesajları okundu olarak işaretle
    const unreadMessages = reversedMessages.filter(
      (msg) =>
        !msg.isRead &&
        msg.receiver._id.toString() === currentUser._id.toString()
    );

    for (const message of unreadMessages) {
      await message.markAsRead();
    }

    // Konuşmadaki okunmamış mesaj sayısını sıfırla
    const conversation = await Conversation.findOne({
      participants: { $all: [currentUser._id, userId] },
      isActive: true,
    });

    if (conversation) {
      await conversation.resetUnreadCount(currentUser._id);
    }

    res.json({
      success: true,
      data: {
        messages: reversedMessages,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalMessages / limit),
          totalMessages,
          hasNextPage: page * limit < totalMessages,
          hasPrevPage: page > 1,
        },
        otherUser: {
          id: otherUser._id,
          username: otherUser.username,
          profile: otherUser.profile,
        },
      },
    });
  } catch (error) {
    logger.error('Get message history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get message history',
    });
  }
};

// Konuşma listesini getir
const getConversations = async (req, res) => {
  try {
    const currentUser = req.user;
    const { page = 1, limit = 20 } = req.query;

    // Kullanıcının konuşmalarını getir
    const conversations = await Conversation.find({
      participants: currentUser._id,
      isActive: true,
    })
      .populate('participants', 'username email profile lastSeen')
      .populate('lastMessage')
      .sort({ lastMessageAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Her konuşma için diğer kullanıcıyı belirle
    const conversationsWithOtherUser = conversations.map((conversation) => {
      const otherUser = conversation.participants.find(
        (participant) =>
          participant._id.toString() !== currentUser._id.toString()
      );

      return {
        id: conversation._id,
        otherUser: {
          id: otherUser._id,
          username: otherUser.username,
          email: otherUser.email,
          profile: otherUser.profile,
          lastSeen: otherUser.lastSeen,
        },
        lastMessage: conversation.lastMessage,
        lastMessageAt: conversation.lastMessageAt,
        unreadCount:
          conversation.unreadCount.get(currentUser._id.toString()) || 0,
        createdAt: conversation.createdAt,
      };
    });

    // Toplam konuşma sayısını getir
    const totalConversations = await Conversation.countDocuments({
      participants: currentUser._id,
      isActive: true,
    });

    res.json({
      success: true,
      data: {
        conversations: conversationsWithOtherUser,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalConversations / limit),
          totalConversations,
          hasNextPage: page * limit < totalConversations,
          hasPrevPage: page > 1,
        },
      },
    });
  } catch (error) {
    logger.error('Get conversations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get conversations',
    });
  }
};

// Mesaj okundu işaretleme
const markMessageAsRead = async (req, res) => {
  try {
    const { messageId } = req.params;
    const currentUser = req.user;

    // Mesajı bul
    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
      });
    }

    // Mesajın alıcısı mı kontrol et
    if (message.receiver.toString() !== currentUser._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to mark this message as read',
      });
    }

    // Mesajı okundu olarak işaretle
    await message.markAsRead();

    // Konuşmadaki okunmamış mesaj sayısını güncelle
    const conversation = await Conversation.findOne({
      participants: { $all: [currentUser._id, message.sender] },
      isActive: true,
    });

    if (conversation) {
      await conversation.resetUnreadCount(currentUser._id);
    }

    logger.info(
      `Message marked as read: ${messageId} by ${currentUser.username}`
    );

    res.json({
      success: true,
      message: 'Message marked as read',
      data: {
        messageId: message._id,
        readAt: message.readAt,
      },
    });
  } catch (error) {
    logger.error('Mark message as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark message as read',
    });
  }
};

// Mesaj silme
const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const currentUser = req.user;

    // Mesajı bul
    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
      });
    }

    // Mesajın sahibi mi kontrol et
    if (message.sender.toString() !== currentUser._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this message',
      });
    }

    // Mesajı sil (soft delete)
    await message.softDelete(currentUser._id);

    logger.info(`Message deleted: ${messageId} by ${currentUser.username}`);

    res.json({
      success: true,
      message: 'Message deleted successfully',
    });
  } catch (error) {
    logger.error('Delete message error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete message',
    });
  }
};

// Okunmamış mesaj sayısını getir
const getUnreadCount = async (req, res) => {
  try {
    const currentUser = req.user;

    // Toplam okunmamış mesaj sayısını getir
    const totalUnread = await Message.countDocuments({
      receiver: currentUser._id,
      isRead: false,
      isDeleted: false,
    });

    // Konuşma bazında okunmamış mesaj sayılarını getir
    const conversations = await Conversation.find({
      participants: currentUser._id,
      isActive: true,
    });

    const unreadByConversation = {};
    for (const conversation of conversations) {
      const otherUserId = conversation.participants.find(
        (p) => p.toString() !== currentUser._id.toString()
      );
      const unreadCount =
        conversation.unreadCount.get(currentUser._id.toString()) || 0;
      unreadByConversation[otherUserId.toString()] = unreadCount;
    }

    res.json({
      success: true,
      data: {
        totalUnread,
        unreadByConversation,
      },
    });
  } catch (error) {
    logger.error('Get unread count error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get unread count',
    });
  }
};

module.exports = {
  sendMessage,
  getMessageHistory,
  getConversations,
  markMessageAsRead,
  deleteMessage,
  getUnreadCount,
};
