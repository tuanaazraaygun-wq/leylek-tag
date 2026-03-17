# Leylek TAG – Bildirim Sistemi Tam Yapı Dokümanı

Bu doküman, uygulamanın **push bildirim sisteminin** tam mimarisini, veri akışını, bileşenleri ve API’leri tek yerde tanımlar. GPT veya başka bir araçla entegrasyon / analiz için referans olarak kullanılabilir.

---

## 1. Genel Mimarî Özet

```
[Expo Push API]
       ↑
[Backend server.py]  ←→  [Supabase: users.push_token]
       ↑
[Frontend: usePushNotifications]  ←→  [expo-notifications]
       ↑
[Android/iOS cihaz]
```

- **Token kaynağı:** Expo SDK (`expo-notifications`) cihazda token üretir; frontend bunu backend’e kaydeder.
- **Token saklama:** Backend, Supabase `users` tablosunda `push_token`, `push_token_updated_at` (ve isteğe bağlı `push_token_type`) alanlarını kullanır.
- **Gönderim:** Backend, bildirim tetikleyen olaylarda (arama, teklif, admin duyurusu vb.) `users.push_token` ile Expo Push API v2’ye istek atar.
- **Format:** Expo Push API v2 istek gövdesinde **mutlaka mesaj dizisi** bekler: `[{ "to": token, "title", "body", "data", ... }]`.

---

## 2. Veritabanı (Supabase)

### 2.1 Kullanılan alanlar – `users` tablosu

| Alan | Tip | Açıklama |
|------|-----|----------|
| `id` | UUID | Kullanıcı kimliği |
| `push_token` | TEXT, nullable | Expo push token; format: `ExponentPushToken[...]` |
| `push_token_updated_at` | TIMESTAMPTZ, nullable | Token’ın son güncellenme zamanı |
| `push_token_type` | TEXT, optional | Örn. `"expo"` (yoksa backend sadece `push_token` günceller) |

### 2.2 İsteğe bağlı tablolar

- **notifications** – Admin bildirimlerinin kaydı (title, body, target, sent_by, created_at).
- **admin_notifications_log** – Toplu push sonuçları (title, body, target, sent_count, created_at).

---

## 3. Backend (server.py) – Bileşenler ve Akış

### 3.1 Token doğrulama

```python
class ExpoPushService:
    EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

    @staticmethod
    def is_valid_token(token: str) -> bool:
        return token and token.startswith("ExponentPushToken[")
```

- Sadece `ExponentPushToken[` ile başlayan token’lar kabul edilir; diğer formatlar (ör. FCM) reddedilir.

### 3.2 Token kayıt / silme API’leri

| Method | Endpoint | Açıklama |
|--------|----------|----------|
| **POST** | `/api/user/register-push-token` | Token kaydet. Body: `{ "user_id", "push_token", "platform" }` veya query: `user_id`, `push_token`. |
| **DELETE** | `/api/user/remove-push-token?user_id=...` | İlgili kullanıcının `push_token` ve `push_token_updated_at` alanlarını null yapar. |

- Kayıt öncesi: kullanıcı var mı kontrolü, `ExpoPushService.is_valid_token` kontrolü.
- Kayıt: `users` tablosunda `push_token`, `push_token_updated_at` (ve varsa `push_token_type`) güncellenir.

### 3.3 Gönderim fonksiyonları (sıra ile)

1. **send_push_notification(user_id, title, body, data=None)**  
   - `users` tablosundan ilgili kullanıcının `push_token`’ını alır.  
   - Token yoksa veya geçersizse `False` döner.  
   - Geçerliyse `send_expo_notification(token, title, body, data)` çağrılır.

2. **send_push_notifications_to_users(user_ids, title, body, data=None)**  
   - Her `user_id` için `send_push_notification` çağırır.  
   - Dönen değer: `{"sent", "failed", "total"}`.

3. **_send_expo_and_get_receipt(token, title, body, data=None)**  
   - Tek mesajı **dizi** olarak `https://exp.host/--/api/v2/push/send` adresine POST eder.  
   - İstek gövdesi: `[ { "to", "sound", "title", "body", "data", "priority", "channelId", "_displayInForeground" } ]`.  
   - Yanıt: `{"data": [ { "status": "ok" } | { "status": "error", "message", ... } ] }`.  
   - Dönüş: `(success: bool, receipt_dict)`.

4. **send_expo_notification(token, title, body, data=None)**  
   - `_send_expo_and_get_receipt` çağrılır; sadece `success` döndürülür.

5. **send_bulk_push_notification(title, body, target, data=None)**  
   - `target`: `"all"` | `"drivers"` | `"passengers"` | `"online_drivers"`.  
   - Supabase’den ilgili kullanıcıları (push_token dolu ve geçerli) seçer.  
   - `send_push_notifications_to_users` ile toplu gönderim; isteğe bağlı `admin_notifications_log` kaydı.

