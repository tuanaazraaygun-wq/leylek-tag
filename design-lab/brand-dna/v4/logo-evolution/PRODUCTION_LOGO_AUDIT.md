# LeylekTAG Production Logo Audit

**Phase:** P1 — Logo Evolution Analysis  
**Mode:** Read-only production scan  
**Date:** 2026-06-21  
**Scan scope:** website, frontend, backend templates, splash, login, watermark, app icon, adaptive icon, notification, QR surfaces, Leylek Zeka, navbar, favicon, OG, markers companion  
**Inventory detail:** `LOGO_SURFACE_MAP.md`

---

## Executive summary

Production'da **kritik tutarsızlık**: aynı uygulama ve web sitesi **üç farklı logo ailesi** gösteriyor. Kullanıcı splash'te premium kuş, favicon'da wireframe arc, Android native splash'te pin görür. iOS ve Android home screen icon'ları **farklı marka**.

| Severity | Bulgu sayısı |
|----------|--------------|
| **P0 — Blocker** | 6 |
| **P1 — High** | 8 |
| **P2 — Medium** | 7 |
| **P3 — Low / cleanup** | 5 |

**Evrim önceliği:** Aile A (premium kuş) canonical; B/C birleştirilir — yeni marka değil.

---

## 1. Logo ailesi envanteri

### Aile A — Premium kuş + orbital arc

| Dosya | Konum |
|-------|-------|
| `leylek-logo-premium.png` | `frontend/assets/images/` |
| `leylek-logo-premium.png` | `website/public/store/` |
| `ios.premium.logo.png` | `frontend/assets/` |

**Tüketiciler:** SplashScreen, LoginBrandHeader, LeylekZekaChat, LeylekZekaWidget, MuhabbetWatermark, expo icon, notification icon, splash config.

### Aile B — Pin / wireframe arc

| Dosya | Konum |
|-------|-------|
| `logo-leylek.svg` | `website/public/` — **orphan** |
| `leylektag-icon.png` | `website/public/store/` |
| `leylektag-icon.png` | `website/public/branding/` |
| `favicon.png` | `frontend/assets/images/` |
| `adaptive-icon-foreground.png` | `frontend/assets/images/` |
| `adaptive-icon.png` | `frontend/assets/images/` — orphan |
| `icon.png` | `frontend/assets/images/` — orphan |
| `splashscreen_logo.png` ×5 DPI | `frontend/android/app/src/main/res/drawable-*dpi/` |
| `ic_launcher_foreground.png` | `frontend/android/.../mipmap-*dpi/` |

**Tüketiciler:** Website navbar/footer/favicon/PWA, Android native splash, adaptive icon, Expo web favicon.

### Aile C — Wordmark banner

| Dosya | Konum |
|-------|-------|
| `feature-graphic.png` | `website/public/store/` |
| `feature-graphic.png` | `website/public/branding/` |
| `app-icon.png` | `website/public/` — legacy fallback |

**Tüketiciler:** HeroHorizontalLogo, OG image, Twitter card, footer horizontal.

---

## 2. Yüzey bazlı audit

### 2.1 Splash

| Katman | Asset | Aile | Sorun |
|--------|-------|------|-------|
| JS Splash (`SplashScreen.tsx`) | `leylek-logo-premium.png` | A | ✅ Doğru aile |
| Expo native (`app.json` splash.image) | `leylek-logo-premium.png` | A | ✅ |
| Android native (`splashscreen_logo.png`) | Pin türevi raster | B | **P0 — JS ile farklı aile** |
| Zemin | `#08111F` | — | `#0D1117` drift (P2) |

**Kullanıcı deneyimi:** İlk ~200 ms pin, sonra kuş — çift kimlik.

### 2.2 Login / onboarding

| Yüzey | Asset | Aile | Sorun |
|-------|-------|------|-------|
| `LoginBrandHeader.tsx` default | premium PNG | A | ✅ |
| `LoginBrandHeader.tsx` premium theme | premium PNG | A | ✅ |
| `Logo.tsx` | premium PNG | A | **P3 — import yok, dead code** |
| `login-brand.png` | — | — | **P3 — unused asset** |
| Driver KYC onboarding | Text only | — | Logo yok (OK) |

### 2.3 App icon

| Platform | Config | Asset | Aile | Sorun |
|----------|--------|-------|------|-------|
| iOS | `app.json` expo.ios.icon | `ios.premium.logo.png` | A | Squircle clip ince detay riski P1 |
| Android adaptive | foregroundImage | `adaptive-icon-foreground.png` | B | **P0 — iOS ≠ Android** |
| Expo default icon | expo.icon | `leylek-logo-premium.png` | A | prebuild ile mipmap sync belirsiz P1 |
| Legacy `icon.png` | — | orphan | B | **P3 — cleanup** |

### 2.4 Adaptive icon

