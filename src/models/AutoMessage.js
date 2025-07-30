const mongoose = require('mongoose');

const autoMessageSchema = new mongoose.Schema(
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
    sendDate: {
      type: Date,
      required: true,
      index: true,
    },
    isQueued: {
      type: Boolean,
      default: false,
      index: true,
    },
    isSent: {
      type: Boolean,
      default: false,
      index: true,
    },
    sentAt: {
      type: Date,
      default: null,
    },
    messageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
    retryCount: {
      type: Number,
      default: 0,
    },
    maxRetries: {
      type: Number,
      default: 3,
    },
    errorMessage: {
      type: String,
      default: null,
    },
    metadata: {
      // Otomatik mesaj oluşturma bilgileri
      generatedAt: {
        type: Date,
        default: Date.now,
      },
      messageType: {
        type: String,
        enum: ['auto', 'scheduled'],
        default: 'auto',
      },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
autoMessageSchema.index({ sendDate: 1, isQueued: 1 });
autoMessageSchema.index({ isQueued: 1, isSent: 1 });
autoMessageSchema.index({ sender: 1, receiver: 1 });
autoMessageSchema.index({ createdAt: -1 });

// Compound index for cron job queries
autoMessageSchema.index({
  sendDate: 1,
  isQueued: false,
  isSent: false,
});

// Mesajı kuyruğa ekleme metodu
autoMessageSchema.methods.markAsQueued = function () {
  this.isQueued = true;
  return this.save();
};

// Mesajı gönderildi olarak işaretleme metodu
autoMessageSchema.methods.markAsSent = function (messageId) {
  this.isSent = true;
  this.sentAt = new Date();
  this.messageId = messageId;
  return this.save();
};

// Hata durumunda retry sayısını artırma metodu
autoMessageSchema.methods.incrementRetry = function (errorMessage) {
  this.retryCount += 1;
  this.errorMessage = errorMessage;
  return this.save();
};

// Mesajın gönderilmeye hazır olup olmadığını kontrol etme
autoMessageSchema.methods.isReadyToSend = function () {
  return !this.isQueued && !this.isSent && this.sendDate <= new Date();
};

// Maksimum retry sayısına ulaşıp ulaşmadığını kontrol etme
autoMessageSchema.methods.hasReachedMaxRetries = function () {
  return this.retryCount >= this.maxRetries;
};

module.exports = mongoose.model('AutoMessage', autoMessageSchema);
