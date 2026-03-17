# Trip lifecycle push – analiz özeti

## 1. Trips tablosu (tags)

- **Tablo:** `tags` (yolculuk talepleri)
- **Alanlar:** id, passenger_id, driver_id, pickup_*, dropoff_*, status, final_price, matched_at, started_at, completed_at, cancelled_at, vb.

## 2. Trip status değerleri

| DB status        | Açıklama                          |
|------------------|-----------------------------------|
| pending          | Beklemede                         |
| offers_received  | Teklifler geldi                  |
| waiting          | Sürücülere sırayla teklif gidiyor |
| matched          | Eşleşme yapıldı                   |
| in_progress      | Yolculuk başladı                  |
| completed        | Yolculuk bitti                    |
| cancelled        | İptal                             |
| expired          | Süre doldu                        |

## 3. Push token

- **Tablo:** `users`
- **Alan:** `push_token` (Expo push token)
- Admin panel `send_push_notification(user_id, title, body, data)` ile gönderiyor; token buradan alınıyor.

## 4. Admin panel bildirim servisi

- **Fonksiyonlar:** `send_push_notification()`, `send_push_notifications_to_users()`, `_send_expo_and_get_receipt()`
- **Expo:** `https://exp.host/--/api/v2/push/send`, `EXPO_ACCESS_TOKEN` ile
- **Kullanım:** Admin panel → toplu/tekil push bu fonksiyonlarla gönderiliyor.

## 5. Trip status değişim noktaları

| Olay | Yer (server.py) | Mevcut push |
|------|-----------------|------------|
| Yeni talep (sürücüye) | `dispatch_offer_to_next_driver` | Var (farklı metin) |
| Eşleşme (accept_offer) | ~2746 tags.update matched | Var (sürücü) |
| Eşleşme (accept_ride) | ~6949 tags.update matched | Var (yolcu+sürücü) |
| Yolculuk başladı | `start_trip` ~3265 | Yok |
| Yolculuk bitti | `complete_trip` ~3295 | Var |
| Sürücü yola çıktı | - | Yok (endpoint yok) |
| Sürücü vardı | - | Yok (endpoint yok) |

## 6. Backend

- **Stack:** FastAPI + Supabase (PostgreSQL) + Socket.IO
- **Ana dosya:** `backend/server.py`

---

## 7. Yapılan değişiklikler (trip lifecycle push)

- **notifications_log tablosu:** `type`, `user_id`, `title`, `body`, `created_at` – tüm bildirimler loglanıyor.
- **send_trip_push_and_log(user_id, type, title, body, data):** Önce `notifications_log` insert, sonra mevcut `send_push_notification` ile Expo gönderimi.
- **Lifecycle noktaları:**
  - **NEW_RIDE_REQUEST:** `dispatch_offer_to_next_driver` → sürücüye "Yeni yolculuk teklifi" / "Yakınınızda yeni bir yolculuk isteği var."
  - **MATCHED:** `accept_offer` ve `accept_ride` → yolcu: "Sürücü bulundu" / "Sürücünüz yola çıktı. İyi yolculuklar."; sürücü: "Yolculuk eşleşti" / "Yolcu ile eşleştiniz. Konuma doğru ilerleyin."
  - **DRIVER_ON_THE_WAY:** `POST /driver/on-the-way` (tag_id, user_id) → yolcuya "Sürücü yola çıktı" / "Sürücünüz size doğru geliyor."
  - **DRIVER_ARRIVED:** `POST /driver/arrived` (tag_id, user_id) → yolcu: "Sürücü sizi bekliyor" / "Sürücünüz bulunduğunuz konuma ulaştı."; sürücü: "Yolcuya ulaştınız" / "Yolcuyu aldığınızda yolculuğu başlatabilirsiniz."
  - **TRIP_STARTED:** `start_trip` → yolcu: "Yolculuk başladı" / "İyi yolculuklar."; sürücü: "Yolculuk başladı" / "Güvenli sürüşler."
  - **TRIP_COMPLETED:** `complete_trip` → yolcu: "Yolculuk tamamlandı" / "Bizi tercih ettiğiniz için teşekkür ederiz."; sürücü: "Yolculuk tamamlandı" / "Kazancınız: {fare_amount} TL. Yeni teklif almak için bekleme ekranına geçebilirsiniz."
- **Android channel:** Trip tipleri `channelId: "match"` ile gönderiliyor (`_send_expo_and_get_receipt` içinde).
