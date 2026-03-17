# Leylek TAG – Tam Proje Yapı Analizi

Bu doküman, uygulamanın **tam mimarisini**, **hangi parçanın nereye bağlı olduğunu** ve **akışı bozmadan değişiklik yapmak için dikkat edilmesi gerekenleri** tek yerde toplar. Claude AI veya başka bir araçla geliştirme yaparken referans olarak kullanılabilir.

---

## 1. Genel Mimari Özet

| Katman | Teknoloji | Konum | Açıklama |
|--------|-----------|--------|----------|
| **Frontend** | Expo 54, React Native, Expo Router | `frontend/` | Mobil uygulama (iOS/Android) |
| **Backend API** | FastAPI (Python) | `backend/server.py` | Tüm REST API + Socket.IO sunucusu |
| **Veritabanı** | Supabase (PostgreSQL) | Harici | users, tags, offers, calls, vb. |
| **Realtime** | Socket.IO + Supabase Realtime | Backend + Frontend | Çağrı, tag, konum, mesaj |
| **Ses/Görüntü** | Agora | Backend token, Frontend SDK | Sesli/görüntülü arama |
| **Push** | Expo/Firebase | Backend servis | Bildirimler |

**Önemli URL’ler (production):**
- **API:** `https://api.leylektag.com` → tüm istekler `/api` prefix’i ile (örn. `https://api.leylektag.com/api/auth/check-user`)
- **Socket:** `https://socket.leylektag.com` → path: `/socket.io` (frontend’de sabit)
- **Not:** Backend `server.py` içinde Socket.IO path’i `/api/socket.io` olarak tanımlı; production’da socket ayrı bir host’ta (`socket.leylektag.com`) çalışıyor olabilir. Frontend her zaman `socket.leylektag.com` + `/socket.io` kullanıyor.

---

## 2. Dizin Yapısı (Önemli Dosyalar)

```
leylek-tag/
├── backend/
│   ├── server.py              # Ana uygulama: FastAPI + Socket.IO (~9k+ satır)
│   ├── supabase_client.py     # Supabase client
│   ├── database.py            # DB init (Mongo eski; Supabase kullanılıyor)
│   ├── models.py              # Pydantic modelleri
│   ├── call_service.py        # Çağrı yaşam döngüsü, calls tablosu
│   ├── route_service.py       # Rota/geo yardımcıları
│   ├── services/
│   │   ├── push_notification_service.py
│   │   ├── iyzico_payment_service.py
│   │   ├── turkey_ip_service.py
│   │   └── error_handler.py
│   ├── templates/             # HTML: landing, kvkk, gizlilik, hesap-silme, kullanim-sartlari
│   ├── supabase_schema.sql    # PostgreSQL şeması
│   ├── requirements.txt
│   └── .env                   # Git’te yok; SUPABASE_*, GOOGLE_*, IYZICO_*, vb.
│
├── frontend/
│   ├── app/                   # Expo Router (ekranlar)
│   │   ├── _layout.tsx        # Root: SafeAreaProvider → NotificationProvider → SocketProvider → Stack
│   │   ├── index.tsx          # Ana ekran (harita, auth, yolcu/şoför akışı, çağrı UI)
│   │   ├── admin.tsx          # Admin panel
│   │   ├── profile.tsx        # Profil
│   │   ├── history.tsx        # Geçmiş (yolcu/şoför)
│   │   ├── driver-verify.tsx  # Şoför doğrulama
│   │   ├── delete-account.tsx # Hesap silme
│   │   ├── kvkk.tsx / terms.tsx / privacy.tsx
│   │   └── ...
│   ├── components/            # Tüm UI bileşenleri
│   ├── contexts/
│   │   ├── SocketContext.tsx  # Tek socket instance, SOCKET_URL sabit
│   │   └── NotificationContext.tsx
│   ├── hooks/
│   │   ├── useSocket.ts       # Socket event dinleyicileri + emit
│   │   ├── useCall.ts         # Çağrı API + akış
│   │   ├── useOffers.ts       # Teklif kabul/red
│   │   ├── useAgoraEngine.ts  # Agora token + SDK
│   │   └── usePushNotifications.ts
│   ├── stores/
│   │   └── callStore.ts
│   ├── lib/
│   │   └── supabase.ts        # Supabase client, konum/trip channel’ları, presence
│   ├── app.json               # extra.backendUrl, scheme, izinler
│   ├── eas.json               # EAS build; preview: EXPO_PUBLIC_BACKEND_URL
│   └── .env                   # Git’te yok; EXPO_PUBLIC_*
│
├── sql_migrations/
├── website_files/
├── memory/
├── DEPLOYMENT_GUIDE.md
└── FULL_DOCUMENTATION.md
```

