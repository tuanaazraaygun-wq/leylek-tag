# LOGO_SURFACE_MAP.md

**Phase:** P5-L2A — Logo Evolution Analysis  
**Mode:** Read-only inventory (production untouched)  
**Date:** 2026-06-21  
**Scope:** Tüm repo logo kullanım envanteri

---

## Executive summary

Production'da **üç ayrı logo ailesi** paralel yaşar:

| Aile | Form | Ana dosya(lar) | Birincil yüzeyler |
|------|------|----------------|-------------------|
| **A — Premium kuş** | 3D metalik leylek + orbital arc | `leylek-logo-premium.png` | Mobil splash, login, Leylek Zeka, watermark |
| **B — Pin / arc ikon** | Gradient harita pini veya wireframe arc | `logo-leylek.svg`, `leylektag-icon.png` | Website favicon/navbar, Android native splash (pin türevi) |
| **C — Wordmark + flat kuş** | Yatay banner, düz siluet | `feature-graphic.png` | Website hero, OG image |

Ek olarak **LeylekEye** (SVG göz) ve **Muhabbet illüstrasyonları** (`leylek-blue.png`, `leylek-header.png`) marka ile ilişkili ama **master logo değil**.

---

## 1. Frontend (React Native / Expo)

### 1.1 Asset dosyaları

| Dosya yolu | Format | Boyut (repo) | Aile |
|------------|--------|--------------|------|
| `frontend/assets/images/leylek-logo-premium.png` | PNG raster | ~512+ | **A — Premium kuş** |
| `frontend/assets/ios.premium.logo.png` | PNG | iOS override | **A** |
| `frontend/assets/images/adaptive-icon-foreground.png` | PNG | 432 dp safe | **B/C karışık** (wireframe arc benzeri) |
| `frontend/assets/images/adaptive-icon.png` | PNG | Orphan | B |
| `frontend/assets/images/icon.png` | PNG | Orphan (`app.json` referansı yok) | B |
| `frontend/assets/images/favicon.png` | PNG | Expo web | B |
| `frontend/assets/images/login-brand.png` | PNG | Kullanılmıyor (require yok) | — |
| `frontend/assets/images/leylek-blue.png` | PNG | Muhabbet hero illüstrasyon | C — illüstrasyon |
| `frontend/assets/images/leylek-header.png` | PNG | Muhabbet header bubble | C — illüstrasyon |

### 1.2 Expo manifest (`frontend/app.json`)

| Key | Asset | Yüzey |
|-----|-------|-------|
| `expo.icon` | `leylek-logo-premium.png` | App icon (EAS/prebuild) |
| `expo.ios.icon` | `ios.premium.logo.png` | iOS App Store icon |
| `expo.android.adaptiveIcon.foregroundImage` | `adaptive-icon-foreground.png` | Android adaptive foreground |
| `expo.android.adaptiveIcon.backgroundColor` | `#08111F` | Adaptive zemin |
| `expo.splash.image` | `leylek-logo-premium.png` | Native splash (kısa flash) |
| `expo.splash.backgroundColor` | `#08111F` | Splash zemin |
| `expo.web.favicon` | `favicon.png` | Expo web |
| `plugins.expo-notifications.icon` | `leylek-logo-premium.png` | Android bildirim küçük ikon |
| `plugins.expo-notifications.color` | `#22D3EE` | Bildirim tint |

### 1.3 Android native (`frontend/android/app/src/main/res/`)

| Dosya | Yüzey |
|-------|-------|
| `drawable-*dpi/splashscreen_logo.png` (×5 DPI) | Native splash merkez görseli — **pin ailesi** |
| `mipmap-*dpi/ic_launcher_foreground.png` | Launcher adaptive foreground |
| `mipmap-*dpi/ic_launcher.png` / `ic_launcher_round.png` | Legacy launcher |
| `drawable/ic_launcher_background.xml` | `#08111F` + splash bitmap |
| `values/colors.xml` | `iconBackground`, `splashscreen_background` |

**Risk:** `app.json` premium PNG ile `res/` pin/arc raster **senkron değil** olabilir.

### 1.4 Bileşen tüketicileri

