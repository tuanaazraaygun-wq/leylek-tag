# Eşleşme Bildirimi Neden Gelmiyor? – Adım Adım Rehber

Bu rehber, **eşleşme olduğunda yolcuya/sürücüye push bildirimi gelmeme** sorununu adım adım nasıl kontrol edeceğinizi ve ne yapmanız gerektiğini anlatır.

---

## 1. Backend’de Yapılan Düzeltme (Önemli)

**Sorun:** Yolcu teklifi kabul ettiğinde (`/passenger/accept-offer`) backend’de TAG verisi hiç çekilmiyordu. `passenger_id` ve `tag` bilgisi olmadan bildirim kısmı hata veriyor veya yanlış çalışıyordu.

**Yapılan:** `accept_offer` içinde, teklif bulunduktan sonra **TAG veritabanından çekiliyor**. Böylece hem `passenger_id` doğru alınıyor hem de ETA/pickup koordinatları kullanılabiliyor.

- Eğer backend’i güncellediyseniz, **sunucuyu yeniden başlatın** (değişiklikler yüklenmesi için).

---

## 2. Bildirimin Gelmesi İçin Şartlar (Sırayla Kontrol Edin)

### Adım A: Cihazda bildirim izni

- Telefonda: **Ayarlar → Uygulamalar → Leylek TAG → Bildirimler** açık olmalı.
- İlk açılışta uygulama “Bildirimlere izin ver” diye sormuş olmalı; **İzin ver** denmiş olmalı.

### Adım B: Push token’ın alınmış ve backend’e kaydedilmiş olması

Bildirim gidebilmesi için o kullanıcının **push_token**’ı backend’de (Supabase `users` tablosunda) kayıtlı olmalı.

- **Ne zaman kaydedilir?** Kullanıcı giriş yaptıktan sonra uygulama `registerPushToken(userId)` çağırır; backend `/user/register-push-token` ile bu token’ı `users.push_token` alanına yazar.
- **Pratik kontrol:**
  1. Kullanıcı uygulamaya **giriş yapsın** (yolcu veya sürücü fark etmez).
  2. Uygulama açıkken birkaç saniye beklesin (token kaydı tetiklenir).
  3. İsterseniz **çıkış yapıp tekrar giriş yapsın** – böylece token tekrar gönderilir.

**Veritabanından kontrol:**  
Supabase → `users` tablosu → ilgili kullanıcının satırında `push_token` sütunu **dolu** olmalı (ExponentPushToken[...] veya ExpoPushToken[...] ile başlayan uzun bir metin). Boşsa o kullanıcıya bildirim gitmez.

### Adım C: API cevabında push_sent kontrolü (Hızlı tanı)

Eşleşme yaptıktan sonra **accept-offer** veya **ride/accept** API cevabında `push_sent` alanı var:

- **Nasıl bakılır:** Tarayıcı F12 → Network → İlgili isteği bul (passenger/accept-offer veya ride/accept) → Response.
- **Ne anlama gelir:**
  - `"push_sent": { "driver": false, "passenger": false }` → Backend push gönderemedi (token yok veya kullanıcı bulunamadı). Her iki kullanıcı da çıkış yapıp tekrar giriş yapsın; Supabase’de `users.push_token` dolu olsun.
  - `"push_sent": { "driver": true, "passenger": true }` → Backend bildirimi gönderdi. Telefonda gelmiyorsa cihaz/Expo tarafı (bildirim kapalı, pil tasarrufu, Expo teslim gecikmesi vb.) kontrol edin.
  - `push_sent` yok → Eski backend sürümü çalışıyor olabilir; deploy + servis yeniden başlatın.

### Adım D: Backend loglarına bakmak (En net yol)

Eşleşme anında backend gerçekten bildirim göndermeye çalışıyor mu, nerede takılıyor görmek için **sunucu loglarına** bakın.

1. Backend’i **terminalde** çalıştırın (örn. `python server.py` veya `uvicorn ...`).
2. Bir eşleşme yapın (yolcu teklif kabul etsin veya sürücü teklif kabul etsin).
3. Loglarda şunlara dikkat edin:

**Görmek istediğiniz (her şey yolundaysa):**
- `🔔 Eşleşme push (anında): tag_id=..., passenger_id=..., driver_id=...`
- `🔔 Expo API'ye gönderiliyor, token=...`
- `🔔 Expo API yanıtı: status=200`
- `✅ Expo push başarılı`

**Sorun varsa göreceğiniz mesajlar ve anlamları:**