| Öğe | Değer | Sorun |
|-----|-------|-------|
| Foreground | wireframe arc | Premium kuş değil — **P0** |
| Background | `#08111F` | OK |
| Safe zone | 432 dp | Wing/kuş apex clip testi yapılmamış P1 |

### 2.5 Notification icon

| Config | Asset | Sorun |
|--------|-------|-------|
| `expo-notifications` icon | `leylek-logo-premium.png` | Aile A — detay kaybı küçük monochrome P1 |
| tint color | `#22D3EE` | Genom `#00D4AA` drift P2 |

### 2.6 Favicon / PWA

| Yüzey | Path | Asset | Aile |
|-------|------|-------|------|
| Website favicon | `BRANDING_PATHS.favicon` | `leylektag-icon.png` | B |
| icon192/512 | same | B | B |
| appleTouch | same | B | B |
| Expo web | `favicon.png` | frontend asset | B |
| themeColor | `#0072FF` | — | Logo cyan genom dışı P2 |

**Sorun:** Mobil app icon (A) ≠ web favicon (B) — **P0**.

### 2.7 Website navbar / footer

| Bileşen | Asset chain | Aile | Sorun |
|---------|-------------|------|-------|
| `navbar.tsx` | logoMark → fallbacks | B | Arc-only; leylek zayıf P1 |
| `footer.tsx` | logoMark + horizontal | B + C | Mixed P1 |
| Fallback | `app-icon.png` | legacy | **P3 orphan chain** |

### 2.8 Website hero

| Bileşen | Asset | Sorun |
|---------|-------|-------|
| `hero-horizontal-logo.tsx` | `feature-graphic.png` | C — OK hikâye |
| Violet blur wrapper | CSS gradient | **P1 — constitution ihlali** |
| Cyan ambient | OK | — |

```12:12:website/components/hero-horizontal-logo.tsx
      <div className="pointer-events-none absolute -inset-4 rounded-3xl bg-gradient-to-r from-cyan-400/15 via-transparent to-violet-400/15 blur-xl" />
```

### 2.9 OG / social

| Meta | Asset | Boyut | Sorun |
|------|-------|-------|-------|
| openGraph.images | `feature-graphic.png` | 1200×630 crop | C — marketing OK |
| twitter.images | same | — | OK |
| Alt text | "Leylek TAG" | — | OK |

### 2.10 Leylek Zeka

| Yüzey | Mobil | Web | Sorun |
|-------|-------|-----|-------|
| Chat header | premium PNG | — | A |
| Widget | premium + LeylekEye | — | İki companion P2 |
| Web mark | — | premium → icon fallback | A/B fallback P2 |

### 2.11 Watermark

| Bileşen | Asset | Sorun |
|---------|-------|-------|
| `MuhabbetWatermark.tsx` | premium PNG | Detaylı — düşük opacity gürültü P2 |

### 2.12 QR surfaces

| Yüzey | Logo kullanımı | Not |
|-------|----------------|-----|
| `DriverBoardingQRModal.tsx` | Ionicons qr-code — logo yok | Lock animasyonu logo ring ile sync potansiyeli P6 |
| QR camera UI | Viewfinder — mark yok | OK |

QR akışında logo görünmüyor; evrim fırsatı: QR verify anında orbital arc ring close.

### 2.13 LeylekEye (companion)

| Tüketici | Boyut | Sorun |
|----------|-------|-------|
| TagMatchTransitionOverlay | 66 px | Logo stil farkı P2 |
| RatingModal | role select | OK companion |
| LeylekEyeTrigger | FAB | Iris `#38BDD4` — genom drift P2 |
| LeylekZekaWidget | overlay | premium PNG + Eye — dual mark P2 |

### 2.14 Backend / legacy

| Template | Referans | Repo'da dosya |
|----------|----------|---------------|
| `landing.html` | `/static/images/leylek-logo.png` | **❌ YOK** — P0 deploy risk |
| `kvkk.html` | same | **❌ YOK** |
| `gizlilik-politikasi.html` | same | **❌ YOK** |
| `kullanim-sartlari.html` | same | **❌ YOK** |
| `hesap-silme.html` | same | **❌ YOK** |
| `website_files/*.html` | `leylek-logo.png` local | Mirror — stale P2 |

**Not:** `backend/static/` repo taramasında boş — production deploy'da ayrı asset gerekir.

### 2.15 Muhabbet illüstrasyon (logo değil)

| Asset | Kullanım | Sorun |
|-------|----------|-------|
| `leylek-blue.png` | Muhabbet hero | Cartoon — core marka ile ton farkı P3 |
| `leylek-header.png` | Header bubble | Dekoratif P3 |

---

## 3. Renk tutarsızlığı