| Bileşen | Asset / kaynak | Yüzey | Amaç |
|---------|----------------|-------|------|
| `components/SplashScreen.tsx` | `leylek-logo-premium.png` | **Splash** (JS, ~2.5s) | Açılış marka anı; breathe animasyon |
| `components/auth/LoginBrandHeader.tsx` | `leylek-logo-premium.png` | **Login** | Giriş marka kümesi |
| `components/LeylekZekaChat.tsx` | `leylek-logo-premium.png` | **Leylek Zeka** | Chat header avatar |
| `components/LeylekZekaWidget.tsx` | `leylek-logo-premium.png` + `LeylekEye` | **Leylek Zeka / harita FAB** | Widget header + map overlay |
| `components/MuhabbetWatermark.tsx` | `leylek-logo-premium.png` | **Watermark** | Muhabbet içerik filigranı |
| `components/Logo.tsx` | `leylek-logo-premium.png` | Legacy | Import yok — muhtemelen ölü kod |
| `components/LeylekMuhabbetiHomeTab.tsx` | `leylek-blue.png` | Muhabbet hero | İllüstrasyon (logo değil) |
| `components/LeylekMuhabbetiFaz1Screen.tsx` | `leylek-header.png` | Muhabbet header | Dekoratif balon |
| `design-system/leylek-eye/LeylekEye.tsx` | Inline SVG | **Loading / transition / rating / Zeka** | Animasyonlu göz — logo türevi |
| `components/TagMatchTransitionOverlay.tsx` | `LeylekEye` | Match transition | Eşleşme geçişi |
| `components/RatingModal.tsx` | `LeylekEye` | Post-trip rating | Değerlendirme |
| `components/superUx/LeylekEyeTrigger.tsx` | `LeylekEye` wrapper | Harita FAB | Leylek Zeka tetikleyici |
| `app/_layout.tsx` | — | Native splash | `ExpoSplashScreen.hideAsync()` anında |
| `app/settings-hub.tsx` | Route only | Ayarlar | `/privacy`, `/terms`, `/kvkk` — logo yok |

**Ekran görüntüsü notu:** Splash ve login'de premium kuş koyu navy zemin üzerinde ortalanır; orbital arc glow ile birlikte görünür. Harita Zeka widget'ında logo ~18–28 px tile içinde küçültülür.

---

## 2. Website (Next.js)

### 2.1 Static assets (`website/public/`)

| Dosya yolu | Format | Aile | Aktif? |
|------------|--------|------|--------|
| `store/leylektag-icon.png` | PNG | **B — wireframe arc** | ✅ favicon, navbar, PWA icons |
| `store/feature-graphic.png` | PNG wide | **C — wordmark banner** | ✅ hero, OG |
| `store/leylek-logo-premium.png` | PNG | **A — premium kuş** | Leylek Zeka mark primary |
| `app-icon.png` | PNG | Legacy fallback | Navbar fallback chain |
| `logo-leylek.svg` | SVG gradient pin | **B — pin** | ❌ Orphan (kod referansı yok) |
| `branding/leylektag-icon.png` | PNG | B | Kampanya kopyası |
| `branding/feature-graphic.png` | PNG | C | Kampanya kopyası |
| `branding/leylektag-yolcu-*.png` | PNG | App Store vitrin | Logo içerir (ekran mockup) |
| `branding/leylektag-surucu-*.png` | PNG | App Store vitrin | Logo içerir |
| `store/yolcu*.png`, `surucu*.png` | PNG | Store screenshots | UI içinde mark |
| `store/ipad-showcase/*.png` | PNG | iPad vitrin | UI içinde mark |

### 2.2 Config & bileşenler

| Dosya | Asset path | Yüzey |
|-------|------------|-------|
| `lib/branding-assets.ts` | `BRANDING_PATHS.*` | Merkezi path tanımı |
| `app/layout.tsx` | favicon, icon192/512, appleTouch, ogImage | **Metadata / PWA** |
| `components/navbar.tsx` | `logoMark` + fallbacks | **Website header** |
| `components/footer.tsx` | `logoMark` + fallbacks | Footer mark |
| `components/hero-horizontal-logo.tsx` | `logoHorizontal` (feature-graphic) | **Website hero** + cyan/violet blur wrapper |
| `components/leylek-zeka-mark.tsx` | premium PNG → icon fallback | **Leylek Zeka** web tile |
| `components/branding-image.tsx` | Multi-source fallback | Hero/nav resiliency |

**Ekran görüntüsü notu:** Navbar'da `leylektag-icon.png` ~28–36 px; wireframe arc + cyan dot, koyu zemin. Hero'da `feature-graphic.png` geniş wordmark + telefon mockup — violet/cyan ambient blur ile sarılı.

---

## 3. Backend / legacy web

| Dosya | Asset referansı | Yüzey |
|-------|-----------------|-------|
| `backend/templates/landing.html` | `/static/images/leylek-logo.png` | Header, hero, footer |
| `backend/templates/kvkk.html` | `leylek-logo.png` | Legal header |
| `backend/templates/gizlilik-politikasi.html` | `leylek-logo.png` | Legal header |
| `backend/templates/kullanim-sartlari.html` | `leylek-logo.png` | Legal header |
| `backend/templates/hesap-silme.html` | `leylek-logo.png` | Legal header |
| `website_files/*.html` | `leylek-logo.png` | Legacy static mirror |

