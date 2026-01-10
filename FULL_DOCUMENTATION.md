# 🚗 LEYLEK TAG - Tam Uygulama Dokümantasyonu

## 📋 İÇİNDEKİLER
1. [Genel Bakış](#1-genel-bakış)
2. [Teknoloji Stack](#2-teknoloji-stack)
3. [Proje Yapısı](#3-proje-yapısı)
4. [Veritabanı Şeması](#4-veritabanı-şeması)
5. [API Endpoints](#5-api-endpoints)
6. [Socket Events](#6-socket-events)
7. [Akış Diyagramları](#7-akış-diyagramları)
8. [Frontend Bileşenleri](#8-frontend-bileşenleri)
9. [Hooks](#9-hooks)
10. [Ortam Değişkenleri](#10-ortam-değişkenleri)
11. [Sunucu Bilgileri](#11-sunucu-bilgileri)
12. [Önemli Notlar](#12-önemli-notlar)

---

## 1. GENEL BAKIŞ

**Leylek TAG**, yolcular ve sürücüler arasında anlık teklif tabanlı eşleştirme yapan bir mobil uygulamadır.

### Temel Özellikler:
- 📍 Konum tabanlı teklif sistemi (20km radius)
- 💰 Anlık teklif gönderme/alma
- 🗺️ Gerçek zamanlı harita takibi
- 📞 Sesli/Görüntülü arama (Daily.co)
- 💬 Anlık mesajlaşma (Supabase Realtime)
- ⭐ Puanlama sistemi

### Kullanıcı Rolleri:
- **Yolcu (Passenger)**: Teklif ister, gelen teklifleri görür, kabul/red eder
- **Sürücü (Driver)**: Yolcu isteklerini görür, teklif gönderir

---

## 2. TEKNOLOJİ STACK

### Frontend (Mobil Uygulama)
| Teknoloji | Versiyon | Kullanım |
|-----------|----------|----------|
| Expo | 54.0.0 | React Native framework |
| React Native | 0.76.9 | Mobil UI |
| TypeScript | ~5.8.3 | Tip güvenliği |
| Expo Router | ~4.1.5 | Navigasyon |
| Socket.IO Client | 4.8.1 | Realtime iletişim |
| react-native-maps | 1.18.0 | Harita |
| @daily-co/daily-react-native | ^0.72.0 | Video/Sesli arama |
| @supabase/supabase-js | ^2.49.4 | Auth & Realtime |

### Backend (API Server)
| Teknoloji | Kullanım |
|-----------|----------|
| FastAPI | Python web framework |
| Supabase | PostgreSQL veritabanı |
| Uvicorn | ASGI server |

### Socket Server (VPS)
| Teknoloji | Kullanım |
|-----------|----------|
| Python Socket.IO | Realtime events |
| Uvicorn | ASGI server |

### Harici Servisler
| Servis | Kullanım |
|--------|----------|
| Supabase | Auth, Database, Realtime |
| Daily.co | Video/Sesli arama |
| Google Maps | Harita & Places API |
| OSRM | Rota hesaplama |

---

## 3. PROJE YAPISI

```
/app/
├── backend/
│   ├── server.py              # Ana FastAPI sunucusu
│   ├── requirements.txt       # Python bağımlılıkları
│   └── .env                   # Backend ortam değişkenleri
│
├── frontend/
│   ├── app/
│   │   ├── _layout.tsx        # Root layout (SocketProvider)
│   │   └── index.tsx          # ANA DOSYA (~10000 satır) - Tüm ekranlar
│   │
│   ├── components/
│   │   ├── ChatBubble.tsx         # Mesajlaşma (Supabase Realtime)
│   │   ├── DailyCallScreen.tsx    # Video/Sesli arama ekranı
│   │   ├── DriverOfferScreen.tsx  # Sürücü teklif ekranı (harita + kartlar)
│   │   ├── EndTripModal.tsx       # Yolculuk bitirme modalı
│   │   ├── ForceEndConfirmModal.tsx
│   │   ├── IncomingCallScreen.tsx # Gelen arama ekranı
│   │   ├── OutgoingCallScreen.tsx # Aranan ekranı
│   │   ├── LiveMapView.tsx        # Eşleşme sonrası harita
│   │   ├── SearchingMapView.tsx   # Teklif bekleme haritası
│   │   ├── PlacesAutocomplete.tsx # Google Places
│   │   ├── RatingModal.tsx        # Puanlama modalı
│   │   ├── Logo.tsx
│   │   ├── AdminPanel.tsx
│   │   ├── LegalPages.tsx
│   │   ├── KVKKComponents.tsx
│   │   ├── SplashScreen.tsx
│   │   └── VideoCall.tsx
│   │
│   ├── contexts/
│   │   └── SocketContext.tsx  # Socket.IO bağlantı yönetimi
│   │
│   ├── hooks/
│   │   ├── useSocket.ts       # Socket event handlers
│   │   ├── useOffers.ts       # Teklif state yönetimi
│   │   ├── useCall.ts         # Arama yönetimi
│   │   └── usePushNotifications.ts
│   │
│   ├── app.json               # Expo yapılandırması
│   ├── eas.json               # EAS Build yapılandırması
│   ├── package.json
│   └── .env                   # Frontend ortam değişkenleri
│
└── (VPS: 157.173.113.156)
    └── /opt/leylek-socket/
        └── socket_server.py   # Realtime Socket Server
```

---

## 4. VERİTABANI ŞEMASI (Supabase PostgreSQL)

### users
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(100),
  role VARCHAR(20) DEFAULT 'passenger',  -- 'passenger' | 'driver'
  rating DECIMAL(3,2) DEFAULT 5.0,
  total_ratings INTEGER DEFAULT 0,
  points INTEGER DEFAULT 100,
  city VARCHAR(100),
  vehicle_model VARCHAR(100),
  vehicle_color VARCHAR(50),
  vehicle_plate VARCHAR(20),
  push_token TEXT,
  profile_photo TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### tags (Yolculuk Talepleri)
```sql
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  passenger_id UUID REFERENCES users(id),
  passenger_name VARCHAR(100),
  driver_id UUID REFERENCES users(id),
  driver_name VARCHAR(100),
  status VARCHAR(20) DEFAULT 'pending',
  -- Status: pending -> offers_received -> matched -> in_progress -> completed/cancelled
  
  -- Konum bilgileri
  pickup_location TEXT,
  pickup_lat DECIMAL(10,8),
  pickup_lng DECIMAL(11,8),
  dropoff_location TEXT,
  dropoff_lat DECIMAL(10,8),
  dropoff_lng DECIMAL(11,8),
  
  -- Eşleşme bilgileri
  accepted_offer_id UUID,
  final_price DECIMAL(10,2),
  matched_at TIMESTAMP,
  
  -- Daily.co arama
  daily_room_name VARCHAR(100),
  daily_room_url TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### offers (Teklifler)
```sql
CREATE TABLE offers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tag_id UUID REFERENCES tags(id),
  driver_id UUID REFERENCES users(id),
  driver_name VARCHAR(100),
  price DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  -- Status: pending -> accepted/rejected
  
  driver_lat DECIMAL(10,8),
  driver_lng DECIMAL(11,8),
  
  created_at TIMESTAMP DEFAULT NOW()
);
```

### chat_messages (Mesajlar - DEPRECATED, Supabase Realtime kullanılıyor)
```sql
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tag_id UUID REFERENCES tags(id),
  sender_id UUID REFERENCES users(id),
  sender_name VARCHAR(100),
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### daily_rooms (Arama Odaları)
```sql
CREATE TABLE daily_rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tag_id UUID REFERENCES tags(id),
  room_name VARCHAR(100) UNIQUE,
  room_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP
);
```

---

## 5. API ENDPOINTS

### Base URL
- **Development**: `https://riderlink-1.preview.emergentagent.com/api`
- **Backend Port**: 8001

### Auth Endpoints
```
POST /api/auth/send-code
  Body: { phone: "+905551234567" }
  Response: { success: true, message: "Kod gönderildi" }

POST /api/auth/verify-code
  Body: { phone: "+905551234567", code: "123456" }
  Response: { success: true, user: {...}, token: "..." }

POST /api/auth/register
  Body: { phone, name, city, role, vehicle_model?, vehicle_color?, vehicle_plate? }
  Response: { success: true, user: {...} }
```

### User Endpoints
```
GET /api/user/{user_id}
  Response: { id, name, phone, role, rating, points, ... }

PUT /api/user/{user_id}
  Body: { name?, city?, vehicle_model?, ... }
  Response: { success: true, user: {...} }

POST /api/user/{user_id}/push-token
  Body: { push_token: "ExponentPushToken[...]" }
```

### Tag (Yolculuk) Endpoints
```
POST /api/tag/create
  Query: user_id
  Body: { pickup_location, pickup_lat, pickup_lng, dropoff_location, dropoff_lat, dropoff_lng }
  Response: { success: true, tag: {...} }

GET /api/tag/active?user_id={user_id}
  Response: { tag: {...} | null }

GET /api/tag/{tag_id}
  Response: { tag: {...} }

POST /api/tag/{tag_id}/cancel?user_id={user_id}
  Response: { success: true }

POST /api/tag/{tag_id}/complete?user_id={user_id}
  Response: { success: true }
```

### Offer Endpoints
```
POST /api/driver/send-offer?user_id={driver_id}
  Body: { tag_id, price, latitude, longitude }
  Response: { success: true, offer_id: "..." }

POST /api/passenger/accept-offer
  Query: user_id, offer_id, driver_id?, tag_id?
  Response: { success: true, driver_id: "..." }

POST /api/passenger/dismiss-offer?user_id={user_id}&offer_id={offer_id}
  Response: { success: true }

GET /api/driver/pending-tags?user_id={driver_id}&lat={lat}&lng={lng}&radius_km=20
  Response: { tags: [...] }
```

### Daily.co (Arama) Endpoints
```
POST /api/daily/create-room
  Body: { tag_id }
  Response: { room_name, room_url }

GET /api/daily/room/{tag_id}
  Response: { room_name, room_url }
```

### Rating Endpoint
```
POST /api/rating/submit
  Body: { tag_id, rater_id, rated_id, rating (1-5), comment? }
  Response: { success: true }
```

---

## 6. SOCKET EVENTS

### Socket Server
- **URL**: `wss://socket.leylektag.com` veya `http://157.173.113.156:3001`
- **Log dosyası**: `/var/log/socket_server.log`

### Client -> Server Events

#### register
```javascript
socket.emit('register', {
  user_id: "uuid",
  role: "passenger" | "driver",
  latitude: 41.0082,
  longitude: 28.9784
});
```

#### create_tag_request (Yolcu teklif isteği)
```javascript
socket.emit('create_tag_request', {
  request_id: "unique_id",      // Frontend'de üretilen unique ID
  tag_id: "uuid",
  passenger_id: "uuid",
  passenger_name: "Ahmet",
  pickup_location: "Kadıköy",
  pickup_lat: 40.99,
  pickup_lng: 29.02,
  dropoff_location: "Taksim",
  dropoff_lat: 41.03,
  dropoff_lng: 28.98
});
```

#### send_offer (Sürücü teklif gönderme)
```javascript
socket.emit('send_offer', {
  request_id: "unique_id",      // create_tag_request'teki request_id
  tag_id: "uuid",
  driver_id: "uuid",
  driver_name: "Mehmet",
  driver_rating: 4.8,
  passenger_id: "uuid",
  price: 150,
  vehicle_model: "Toyota Corolla",
  vehicle_color: "Beyaz"
});
```

#### accept_offer (Yolcu teklif kabul)
```javascript
socket.emit('accept_offer', {
  request_id: "unique_id",
  offer_id: "uuid",
  tag_id: "uuid",
  driver_id: "uuid",
  passenger_id: "uuid"
});
```

#### location_update (Konum güncelleme)
```javascript
socket.emit('location_update', {
  user_id: "uuid",
  latitude: 41.0082,
  longitude: 28.9784,
  heading: 180  // Yön (derece)
});
```

#### subscribe_location (Konum takibi başlat)
```javascript
socket.emit('subscribe_location', {
  target_id: "uuid"  // Takip edilecek kullanıcı
});
```

#### call_invite (Arama başlat)
```javascript
socket.emit('call_invite', {
  caller_id: "uuid",
  receiver_id: "uuid",
  tag_id: "uuid",
  call_type: "video" | "audio",
  room_url: "https://daily.co/room_name"
});
```

#### call_accept / call_reject / call_end
```javascript
socket.emit('call_accept', { caller_id, receiver_id, tag_id, room_url });
socket.emit('call_reject', { caller_id, receiver_id });
socket.emit('call_end', { caller_id, receiver_id, tag_id });
```

#### trip_end_request (Yolculuk bitirme isteği)
```javascript
socket.emit('trip_end_request', {
  tag_id: "uuid",
  requester_id: "uuid",
  requester_role: "passenger" | "driver"
});
```

### Server -> Client Events

#### new_tag (Yeni yolcu isteği - sürücülere)
```javascript
socket.on('new_tag', (data) => {
  // data: { tag_id, request_id, passenger_id, passenger_name, pickup_*, dropoff_*, ... }
});
```

#### new_offer (Yeni teklif - yolcuya)
```javascript
socket.on('new_offer', (data) => {
  // data: { offer_id, request_id, tag_id, driver_id, driver_name, price, ... }
});
```

#### offer_accepted (Teklif kabul edildi - sürücüye)
```javascript
socket.on('offer_accepted', (data) => {
  // data: { offer_id, tag_id, passenger_id }
});
```

#### tag_matched (Eşleşme tamamlandı - her ikisine)
```javascript
socket.on('tag_matched', (data) => {
  // data: { tag_id, driver_id, passenger_id, daily_room_url }
});
```

#### location_updated (Konum güncellemesi)
```javascript
socket.on('location_updated', (data) => {
  // data: { user_id, latitude, longitude, heading }
});
```

#### call_incoming (Gelen arama)
```javascript
socket.on('call_incoming', (data) => {
  // data: { caller_id, caller_name, tag_id, call_type, room_url }
});
```

#### call_accepted / call_rejected / call_ended
```javascript
socket.on('call_accepted', (data) => { /* room_url */ });
socket.on('call_rejected', (data) => { /* caller_id */ });
socket.on('call_ended', (data) => { /* tag_id */ });
```

#### trip_end_requested (Karşı taraf bitirmek istiyor)
```javascript
socket.on('trip_end_requested', (data) => {
  // data: { tag_id, requester_id, requester_role }
});
```

---

## 7. AKIŞ DİYAGRAMLARI

### 7.1 Teklif Akışı
```
┌─────────────┐     create_tag_request     ┌───────────────┐
│   YOLCU     │ ─────────────────────────> │ SOCKET SERVER │
│             │                            │               │
│ Teklif İste │                            │  active_      │
│             │                            │  requests{}   │
└─────────────┘                            └───────────────┘
                                                  │
                                                  │ new_tag (broadcast to drivers)
                                                  ▼
                                           ┌───────────────┐
                                           │   SÜRÜCÜLER   │
                                           │ (20km radius) │
                                           └───────────────┘
                                                  │
                                                  │ send_offer
                                                  ▼
┌─────────────┐      new_offer             ┌───────────────┐
│   YOLCU     │ <───────────────────────── │ SOCKET SERVER │
│             │                            │               │
│ Teklif Geldi│                            │               │
└─────────────┘                            └───────────────┘
      │
      │ accept_offer (socket) + API call
      ▼
┌─────────────┐     offer_accepted         ┌───────────────┐
│   SÜRÜCÜ    │ <───────────────────────── │    BACKEND    │
│             │                            │               │
│ Kabul Edildi│     tag_matched            │ tags.status=  │
│             │ <───────────────────────── │  'matched'    │
└─────────────┘                            └───────────────┘
```

### 7.2 Arama Akışı
```
┌─────────────┐     call_invite            ┌───────────────┐
│  ARAYAN     │ ─────────────────────────> │ SOCKET SERVER │
│             │                            └───────────────┘
│             │                                   │
└─────────────┘                                   │ call_incoming
                                                  ▼
                                           ┌───────────────┐
                                           │   ARANAN      │
                                           │ Gelen Arama   │
                                           └───────────────┘
                                                  │
                                                  │ call_accept
                                                  ▼
┌─────────────┐     call_accepted          ┌───────────────┐
│  ARAYAN     │ <───────────────────────── │ SOCKET SERVER │
└─────────────┘                            └───────────────┘
      │                                           │
      └──────────────── Daily.co ─────────────────┘
                    (Video/Sesli Arama)
```

### 7.3 Mesajlaşma Akışı (Supabase Realtime)
```
┌─────────────┐                            ┌───────────────┐
│  GÖNDEREN   │ ────── broadcast ────────> │   SUPABASE    │
│             │                            │   REALTIME    │
└─────────────┘                            └───────────────┘
                                                  │
                                                  │ broadcast
                                                  ▼
                                           ┌───────────────┐
                                           │    ALICI      │
                                           │ Yeni Mesaj    │
                                           └───────────────┘

Channel: `chat:${tagId}`
Event: 'message'
Payload: { sender_id, sender_name, message, timestamp }
```

---

## 8. FRONTEND BİLEŞENLERİ

### Ana Dosya: `/app/frontend/app/index.tsx`
Bu dosya ~10.000 satır ve tüm ekranları içerir:

#### Ekranlar (Screens)
| Ekran | Açıklama |
|-------|----------|
| `SplashScreen` | Yükleme ekranı |
| `LoginScreen` | Telefon ile giriş |
| `RegisterScreen` | Kayıt formu |
| `RoleSelectScreen` | Yolcu/Sürücü seçimi |
| `PassengerDashboard` | Yolcu ana ekranı |
| `DriverDashboard` | Sürücü ana ekranı |

#### Yolcu Akışı (PassengerDashboard)
1. **Adres Seçimi**: Nereden/Nereye
2. **Teklif Bekleme**: Harita + bekleme animasyonu
3. **Teklif Listesi**: Gelen teklifler kartlar halinde
4. **Eşleşme Sonrası**: LiveMapView + Chat + Arama butonları

#### Sürücü Akışı (DriverDashboard)
1. **DriverOfferScreen**: Harita + yolcu istekleri listesi
2. **Teklif Gönderme**: Fiyat girişi + gönder butonu
3. **Eşleşme Sonrası**: LiveMapView + Chat + Arama butonları

### Bileşen Detayları

#### ChatBubble.tsx
```typescript
// Supabase Realtime Broadcast kullanır (Socket.IO DEĞİL)
// Mesajlar veritabanına KAYDEDILMEZ - sadece anlık

Props:
- tagId: string
- currentUserId: string
- currentUserName: string
- otherUserName: string
- isDriver: boolean
```

#### DailyCallScreen.tsx
```typescript
// Daily.co video/sesli arama

Props:
- roomUrl: string
- userName: string
- onLeave: () => void
- isVideo: boolean
```

#### DriverOfferScreen.tsx
```typescript
// Sürücü için harita + yolcu istekleri listesi

Props:
- driverLocation: { latitude, longitude }
- requests: PassengerRequest[]
- onSendOffer: (requestId, price) => Promise<boolean>
- onDismissRequest: (requestId) => void
```

#### LiveMapView.tsx
```typescript
// Eşleşme sonrası harita

Props:
- userLocation: { latitude, longitude }
- otherLocation: { latitude, longitude }
- destination: { latitude, longitude }
- isDriver: boolean
```

---

## 9. HOOKS

### useSocket.ts
```typescript
// Socket.IO event yönetimi

Input (Options):
- userId: string
- role: 'passenger' | 'driver'
- onNewTag?: (data) => void        // Sürücü: Yeni yolcu isteği
- onNewOffer?: (data) => void      // Yolcu: Yeni teklif
- onOfferAccepted?: (data) => void // Sürücü: Teklif kabul edildi
- onTagMatched?: (data) => void    // Her ikisi: Eşleşme
- onCallIncoming?: (data) => void  // Gelen arama
- onLocationUpdated?: (data) => void

Output:
- socket: Socket instance
- isConnected: boolean
- emitCreateTagRequest: (data) => void
- emitSendOffer: (data) => void
- emitAcceptOffer: (data) => void
- emitCallInvite: (data) => void
- emitLocationUpdate: (data) => void
```

### useOffers.ts
```typescript
// Teklif state yönetimi (Socket listener YOK - sadece state)

Input (Options):
- userId: string
- tagId?: string
- requestId?: string

Output:
- offers: Offer[]
- addOffer: (offer) => void        // Socket'ten teklif ekle
- acceptOffer: (offerId, driverId, tagId) => Promise<boolean>
- rejectOffer: (offerId, driverId) => Promise<boolean>
- clearOffers: () => void
```

### SocketContext.tsx
```typescript
// Socket.IO bağlantı yönetimi

// Socket URL
const SOCKET_URL = 'https://socket.leylektag.com';

// Bağlantı durumu
- isConnected: boolean
- socket: Socket | null

// Emit fonksiyonları
- emit: (event, data) => void
- emitSendOffer: (data) => void
- emitAcceptOffer: (data) => void
- emitRejectOffer: (data) => void
- emitCallInvite: (data) => void
- emitCallAccept: (data) => void
```

---

## 10. ORTAM DEĞİŞKENLERİ

### Frontend (.env)
```env
# Expo
EXPO_TUNNEL_SUBDOMAIN=riderlink-1
EXPO_PACKAGER_HOSTNAME=https://riderlink-1.preview.emergentagent.com
EXPO_PACKAGER_PROXY_URL=https://riderlink-1.preview.emergentagent.com

# Backend
EXPO_PUBLIC_BACKEND_URL=https://riderlink-1.preview.emergentagent.com

# EAS Build
EXPO_TOKEN=S6hM0DkhaviyggW6pRn2Sfq7NIAPr5GkXRpj5cYI

# Supabase
EXPO_PUBLIC_SUPABASE_URL=https://ujvploftywsxprlzejgc.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...

# Google Maps
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSyBk...

# Socket
EXPO_PUBLIC_SOCKET_URL=https://socket.leylektag.com
```

### Backend (.env)
```env
# Supabase
SUPABASE_URL=https://ujvploftywsxprlzejgc.supabase.co
SUPABASE_KEY=eyJhbGc...

# Daily.co
DAILY_API_KEY=...

# MongoDB (kullanılmıyor)
MONGO_URL=mongodb://localhost:27017
```

---

## 11. SUNUCU BİLGİLERİ

### Ana Sunucu (Emergent)
- **URL**: https://riderlink-1.preview.emergentagent.com
- **Frontend**: Port 3000
- **Backend**: Port 8001 (/api/* prefix)

### Socket Server (VPS)
- **IP**: 157.173.113.156
- **Port**: 3001
- **Domain**: socket.leylektag.com
- **SSH User**: root
- **SSH Pass**: 2VakZUbXY00D7s5
- **Dosya Yolu**: /opt/leylek-socket/socket_server.py
- **Log**: /var/log/socket_server.log

### Supervisor Komutları
```bash
# Backend
sudo supervisorctl restart backend
sudo supervisorctl status backend
tail -f /var/log/supervisor/backend.err.log

# Frontend (Expo)
sudo supervisorctl restart expo
tail -f /var/log/supervisor/expo.out.log
```

### Socket Server Yönetimi (VPS)
```bash
# SSH bağlantısı
ssh root@157.173.113.156

# Logları görüntüle
tail -f /var/log/socket_server.log

# Servisi yeniden başlat
pkill -f socket_server.py
cd /opt/leylek-socket && nohup python3 socket_server.py > /var/log/socket_server.log 2>&1 &

# Çalışan process kontrol
ps aux | grep socket
```

---

## 12. ÖNEMLİ NOTLAR

### ⚠️ Kritik Bilgiler

1. **index.tsx ÇOK BÜYÜK**: ~10.000 satır. Dikkatli değişiklik yapın.

2. **Socket ID (SID) Değişebilir**: Kullanıcı yeniden bağlandığında SID değişir. Her zaman `users[user_id]` listesinden güncel SID'leri kullanın.

3. **request_id ÖNEMLİ**: Teklif akışında `request_id` ile eşleştirme yapılır. Her `create_tag_request` için unique bir `request_id` oluşturulmalı.

4. **Chat Supabase Kullanır**: Mesajlaşma Socket.IO ile DEĞİL, Supabase Realtime Broadcast ile çalışır.

5. **Daily.co Odaları**: Her eşleşme için backend'den `/api/daily/create-room` ile oda oluşturulmalı.

### 🔧 Sık Karşılaşılan Sorunlar

| Sorun | Çözüm |
|-------|-------|
| Teklif ulaşmıyor | Socket server loglarını kontrol et, SID güncel mi? |
| Eşleşme olmuyor | Backend `/api/passenger/accept-offer` çağrılıyor mu? |
| Arama açılmıyor | Daily.co room URL doğru mu? |
| Chat çalışmıyor | Supabase Realtime channel doğru mu? |
| Konum güncellenmiyor | `location_update` eventi emit ediliyor mu? |

### 📱 APK Build
```bash
cd /app/frontend
EXPO_TOKEN=... npx eas build --platform android --profile preview
```

### 🧪 Test Etme
1. İki farklı telefonla test edin (Yolcu + Sürücü)
2. Socket server loglarını takip edin
3. Backend loglarını takip edin
4. Expo loglarını takip edin

---

## 📞 İLETİŞİM & DESTEK

Sorularınız için bu dokümantasyona başvurun. Çözemediğiniz sorunlar için detaylı log bilgisi ile destek isteyin.

**Başarılar! 🚀**