---

## 3. Backend – API ve Socket Bağlantıları

### 3.1 API Base

- **Prefix:** Tüm HTTP route’lar `/api` altında (örn. `/api/auth/check-user`).
- **Socket:** Backend’de `socketio_path='/api/socket.io'`; production frontend ise `https://socket.leylektag.com` + `path: '/socket.io'` kullanıyor (ayrı deployment).

### 3.2 Ana API Grupları (server.py)

| Grup | Örnek endpoint’ler | Frontend’de kullanım |
|------|--------------------|------------------------|
| **Auth** | `/api/auth/check-user`, `send-otp`, `verify-otp`, `register`, `verify-pin`, `login`, `reset-pin`, `cities` | app/index.tsx, giriş/kayıt akışı |
| **User** | `/api/user/{id}`, `update-location`, `register-driver`, `block`, `report`, `update-profile`, `register-push-token`, `delete-account`, `blocked-list` | index, profile, delete-account, push hook |
| **Admin** | `/api/admin/check`, `kyc/*`, `reports`, `dashboard`, `users`, `settings`, `notifications`, `calls`, `tags`, `send-notification`, vb. | AdminPanel.tsx, app/admin.tsx |
| **Driver** | `/api/driver/kyc/submit`, `kyc/status`, `requests`, `active-trip`, `send-offer`, `start-trip`, `complete-trip`, `nearby-activity`, vb. | index, DriverActivityMap, PassengerWaitingScreen, driver ekranları |
| **Passenger** | `/api/passenger/create-tag`, `create-request`, `history`, `active-tag`, `offers`, `accept-offer`, `cancel-tag`, `driver-location` | index, useOffers, PassengerWaitingScreen |
| **Trip** | `/api/trip/force-end`, `rate`, `request-end`, `respond-end-request`, `check-end-request`, `complete-qr` | index, QRTripEndModal, RatingModal |
| **Voice/Calls** | `/api/voice/get-token`, `start-call`, `accept-call`, `reject-call`, `end-call`, `check-call-status`, `history` | useCall, PhoneCallScreen, CallScreen*, WhatsAppCallScreen |
| **Agora** | `/api/agora/token` | useAgoraEngine, CallScreenV2, VideoCall |
| **Calls (kayıt)** | `/api/calls/start`, `/api/calls/end` | index, WhatsAppCallScreen, DailyCallScreen |
| **QR/Ödeme** | `/api/qr/check-proximity`, `verify-trip`, `scan-trip-end`, `rate-user`, `trip-code`, `my-code` | QRTripEndModal, RatingModal |
| **Payment** | `/api/payment/create-request`, `verify` | Backend/ödeme akışı |
| **Community** | `/api/community/messages`, `online-count`, `message`, `like`, `report` | CommunityScreen |
| **Dispatch** | `/api/dispatch/config`, `queue/{tag_id}` | PassengerWaitingScreen |
| **Storage** | `/api/storage/upload-profile-photo`, `upload-vehicle-photo` | Profil/araç fotoğrafı |
| **Diğer** | `/api/price/calculate`, `/api/ride/create-offer`, `/api/directions` | index, InAppNavigation |

### 3.3 Socket.IO – Sunucu Event’leri (server.py)

- **Bağlantı:** `connect`, `disconnect`
- **Kayıt:** `register` → sunucu `registered` döner
- **Çağrı:** `call_user` → `incoming_call`, `call_ringing`; `accept_call` → `call_accepted`; `reject_call` → `call_rejected`; `end_call` → `call_ended`
- **Yolculuk bitişi:** `force_end_trip`, `request_trip_end_socket`, `respond_trip_end_socket` → ilgili trip event’leri
- **Günlük arama:** `accept_daily_call`, `reject_daily_call`, `end_daily_call`
- **Diğer (HTTP veya iç mantıktan emit):** `new_passenger_offer`, `offer_accepted`, `tag_matched`, `tag_cancelled`, `new_offer`, `show_rating_modal`, `payment_received`, `new_chat_message`, vb.

