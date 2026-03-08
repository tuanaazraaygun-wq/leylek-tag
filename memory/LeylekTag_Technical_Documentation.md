# LeylekTag - Tam Teknik Dokümantasyon

## 📱 Uygulama Özeti
LeylekTag, Türkiye'de yol paylaşımı (ride-sharing) hizmeti sunan bir mobil uygulamadır. Sürücüler ve yolcular arasında eşleşme sağlar, gerçek zamanlı konum takibi, sesli/görüntülü arama ve QR kod ile yolculuk doğrulama özellikleri sunar.

---

## 🏗️ Sistem Mimarisi

### Tech Stack
- **Frontend**: React Native + Expo (SDK 52)
- **Backend**: Python FastAPI + Socket.IO (async)
- **Database**: Supabase (PostgreSQL)
- **Real-time**: Python-SocketIO
- **Maps**: Google Maps Platform
- **Video Calls**: Daily.co
- **Build**: Expo Application Services (EAS)

### Klasör Yapısı
```
/app/
├── backend/
│   ├── server.py          # Ana backend dosyası (~6500 satır)
│   ├── requirements.txt   # Python bağımlılıkları
│   └── .env              # Backend environment variables
├── frontend/
│   ├── app/
│   │   └── index.tsx     # Ana uygulama dosyası (~13000 satır)
│   ├── components/
│   │   ├── DriverDashboardPanel.tsx  # Sürücü kazanç paneli
│   │   ├── DriverPackagesModal.tsx   # Paket satın alma
│   │   ├── QRTripEndModal.tsx        # QR ile yolculuk bitirme
│   │   ├── RatingModal.tsx           # Puanlama modalı
│   │   ├── LiveMapView.tsx           # Canlı harita
│   │   ├── ChatBubble.tsx            # Mesajlaşma
│   │   ├── DailyCallScreen.tsx       # Video arama
│   │   └── ...
│   ├── contexts/
│   │   ├── SocketContext.tsx         # Socket.IO context
│   │   └── NotificationContext.tsx   # Bildirim context
│   ├── hooks/
│   │   └── useSocket.ts              # Socket.IO hook
│   └── .env              # Frontend environment variables
└── memory/
    └── PRD.md            # Ürün gereksinimleri
```

---

## 🗄️ Veritabanı Şeması (Supabase/PostgreSQL)

### users Tablosu
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(100),
  first_name VARCHAR(50),
  email VARCHAR(255),
  profile_photo TEXT,
  rating DECIMAL(3,2) DEFAULT 5.0,
  total_trips INTEGER DEFAULT 0,
  points INTEGER DEFAULT 100,
  location JSONB,  -- {latitude, longitude}
  
  -- Sürücü Bilgileri
  driver_details JSONB,  -- {kyc_status, is_verified, vehicle_brand, vehicle_model, plate_number, ...}
  driver_active_until TIMESTAMPTZ,  -- Paket bitiş zamanı
  driver_online BOOLEAN DEFAULT FALSE,
  
  -- Admin
  is_admin BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### tags Tablosu (Yolculuk Talepleri)
