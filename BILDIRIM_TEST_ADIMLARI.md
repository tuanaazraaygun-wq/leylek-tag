# Bildirim Neden Gitmiyor – Test Adımları

## 1. Yapılan Düzeltmeler (Backend)

### Expo istek formatı
- **Sorun:** Expo Push API v2, istek gövdesinde **dizi** bekliyor `[{ "to": "...", ... }]`. Kod tek obje gönderiyordu.
- **Düzeltme:** `send_expo_notification` artık mesajı `[message]` olarak gönderiyor.

### Expo yanıt kontrolü
- **Sorun:** Yanıt `{"data": [ {"status": "ok"} ]}` şeklinde dizi; kod `data.get("status")` ile objeymiş gibi bakıyordu.
- **Düzeltme:** `data` dizisinin ilk elemanındaki `status` ve `message` kullanılıyor.

### Yeni debug endpoint’leri
- **GET /api/admin/push-debug?admin_phone=5326497412**  
  Hangi kullanıcıların push token’ı kayıtlı, format geçerli mi listeler.
- **POST /api/test/push-notification-by-phone**  
  Test bildirimi gönderir; yanıtta **expo_receipt** döner (Expo’nun döndüğü hata varsa burada görünür).

---

## 2. Test Sırası

### Adım 1: Token’lar kayıtlı mı?
Backend’i çalıştırıp tarayıcı veya curl ile:

```bash
curl "https://api.leylektag.com/api/admin/push-debug?admin_phone=5326497412"
```

(Yerel test için: `http://localhost:8000` kullanın.)

- **users** boş veya **token_valid_format: false** ise: Uygulama token’ı backend’e kaydetmemiş veya yanlış formatta.
- **token_valid_format: true** olan kullanıcı var ama bildirim gitmiyorsa: Adım 2’ye geçin.

### Adım 2: Tek numaraya test bildirimi + Expo yanıtı
Kendinize (veya test etmek istediğiniz numaraya) test atın:

```bash
curl -X POST "https://api.leylektag.com/api/test/push-notification-by-phone?admin_phone=5326497412&phone=5326497412&title=Test&body=Merhaba"
```

Yanıtta **expo_receipt** alanına bakın:

- **status: "ok"** → Expo bildirimi kabul etti; cihazda bildirim ayarları / batarya optimizasyonu kontrol edin.
- **status: "error", message: "DeviceNotRegistered"** → Token artık geçersiz (uygulama silinmiş / veri temizlenmiş). Bu kullanıcı için token’ı silip uygulama açıldığında yeniden kaydettirin.
- **Başka error** → Gelen **message** ve **details** ile Expo dokümantasyonundan hata anlamını kontrol edin.

### Adım 3: Admin panelden toplu bildirim
Admin panelden “Bildirim gönder” kullanın. Backend log’larında şunları arayın:

- `📭 Push token'ı olan kullanıcı bulunamadı` → Hiç geçerli token yok; önce Adım 1.
- `🔔 Expo API'ye gönderiliyor` / `✅ Expo push başarılı` → Sunucu tarafı tamam; cihazda bildirim kapalı / optimize edilmiş olabilir.

---

## 3. Sık Nedenler

| Neden | Çözüm |
|-------|--------|
| Token hiç kaydedilmemiş | Uygulama açıldığında bildirim izni verilmeli; giriş sonrası `registerPushToken(user.id)` tetikleniyor. İzin reddedilirse token alınmaz. |
| Token yanlış formatta | Sadece `ExponentPushToken[...]` kabul edilir. FCM token’ı kullanılıyorsa backend’e Expo token gönderilmeli. |
| DeviceNotRegistered | Eski token; kullanıcı uygulamayı silip yeniden kurduysa veya Expo token’ı değiştiyse olur. Yeni token’ı giriş sonrası tekrar kaydetmek gerekir. |
| Cihazda bildirim kapalı | Ayarlar → Uygulama → Leylek TAG → Bildirimler açık olmalı. |
| Batarya tasarrufu | Bazı cihazlar arka planda Expo’yu keser; “Kısıtlanmamış” veya “Optimize etme” deneyin. |

---

## 4. Frontend Kontrolü (Token ne zaman kaydediliyor?)

- `app/index.tsx` içinde giriş / kayıt sonrası `registerPushToken(user.id)` çağrılıyor.
- `usePushNotifications` hook’u izin isteyip Expo token alıyor; `registerPushToken` bu token’ı `POST /api/user/register-push-token` ile backend’e gönderiyor.
- İlk açılışta kullanıcı bildirim iznini reddederse token alınmaz; sonradan izin verip uygulamayı yeniden açması veya tekrar giriş yapması gerekebilir.

Backend’i güncel kodla deploy edip önce **push-debug**, sonra **test-push-notification-by-phone** ile test edin; **expo_receipt** çıktısı neden bildirim gitmediğini netleştirir.
