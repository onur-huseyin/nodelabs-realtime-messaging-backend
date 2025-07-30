const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Real-Time Mesajlaşma Sistemi API',
      version: '1.0.0',
      description:
        'Modern teknolojiler kullanılarak geliştirilmiş gerçek zamanlı mesajlaşma sistemi API dokümantasyonu',
      contact: {
        name: 'Hüseyin Onur',
        email: 'onur.huseyin05@gmail.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: 'https://web-production-d479.up.railway.app/api',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Kullanıcı ID',
            },
            username: {
              type: 'string',
              description: 'Kullanıcı adı',
            },
            email: {
              type: 'string',
              description: 'E-posta adresi',
            },
            profile: {
              type: 'object',
              properties: {
                firstName: {
                  type: 'string',
                  description: 'Ad',
                },
                lastName: {
                  type: 'string',
                  description: 'Soyad',
                },
                bio: {
                  type: 'string',
                  description: 'Biyografi',
                },
                avatar: {
                  type: 'string',
                  description: 'Profil resmi URL',
                },
              },
            },
            isActive: {
              type: 'boolean',
              description: 'Aktif durumu',
            },
            lastSeen: {
              type: 'string',
              format: 'date-time',
              description: 'Son görülme zamanı',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Oluşturulma zamanı',
            },
          },
        },
        Message: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Mesaj ID',
            },
            sender: {
              $ref: '#/components/schemas/User',
            },
            receiver: {
              $ref: '#/components/schemas/User',
            },
            content: {
              type: 'string',
              description: 'Mesaj içeriği',
            },
            messageType: {
              type: 'string',
              enum: ['text', 'image', 'file', 'system'],
              description: 'Mesaj türü',
            },
            isRead: {
              type: 'boolean',
              description: 'Okundu durumu',
            },
            readAt: {
              type: 'string',
              format: 'date-time',
              description: 'Okunma zamanı',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Oluşturulma zamanı',
            },
          },
        },
        Conversation: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Konuşma ID',
            },
            participants: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/User',
              },
              description: 'Konuşma katılımcıları',
            },
            lastMessage: {
              $ref: '#/components/schemas/Message',
            },
            lastMessageAt: {
              type: 'string',
              format: 'date-time',
              description: 'Son mesaj zamanı',
            },
            unreadCount: {
              type: 'object',
              description: 'Okunmamış mesaj sayıları',
            },
            isActive: {
              type: 'boolean',
              description: 'Aktif durumu',
            },
          },
        },
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            message: {
              type: 'string',
              description: 'Hata mesajı',
            },
            errors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: {
                    type: 'string',
                    description: 'Hatalı alan',
                  },
                  message: {
                    type: 'string',
                    description: 'Alan hata mesajı',
                  },
                },
              },
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./src/routes/*.js', './src/controllers/*.js'], // API route dosyalarının yolu
};

const specs = swaggerJsdoc(options);

module.exports = specs;