```sql
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Yolcu Bilgileri
  passenger_id UUID REFERENCES users(id),
  passenger_name VARCHAR(100),
  passenger_phone VARCHAR(20),
  passenger_latitude DOUBLE PRECISION,
  passenger_longitude DOUBLE PRECISION,
  
  -- Sürücü Bilgileri (eşleşme sonrası)
  driver_id UUID REFERENCES users(id),
  driver_name VARCHAR(100),
  
  -- Konum Bilgileri
  pickup_lat DOUBLE PRECISION,
  pickup_lng DOUBLE PRECISION,
  pickup_address TEXT,
  dropoff_lat DOUBLE PRECISION,
  dropoff_lng DOUBLE PRECISION,
  dropoff_address TEXT,
  
  -- Fiyat
  offered_price INTEGER,
  final_price INTEGER,
  
  -- Durum
  status VARCHAR(20) DEFAULT 'active',
  -- Durumlar: active, matched, in_progress, completed, cancelled
  
  -- Rota Bilgisi
  route_info JSONB,  -- {distance_km, duration_min, polyline}
  
  -- Tamamlanma
  completed_at TIMESTAMPTZ,
  end_method VARCHAR(50),  -- qr_dynamic, manual, auto
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### driver_package_purchases Tablosu
```sql
CREATE TABLE driver_package_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  package_id VARCHAR(50) NOT NULL,  -- 3_hours, 6_hours, etc.
  package_name VARCHAR(100) NOT NULL,
  hours INTEGER NOT NULL,
  price_tl INTEGER NOT NULL,
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  payment_method VARCHAR(50),
  payment_reference VARCHAR(255)
);
```

### trip_logs Tablosu (Yasal Kayıt)
```sql
CREATE TABLE trip_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id UUID REFERENCES tags(id),
  driver_id UUID REFERENCES users(id),
  passenger_id UUID REFERENCES users(id),
  start_latitude DOUBLE PRECISION,
  start_longitude DOUBLE PRECISION,
  end_latitude DOUBLE PRECISION,
  end_longitude DOUBLE PRECISION,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  end_method VARCHAR(50),
  driver_rating INTEGER,
  passenger_rating INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### driver_offers Tablosu
```sql
CREATE TABLE driver_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id UUID REFERENCES tags(id),
  driver_id UUID REFERENCES users(id),
  offered_price INTEGER,
  status VARCHAR(20) DEFAULT 'pending',
  -- Durumlar: pending, accepted, rejected
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 🔌 API Endpoints

### Kimlik Doğrulama
```
POST /api/auth/check-user        # Telefon kontrolü
POST /api/auth/send-otp          # SMS OTP gönder
POST /api/auth/verify-otp        # OTP doğrula
POST /api/auth/register          # Yeni kullanıcı kayıt
POST /api/auth/login             # Giriş
```

### Kullanıcı
```
GET  /api/user/{user_id}         # Kullanıcı bilgisi
POST /api/user/update-location   # Konum güncelle
POST /api/user/update-profile    # Profil güncelle
POST /api/user/block             # Kullanıcı engelle
POST /api/user/report            # Kullanıcı şikayet et
```

### Yolcu İşlemleri
```
POST /api/passenger/create-tag   # Yolculuk talebi oluştur
GET  /api/passenger/my-tags/{user_id}  # Aktif taleplerimi getir
GET  /api/passenger/offers/{tag_id}    # Gelen teklifleri getir
POST /api/passenger/accept-offer       # Teklif kabul et
POST /api/passenger/reject-offer       # Teklif reddet
POST /api/passenger/cancel-tag/{tag_id}  # Talebi iptal et
```

### Sürücü İşlemleri
```
GET  /api/driver/active-tags           # Aktif talepleri getir
POST /api/driver/send-offer            # Teklif gönder
GET  /api/driver/my-active-tag/{user_id}  # Aktif eşleşmemi getir
POST /api/driver/complete-tag/{tag_id}    # Yolculuğu tamamla
GET  /api/driver/passenger-location/{passenger_id}  # Yolcu konumu
```

### Sürücü Paketleri
```
GET  /api/driver/packages              # Paket listesi
GET  /api/driver/status?user_id=X      # Aktif durumu ve kalan süre
GET  /api/driver/dashboard?user_id=X   # Dashboard verileri
POST /api/driver/activate-package      # Paket aktifleştir
POST /api/driver/go-online             # Online ol
POST /api/driver/go-offline            # Offline ol
```

### QR Kod Sistemi
```
GET  /api/qr/trip-code?tag_id=X&user_id=X   # Trip QR oluştur (sürücü)
POST /api/qr/verify-trip                     # QR doğrula (yolcu)
GET  /api/qr/my-code?user_id=X              # Kişisel QR (eski sistem)
POST /api/qr/scan-trip-end                  # QR tarama (eski sistem)
```

### Puanlama
```
POST /api/qr/rate    # Kullanıcı puanla
```

### Arama (Daily.co)
```
POST /api/daily/create-room      # Arama odası oluştur
POST /api/daily/end-call         # Aramayı sonlandır
```

### Admin
```
GET  /api/admin/stats            # İstatistikler
GET  /api/admin/users            # Kullanıcı listesi
GET  /api/admin/kyc-requests     # KYC başvuruları
POST /api/admin/kyc/approve      # KYC onayla
POST /api/admin/kyc/reject       # KYC reddet
```

---

## 🔄 Socket.IO Events

### Client → Server
```javascript
// Kayıt
socket.emit('register', { user_id, role })

