# 📱 LEYLEK TAG - UYGULAMA DURUM RAPORU
## Store Yayınlama Rehberi (Google Play & Apple App Store)

**Tarih:** 31 Aralık 2024
**Versiyon:** 1.0.0
**Platform:** React Native (Expo) + FastAPI + Supabase

---

# 📊 GENEL BAKIŞ

## Uygulama Bilgileri
| Özellik | Değer |
|---------|-------|
| **Uygulama Adı** | Leylek TAG |
| **Slug** | leylektag-app |
| **Android Package** | com.leylektag.app |
| **iOS Bundle ID** | ❌ TANIMLI DEĞİL (EKLENMELİ!) |
| **Versiyon** | 1.0.0 |
| **SDK Version** | 52 |

---

# ✅ ÇALIŞAN ÖZELLİKLER

## 1️⃣ KULLANICI YÖNETİMİ
| Özellik | Durum | Endpoint |
|---------|-------|----------|
| Telefon ile kayıt | ✅ Çalışıyor | `/api/auth/register` |
| SMS OTP gönderimi | ✅ Çalışıyor (NETGSM) | `/api/auth/send-otp` |
| OTP doğrulama | ✅ Çalışıyor | `/api/auth/verify-otp` |
| PIN oluşturma | ✅ Çalışıyor | `/api/auth/set-pin` |
| PIN ile giriş | ✅ Çalışıyor | `/api/auth/verify-pin` |
| Profil güncelleme | ✅ Çalışıyor | `/api/user/update-profile` |
| Profil fotoğrafı yükleme | ✅ Çalışıyor | `/api/storage/upload-profile-photo` |

## 2️⃣ SÜRÜCÜ YÖNETİMİ
| Özellik | Durum | Endpoint |
|---------|-------|----------|
| Sürücü kaydı | ✅ Çalışıyor | `/api/user/register-driver` |
| Sürücü doğrulama | ✅ Çalışıyor | `/api/admin/toggle-user` |
| Araç fotoğrafı yükleme | ✅ Çalışıyor | `/api/storage/upload-vehicle-photo` |
| Aktif trip görüntüleme | ✅ Çalışıyor | `/api/driver/active-trip` |

## 3️⃣ YOLCULUK (TAG) SİSTEMİ
| Özellik | Durum | Endpoint |
|---------|-------|----------|
| Tag oluşturma | ✅ Çalışıyor | `/api/passenger/create-tag` |
| Tag iptal etme | ✅ Çalışıyor | `/api/passenger/cancel-tag` |
| Teklifleri görme | ✅ Çalışıyor | `/api/passenger/offers` |
| Teklif kabul etme | ✅ Çalışıyor | `/api/passenger/accept-offer` |
| Sürücü teklif gönderme | ✅ Çalışıyor | `/api/driver/send-offer` |
| Trip tamamlama | ✅ Çalışıyor | `/api/driver/complete-trip` |
| Zorla bitirme | ✅ Çalışıyor | `/api/trip/force-end` |
| Puanlama | ✅ Çalışıyor | `/api/trip/rate` |

## 4️⃣ SESLİ/GÖRÜNTÜLÜ ARAMA (AGORA RTC)
| Özellik | Durum | Notlar |
|---------|-------|--------|
| Sesli arama başlatma | ✅ Çalışıyor | Socket.IO signaling |
| Görüntülü arama başlatma | ✅ Çalışıyor | Socket.IO signaling |
| Arama alma (incoming) | ✅ Çalışıyor | Anında ulaşıyor |
| Arama kabul etme | ✅ Çalışıyor | |
| Arama reddetme | ✅ Çalışıyor | |
| Mikrofon açma/kapama | ✅ Çalışıyor | |
| Hoparlör açma/kapama | ✅ Çalışıyor | |
| Kamera açma/kapama | ✅ Çalışıyor | |
| Kamera değiştirme | ✅ Çalışıyor | |
| Local video preview | ✅ Çalışıyor | PIP görünüm |
| Remote video | ✅ Çalışıyor | Tam ekran |
| Ringback tone | ✅ Çalışıyor | Vibration pattern |
| Ringtone | ✅ Çalışıyor | Vibration pattern |

## 5️⃣ GERÇEK ZAMANLI ÖZELLİKLER
| Özellik | Durum | Teknoloji |
|---------|-------|-----------|
| Socket.IO bağlantısı | ✅ Çalışıyor | External VPS (socket.leylektag.com) |
| Konum takibi | ✅ Çalışıyor | expo-location |
| Harita görüntüleme | ✅ Çalışıyor | Google Maps |
| Rota çizimi | ✅ Çalışıyor | OSRM |