| Log mesajı | Anlamı | Ne yapmalısınız? |
|------------|--------|-------------------|
| `❌ Push: kullanıcı bulunamadı (user_id=...)` | Veritabanında bu id’ye sahip kullanıcı yok. | Giriş yapan kullanıcının `user.id` değeri ile `tags.passenger_id` / `tags.driver_id` aynı kaynaktan (Supabase users.id) gelmeli. |
| `📭 Push token yok: ... (id=...)` | Bu kullanıcının `push_token`’ı boş. | O kullanıcı uygulamadan giriş yapıp bildirim izni vermeli; mümkünse çıkış/yeniden giriş yapsın. Token kaydı için Adım B’yi tekrarlayın. |
| `⚠️ Geçersiz Expo token: ...` | Token formatı Expo’nun beklediği formatta değil. | Uygulama sadece Expo push token üretmeli. Geliştirme / test token’ı kullanıyorsanız gerçek cihaz token’ı ile değiştirin. |
| `❌ Expo API hatası: ...` | Expo sunucusu bildirimi reddetti (örn. eski/geçersiz cihaz). | Mesajda yazan sebebi okuyun (örn. DeviceNotRegistered). Kullanıcı çıkış yapıp tekrar giriş yaparak yeni token aldırsın. |

Bu tabloya göre hangi satırı gördüğünüzü not edin; çözüm o satıra göre ilerleyin.

### Adım E: Test bildirimi ile deneme

Backend’in ve token’ın çalıştığından emin olmak için **tek kullanıcıya test bildirimi** atın:

```bash
# TEK BİR KULLANICIYA TEST (user_id = Supabase'deki users.id - UUID)
curl -X POST "http://SUNUCU_ADRESI/api/test/push-notification?user_id=KULLANICI_UUID&title=Test&body=Merhaba"
```

- Cevap `"success": true` ve telefonda bildirim çıkıyorsa: backend + token doğru, sorun büyük ihtimalle eşleşme anındaki kullanıcı id’leri veya akıştaydı (bu da düzeltmeyle hallolmuş olmalı).
- Cevap `"success": false` veya bildirim gelmiyorsa: `debug` / `error` alanına bakın; çoğu zaman “Push token yok” veya “kullanıcı bulunamadı” olur – yine Adım B ve C’ye dönün.

### Adım F: Eşleşme test endpoint’i (İki tarafa birden)

Hem yolcu hem sürücü tarafına **eşleşme bildirimi metniyle** test göndermek için:

```bash
curl -X POST "http://SUNUCU_ADRESI/api/test/match-notification?passenger_id=YOLCU_UUID&driver_id=SURUCU_UUID&eta_min=3"
```

- Yolcu ve sürücü için kullandığınız `user_id` değerleri, Supabase `users.id` (UUID) olmalı.
- İki telefonda da bildirim gelmeli: “Eşleşme sağlandı” başlığı ve doğru metinler.

---

## 3. Özet Kontrol Listesi

- [ ] Backend güncel (tag’in çekildiği accept_offer kodu deploy edildi) ve sunucu yeniden başlatıldı.
- [ ] Her iki kullanıcıda da (yolcu + sürücü) bildirim izni açık.
- [ ] Her iki kullanıcı da en az bir kez giriş yapmış; tercihen çıkış/yeniden giriş yapılmış (push token kaydı için).
- [ ] Supabase `users` tablosunda her iki kullanıcının `push_token` alanı dolu.
- [ ] Eşleşme denemesinden hemen sonra backend loglarında “Eşleşme push” ve “Expo API” satırlarına baktınız; hata varsa tablodaki mesaja göre aksiyon aldınız.
- [ ] İsterseniz tek kullanıcı ve eşleşme test endpoint’leri ile deneyip bildirimin geldiğini doğruladınız.

Bu listeyi sırayla yaptığınızda, eşleşme anında bildirimin neden gelmediği büyük ihtimalle loglardan net şekilde görünür ve yukarıdaki adımlarla giderilir.

---

## 4. Belirli Kullanıcılar İçin Kontrol (örn. sürücü 5326427412, yolcu 5361112233)

Eşleşme sağlandığında **belirli iki kullanıcı** (telefon numaralarıyla bilinen) bildirim almıyorsa aşağıdaki adımları uygulayın.

### Adım 1: Veritabanında kullanıcı ve token kontrolü

Supabase SQL Editor’da çalıştırın:

```sql
SELECT id, phone, name,
       (push_token IS NOT NULL AND length(push_token) > 10) AS has_push_token,
       left(push_token, 30) AS token_preview
FROM users
WHERE phone IN ('5326427412', '5361112233')
   OR phone LIKE '%5326427412%'
   OR phone LIKE '%5361112233%';
```