### 3.4 Android kanal eşlemesi (channelId)

Backend, `data.type` değerine göre `channelId` atar:

| data.type | channelId | Kullanım |
|-----------|-----------|----------|
| `new_offer` | `offers` | Yolculuk teklifleri |
| `match_found`, `match_confirmed`, `kyc_approved`, `kyc_rejected` | `match` | Eşleşme / KYC |
| `incoming_call`, `incoming_daily_call` | `calls` | Arama bildirimleri |
| `admin_notification` | `admin` | Admin duyuruları |
| Diğer | `default` | Genel |

Frontend’te aynı id’lerle kanallar tanımlı olmalı (usePushNotifications içinde).

### 3.5 Bildirim tetikleyen olaylar (server.py içi kullanım)

- **Arama (alıcı çevrimdışı):** `send_push_notification(..., data={"type": "incoming_call", ...})`.
- **Yolculuk teklifi:** Sürücü teklif gönderdiğinde yolcuya `send_push_notification(..., data={"type": "new_offer", ...})`.
- **KYC onay/red:** İlgili kullanıcıya push.
- **Admin panel:** `POST /api/admin/send-notification` (body: phone, title, body, target) veya `POST /api/admin/notifications/send` (query: admin_phone, title, body, target, user_id?) ile toplu/tekli gönderim; içeride `send_bulk_push_notification` veya `send_push_notification` kullanılır.
- **Çeşitli iş akışları:** Eşleşme, yolculuk durumu, mesaj vb. için ilgili yerlere `send_push_notification` / `asyncio.create_task(send_push_notification(...))` çağrıları.

### 3.6 Admin / test API’leri

| Method | Endpoint | Açıklama |
|--------|----------|----------|
| **GET** | `/api/admin/push-stats?phone=...` | Admin. Toplam kullanıcı, push token’lı kullanıcı, sürücü/yolcu sayıları. |
| **GET** | `/api/admin/push-debug?admin_phone=...&limit=50` | Admin. Push token’ı olan kullanıcı listesi (id, phone_masked, name, has_push_token, token_valid_format, token_preview, push_token_updated_at). |
| **POST** | `/api/test/push-notification?user_id=...&title=...&body=...` | Tek kullanıcıya test push; yanıtta debug bilgisi. |
| **POST** | `/api/test/push-notification-by-phone?admin_phone=...&phone=...&title=...&body=...` | Admin. Telefon numarasına göre kullanıcı bulunur, test push atılır; yanıtta `expo_receipt` döner (Expo hata ayıklama için). |
| **POST** | `/api/admin/send-notification` | Body: `{ "phone", "title", "body", "target" }`. Hedef: all / drivers / passengers. |
| **POST** | `/api/admin/notifications/send` | Query: admin_phone, title, body, target, user_id?. Tek veya toplu admin bildirimi. |
| **POST** | `/api/admin/cleanup-invalid-tokens` | Admin. Geçersiz token’ları veritabanından temizler. |

---

## 4. Frontend – Bileşenler ve Akış

### 4.1 usePushNotifications (hooks/usePushNotifications.ts)

- **Amaç:** Tek merkezden Expo push token almak, backend’e kaydetmek ve bildirim dinleyicilerini kurmak.
- **API base:** `Constants.expoConfig?.extra?.backendUrl` veya `https://api.leylektag.com`; istekler `/api` prefix’i ile.

**Fonksiyonlar:**

- **registerForPushNotifications()**  
  - Fiziksel cihaz kontrolü (`Device.isDevice`).  
  - Android için bildirim kanalları: `default`, `offers`, `match`, `calls`, `admin`.  
  - İzin: `getPermissionsAsync` / `requestPermissionsAsync`.  
  - EAS `projectId` (app.json `extra.eas.projectId`) ile `Notifications.getExpoPushTokenAsync({ projectId })`.  
  - Dönen token state’e yazılır ve döndürülür.

- **registerPushToken(userId)**  
  - Token yoksa önce `registerForPushNotifications()` çağrılır.  
  - `POST /api/user/register-push-token` body: `{ user_id, push_token, platform }`.  
  - Başarılıysa `true` döner.

- **removePushToken(userId)**  
  - `DELETE /api/user/remove-push-token?user_id=...` çağrılır; local state temizlenir.

**Dinleyiciler:**

- `addNotificationReceivedListener` – Gelen bildirimi state’e yazar ve log’lar.
- `addNotificationResponseReceivedListener` – Bildirime tıklanınca data’yı log’lar.

**Başlangıç:** Bir `useEffect` ile sayfa açılışında `registerForPushNotifications()` çağrılır (token alınır; backend’e kayıt aşağıda anlatılan yerlerde yapılır).

### 4.2 NotificationContext (contexts/NotificationContext.tsx)