## 6️⃣ ADMİN PANELİ
| Özellik | Durum | Endpoint |
|---------|-------|----------|
| Dashboard | ✅ Çalışıyor | `/api/admin/dashboard` |
| Kullanıcı listesi | ✅ Çalışıyor | `/api/admin/users` |
| Kullanıcı detayı | ✅ Çalışıyor | `/api/admin/user-detail` |
| Raporlar | ✅ Çalışıyor | `/api/admin/reports` |
| Ayarlar | ✅ Çalışıyor | `/api/admin/settings` |
| Bildirim gönderme | ✅ Çalışıyor | `/api/admin/send-notification` |

---

# ⚠️ EKSİK / YAPILMASI GEREKENLER

## 🔴 KRİTİK (Store için ZORUNLU)

### 1. iOS Bundle Identifier (Apple Store için)
```json
// app.json'a eklenmeli:
"ios": {
  "bundleIdentifier": "com.leylektag.app",
  "buildNumber": "1.0.0",
  "supportsTablet": false
}
```
**Durum:** ❌ EKSİK

### 2. Uygulama İçi Hesap Silme (Apple ZORUNLU)
Apple, uygulama içinden hesap silme özelliğini zorunlu kılıyor.
- Backend endpoint VAR: `/api/account/delete-request`
- Web sayfası VAR: `/hesap-silme`
- **Uygulama içi buton:** ❌ EKSİK

**Yapılması Gereken:**
- Profile sayfasına "Hesabımı Sil" butonu eklenmeli
- Onay modalı gösterilmeli
- API çağrısı yapılmalı

### 3. Uygulama İçi Legal Linkler
Gizlilik Politikası ve Kullanım Şartları'na uygulama içinden erişim gerekli.
- Web sayfaları VAR: `/gizlilik-politikasi`, `/kullanim-sartlari`, `/kvkk`
- **Uygulama içi linkler:** ❌ EKSİK

## 🟡 ÖNEMLİ (Store için Önerilen)

### 4. Store Açıklaması ve Screenshots
| Gerekli | Durum |
|---------|-------|
| Kısa açıklama (80 karakter) | ❌ Hazırlanmalı |
| Uzun açıklama (4000 karakter) | ❌ Hazırlanmalı |
| Feature graphic (1024x500) | ❌ Hazırlanmalı |
| Screenshots (en az 2) | ❌ Hazırlanmalı |
| Promo video (opsiyonel) | ❌ Hazırlanmalı |

### 5. İletişim Bilgileri
| Gerekli | Durum |
|---------|-------|
| Developer email | ❌ Belirlenmeli |
| Privacy policy URL | ✅ https://[domain]/gizlilik-politikasi |
| Support URL | ❌ Belirlenmeli |

### 6. İçerik Derecelendirmesi
Google Play ve Apple Store için içerik rating anketi doldurulmalı.

---

# 🛠️ TEKNİK MİMARİ

## Backend (FastAPI)
```
📁 /app/backend/
├── server.py          # Ana API dosyası (108 fonksiyon)
├── database.py        # Supabase bağlantısı
├── .env              # Environment variables
└── requirements.txt  # Python bağımlılıkları
```

### API Endpoint Sayıları:
| Kategori | Endpoint Sayısı |
|----------|-----------------|
| Auth | 12 |
| User | 8 |
| Passenger | 8 |
| Driver | 12 |
| Admin | 15 |
| Voice/Call | 12 |
| Trip | 6 |
| Storage | 3 |
| **TOPLAM** | **~76** |

## Frontend (React Native / Expo)
```
📁 /app/frontend/
├── app/
│   ├── index.tsx           # Ana sayfa (~4000 satır)
│   ├── profile.tsx         # Profil sayfası
│   ├── history.tsx         # Geçmiş yolculuklar
│   └── driver-verify.tsx   # Sürücü doğrulama
├── components/
│   ├── CallScreenV2.tsx    # Arama ekranı
│   └── ...
├── hooks/
│   └── useSocket.ts        # Socket.IO hook
├── assets/
│   └── images/             # App iconlar, splash
└── app.json               # Expo config
```

## Veritabanı (Supabase PostgreSQL)
### Tablolar:
| Tablo | Açıklama |
|-------|----------|
| users | Kullanıcı bilgileri |
| tags | Yolculuk talepleri |
| offers | Sürücü teklifleri |
| trips | Aktif/tamamlanan yolculuklar |
| calls | Arama geçmişi |
| ratings | Puanlamalar |
| reports | Şikayetler |
| notifications | Bildirimler |
| admin_settings | Admin ayarları |

## Harici Servisler

### 1. Supabase
- **URL:** https://ujvploftywsxprlzejgc.supabase.co
- **Kullanım:** Database, Storage, Auth
- **Durum:** ✅ Aktif