---

## 4. Frontend – API ve Socket Kullanımı

### 4.1 API Base URL Nereden Geliyor?

- **Tercih sırası:** `Constants.expoConfig?.extra?.backendUrl` → `process.env.EXPO_PUBLIC_BACKEND_URL` → fallback (bazı dosyalarda `https://api.leylektag.com` veya `https://leylektag-debug.preview.emergentagent.com`).
- **Kullanım:** Çoğu yerde `API_URL = BACKEND_URL + '/api'` (yani istekler `https://<host>/api/...`).
- **İstisnalar:**
  - **LegalPages.tsx:** `API_URL = process.env.EXPO_PUBLIC_BACKEND_URL` (sonuna `/api` eklemeden) → `${API_URL}/legal/...`. Backend’de `/api/legal/*` yok; yasal sayfalar HTML olarak farklı path’lerde (örn. `/gizlilik-politikasi`).
  - **AdminPanel.tsx, app/admin.tsx:** Sabit `https://api.leylektag.com/api`.
  - **RatingModal.tsx:** `API_URL` sonuna tekrar `/api` ekleniyor olabilir; kontrol edilmeli (`/api/qr/rate-user` çift prefix’e düşmesin).
  - **DriverDashboardPanel, DriverStatusBar, DriverActivityMap, DriverPackagesModal, VideoCall, SimpleCallScreen:** Bazıları farklı fallback URL kullanıyor (debug/preview).

### 4.2 Dosya Bazında API Kullanımı (Özet)