// Konum güncelleme
socket.emit('update_location', { user_id, latitude, longitude })

// Mesaj gönderme
socket.emit('send_message', { sender_id, receiver_id, message, tag_id })

// Arama başlatma
socket.emit('call_invite', { caller_id, receiver_id, call_type, tag_id })

// Arama kabul/red
socket.emit('accept_call', { call_id, caller_id, receiver_id })
socket.emit('reject_call', { call_id, caller_id, receiver_id })
socket.emit('end_call', { call_id, caller_id, receiver_id })

// Yolculuk bitirme
socket.emit('force_end_trip', { tag_id, ender_id, ender_type })
```

### Server → Client
```javascript
// Kayıt onayı
socket.on('registered', { success, user_id, room })

// Yeni teklif (sürücüye)
socket.on('new_offer', { tag_id, driver_id, offered_price })

// Teklif kabul/red (sürücüye)
socket.on('offer_accepted', { tag_id, driver_id })
socket.on('offer_rejected', { tag_id, driver_id })

// Eşleşme (her iki tarafa)
socket.on('match_found', { tag_id, driver_id, passenger_id })

// Konum güncelleme
socket.on('location_update', { user_id, latitude, longitude })

// Mesaj alma
socket.on('new_message', { sender_id, sender_name, message, tag_id })

// Arama eventleri
socket.on('incoming_call', { caller_id, caller_name, call_type, room_url })
socket.on('call_accepted', { room_url, room_name, call_type })
socket.on('call_rejected', { call_id })
socket.on('call_ended', { call_id })
socket.on('call_cancelled', { call_id })

// Puanlama modalı (QR sonrası)
socket.on('show_rating_modal', { tag_id, rate_user_id, rate_user_name })

// Yolculuk iptali
socket.on('trip_cancelled', { tag_id, cancelled_by })
socket.on('trip_completed', { tag_id })
```

---

## 💰 Sürücü Paket Sistemi

### Paket Fiyatları
```javascript
DRIVER_PACKAGES = {
  "3_hours":  { hours: 3,  price_tl: 120, name: "3 Saat" },
  "6_hours":  { hours: 6,  price_tl: 200, name: "6 Saat" },
  "9_hours":  { hours: 9,  price_tl: 260, name: "9 Saat" },
  "12_hours": { hours: 12, price_tl: 320, name: "12 Saat" },
  "24_hours": { hours: 24, price_tl: 400, name: "24 Saat" }
}
```

### Paket Akışı
1. Sürücü paket seçer
2. Ödeme yapılır (iyzico - henüz entegre değil)
3. Backend `driver_active_until` günceller
4. Sürücü `driver_online = true` olur
5. Süre dolunca otomatik `driver_online = false`

---

## 📲 QR Kod ile Yolculuk Bitirme

### Akış
```
1. Sürücü "Yolculuğu Bitir" butonuna basar
2. Dinamik QR kod oluşturulur (5 dk geçerli)
   - Format: leylektag://trip?t=TOKEN&tag=TAG_ID
