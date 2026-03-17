# Bildirim Düzeltmesi – Adım Adım Ne Yapacaksın

---

## ADIM 1: Backend’i güncelle ve çalıştır

1. Proje klasöründe backend’teki son değişikliklerin olduğundan emin ol (Expo push düzeltmesi ve debug endpoint’leri).
2. Backend’i **ya yerelde çalıştır** ya da **sunucuya deploy et** (api.leylektag.com kullanıyorsan oraya).

**Yerelde çalıştırmak için (PowerShell):**
```powershell
cd c:\dev\leylek-tag\backend
python -m uvicorn backend.server:socket_app --host 0.0.0.0 --port 8000
```
Çalıştığında tarayıcıda `http://localhost:8000` açılıyorsa tamam.

**Sunucuya deploy ediyorsan:**  
Kendi yönteminle (git push, FTP, panel vb.) backend kodunu sunucuya at ve API’yi yeniden başlat.

---

## ADIM 2: Token’lar kayıtlı mı kontrol et

1. Bilgisayarda tarayıcı veya terminal aç.
2. Aşağıdaki adresi kullan.  
   - **Yerel backend** kullanıyorsan: `http://localhost:8000`  
   - **Canlı sunucu** kullanıyorsan: `https://api.leylektag.com`

**Tarayıcıda açılacak adres (yerel örnek):**
```
http://localhost:8000/api/admin/push-debug?admin_phone=5326497412
```

**Veya PowerShell’de:**
```powershell
curl "http://localhost:8000/api/admin/push-debug?admin_phone=5326497412"
```
(Canlı kullanıyorsan `http://localhost:8000` yerine `https://api.leylektag.com` yaz.)

3. Dönen JSON’a bak:
   - **"users": []** veya liste boş → Hiç kullanıcının push token’ı yok. **ADIM 4’e geç** (telefonlarda izin + giriş).
   - **"users": [ {...}, ... ]** var ve bazılarında **"token_valid_format": true** → Token’lar kayıtlı. **ADIM 3’e geç** (test bildirimi at).

---

## ADIM 3: Tek numaraya test bildirimi at

1. Yine tarayıcı veya PowerShell kullan. Bu sefer **POST** isteği atacaksın.

**PowerShell’de (yerel backend):**
```powershell
Invoke-RestMethod -Method POST -Uri "http://localhost:8000/api/test/push-notification-by-phone?admin_phone=5326497412&phone=5326497412&title=Test&body=Merhaba%20bu%20bir%20test"
```

**Veya curl ile (Git Bash / WSL):**
```bash
curl -X POST "http://localhost:8000/api/test/push-notification-by-phone?admin_phone=5326497412&phone=5326497412&title=Test&body=Merhaba"
```

(Canlı kullanıyorsan `http://localhost:8000` yerine `https://api.leylektag.com` yaz.)

2. Dönen cevaba bak:
   - **"success": true** → Backend ve Expo bildirimi kabul etti. Telefonda bildirim gelmediyse **ADIM 5** (cihaz ayarları).
   - **"success": false** ve **"expo_receipt"** içinde **"message": "DeviceNotRegistered"** → Token geçersiz. **ADIM 4** (telefonda uygulama aç, giriş yap, token tekrar kaydolsun).
   - **"error": "Bu numaraya kayıtlı kullanıcı bulunamadı"** → Veritabanında bu numara yok; önce uygulamadan bu numarayla kayıt ol / giriş yap.
   - **"error": "Kullanıcının kayıtlı push token'ı yok"** → Token hiç kayıtlı değil. **ADIM 4**.

---

## ADIM 4: Telefonlarda token’ın kaydedilmesini sağla

Her iki telefonda da:

1. **Bildirim izni**
   - Ayarlar → Uygulamalar → Leylek TAG → Bildirimler **Açık**.
   - İlk açılışta uygulama “Bildirimlere izin ver” derse **İzin ver** de.

2. **Uygulamayı aç**
   - Leylek TAG’i aç.
   - **5326497412** ile (veya test etmek istediğin numarayla) giriş yap.
   - Ana ekrana gelene kadar bekle (giriş sonrası token otomatik backend’e gidecek).

3. **İstersen çıkış yapıp tekrar giriş yap**
   - Profil / Ayarlar’dan Çıkış yap, sonra tekrar aynı numarayla giriş yap. Bu, token’ın tekrar kaydedilmesini tetikler.

4. **5–10 saniye bekle**, sonra tekrar **ADIM 2** ve **ADIM 3**’ü yap (push-debug ve test bildirimi). Bu sefer listede kullanıcı ve `token_valid_format: true` görünmeli; test bildirimi de `success: true` dönmeli.

---

## ADIM 5: Cihazda bildirim gelmiyorsa (sunucu “success” diyorsa)

Backend “success” diyor ama telefonda bildirim yoksa:

1. **Bildirimler açık mı**
   - Ayarlar → Uygulamalar → Leylek TAG → Bildirimler **Açık**, “Duyurular” veya “Genel” kanalı açık olsun.

2. **Batarya / optimizasyon**
   - Ayarlar → Pil / Batarya → Uygulama kısıtlamaları (veya “Uyku modu”).
   - Leylek TAG’i **kısıtlanmayan** / **optimize edilmeyen** listesine al.

3. **Uygulamayı bir kez tam kapatıp tekrar aç**
   - Son çekmecede kapat, tekrar aç, tekrar test bildirimi at (ADIM 3).

---

## ADIM 6: Admin panelden toplu bildirim dene

1. Telefonda Leylek TAG’i aç.
2. **5326497412** ile giriş yap.
3. Admin paneli aç (ana ekranda admin isen panel butonu çıkar).
4. “Bildirim gönder” / “Duyuru” benzeri bölüme gir.
5. Başlık ve mesaj yaz (ör: “Test”, “Merhaba”).
6. Hedef: **Tümü** (veya sadece kendini test edeceksen ilgili seçenek varsa onu seç).
7. Gönder’e bas.

- Bildirim(ler) gelirse: Akış tamam.
- Gelmezse: Backend log’larına bak; “Push token'ı olan kullanıcı bulunamadı” varsa tekrar **ADIM 2** ve **ADIM 4** ile token’ların kayıtlı olduğundan emin ol.

---

## Kısa özet sırası

| Sıra | Ne yapıyorsun |
|------|-------------------------------|
| 1    | Backend’i güncel kodla çalıştır / deploy et |
| 2    | `push-debug` ile token’ları kontrol et |
| 3    | Test bildirimi at, `expo_receipt` ve `success` değerine bak |
| 4    | Telefonlarda bildirim izni ver, uygulamayı aç, giriş yap (token kaydolsun) |
| 5    | Hâlâ gelmiyorsa cihaz bildirim ve batarya ayarlarını kontrol et |
| 6    | Admin panelden bildirim gönderip sonucu gör |

Bu sırayı takip et; bir adımda takılırsan o adımın çıktısını (örneğin push-debug JSON’ı veya test bildirimi cevabı) paylaşırsan bir sonraki adımı net söyleyebilirim.
