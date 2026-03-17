# Leylek TAG – Bildirim Sistemi Yapısı

Bu doküman, projedeki push bildirim sisteminin mimarisini ve akışını özetler. GPT veya başka bir asistanla paylaşmak için kullanılabilir.

---

## 1. Genel Mimari

- **Backend:** FastAPI (Python), Supabase (PostgreSQL), Socket.IO
- **Push servisi:** **Expo Push API** (`https://exp.host/--/api/v2/push/send`)
- **Token kaynağı:** Kullanıcı giriş yaptıktan sonra uygulama Expo’dan token alır ve backend’e gönderir; backend `users.push_token` sütununa yazar.
- **Bildirim tetikleyicileri:** Teklif oluşturma, teklif kabul (eşleşme), yolculuk aşamaları, arama, admin, test endpoint’leri.

---

## 2. Backend Akışı (Özet)

```
[Uygulama] --register push token--> POST /api/user/register-push-token
                                        --> users.push_token güncellenir

[Olay: teklif / eşleşme / trip / vb.]
    --> send_trip_push_and_log(user_id, type, title, body, data)
        --> notifications_log tablosuna insert (log)
        --> send_push_notification(user_id, title, body, data)
            --> users tablosundan push_token alınır (user_id ile)
            --> send_expo_notification(token, title, body, data)
                --> _send_expo_and_get_receipt()
                    --> POST https://exp.host/--/api/v2/push/send
                    --> payload: to, title, body, data, channelId, sound, priority
```

---

## 3. Temel Fonksiyonlar (server.py)

| Fonksiyon | Amaç |
|-----------|------|
| `register_push_token_endpoint` | Uygulama Expo token’ı gönderir → `users.push_token` güncellenir. |
| `send_push_notification(user_id, title, body, data)` | Tek kullanıcıya push: `users` tablosundan `push_token` alır, Expo’ya gönderir. Kullanıcı yoksa veya token yoksa/geçersizse `False` döner. |
| `send_trip_push_and_log(user_id, notification_type, title, body, data)` | Önce `notifications_log` tablosuna kayıt atar, sonra `send_push_notification` çağırır. Trip ve eşleşme bildirimleri buradan gider. |
| `send_push_notifications_to_users(user_ids, title, body, data)` | Birden fazla kullanıcıya aynı bildirimi gönderir (admin/toplu bildirim vb.). |
| `_send_expo_and_get_receipt(token, title, body, data)` | Expo Push API’ye tek mesaj gönderir; `data` içindeki `type`’a göre `channelId` seçer. |

---

## 4. Kanal (channelId) Eşleştirmesi

Backend, `data` içindeki `type` değerine göre Android için `channelId` atar:

| type | channelId |
|------|-----------|
| `new_offer` | offers |
| `match_found`, `match_confirmed`, `matched`, `new_ride_request`, trip tipleri vb. | offers |
| `incoming_call`, `incoming_daily_call` | calls |
| `admin_notification` | admin |
| Diğer | default |

Expo’ya giden mesajda: `channelId`, `title`, `body`, `data` (içinde `type`, `tag_id` vb.) kullanılır.

---

## 5. Bildirim Tetikleyen Yerler (Özet)

- **Teklif (sürücüye):** Yolculuk teklifi oluşturulunca dispatch/kuyruk ile sürücülere → `send_trip_push_and_log(driver_id, "new_ride_request", "Yeni yolculuk teklifi", body, {"type": "new_offer", "tag_id": ...})`.
- **Eşleşme (yolcu + sürücü):**
  - Yolcu teklif kabul: `POST /passenger/accept-offer` → TAG veritabanından alınır, hem sürücü hem yolcu için `send_trip_push_and_log` çağrılır.
  - Sürücü teklif kabul: `POST /ride/accept` → Aynı şekilde iki tarafa da `send_trip_push_and_log`.
- **Yolcu eşleşme bildirimi:** title: "Paylaşımlı yolculuk başladı", body: "Sürücüye yazmak için tıklayın.", data.type: `match_found`.
- **Sürücü eşleşme bildirimi:** title: "Eşleşme sağlandı", body: "Yolcuya X dk. Yolcuya git için tıklayın.", data.type: `match_confirmed`.
- Diğer: arama, trip aşamaları (yola çıktı, geldi, başladı, bitti), KYC, admin, chat bildirimi vb.

---

## 6. Veritabanı

- **users:** `id` (UUID), `push_token` (Expo token string), `push_token_updated_at`. Token `ExponentPushToken[...]` veya `ExpoPushToken[...]` ile başlamalı.
- **notifications_log:** Her gönderim denemesi loglanır: `type`, `user_id`, `title`, `body`, `created_at`.

---

## 7. Frontend (Expo / React Native)

- **expo-notifications** ile izin alınır, Expo’dan push token alınır.
- Android için kanallar tanımlanır: `default`, `offers`, `match`, `calls`, `admin` (isimler ve importance MAX/HIGH).
- Token, giriş sonrası `POST /api/user/register-push-token` ile backend’e gönderilir (body: `user_id`, `push_token`, `platform`).
- Bildirime tıklanınca `data` (örn. `type`, `tag_id`) ile deep link / ekran yönlendirmesi yapılabilir.

---

## 8. Önemli Noktalar (Sorun Giderme)

- Eşleşme bildirimi gitmiyorsa: Backend’in doğru `user_id` (UUID) ile `users` tablosundan token çektiğinden emin olun; `tag`/`offer` kayıtlarından alınan `passenger_id` ve `driver_id` aynı formatta (string UUID) kullanılmalı.
- Teklif bildirimi gelip eşleşme gelmiyorsa: Aynı `channelId` ("offers") ve aynı `send_trip_push_and_log` / `send_push_notification` zinciri kullanılıyor; fark genelde tetikleyen endpoint (accept-offer vs ride/accept) ve oradaki `user_id` değerleri veya log’daki hata mesajlarından anlaşılır.
- Log’da "Push token yok" veya "kullanıcı bulunamadı" görülüyorsa: İlgili kullanıcı giriş yapıp token kaydettirmeli; gerekirse çıkış/yeniden giriş yapılmalı.

---

## 9. Dosya Konumları

- **Backend:** `backend/server.py`  
  - Token kayıt: `register_push_token_endpoint`, `register_push_token` (notifications).  
  - Gönderim: `send_push_notification`, `send_trip_push_and_log`, `_send_expo_and_get_receipt`, `send_expo_notification`.  
  - Eşleşme push: `accept_offer` (passenger accept), `accept_ride` (driver accept) içinde.
- **Frontend:** `frontend/hooks/usePushNotifications.ts` (kanallar, token alma, backend’e kayıt).

Bu yapı GPT’ye verildiğinde, bildirim akışı ve olası hata noktaları net şekilde anlatılmış olur.
