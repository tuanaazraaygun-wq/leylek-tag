# 01 — Production Identity Inventory

**Sprint:** B5 — Logo + Marker + Brand Identity Production  
**Mode:** Read-only analysis + design-lab output  
**Date:** 2026-06-21  
**Primary source logo:** `frontend/assets/images/leylek-logo-premium.png`

---

## Executive summary

Production'da **üç paralel logo ailesi** ve **iki paralel marker dili** yaşar. B5 kararı: **Aile A (premium kuş + orbital arc)** canonical kalır ve evrimleşir — pin/wireframe (B) ve wordmark-only (C) birleştirilir. Marker tarafında `passenger-woman.png` adı cinsiyet çağrışımı taşır; kod nötrleştirilmiş olsa da görsel yenilenmeli.

| Area | Families / systems | B5 action |
|------|-------------------|-----------|
| Logo | A premium / B pin / C wordmark | Evolve A → vector master |
| App icon | iOS premium ≠ Android adaptive B | Unify under A |
| Markers | PNG entity + View/Ionicons field | 12-type SVG genom |
| Leylek Zeka | premium PNG + LeylekEye SVG | Eye derivative spec |
| Website | leylektag-icon (B) vs premium store copy | Migrate to unified mark |

**Production touched in B5:** ❌ None

---

## 1. Logo assets — frontend

### 1.1 Raster / vector files

| Path | Format | Family | Role | Status |
|------|--------|--------|------|--------|
| `frontend/assets/images/leylek-logo-premium.png` | PNG | **A — Premium kuş** | **PRIMARY SOURCE** | ✅ Canonical |
| `frontend/assets/ios.premium.logo.png` | PNG | A | iOS App Store icon override | ✅ Same family |
| `frontend/assets/images/adaptive-icon-foreground.png` | PNG | **B — Wireframe arc** | Android adaptive fg | ⚠️ P0 drift |
| `frontend/assets/images/adaptive-icon.png` | PNG | B | Orphan | 🗑 Retire |
| `frontend/assets/images/icon.png` | PNG | B | Orphan | 🗑 Retire |
| `frontend/assets/images/favicon.png` | PNG | B | Expo web favicon | ⚠️ Migrate |
| `frontend/assets/images/login-brand.png` | PNG | — | Unused | 🗑 Retire |
| `frontend/assets/images/leylek-blue.png` | PNG | C illüstrasyon | Muhabbet hero | Out of logo scope |
| `frontend/assets/images/leylek-header.png` | PNG | C illüstrasyon | Muhabbet bubble | Out of logo scope |

### 1.2 Expo manifest (`frontend/app.json`) — read only

| Key | Asset | Surface |
|-----|-------|---------|
| `expo.icon` | `leylek-logo-premium.png` | Default app icon |
| `expo.ios.icon` | `ios.premium.logo.png` | iOS icon |
| `expo.android.adaptiveIcon.foregroundImage` | `adaptive-icon-foreground.png` | **B family — drift** |
| `expo.android.adaptiveIcon.backgroundColor` | `#08111F` | Ground |
| `expo.splash.image` | `leylek-logo-premium.png` | Native splash flash |
| `expo.splash.backgroundColor` | `#08111F` | Splash ground |
| `expo.web.favicon` | `favicon.png` | Expo web |
| `expo-notifications.icon` | `leylek-logo-premium.png` | Notification small icon |
| `expo-notifications.color` | `#22D3EE` | Tint (genom drift from `#00D4AA`) |

### 1.3 Android native (`frontend/android/app/src/main/res/`) — read only

| Asset | Family | Issue |
|-------|--------|-------|
| `drawable-*dpi/splashscreen_logo.png` | B pin | **P0 — JS splash shows A, native shows B** |
| `mipmap-*dpi/ic_launcher_foreground.png` | B | **P0 — iOS ≠ Android home screen** |
| `values/colors.xml` | `#08111F` | OK |

### 1.4 Component consumers

| Component | Asset | Surface |
|-----------|-------|---------|
| `SplashScreen.tsx` | premium PNG | JS splash (~2.5s breathe) |
| `LoginBrandHeader.tsx` | premium PNG | Login / auth |
| `LeylekZekaChat.tsx` | premium PNG | AI chat header |
| `LeylekZekaWidget.tsx` | premium PNG + `LeylekEye` | Map FAB + widget |
| `MuhabbetWatermark.tsx` | premium PNG | Content watermark |
| `TagMatchTransitionOverlay.tsx` | `LeylekEye` | Match transition |
| `RatingModal.tsx` | `LeylekEye` | Post-trip rating |
| `design-system/leylek-eye/LeylekEye.tsx` | Inline SVG | Loading / transitions |
| `Logo.tsx` | premium PNG | Dead code (no imports) |

---

## 2. Logo assets — website (read only)

| Path | Family | Consumer |
|------|--------|----------|
| `website/public/store/leylek-logo-premium.png` | A | Store copy of premium |
| `website/public/store/leylektag-icon.png` | B | **Navbar, favicon, PWA** (`BRANDING_PATHS`) |
| `website/public/store/feature-graphic.png` | C | Hero horizontal, OG |
| `website/public/logo-leylek.svg` | B pin | **Orphan** — not in BRANDING_PATHS |
| `website/public/app-icon.png` | Legacy | Fallback |
| `website/public/branding/*` | C screenshots | Marketing only |

**Website branding config:** `website/lib/branding-assets.ts` — all icon paths point to `leylektag-icon.png` (B).

---

## 3. Leylek Zeka logo / eye

