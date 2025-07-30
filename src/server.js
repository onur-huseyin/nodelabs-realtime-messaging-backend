require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const http = require('http');

// Config imports
const connectDB = require('./config/database');
const redisClient = require('./config/redis');
const rabbitMQClient = require('./config/rabbitmq');

// Service imports
const socketService = require('./services/socketService');
const cronService = require('./services/cronService');

// Middleware imports
const { errorHandler, notFound } = require('./middleware/errorHandler');
const {
  generalLimiter,
  authLimiter,
  messageLimiter,
} = require('./middleware/rateLimit');

// Route imports
const authRoutes = require('./routes/auth');
const messageRoutes = require('./routes/messages');
const onlineRoutes = require('./routes/online');
const cronRoutes = require('./routes/cron');

// Swagger
const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('./config/swagger');

// Logger
const logger = require('./utils/logger');

const app = express();
const server = http.createServer(app);

// Middleware
// Helmet middleware - sadece production'da CSP aktif
if (process.env.NODE_ENV === 'production') {
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ['\'self\''],
        styleSrc: ['\'self\'', '\'unsafe-inline\''],
        scriptSrc: ['\'self\'', '\'unsafe-inline\'', 'https://cdn.socket.io'],
        scriptSrcAttr: ['\'unsafe-inline\''],
        connectSrc: ['\'self\'', 'ws:', 'wss:'],
        imgSrc: ['\'self\'', 'data:', 'https:'],
        fontSrc: ['\'self\'', 'https:', 'data:'],
      },
    },
  }));
} else {
  // Development'ta CSP olmadan Helmet kullan
  app.use(helmet({
    contentSecurityPolicy: false,
  }));
}
app.use(
  cors({
    origin: process.env.NODE_ENV === 'production'
      ? process.env.FRONTEND_URL
      : ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000', 'null'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use('/public', express.static('public'));

// Test page route
app.get('/test-socket', (req, res) => {
  res.sendFile('public/test-socket.html', { root: __dirname + '/..' });
});

// Rate limiting
app.use(generalLimiter);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Real-Time Messaging System API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      apiDocs: '/api-docs',
      auth: '/api/auth',
      messages: '/api/messages',
      online: '/api/online',
      cron: '/api/cron'
    },
    timestamp: new Date(),
    uptime: process.uptime(),
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date(),
    uptime: process.uptime(),
  });
});

// API routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/messages', messageLimiter, messageRoutes);
app.use('/api/online', onlineRoutes);
app.use('/api/cron', cronRoutes);

// Swagger documentation
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpecs, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Real-Time Messaging API Documentation',
  })
);

// 404 handler
app.use(notFound);

// Error handler
app.use(errorHandler);

// Initialize services
const initializeServices = async () => {
  try {
    // Connect to databases
    await connectDB();
    await redisClient.connect();
    await rabbitMQClient.connect();

    // Initialize Socket.IO
    socketService.initialize(server);

    // Start cron services
    await cronService.start();

    logger.info('All services initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize services:', error);
    process.exit(1);
  }
};

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  try {
    // Stop cron services
    await cronService.stop();

    // Close RabbitMQ connection
    await rabbitMQClient.close();

    // Close Redis connection
    if (redisClient.client) {
      await redisClient.client.quit();
    }

    // Close server
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });

    // Force exit after 10 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start server
const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    await initializeServices();

    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
      logger.info(`API Documentation: http://localhost:${PORT}/api-docs`);
      logger.info(`Health Check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
