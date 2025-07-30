# Real-Time Mesajlaşma Sistemi

Modern teknolojiler kullanılarak geliştirilmiş gerçek zamanlı mesajlaşma sistemi.

##  Teknolojiler

- **Backend**: Node.js, Express.js
- **Veritabanı**: MongoDB
- **Cache**: Redis
- **Message Queue**: RabbitMQ
- **Real-time**: Socket.IO
- **Authentication**: JWT
- **Scheduling**: Cron Jobs
- **Logging**: Winston
- **Documentation**: Swagger/OpenAPI

##  Özellikler

###  Authentication
- JWT tabanlı kimlik doğrulama
- Access Token ve Refresh Token
- Güvenli oturum yönetimi

###  Real-Time Mesajlaşma
- Socket.IO ile anlık mesajlaşma
- Typing indicator
- Mesaj okundu bildirimi
- Online/offline durum takibi

###  Otomatik Sistem
- Gece 02:00'da otomatik kullanıcı eşleştirme
- RabbitMQ ile asenkron mesaj işleme
- Cron job'lar ile zamanlanmış görevler

### ⚡ Performans
- Redis cache sistemi
- Rate limiting
- Database indexing

## Socket bağlantısı 
- Web socket bağlantısını test etmek için /test-socket adresine göz atabilirsiniz

## 🛠️ Kurulum

### Gereksinimler
- Node.js (>= 18.0.0)
- MongoDB
- Redis
- RabbitMQ

### Adımlar

1. **Repository'yi klonlayın**
```bash
git clone <repository-url>
cd realtime-messaging-system
```

2. **Dependencies'leri yükleyin**
```bash
npm install
```

3. **Environment dosyasını oluşturun**
```bash
cp env.example .env
```

4. **Environment değişkenlerini düzenleyin**
```bash
# .env dosyasını düzenleyin
```

5. **Veritabanlarını başlatın**
- MongoDB
- Redis
- RabbitMQ

6. **Uygulamayı başlatın**
```bash
# Development
npm run dev

# Production
npm start
```

## API Dokümantasyonu

Uygulama çalıştıktan sonra Swagger dokümantasyonuna erişebilirsiniz:
```
/api-docs
```

## 🔧 Geliştirme

### Scripts
```bash
# Development server
npm run dev

# Production build
npm start

# Linting
npm run lint
npm run lint:fix

# Formatting
npm run format

# Testing
npm test
```

## Proje Yapısı

```
src/
├── config/          # Yapılandırma dosyaları
├── controllers/     # Route controller'ları
├── middleware/      # Express middleware'leri
├── models/          # MongoDB modelleri
├── routes/          # API route'ları
├── services/        # İş mantığı servisleri
├── utils/           # Yardımcı fonksiyonlar
├── cron/            # Cron job'lar
└── server.js        # Ana server dosyası
```

## Güvenlik

- JWT token doğrulama
- Rate limiting
- Input validation
- Security headers (Helmet)
- CORS yapılandırması

## Monitoring

- Winston logger ile detaylı loglama
- Error tracking
- Performance monitoring

## Katkıda Bulunma

1. Fork edin
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Commit edin (`git commit -m 'Add amazing feature'`)
4. Push edin (`git push origin feature/amazing-feature`)
5. Pull Request oluşturun

##  Lisans

Bu proje MIT lisansı altında lisanslanmıştır.

##  Geliştirici

**Hüseyin Onur** - Software Developer 