### 2. Agora (RTC)
- **App ID:** 43c07f0cef814fd4a5ae3283c8bd77de
- **Kullanım:** Sesli/Görüntülü arama
- **Durum:** ✅ Aktif
- **Limit:** 10,000 dakika/ay (ücretsiz)

### 3. NETGSM (SMS OTP)
- **Usercode:** 8503078029
- **Msgheader:** KAREKOD AS
- **Durum:** ✅ Aktif

### 4. Google Maps
- **API Key:** Tanımlı (app.json)
- **Kullanım:** Harita görüntüleme
- **Durum:** ✅ Aktif

### 5. OSRM (Routing)
- **URL:** https://router.project-osrm.org
- **Kullanım:** Rota hesaplama
- **Durum:** ✅ Aktif (Public API)

### 6. Socket.IO Server
- **URL:** https://socket.leylektag.com
- **Kullanım:** Real-time signaling
- **Durum:** ✅ Aktif (External VPS)

---

# 📝 LEGAL SAYFALAR

| Sayfa | URL | Durum |
|-------|-----|-------|
| Gizlilik Politikası | /gizlilik-politikasi | ✅ Mevcut |
| Kullanım Şartları | /kullanim-sartlari | ✅ Mevcut |
| KVKK | /kvkk | ✅ Mevcut |
| Hesap Silme | /hesap-silme | ✅ Mevcut |

---

# 📦 BUILD KONFİGÜRASYONU

## EAS Build Profilleri
```json
{
  "preview": {
    "distribution": "internal",
    "android": { "buildType": "apk" }
  },
  "production": {
    "autoIncrement": true
  }
}
```

## Mevcut APK
**Son Build:** https://expo.dev/artifacts/eas/ddGTmMVJg3QDwgJ2ZGAKPm.apk
**Build ID:** 62f3c926-3064-46a0-ad23-58b132ce0276

---

# 🎯 STORE YAYINLAMA CHECKLIST

## Google Play Store

### Gerekli Dosyalar
- [ ] App Bundle (.aab) - Production build
- [ ] Screenshots (telefon: 2-8 adet)
- [ ] Feature Graphic (1024x500)
- [ ] Hi-res icon (512x512) ✅ Mevcut

### Store Listing
- [ ] Kısa açıklama (80 karakter)
- [ ] Uzun açıklama (4000 karakter)
- [ ] Uygulama kategorisi
- [ ] İçerik derecelendirmesi
- [ ] İletişim bilgileri
- [ ] Privacy policy URL ✅

### Uygulama İçi
- [ ] Hesap silme özelliği ❌
- [ ] Legal linkler ❌

## Apple App Store

### Gerekli Dosyalar
- [ ] iOS Bundle ID ❌ EKSİK
- [ ] App Store Connect hesabı
- [ ] Screenshots (iPhone: 6.5", 5.5")
- [ ] App Icon (1024x1024) ✅

### Store Listing
- [ ] Promotional text (170 karakter)
- [ ] Description (4000 karakter)
- [ ] Keywords (100 karakter)
- [ ] Support URL
- [ ] Privacy policy URL ✅

### Uygulama İçi (ZORUNLU)
- [ ] Hesap silme özelliği ❌ ZORUNLU
- [ ] Legal linkler ❌

---

# 🔧 ACİL YAPILMASI GEREKENLER

## 1. iOS Bundle ID Ekle (5 dakika)
```json
// app.json'a ekle:
"ios": {
  "bundleIdentifier": "com.leylektag.app"
}
```

## 2. Uygulama İçi Hesap Silme (30 dakika)
- Profile sayfasına buton ekle
- Onay modalı göster
- API çağrısı yap

## 3. Uygulama İçi Legal Linkler (20 dakika)
- Profile sayfasına linkler ekle
- WebView veya Linking kullan

## 4. Store Açıklamaları Hazırla (1 saat)
- Kısa/uzun açıklama
- Özellikler listesi
- Keywords

## 5. Screenshots Hazırla (1 saat)
- En az 2 screenshot
- Farklı ekran boyutları

---

# 📊 ÖZET

| Kategori | Tamamlanan | Eksik | Toplam |
|----------|------------|-------|--------|
| Backend API | 76 | 0 | 76 |
| Frontend Sayfaları | 4 | 0 | 4 |
| Arama Sistemi | 10 | 0 | 10 |
| Store Gereksinimleri | 5 | 5 | 10 |
| Legal Sayfalar | 4 | 0 | 4 |

**Genel İlerleme:** ~85%

**Store'a yayınlamak için kalan iş:** ~2-3 saat

---

# 📞 DESTEK

**NETGSM Destek:** 444 0 885
**Agora Destek:** https://www.agora.io/en/support/
**Expo Destek:** https://expo.dev/support

---

*Bu doküman 31 Aralık 2024 tarihinde oluşturulmuştur.*