- Token alma/izin akışı **usePushNotifications** içinde toplanmış; bu context daha çok **bildirim dinleyicilerini** ve (varsa) yerel bildirim/izin UI’ını yönetir.
- `_layout.tsx` içinde `NotificationProvider`, `SocketProvider` ile birlikte uygulama ağacını sarar.

### 4.3 Token’ın backend’e kaydedildiği yerler (app/index.tsx)

- Giriş/kayıt sonrası, `user` set edildikten sonra:  
  `registerPushToken(user.id)` çağrılır (useEffect veya ilgili akışın sonunda).
- Kayıt (register) tamamlandığında: `registerPushToken(registerData.user.id)` veya `registerPushToken(data.user.id)`.
- PIN doğrulama sonrası: `registerPushToken(data.user.id)`.
- Böylece her “giriş/kayıt” senaryosunda token bir kez daha backend’e gönderilir; güncel token kalır.

### 4.4 Admin panel (bildirim gönderme)

- **AdminPanel.tsx** sabit `API_URL = 'https://api.leylektag.com/api'` kullanır.
- Bildirim gönderme: `POST /api/admin/notifications/send?admin_phone=...&title=...&body=...&target=all|drivers|passengers`.
- Başarı/hata Alert ile gösterilir.

---

## 5. Expo Push API v2 – Kritik Noktalar

- **URL:** `https://exp.host/--/api/v2/push/send`
- **İstek:** POST; Content-Type: application/json. **Body mutlaka bir dizi:** `[ { "to": "ExponentPushToken[...]", "sound", "title", "body", "data", "priority", "channelId", ... } ]`.
- **Yanıt:** `200` + `{"data": [ { "status": "ok" } | { "status": "error", "message", "details" } ] }`. Hata durumunda `details.error` örn. `DeviceNotRegistered`, `MessageTooBig`, `InvalidCredentials` olabilir.
- **Yetki:** Expo hesabı/proje ayarlarından “custom server” veya ilgili izinler açık olmalı; aksi halde 403 (Insufficient permissions) alınır.

---

## 6. Akış Özeti (Sıralı)

1. **Kayıt:** Cihazda uygulama açılır → izin verilir → `getExpoPushTokenAsync` ile token alınır → giriş/kayıt sonrası `registerPushToken(user.id)` ile `POST /api/user/register-push-token` çağrılır → backend `users.push_token` (ve ilgili alanları) günceller.
2. **Gönderim:** İş kuralı tetiklenir (arama, teklif, admin vb.) → backend ilgili user_id’leri veya token listesini belirler → `send_push_notification` / `send_push_notifications_to_users` → `send_expo_notification` → `_send_expo_and_get_receipt` → Expo Push API v2’ye dizi formatında istek gider → cihazda bildirim gösterilir.
3. **Dinleme:** Frontend’te `addNotificationReceivedListener` ile gelen bildirimler işlenir; `data` ile ekran yönlendirmesi veya UI güncellemesi yapılabilir.

---

## 7. Dosya Konumları Özeti

| Bileşen | Dosya / Konum |
|--------|----------------|
| Token kayıt API, Expo gönderim, admin/test endpoint’leri | `backend/server.py` |
| Expo token doğrulama, push URL | `backend/server.py` – `ExpoPushService`, `_send_expo_and_get_receipt`, `send_expo_notification` |
| Token alma, backend’e kayıt, kanallar, dinleyiciler | `frontend/hooks/usePushNotifications.ts` |
| Bildirim dinleyicileri, provider | `frontend/contexts/NotificationContext.tsx` |
| registerPushToken çağrıları | `frontend/app/index.tsx` |
| Admin bildirim gönderme UI | `frontend/components/AdminPanel.tsx` |
| EAS/Expo config (projectId vb.) | `frontend/app.json` (extra.eas.projectId), `frontend/eas.json` |

---

## 8. Dikkat Edilecekler (Değişiklik Yaparken)

- Backend’de Expo’ya giden istek **her zaman dizi** olmalı; tek obje gönderilirse API hatalı/reddedebilir.
- Frontend’teki `channelId` isimleri (default, offers, match, calls, admin) backend’deki `data.type` → `channelId` eşlemesi ile uyumlu kalmalı.
- Token formatı sadece `ExponentPushToken[` ile başlayan Expo token’ları; FCM veya başka format eklenirse backend’de `is_valid_token` ve kayıt/gönderim mantığı buna göre güncellenmeli.
- Admin endpoint’leri `ADMIN_PHONE_NUMBERS` veya ilgili admin kontrolü ile korunmalı; test endpoint’leri sadece admin_phone ile çağrılmalı veya production’da kapatılmalı.

Bu doküman, Leylek TAG bildirim sisteminin tam yapısını tek referansta toplar; GPT veya başka bir entegrasyon bu yapıya göre doğrulama, genişletme veya hata analizi yapabilir.
