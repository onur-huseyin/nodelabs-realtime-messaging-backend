const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: {
      type: String,
      required: true,
      maxlength: [1000, 'Message content cannot exceed 1000 characters'],
    },
    messageType: {
      type: String,
      enum: ['text', 'image', 'file', 'system'],
      default: 'text',
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
      default: null,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    metadata: {
      // Dosya mesajları için ek bilgiler
      fileName: String,
      fileSize: Number,
      fileType: String,
      fileUrl: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
messageSchema.index({ sender: 1, receiver: 1 });
messageSchema.index({ receiver: 1, sender: 1 });
messageSchema.index({ createdAt: -1 });
messageSchema.index({ isRead: 1 });
messageSchema.index({ isDeleted: 1 });

// Compound index for conversation queries
messageSchema.index({
  $or: [
    { sender: 1, receiver: 1 },
    { sender: 1, receiver: 1 },
  ],
  createdAt: -1,
});

// Mesaj okundu işaretleme metodu
messageSchema.methods.markAsRead = function () {
  this.isRead = true;
  this.readAt = new Date();
  return this.save();
};

// Mesaj silme metodu
messageSchema.methods.softDelete = function (userId) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = userId;
  return this.save();
};

// JSON'a çevirirken silinen mesajları filtrele
messageSchema.methods.toJSON = function () {
  const messageObject = this.toObject();

  // Eğer mesaj silinmişse ve bu kullanıcı silen değilse içeriği gizle
  if (
    this.isDeleted &&
    this.deletedBy &&
    this.deletedBy.toString() !== this.sender.toString()
  ) {
    messageObject.content = '[Message deleted]';
    messageObject.metadata = null;
  }

  return messageObject;
};

module.exports = mongoose.model('Message', messageSchema);
