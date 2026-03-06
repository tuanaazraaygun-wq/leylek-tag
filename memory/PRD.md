# Leylek TAG - Product Requirements Document

## Original Problem Statement
Ride-sharing application with QR-based trip ending, symmetric rating system, driver activation packages, and intelligent dispatch queue.

## Core Features
1. **QR Trip Ending System** - Personal QR codes for instant trip completion
2. **Symmetric Rating System** - Both driver and passenger rate each other
3. **Driver Activation Packages** - Time-based packages (3, 6, 9, 12, 24 hours)
4. **Driver Dashboard** - Stats panel showing earnings, trips, active time
5. **Dispatch Queue System** - Intelligent driver matching by proximity and rating
6. **Admin Panel** - Comprehensive dashboard for platform management
7. **In-App Navigation** - OSRM-based route display without external app

## Tech Stack
- **Frontend:** React Native (Expo)
- **Backend:** FastAPI + Python Socket.IO
- **Database:** Supabase (PostgreSQL)
- **Real-time:** Socket.IO for live updates
- **Production Server:** api.leylektag.com (157.173.113.156)
- **Routing:** OSRM (Open Source Routing Machine) - Free, unlimited

## What's Been Implemented

### 2026-12-15 - Beyaz Ekran Fix & In-App Navigation
- **BEYAZ EKRAN FİX:**
  - `admin.tsx`'den LinearGradient kaldırıldı (Android uyumluluk)
  - `admin.tsx`'den FlatList kaldırıldı → ScrollView + .map() ile değiştirildi
  - Bu değişiklikler bazı Android cihazlardaki render sorunlarını çözmeli
- **IN-APP NAVİGASYON TAMAMLANDI:**
  - `startInAppNavigation()` fonksiyonu OSRM rotasını kullanıyor
  - Google Directions API bağımlılığı kaldırıldı (ücretsiz çözüm)
  - Harita üzerinde yeşil rota ile yolcu konumu gösterilir
- **UI FİX:**
  - Matrix durum yazısı pozisyonu düzeltildi (top: 155px)
- **FILES:** `/app/frontend/app/admin.tsx`, `/app/frontend/components/LiveMapView.tsx`

### 2026-03-06 - Admin Panel Tam Güncelleme
- **YENİ ÖZELLİKLER:**
  - Dashboard: Kullanıcı, sürücü, yolcu, online sürücü, bugün/hafta tamamlanan istatistikleri
  - Kullanıcılar: Arama, soft delete (Supabase'de kalır), ban/unban, IP ve cihaz bilgisi gösterimi
  - Yolculuklar: Aktif yolculuklar (yatay scroll) + tüm yolculuk geçmişi
  - Online Sürücüler: Anlık online sürücü listesi, admin'in sürücüyü offline yapabilmesi
  - Promosyonlar: Kod oluşturma, aktif/pasif yapma, kullanım takibi
  - Bildirimler: Push notification gönderme (herkese, sürücülere, yolculara)
  - Giriş Logları: IP, cihaz, başarılı/başarısız girişler, Türkiye/Yabancı filtresi
  - Ayarlar: Fiyatlandırma ve dispatch ayarları görüntüleme
- **TÜRKİYE IP KONTROLÜ:** VPN ile girişi engelleyen /auth/secure-login endpoint'i eklendi
- **FILES:** `/app/frontend/components/AdminPanel.tsx`, `/app/backend/server.py`

### 2026-03-05 - QR Konum Kontrolü
- **YENİ ÖZELLİK:** Sürücü QR kodu göstermeden önce yolcu konumu kontrol edilir
- Yolcu 150 metre içindeyse → QR kod gösterilir
- Yolcu uzaktaysa → "Yolcu Yakın Değil" uyarısı gösterilir

## Prioritized Backlog

### P0 - Critical
- [x] Fix app crash on role selection
- [x] Implement dispatch queue system
- [x] Fix Admin Panel empty data bug
- [x] Fix Admin Panel white screen (LinearGradient/FlatList removed)
- [x] Complete In-App Navigation

### P1 - High Priority
- [ ] iyzico payment integration for driver packages
- [ ] Fix NETGSM SMS authentication (need server IP whitelist: 157.173.113.156)
- [ ] **Build new APK with latest fixes** ← SONRAKI ADIM

### P2 - Medium Priority
- [ ] Push notification system full integration
- [ ] Backend service modules integration (iyzico, push notifications)
- [ ] Admin panel logging view improvements
- [ ] Refactor index.tsx (10,000+ lines)

### P3 - Low Priority
- [ ] Performance optimizations
- [ ] Additional admin features

## Key Files
- `/app/frontend/app/index.tsx` - Main app file (10,000+ lines - needs refactoring)
- `/app/frontend/app/admin.tsx` - Admin Panel (FIXED - no LinearGradient/FlatList)
- `/app/frontend/components/LiveMapView.tsx` - Map view with in-app navigation
- `/app/frontend/components/QRTripEndModal.tsx` - QR scanning flow
- `/app/backend/server.py` - Backend API + Socket.IO + Dispatch Queue

## Admin Panel API Endpoints
- `GET /api/admin/check?phone=...` - Check admin status
- `GET /api/admin/dashboard/full?admin_phone=...` - Get dashboard stats
- `GET /api/admin/users/full?admin_phone=...` - Get users list
- `GET /api/admin/trips?admin_phone=...` - Get trips list
- `GET /api/admin/pricing?phone=...` - Get pricing settings
- `GET /api/admin/kyc/all?admin_phone=...` - Get KYC requests

## Known Issues
- NETGSM authentication error (code 30) - needs server IP whitelist (157.173.113.156)
- TypeScript type definition warnings (non-breaking)

## Admin Credentials
- Admin Phone: 5326497412
- Production Server: api.leylektag.com (157.173.113.156)
