# Backend deploy – adım adım

Sunucu: **157.173.113.156**  
Dizin: **/opt/leylektag/**  
Servis: **leylektag.service**

---

## Yöntem A: PowerShell script ile (şifre elle)

1. **PowerShell’i aç** (Windows’ta Win+X → “Windows PowerShell” veya “Terminal”).

2. **Proje klasörüne geç:**
   ```powershell
   cd c:\dev\leylek-tag
   ```

3. **Deploy script’ini çalıştır:**
   ```powershell
   .\deploy-backend.ps1
   ```

4. **Şifre istenirse** sunucu şifresini yaz (root şifresi).  
   - Önce `scp` için bir kez,  
   - Sonra `ssh` için bir kez daha isteyebilir.

5. Çıktıda şunları görürsün:
   - `server.py` yüklendi
   - `leylektag.service` yeniden başlatıldı, `active (running)`
   - İsteğe bağlı: push-test-by-phone endpoint testi

---

## Yöntem B: PuTTY (pscp + plink) ile – şifre komutta

1. **PowerShell’i aç**, proje klasörüne geç:
   ```powershell
   cd c:\dev\leylek-tag
   ```

2. **server.py’yi sunucuya kopyala** (şifreyi kendi şifrenle değiştir):
   ```powershell
   & "C:\Program Files\PuTTY\pscp.exe" -pw "SIFREN" -batch backend\server.py root@157.173.113.156:/opt/leylektag/server.py
   ```

3. **Servisi yeniden başlat:**
   ```powershell
   & "C:\Program Files\PuTTY\plink.exe" -pw "SIFREN" -batch root@157.173.113.156 "sudo systemctl restart leylektag.service && sleep 2 && sudo systemctl status leylektag.service --no-pager"
   ```

4. Çıktıda **`Active: active (running)`** görünmeli.

---

## Kontrol

- **API canlı mı:** Tarayıcıda veya curl ile bir endpoint deneyin (örn. push-test).

- **Push test (telefon ile):** Tarayıcıda veya PowerShell:
  ```powershell
  Invoke-RestMethod "https://api.leylektag.com/api/admin/push-test-by-phone?admin_phone=5326497412&phone=5326427412" | ConvertTo-Json
  ```
  `success: true` ve telefonda bildirim gelmeli.

- **Eşleşme bildirimi testi (iki numaraya):** Admin telefon + sürücü + yolcu:
  ```powershell
  # Önce sürücü ve yolcu UUID'lerini Supabase'den alın; sonra:
  Invoke-RestMethod "https://api.leylektag.com/api/test/match-notification?passenger_id=YOLCU_UUID&driver_id=SURUCU_UUID&eta_min=3" -Method POST | ConvertTo-Json
  ```

---

## Hata alırsan

- **“Upload failed” / “Permission denied”**  
  Şifreyi kontrol et; sunucuda `/opt/leylektag/` yazılabilir olmalı.

- **“Service restart failed”**  
  SSH ile bağlanıp elle dene:  
  `ssh root@157.173.113.156`  
  `sudo systemctl restart leylektag.service`  
  `sudo systemctl status leylektag.service`

- **PuTTY yok**  
  [PuTTY indir](https://www.putty.org/) veya Yöntem A’yı kullan (script içinde `scp`/`ssh` şifre ister).
