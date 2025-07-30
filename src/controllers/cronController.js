const cronService = require('../services/cronService');
const logger = require('../utils/logger');

// Sistem durumunu getir
const getSystemStatus = async (req, res) => {
  try {
    const status = await cronService.getSystemStatus();

    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    logger.error('Get system status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get system status',
    });
  }
};

// Mesaj planlama tetikle
const triggerMessagePlanning = async (req, res) => {
  try {
    const result = await cronService.triggerMessagePlanning();

    res.json({
      success: result.success,
      message: result.message,
    });
  } catch (error) {
    logger.error('Trigger message planning error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to trigger message planning',
    });
  }
};

// Kuyruk yönetimi tetikle
const triggerQueueManagement = async (req, res) => {
  try {
    const result = await cronService.triggerQueueManagement();

    res.json({
      success: result.success,
      message: result.message,
    });
  } catch (error) {
    logger.error('Trigger queue management error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to trigger queue management',
    });
  }
};

// Kuyruk durumunu getir
const getQueueStatus = async (req, res) => {
  try {
    const status = await cronService.getQueueStatus();

    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    logger.error('Get queue status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get queue status',
    });
  }
};

// Başarısız mesajları yeniden dene
const retryFailedMessages = async (req, res) => {
  try {
    const result = await cronService.retryFailedMessages();

    res.json({
      success: result.success,
      message: result.message,
    });
  } catch (error) {
    logger.error('Retry failed messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retry failed messages',
    });
  }
};

// Test mesajı gönder
const sendTestMessage = async (req, res) => {
  try {
    const { senderId, receiverId, content } = req.body;

    if (!senderId || !receiverId || !content) {
      return res.status(400).json({
        success: false,
        message: 'senderId, receiverId, and content are required',
      });
    }

    const result = await cronService.sendTestMessage(
      senderId,
      receiverId,
      content
    );

    res.json({
      success: result.success,
      message: result.message,
    });
  } catch (error) {
    logger.error('Send test message error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send test message',
    });
  }
};

// Servis durumlarını getir
const getServiceStatus = async (req, res) => {
  try {
    const status = cronService.getServiceStatus();

    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    logger.error('Get service status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get service status',
    });
  }
};

module.exports = {
  getSystemStatus,
  triggerMessagePlanning,
  triggerQueueManagement,
  getQueueStatus,
  retryFailedMessages,
  sendTestMessage,
  getServiceStatus,
};