| Asset | Type | Relation to master |
|-------|------|-------------------|
| `leylek-logo-premium.png` | Full symbol | Chat/widget header |
| `LeylekEye.tsx` | Animated SVG eye | Accent dot derivative |
| B5 `leylek-zeka-eye-v1.svg` | Static eye spec | Cyan ring + dot — aligns with `#00D4AA` |

**Rule:** Leylek Zeka uses **eye derivative**, not full stork at small sizes.

---

## 4. Watermark

| Consumer | Asset | Opacity / size |
|----------|-------|----------------|
| `MuhabbetWatermark.tsx` | premium PNG full symbol | Low opacity overlay |

B5 spec: `leylek-watermark-v1.svg` — 12% opacity symbol, no metallic shader.

---

## 5. Marker assets — frontend

### 5.1 PNG entity markers (System A)

| Path (referenced) | Type | Display px | Issue |
|-------------------|------|------------|-------|
| `frontend/assets/markers/passenger-woman.png` | Passenger | 32 | **Filename gendered; code deprecated gender params** |
| `frontend/assets/markers/driver-car.png` | Driver car | 34 | Generic; no logo DNA |
| `frontend/assets/markers/driver-motor.png` | Motorcycle | 30 | Generic |

**Note:** `frontend/assets/markers/` may be empty in repo (gitignored/local). Code references exist in `mapNavMarkers.ts`.

### 5.2 Map integration

| File | Role |
|------|------|
| `frontend/lib/mapNavMarkers.ts` | PNG paths, pixel sizes, rotation anchors |
| `frontend/lib/mapMarkerChrome.tsx` | `MapEntityMarkerImage`, pickup, destination pins |
| `LiveMapView.tsx` | Trip map PNG markers |
| `PassengerWaitingScreen.tsx` | Waiting map |
| `SearchingMapView.tsx` | Search map |
| `LeylekTripMapPreview.tsx` | Preview map |
| `DriverOfferScreen.tsx` | **System B** — Ionicons + colored circles |
| `OfferMapScreen.tsx` | Legacy generic circles |
| `frontend/app/index.tsx` | Destination route picker custom rings |

### 5.3 Website map markers

| File | Style |
|------|-------|
| `website/components/real-city-map.tsx` | CSS `.leylek-marker-*` divIcon |
| `website/app/globals.css` | Marketing district markers |

---

## 6. Route / journey markers

| Concept | Production | B5 marker |
|---------|------------|-----------|
| Pickup | `MapPickupPin` + green circle (B) | `marker-08-pickup.svg` |
| Destination | `MapDestinationFlagPin` + index rings | `marker-07-destination.svg` |
| Active journey | Polyline + nav pointer | `marker-09-journey-active.svg` |
| Searching | DriverOfferScreen pulse rings | `marker-12-searching-pulse.svg` |

---

## 7. Passenger / driver distinction

| Role | Production visual | B5 target |
|------|-------------------|-----------|
| Passenger | Human PNG (gendered filename) | Gender-neutral figure marker |
| Driver car | Top-down car PNG | Simple vehicle silhouette |
| Driver motor | Top-down motor PNG | Two-wheel silhouette |
| Field map driver | Blue circle + Ionicons car | Unify to PNG genom |

**No taxi yellow, no luxury sedan, no pin teardrop.**

---

## 8. Android / iOS icon paths summary

| Platform | Config path | Current asset | Target family |
|----------|-------------|---------------|---------------|
| iOS | `app.json` → `ios.icon` | `ios.premium.logo.png` | A (evolved) |
| Android adaptive fg | `app.json` → `android.adaptiveIcon.foregroundImage` | wireframe B | **A (evolved)** |
| Android native splash | `res/drawable-*/splashscreen_logo.png` | pin B | **A (evolved)** |
| Expo default | `expo.icon` | premium A | A (evolved) |
| Website favicon | `BRANDING_PATHS.favicon` | leylektag-icon B | **A (evolved)** |

---

## 9. Orphan / retire list

| Asset | Reason |
|-------|--------|
| `logo-leylek.svg` | Pin family — constitution retire |
| `leylektag-icon.png` | Wireframe B — replace with evolved A |
| `adaptive-icon-foreground.png` | B drift |
| `favicon.png` (frontend) | B drift |
| `icon.png`, `adaptive-icon.png` | Orphan |
| `login-brand.png` | Unused |
| `passenger-woman.png` | Gendered filename + non-DNA art |

---

## 10. Design-lab cross-reference

| Prior analysis | Path |
|----------------|------|
| Logo surface map | `logo-evolution/LOGO_SURFACE_MAP.md` |
| Production logo audit | `logo-evolution/PRODUCTION_LOGO_AUDIT.md` |
| Marker inventory | `marker-evolution/PRODUCTION_MARKER_INVENTORY.md` |
| Logo geometry | `logo-master/LOGO_GEOMETRY.md` |
| Marker DNA v4 | `MARKER_DNA.md` |
| F1 ship rejection | `logo-production-lab/COMPARISON_AND_SHIP_RECOMMENDATION.md` — **F1 NOT production** |

---

## 11. B5 design-lab outputs

| Output | Path |
|--------|------|
| Logo SVG master | `brand-identity-production/svg/leylek-symbol-master-v1.svg` |
| 12 marker SVGs | `brand-identity-production/markers/` |
| Manifest | `brand-identity-production/manifest/brand-identity-manifest.json` |

---

**Next:** `02_LOGO_EVOLUTION_PRODUCTION_SPEC.md`