**Not:** `backend/static/images/leylek-logo.png` repo taramasında ayrı glob ile doğrulanmalı; template'ler pin/kuş PNG bekler.

---

## 4. Store & marketing assets

| Konum | İçerik | Logo rolü |
|-------|--------|-----------|
| `website/public/store/feature-graphic.png` | 1024×500 Play feature graphic | Flat kuş + wordmark + telefon |
| `website/public/branding/feature-graphic.png` | Duplicate | Marketing |
| App Store vitrin PNG'leri | Ekran görüntüsü kompozit | Uygulama içi mark yansıması |
| `frontend/app.json` `privacyPolicyUrl` | — | Store listing metadata (logo değil) |

---

## 5. Design-lab (referans — production değil)

| Dosya | Rol |
|-------|-----|
| `design-lab/brand-dna/v4/exports/svg/f1-meridian-wing-icon-1024.svg` | F1 ship candidate |
| `design-lab/brand-dna/v4/exports/svg/f1-meridian-wing-master.svg` | F1 master (Phase 4) |
| `design-lab/brand-dna/v4/exports/png/f1/**` | F1 size ladder, iOS set, favicon |
| `design-lab/brand-dna/v4/logo-sketch-lab/FINALIST_01_MERIDIAN_WING.md` | F1 spec |
| `design-lab/brand-dna/v4/exports/PHASE5_LOGO_MIGRATION_ANALYSIS.md` | Migration envanter |

---

## 6. Yüzey → asset eşleme matrisi

| Yüzey | Birincil asset | Aile | Boyut bandı | QA notu |
|-------|----------------|------|-------------|---------|
| App icon iOS | `ios.premium.logo.png` | A | 1024→29 px | Squircle clip; ince bacak risk |
| App icon Android adaptive | `adaptive-icon-foreground.png` | B wireframe | 432 safe | Premium kuş değil |
| Native splash Android | `splashscreen_logo.png` | B pin | DPI ladder | JS splash ile farklı aile |
| JS Splash | `leylek-logo-premium.png` | A | ~120–180 px | Breathe motion |
| Login | `leylek-logo-premium.png` | A | ~80–120 px | Slogan altında |
| Leylek Zeka (mobil) | premium PNG + LeylekEye | A + göz SVG | 18–66 px | İki farklı marka dili |
| Leylek Zeka (web) | premium PNG / icon fallback | A / B | 18–28 px | Tile glow |
| Watermark | `leylek-logo-premium.png` | A | ~40 px, düşük opacity | Harita üstü |
| Website navbar | `leylektag-icon.png` | B | 28–36 px | Arc okunur; leylek zayıf |
| Website hero | `feature-graphic.png` | C | 560×112 display | Wordmark bağımlı |
| Favicon / PWA | `leylektag-icon.png` | B | 16–512 | Arc + dot |
| OG / social | `feature-graphic.png` | C | 1200×630 crop | Marketing kompozit |
| Push notification | `leylek-logo-premium.png` | A | Monochrome küçük | Detay kaybı riski |
| Muhabbet hero | `leylek-blue.png` | İllüstrasyon | Full width | Logo evrim kapsamı dışı |
| Match transition | LeylekEye SVG | Göz türevi | 66 px | Logo değil — companion |
| Legal pages (backend) | `leylek-logo.png` | Bilinmiyor | ~40 px header | Pin veya kuş kopyası |

---

## 7. Orphan / tutarsızlık listesi

| Bulgu | Etki |
|-------|------|
| `logo-leylek.svg` kodda referans yok | Dead asset; pin gradient hâlâ repoda |
| `Logo.tsx` import yok | Dead component |
| `login-brand.png` require yok | Unused asset |
| iOS icon ≠ Android adaptive ≠ navbar icon | Üç farklı marka algısı |
| Native splash (pin) ≠ JS splash (kuş) | İlk 200 ms çift kimlik |
| `legal-content.ts` gizlilik vs `privacy-policy-locales` | Website içerik (logo ile ilgili değil) |

---

## 8. F1 migration hedef yüzeyleri (referans)

Phase 5 handoff'a göre F1 (`f1-meridian-wing-*`) şu production path'lere map edilir — **bu analizde uygulanmadı**:

- `frontend/assets/images/leylek-logo-premium.png`
- `website/public/store/leylektag-icon.png`
- `website/public/logo-leylek.svg` (opsiyonel replace)
- Android `res/` mipmaps + splash
- iOS AppIcon ladder

Detay: `design-lab/brand-dna/v4/exports/PHASE5_MIGRATION_HANDOFF.md`

---

**Sonraki belge:** `LOGO_EVOLUTION_ANALYSIS.md` — puanlama ve F1 değerlendirmesi.