3. Yolcu QR kodu tarar
4. Backend doğrular ve yolculuğu bitirir
5. Socket.IO ile her iki tarafa "show_rating_modal" gönderilir
6. Her iki kullanıcı birbirini puanlar
7. State'ler temizlenir, ana ekrana dönülür
```

### QR Token Yapısı
```python
qr_token = f"TRP-{hash[:16]}"  # Örnek: TRP-A1B2C3D4E5F6G7H8
qr_string = f"leylektag://trip?t={qr_token}&tag={tag_id}"
```

---

## 🎨 Frontend Component'ları

### DriverDashboardPanel
Sürücü ekranında haritanın üstünde gösterilen kazanç paneli:
- Kalan aktif süre (countdown)
- Bugünkü/haftalık kazanç
- Online/Offline toggle
- Günlük hedef progress
- Genişletilebilir tasarım

### DriverPackagesModal
Paket satın alma ekranı:
- 5 farklı paket seçeneği
- Modern kart tasarımı
- Ödeme entegrasyonu (yakında)

### QRTripEndModal
Yolculuk bitirme ekranı:
- Sürücü: QR kod gösterir
- Yolcu: Kamera ile tarar
- Konum kontrolü (frontend'de)

### RatingModal
Puanlama ekranı:
- 1-5 yıldız sistemi
- Her iki tarafa aynı anda gösterilir
- Puanlama sonrası state temizlenir

### LiveMapView
Canlı harita:
- Kullanıcı ve karşı taraf konumu
- Rota çizimi
- Mesafe ve süre bilgisi
- Arama/mesaj/QR butonları

---

## 🔐 Güvenlik

### Kimlik Doğrulama
- SMS OTP ile telefon doğrulama
- Test modda sabit kod: 123456

### KYC (Sürücü Onayı)
- Kimlik fotoğrafı
- Ehliyet fotoğrafı
- Araç ruhsat fotoğrafı
- Admin manuel onayı

### Socket.IO Güvenliği
- Kullanıcı ID ile room'a join
- Event'ler sadece ilgili room'lara gönderilir

---

## 🌐 Environment Variables

### Backend (.env)
```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=eyJhbGciOi...
DAILY_API_KEY=xxx
NETGSM_USERNAME=xxx
NETGSM_PASSWORD=xxx
NETGSM_HEADER=xxx
```

### Frontend (.env)
```
EXPO_PUBLIC_BACKEND_URL=https://leylektag-debug.preview.emergentagent.com
EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=xxx
```

---

## 📊 Uygulama Durumları

### Yolcu Durumları
1. **Rol Seçimi** - Yolcu/Sürücü seç
2. **Tag Oluşturma** - Nereden nereye
3. **Teklif Bekleme** - Sürücü tekliflerini bekle
4. **Eşleşme** - Sürücü ile eşleşildi
5. **Yolculuk** - Aktif yolculuk
6. **Puanlama** - Yolculuk sonrası

### Sürücü Durumları
1. **Rol Seçimi** - Yolcu/Sürücü seç
2. **KYC Kontrolü** - Onay durumu
3. **Paket Kontrolü** - Aktif paket var mı
4. **Teklif Listesi** - Aktif talepleri gör
5. **Eşleşme** - Yolcu ile eşleşildi
6. **Yolculuk** - Aktif yolculuk
7. **QR Gösterme** - Yolculuk bitirme
8. **Puanlama** - Yolculuk sonrası

---

## 🚀 Gelecek Özellikler

1. **iyzico Ödeme Entegrasyonu** - Kart ile paket satın alma
2. **Push Notifications** - Yeni teklif/mesaj bildirimleri
3. **Mapbox 3D Harita** - Daha iyi harita deneyimi
4. **Otomatik Mesaj Silme** - Eski mesajları temizle
5. **Admin Panel Geliştirmeleri** - Trip logs görüntüleme

---

*Son güncelleme: Aralık 2025*