- **id:** Bu kullanıcının gerçek ID’si (UUID). Tag’lerde ve socket’te bu ID kullanılmalı.
- **has_push_token:** `true` olmalı. `false` ise o kullanıcıya bildirim gitmez; uygulamadan giriş yapıp bildirim izni vermeli, tercihen çıkış/yeniden giriş yapmalı.
- **token_preview:** `ExponentPushToken[...]` veya `ExpoPushToken[...]` ile başlamalı.

### Adım 2: Eşleşme anında sunucu logları

Sürücü “Kabul Et” dedikten hemen sonra loglarda sırayla şunlar görülmeli:

0. **`driver_accept_offer RECEIVED tag_id=... driver_id=...`** — Bu yoksa socket event sunucuya ulaşmıyor.
1. `MATCH FLOW START`
2. `TRIP LOCK SUCCESS`
3. `MATCH PUSH: driver_id=... passenger_id=...` → Hangi ID’lerle push denendiği (uuid:... veya phone:...)
4. `PUSH DRIVER SENT` veya `PUSH DRIVER FAILED`
5. `PUSH PASSENGER SENT` veya `PUSH PASSENGER FAILED`
6. `SOCKET EMIT DONE`
7. `MATCH FLOW END`

**Kullanıcı/token durumu (yeni loglar):**
- `MATCH: driver found=True/False has_token=True/False phone=...`
- `MATCH: passenger_id=... found=True/False has_token=True/False`

**PUSH ... FAILED** görüyorsanız, hemen üstteki/altaki satırlara bakın:

- `❌ Push: kullanıcı bulunamadı` → O ID veritabanında yok; tag’deki `driver_id` / `passenger_id` ile `users.id` veya `users.phone` eşleşmeli. Backend artık **telefon ile de** kullanıcı arayabiliyor (id bulunamazsa).
- `📭 Push token yok` → Bu kullanıcının `push_token` boş; giriş + bildirim izni + gerekirse çıkış/yeniden giriş.
- `⚠️ Geçersiz Expo token` → Token formatı yanlış; uygulama Expo push token üretmeli.
- `⚠️ Expo API bildirim göndermedi` → Expo sunucusu reddetti; token süresi dolmuş veya cihaz kaldırılmış olabilir, yeniden giriş deneyin.

### Adım 3: Tag’deki ID’lerin doğruluğu

Son eşleşen tag’de sürücü ve yolcu ID’leri doğru mu kontrol edin:

```sql
SELECT id AS tag_id, passenger_id, driver_id, status, matched_at
FROM tags
WHERE status = 'matched'
ORDER BY matched_at DESC
LIMIT 5;
```

`passenger_id` ve `driver_id` değerleri, Adım 1’de gördüğünüz `users.id` (UUID) ile aynı olmalı. Farklıysa (ör. telefon yazılmışsa) backend’in telefon fallback’i devreye girer; yine de `users` tablosunda bu numaraların `phone` alanında kayıtlı olması gerekir.

### Adım 4: Eşleşme bildirimi testi – UUID ile (son eşleşen tag’in id’leri)

Supabase’den son eşleşen tag’in `driver_id` ve `passenger_id` (UUID) değerlerini alın, sonra:

```bash
curl -X POST "https://api.leylektag.com/api/test/match-push-by-ids?driver_id=SURUCU_UUID&passenger_id=YOLCU_UUID"
```

- `driver_push_sent: true` ve `passenger_push_sent: true` ise backend + token doğru; sorun büyük ihtimalle socket event’in sunucuya ulaşmaması veya yanlış tag/id.
- Biri false ise o kullanıcı için logda "kullanıcı bulunamadı" veya "Push token yok" çıkar.

### Adım 5: Eşleşme bildirimi testi (iki telefona – gerçek eşleşme yapmadan)

Sürücü ve yolcu numaralarına **aynı metinlerle** eşleşme push’u gönderin (E.164 ile aranır):

```bash
curl -X POST "https://api.leylektag.com/api/test/match-push-by-phone?driver_phone=5326427412&passenger_phone=5361112233"
```

Cevapta `driver_push_sent: true` ve `passenger_push_sent: true` ise backend + token doğru; iki telefonda da bildirim gelmeli. Biri false ise o kullanıcı için logda “kullanıcı bulunamadı” veya “Push token yok” çıkar.

### Adım 5: Test bildirimi (tek kullanıcı)

Önce **UUID** ile test edin (Adım 1’deki `id`):

```bash
curl -X POST "http://SUNUCU/api/test/push-notification?user_id=KULLANICI_UUID&title=Test&body=Merhaba"
```

Bildirim geliyorsa backend + token doğru; sorun büyük ihtimalle eşleşme anında kullanılan ID’lerde veya tag verisinde. Gelmiyorsa Adım 1 ve 2’deki token/Expo mesajlarına dönün.
