const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
    lastMessageAt: {
      type: Date,
      default: null,
    },
    unreadCount: {
      type: Map,
      of: Number,
      default: new Map(),
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    metadata: {
      // Konuşma türü (direct, group, etc.)
      type: {
        type: String,
        enum: ['direct', 'group'],
        default: 'direct',
      },
      // Konuşma adı (grup konuşmaları için)
      name: {
        type: String,
        maxlength: [100, 'Conversation name cannot exceed 100 characters'],
      },
      // Konuşma açıklaması
      description: {
        type: String,
        maxlength: [
          500,
          'Conversation description cannot exceed 500 characters',
        ],
      },
      // Konuşma avatarı
      avatar: {
        type: String,
        default: null,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
conversationSchema.index({ participants: 1 });
conversationSchema.index({ lastMessageAt: -1 });
conversationSchema.index({ isActive: 1 });

// Compound index for finding conversations between two users
conversationSchema.index({
  participants: { $all: [] },
  'metadata.type': 1,
});

// Konuşma oluşturma statik metodu
conversationSchema.statics.findOrCreateConversation = async function (
  user1Id,
  user2Id
) {
  // İki kullanıcı arasında mevcut konuşma var mı kontrol et
  const existingConversation = await this.findOne({
    participants: { $all: [user1Id, user2Id] },
    'metadata.type': 'direct',
    isActive: true,
  });

  if (existingConversation) {
    return existingConversation;
  }

  // Yeni konuşma oluştur
  const newConversation = new this({
    participants: [user1Id, user2Id],
    metadata: {
      type: 'direct',
    },
  });

  return await newConversation.save();
};

// Son mesajı güncelleme metodu
conversationSchema.methods.updateLastMessage = function (
  messageId,
  messageDate
) {
  this.lastMessage = messageId;
  this.lastMessageAt = messageDate;
  return this.save();
};

// Okunmamış mesaj sayısını artırma metodu
conversationSchema.methods.incrementUnreadCount = function (userId) {
  const currentCount = this.unreadCount.get(userId.toString()) || 0;
  this.unreadCount.set(userId.toString(), currentCount + 1);
  return this.save();
};

// Okunmamış mesaj sayısını sıfırlama metodu
conversationSchema.methods.resetUnreadCount = function (userId) {
  this.unreadCount.set(userId.toString(), 0);
  return this.save();
};

// Konuşmayı deaktive etme metodu
conversationSchema.methods.deactivate = function () {
  this.isActive = false;
  return this.save();
};

// JSON'a çevirirken unreadCount'u düzenle
conversationSchema.methods.toJSON = function () {
  const conversationObject = this.toObject();

  // unreadCount Map'ini object'e çevir
  conversationObject.unreadCount = Object.fromEntries(this.unreadCount);

  return conversationObject;
};

module.exports = mongoose.model('Conversation', conversationSchema);