| Token | Logo kullanımı | Brand genom | Drift |
|-------|------------------|-------------|-------|
| Accent cyan | `#67E8F9`, `#22D3EE`, `#0EA5E9` | `#00D4AA` | **P1** |
| Splash/icon ground | `#08111F` | `#0D1117` | P2 |
| Website themeColor | `#0072FF` | Void/Meridian | P2 |
| Notification tint | `#22D3EE` | `#00D4AA` | P2 |
| LeylekEye iris | `#38BDD4` | `#00D4AA` | P2 |
| Violet hero | `violet-400/15` | yasak | **P1** |

---

## 4. Orphan / duplicate / stale assets

| Asset | Durum | Aksiyon (P8) |
|-------|-------|--------------|
| `logo-leylek.svg` | Kod referansı yok | Retire |
| `Logo.tsx` | Hiç import edilmiyor | Remove veya wire |
| `login-brand.png` | require yok | Remove |
| `icon.png` | app.json referansı yok | Remove |
| `adaptive-icon.png` | Orphan | Remove |
| `app-icon.png` | Navbar fallback only | Replace chain |
| `branding/leylektag-icon.png` | Duplicate of store | Consolidate |
| `branding/feature-graphic.png` | Duplicate | Consolidate |
| premium PNG ×2 | frontend + website | Sync single source |

---

## 5. Export / oran tutarsızlıkları

| Sorun | Detay |
|-------|-------|
| Raster-only master | SVG source yok — retina/export zor |
| SVG glow filter | Pin favicon ölçeğinde çamur |
| feature-graphic aspect | 1024×500 Play — hero crop farklı |
| iOS icon squircle | İnce bacak/arc clip riski |
| DPI ladder | Android splash ×5 — senkron garantisi yok |
| OG crop | feature-graphic 1200×630 metadata vs gerçek boyut |

---

## 6. P0 bulgular (evrim blocker)

| ID | Bulgu | Etki |
|----|-------|------|
| AUD-P0-01 | iOS icon (A) ≠ Android adaptive (B) | Farklı uygulama algısı |
| AUD-P0-02 | JS splash (A) ≠ native Android splash (B) | İlk izlenim çift kimlik |
| AUD-P0-03 | App icon (A) ≠ website favicon (B) | Cross-platform marka kırığı |
| AUD-P0-04 | Üç paralel aile aktif | Marka parçalanması |
| AUD-P0-05 | Backend `leylek-logo.png` repo'da yok | Legal sayfa broken image |
| AUD-P0-06 | Tek master vector yok | Evrim pipeline blocker |

---

## 7. Evrim öncelik matrisi

| Öncelik | Aksiyon | Faz |
|---------|---------|-----|
| 1 | Canonical = premium kuş freeze | P1 ✅ |
| 2 | Master SVG trace | P2 |
| 3 | Tier M0 favicon | P4 |
| 4 | Platform icon unify | P5 |
| 5 | Android res sync | P8 |
| 6 | Violet hero retire | P8 |
| 7 | Orphan cleanup | P8 |
| 8 | Backend static fix | P8 |

---

## 8. QA yüzey matrisi (mevcut durum)

| Yüzey | Asset | Aile | 16px | Tutarlı | Not |
|-------|-------|------|------|---------|-----|
| iOS icon | ios.premium | A | ⚠️ | ❌ vs Android | |
| Android adaptive | wireframe | B | ✅ | ❌ vs iOS | |
| Favicon | leylektag-icon | B | ⚠️ | ❌ vs app | |
| JS splash | premium | A | — | ⚠️ vs native | |
| Native splash | pin | B | — | ❌ | |
| Login | premium | A | — | ✅ | |
| Navbar | wireframe | B | ⚠️ | ❌ | |
| Hero | feature-graphic | C | — | ⚠️ | violet P1 |
| OG | feature-graphic | C | — | ✅ marketing | |
| Notification | premium | A | ❌ | ⚠️ | |
| Watermark | premium | A | — | ✅ | |
| Leylek Zeka | premium+Eye | A+ | — | ⚠️ | |
| QR | none | — | — | — | P6 opportunity |

---

## 9. F1 / migration belgeleri ile ilişki

`design-lab/brand-dna/v4/exports/PHASE5_LOGO_MIGRATION_ANALYSIS.md` F1 ship planı içerir — **bu evolution programında geçerli değil**. P1 kararı: F1 ship red; mevcut kuş evrimi.

---

## 10. Post-evrim audit (P8 hedef)

P8 tamamlandığında yeniden ölçülecek:

- [ ] Tek logo ailesi tüm yüzeylerde
- [ ] 16 px QA pass
- [ ] iOS = Android icon
- [ ] Zero orphan assets
- [ ] Backend static mevcut
- [ ] Renk genom `#00D4AA` unified
- [ ] Violet hero kaldırıldı

---

**İlişkili belgeler:** `LOGO_SURFACE_MAP.md`, `CURRENT_DNA_ANALYSIS.md`, `EVOLUTION_ROADMAP.md`, `EVOLUTION_CHECKLIST.md`
