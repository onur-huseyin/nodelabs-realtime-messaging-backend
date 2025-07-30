// MongoDB Başlangıç Script'i
// Bu script MongoDB container'ı başlatıldığında çalışır

// Veritabanını oluştur
db = db.getSiblingDB('realtime_messaging');

// Uygulama kullanıcısını oluştur
db.createUser({
  user: 'messaging_user',
  pwd: 'messaging_password',
  roles: [
    {
      role: 'readWrite',
      db: 'realtime_messaging'
    }
  ]
});

// Koleksiyonları oluştur (opsiyonel - MongoDB otomatik oluşturur)
db.createCollection('users');
db.createCollection('messages');
db.createCollection('conversations');
db.createCollection('automessages');

print('MongoDB başlatıldı ve realtime_messaging veritabanı hazırlandı!'); 