| Dosya | Kullandığı API’ler |
|-------|--------------------|
| **app/index.tsx** | auth/*, admin/check, user/update-location, user/{id}, driver/kyc/status, driver/nearby-activity, driver/active-tag, driver/send-offer, driver/complete-tag, driver/passenger-location, passenger/*, trip/*, price/calculate, ride/create-offer, calls/start |
| **app/admin.tsx** | admin/* (hardcoded base) |
| **AdminPanel.tsx** | admin/* (hardcoded base) |
| **CommunityScreen.tsx** | community/*, upload/image (backend’de `/api/upload/image` yok; sadece storage/upload-*) |
| **PassengerWaitingScreen.tsx** | driver/nearby-activity, drivers/nearby, dispatch/queue/{tagId} |
| **DriverActivityMap.tsx** | driver/nearby-activity |
| **useCall.ts, PhoneCallScreen, WhatsAppCallScreen, DailyCallScreen** | voice/*, calls/end |
| **useAgoraEngine.ts** | agora/token |
| **useOffers.ts** | passenger/accept-offer, passenger/dismiss-offer |
| **QRTripEndModal.tsx** | trip/complete-qr |
| **RatingModal.tsx** | qr/rate-user |
| **usePushNotifications.ts** | user/register-push-token, user/remove-push-token |
| **InAppNavigation.tsx** | directions |
| **app/profile.tsx** | auth/user/{id}/profile |
| **app/driver-verify.tsx** | auth/user/{id}/driver-details |
| **app/delete-account.tsx** | user/delete-account |
| **app/history.tsx** | passenger/history, driver/history |
| **LegalPages.tsx** | legal/{privacy\|terms\|kvkk} (BACKEND_URL, /api yok) |

### 4.3 Socket – Frontend

- **SocketContext.tsx:** `SOCKET_URL = 'https://socket.leylektag.com'`, `path: '/socket.io'`. Singleton socket; `_layout.tsx` içinde `SocketProvider` ile sarılı.
- **useSocket.ts:** Aynı socket’i kullanır; `register`, `call_user`, `accept_call`, `reject_call`, `end_call`, tag/offer/trip end event’leri, `send_message`, `heartbeat` emit eder; `incoming_call`, `call_accepted`, `new_passenger_offer`, `tag_matched`, `trip_*`, `show_rating_modal`, vb. dinler.

**Özet:** Socket URL veya path değişirse tüm gerçek zamanlı özellikler (çağrı, tag, teklif, yolculuk bitişi, mesaj) etkilenir. Backend’deki socket path’i (`/api/socket.io`) ile frontend’deki (`socket.leylektag.com` + `/socket.io`) uyumlu deployment’a dikkat edin.

### 4.4 Supabase – Frontend

- **lib/supabase.ts:** `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`. `getSupabase()`, `broadcastLocation`, konum/trip channel’ları, presence.
- **ChatBubble, PhoneCallScreen, useCall:** Bazı yerlerde kendi Supabase client’ı veya hardcoded URL/key; chat ve çağrı realtime için.
- **Kanal isimleri:** Konum/trip için ortak bir isimlendirme (örn. `location_update`, `trip_event`) kullanılır; backend veya başka istemcilerle uyumlu olmalı.

---

## 5. Ortam Değişkenleri

### 5.1 Frontend (.env veya EAS/env)

| Değişken | Kullanım |
|----------|----------|
| **EXPO_PUBLIC_BACKEND_URL** | Tüm `/api` istekleri (çoğu bileşen) |
| **EXPO_PUBLIC_SUPABASE_URL** | lib/supabase.ts, bazı bileşenler |
| **EXPO_PUBLIC_SUPABASE_ANON_KEY** | Aynı |
| **EXPO_PUBLIC_GOOGLE_MAPS_API_KEY** | Harita (app/index.tsx); app.json’da da sabit key var |
| **EXPO_PUBLIC_AGORA_APP_ID** | useAgoraEngine, ses/görüntü |

**app.json:** `extra.backendUrl`: `https://api.leylektag.com`  
**eas.json (preview):** `EXPO_PUBLIC_BACKEND_URL`: `https://api.leylektag.com`

### 5.2 Backend (.env)

- **SUPABASE_URL, SUPABASE_KEY** (veya projeye özel isimler)
- **GOOGLE_MAPS_API_KEY**
- **IYZICO_*** (ödeme)
- **MONGO_*** (eski; kullanılmıyorsa görmezden gelinebilir)

---

## 6. Veritabanı (Supabase) – Tablolar ve Kullanım

- **Tablolar:** users, tags, offers, blocked_users, notifications, app_settings, call_logs (veya calls), login_attempts, failed_login_attempts, dismissed_requests, dismissed_offers, trip_end_requests, reports, realtime_locations, community_messages.
- **Realtime:** `realtime_locations` için publication tanımlı; frontend konum/trip channel’ları ile uyumlu olmalı.
- **RLS:** users, tags, offers, blocked_users, notifications üzerinde politikalar var; backend genelde service role ile çalışır.

**Dikkat:** Şema veya sütun adı değişirse `server.py`, `call_service.py` ve frontend’deki Supabase sorguları/channel isimleri güncellenmeli.

---

## 7. Akış Özeti (Data Flow)

1. **Auth:** Uygulama → `/api/auth/*` → backend → Supabase `users` (ve ilgili). Supabase Auth kullanılmıyor; OTP/PIN/telefon ile özel auth.
2. **Tag / Teklif / Yolculuk:** Uygulama → `/api/passenger/*`, `/api/driver/*`, `/api/trip/*` + Socket.IO (new_tag, new_offer, tag_matched, trip_*) → server.py → Supabase (tags, offers, users).
3. **Çağrı:** Uygulama → `/api/calls/start`, `/api/calls/end`, `/api/voice/*`, `/api/agora/token` + Socket.IO (call_user, accept_call, reject_call, end_call) → server → Supabase `calls` + Agora.
4. **Konum:** Frontend Supabase channel’ları (lib/supabase.ts) ve/veya Socket `subscribe_location` / `location_updated`.
5. **Sohbet:** Socket `send_message` + Supabase realtime (ChatBubble, tag bazlı kanal).
6. **Topluluk:** `/api/community/*`; görsel için `upload/image` frontend’de kullanılıyor ama backend’de farklı bir route olabilir (storage/upload-*).
7. **Admin:** `/api/admin/*` → server → Supabase (users, tags, reports, kyc, notifications, vb.).
8. **Push:** `/api/user/register-push-token`, remove + backend push servisi (Expo/Firebase).

---

## 8. Bağımlılık Haritası (Değişince Neyi Kırar?)

### 8.1 Backend

- **server.py** → supabase_client, .env, Socket.IO ASGI app, Agora token, Firebase/push, Google Maps, templates, call_service.
- **call_service.py** → Supabase `calls` tablosu.
- **services/** → .env (Iyzico, push, vb.), harici API’ler.

### 8.2 Frontend

- **_layout.tsx** → SocketProvider, NotificationProvider → socket veya bildirim kullanan tüm ekranlar.
- **app/index.tsx** → useSocketContext, API_URL, harita, çağrı ekranları, yolcu/şoför akışları.
- **SocketContext** → `socket.leylektag.com`, path `/socket.io`; useSocket.ts aynı socket’i kullanır.
- **useCall, useAgoraEngine** → BACKEND_URL (voice/agora); PhoneCallScreen, WhatsAppCallScreen, CallScreenV2, VideoCall çağrı akışı.
- **lib/supabase.ts** → EXPO_PUBLIC_SUPABASE_*; LiveMapView, konum/trip UI, ChatBubble.
- **AdminPanel, app/admin.tsx** → Sabit API base; admin route’ları.

### 8.3 Değişiklik Yaparken Dikkat

| Ne değişirse | Etki |
|--------------|------|
| **Socket URL veya path** | Tüm realtime (çağrı, tag, teklif, trip end, mesaj) bozulur. SocketContext + sunucu tarafı aynı host/path’e göre ayarlanmalı. |
| **API base veya /api prefix** | Tüm REST istekleri. BACKEND_URL ve her yerdeki `API_URL = BACKEND_URL + '/api'` tutarlı olmalı; hardcoded base kullanan AdminPanel/admin.tsx da güncellenmeli. |
| **Supabase tablo/sütun/RLS** | server.py, call_service, frontend Supabase kullanımı; şema değişikliği hepsinde yansıtılmalı. |
| **EXPO_PUBLIC_BACKEND_URL / app.json extra** | Build ve runtime’da API base; eas.json preview env ile uyumlu bırakılmalı. |
| **Legal path’leri** | LegalPages `/legal/*` kullanıyor; backend’de bu route yoksa yasal sayfalar 404 verir (HTML’ler farklı path’te). |
| **Community upload** | Frontend `upload/image` çağırıyor; backend’de `/api/upload/image` yoksa eklenmeli veya mevcut storage endpoint’i kullanılmalı. |
| **RatingModal API_URL** | Bazı yerlerde `API_URL` zaten `/api` içeriyor; `qr/rate-user` için çift `/api` eklenmemeli. |

---

## 9. Expo Router – Ekranlar

- **app/_layout.tsx:** Root layout (provider’lar burada).
- **app/index.tsx:** Ana ekran (auth, harita, yolcu/şoför, aktif yolculuk, çağrı UI).
- **app/admin.tsx:** Admin panel.
- **app/profile.tsx:** Profil.
- **app/history.tsx:** Yolcu/şoför geçmişi.
- **app/driver-verify.tsx:** Şoför doğrulama.
- **app/delete-account.tsx:** Hesap silme.
- **app/kvkk.tsx, terms.tsx, privacy.tsx:** Yasal sayfalar (LegalPages veya benzeri ile).

Alt klasör yok; tüm route’lar `app/` altında tek seviye.

---

## 10. Özet Checklist – Akışı Bozmamak İçin

1. **API:** Backend’deki route path’leri ile frontend’deki `fetch(API_URL + '/...')` path’leri aynı olsun; AdminPanel/admin sabit URL’i de güncellenmiş olsun.
2. **Socket:** Frontend `SOCKET_URL` + `path` ile backend’in gerçekten dinlediği host/path aynı olsun.
3. **Env:** EXPO_PUBLIC_BACKEND_URL, app.json extra, eas.json build env tutarlı olsun; Supabase ve Agora key’leri doğru projeye ait olsun.
4. **Supabase:** Şema ve channel isimleri backend + lib/supabase.ts + ChatBubble/çağrı realtime ile uyumlu kalsın.
5. **Legal / Community:** Backend’de `/legal/*` veya frontend’in beklediği upload endpoint’i varsa eşleşsin; yoksa ya route ekleyin ya da frontend’i mevcut endpoint’e göre değiştirin.
6. **Çift prefix:** API_URL zaten `.../api` ise `API_URL + '/api/qr/...'` gibi kullanımları düzeltin.

Bu doküman, proje yapısını ve bağlantıları tek referansta toplar; Claude veya başka bir araçla yapılacak değişikliklerde akışın bozulmaması için yukarıdaki noktalara dikkat etmek yeterli olacaktır.
