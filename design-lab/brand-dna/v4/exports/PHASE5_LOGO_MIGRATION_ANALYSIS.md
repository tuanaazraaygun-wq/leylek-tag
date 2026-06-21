# Phase 5 Logo Migration Analysis

**Date:** 2026-06-21  
**Mode:** Read-only analysis — no production patches applied  
**Source assets:** `design-lab/brand-dna/v4/exports/`  
**Primary ship:** F1 Meridian Wing (S07)  
**Live-system rule:** backend, socket, dispatch, match, payment, QR logic, journey, trust, quick match — **out of scope**

---

## Executive summary

Production today runs **two conflicting logo families**:

1. **In-app UI** — 3D metal stork raster (`leylek-logo-premium.png`) used across splash, auth, Leylek Zeka, watermarks.
2. **Platform / web shell** — Expo `app.json` points the same premium PNG for icon/splash/notifications; Android adaptive uses `adaptive-icon-foreground.png`; website uses `leylektag-icon.png` (likely pin-era export).
3. **Legacy web SVG** — `website/public/logo-leylek.svg` is a **gradient map pin** (constitution violations) and is **not referenced** in website code today.

F1 exports are constitution-clean (flat stroke, `#00D4AA` accent, `#0D1117` void). Migration is **asset + thin UI wiring** only, but carries **color-system drift** (`#22D3EE` / `#08111F` cockpit vs F1 genom), **dual splash paths** (native Expo splash hidden immediately; custom `SplashScreen.tsx` is what users see), and **checked-in Android `res/`** that can diverge from `app.json` until `prebuild`.

**Recommended:** staged PRs per `PHASE5_MIGRATION_HANDOFF.md`, feature flags for icon/splash, blind QA before store submit.

---

## 1. Frontend — current app icon / splash / logo asset paths

### 1.1 Expo manifest (`frontend/app.json`)

| Key | Path | Role |
|-----|------|------|
| `expo.icon` | `./assets/images/leylek-logo-premium.png` | Default app icon source (EAS / prebuild) |
| `expo.ios.icon` | `./assets/ios.premium.logo.png` | iOS-specific icon override |
| `expo.android.adaptiveIcon.foregroundImage` | `./assets/images/adaptive-icon-foreground.png` | Android adaptive foreground |
| `expo.android.adaptiveIcon.backgroundColor` | `#08111F` | Android adaptive background (color only in manifest) |
| `expo.splash.image` | `./assets/images/leylek-logo-premium.png` | Native splash image |
| `expo.splash.backgroundColor` | `#08111F` | Native splash background |
| `expo.web.favicon` | `./assets/images/favicon.png` | Expo web favicon |
| `plugins[].expo-notifications.icon` | `./assets/images/leylek-logo-premium.png` | Android notification small icon source |
| `plugins[].expo-notifications.color` | `#22D3EE` | Notification accent tint |

No `app.config.js` / `app.config.ts` — **single source:** `frontend/app.json`.

### 1.2 `frontend/assets/` raster inventory (logo-related)

| File | Observed use |
|------|----------------|
| `assets/images/leylek-logo-premium.png` | **Primary in-app brand** — splash component, auth, Zeka, watermark |
| `assets/ios.premium.logo.png` | iOS app icon override in `app.json` |
| `assets/images/adaptive-icon-foreground.png` | Android adaptive (Expo config) |
| `assets/images/adaptive-icon.png` | Present; not referenced in `app.json` |
| `assets/images/icon.png` | Present; not referenced in `app.json` |
| `assets/images/favicon.png` | Expo web favicon |
| `assets/images/login-brand.png` | Present; no TSX `require()` hit in repo scan |
| `assets/images/leylek-blue.png` | Muhabbet hero (not core logo) |
| `assets/images/leylek-header.png` | Muhabbet header bubble |
| `assets/sounds/*` | Sonic — **do not touch** in logo PR |

### 1.3 In-app `require()` consumers (F1 target surfaces)

| Component | Asset |
|-----------|-------|
| `components/SplashScreen.tsx` | `leylek-logo-premium.png` |
| `components/auth/LoginBrandHeader.tsx` | `leylek-logo-premium.png` |
| `components/Logo.tsx` | `leylek-logo-premium.png` (**no import sites found — likely dead / legacy**) |
| `components/MuhabbetWatermark.tsx` | `leylek-logo-premium.png` |
| `components/LeylekZekaChat.tsx` | `leylek-logo-premium.png` |
| `components/LeylekZekaWidget.tsx` | `leylek-logo-premium.png` |

`frontend/app/index.tsx` defines `roundLogoWrapper` / `communityLogo` styles but **no active `require()`** to premium PNG in scanned usage — login flow uses `LoginBrandHeader` / premium auth shell.

### 1.4 Splash behavior (critical for Phase 5)

Two layers:

1. **Native Expo splash** — configured in `app.json`; `frontend/app/_layout.tsx` calls `ExpoSplashScreen.hideAsync()` **on mount** (“Native splash’i hemen kapat”).
2. **Custom splash** — `index.tsx` gates on `showSplash` → `SplashScreen` (~2500ms timer, 4500ms safety).

Phase 5 must update **both** native assets (brief flash before JS) and `SplashScreen.tsx` image. Boot Lottie (`lottie/f1-boot-presence.json`) is optional follow-up — not wired today.

### 1.5 Map markers (out of logo scope but same folder tree)

`frontend/lib/mapNavMarkers.ts` references `../assets/markers/*.png`. These are **dispatch/map markers**, not brand logo. **Do not replace** in logo migration PRs.

---

## 2. Expo `app.json` — icon / splash definitions

Confirmed: all icon/splash/favicon/adaptive/notification-icon paths live in `frontend/app.json` (see §1.1).

`frontend/eas.json` has **no** icon overrides — builds inherit `app.json`.

**Version context:** `version` 1.0.38, iOS `buildNumber` 46, Android `versionCode` 40.

---

## 3. Android adaptive icon usage

### 3.1 Expo config

```json
"adaptiveIcon": {
  "foregroundImage": "./assets/images/adaptive-icon-foreground.png",
  "backgroundColor": "#08111F"
}
```

No `backgroundImage` in manifest — solid color background only at Expo layer.

### 3.2 Checked-in native `frontend/android/` (prebuild output)

| Resource | Purpose |
|----------|---------|
| `res/mipmap-anydpi-v26/ic_launcher.xml` | Adaptive icon → `@color/iconBackground` + `@mipmap/ic_launcher_foreground` |
| `res/mipmap-*dpi/ic_launcher_foreground.png` | Per-DPI foreground rasters |
| `res/mipmap-*dpi/ic_launcher.png` / `ic_launcher_round.png` | Legacy launcher icons |
| `res/values/colors.xml` | `iconBackground` = `#08111F`, `splashscreen_background` = `#08111F` |
| `res/drawable/ic_launcher_background.xml` | Layer-list: color + centered `splashscreen_logo` bitmap |
| `res/drawable-*dpi/splashscreen_logo.png` | Native splash center image (5 DPI folders) |

**Risk:** Editing only `frontend/assets/images/adaptive-icon-foreground.png` without `npx expo prebuild` (or manual `res/` sync) leaves **stale** `mipmap-*` and `splashscreen_logo.png` in APK.

### 3.3 F1 export mapping

| Production target | F1 export | Notes |
|-------------------|-----------|-------|
| Expo `foregroundImage` | `png/f1/android-adaptive-foreground-432.png` | 432px safe for Expo plugin |
| Optional `backgroundImage` | `png/f1/android-adaptive-background-1080.png` | Spec recommends `#0D1117` fill |
| `backgroundColor` | `#0D1117` | **Change from `#08111F`** for genom match |
| Full-bleed marketing | `png/f1/android-adaptive-foreground-1080.png` | For manual `res/` if needed |

Spec file: `android-adaptive-icon-spec.json`.

---

## 4. iOS icon set usage

- **No `frontend/ios/` directory** in repo — iOS icons generated at EAS build from `app.json`.
- **Dual icon sources today:**
  - Global `expo.icon` → `leylek-logo-premium.png`
  - `expo.ios.icon` → `ios.premium.logo.png` (**iOS uses different file**)

### F1 export set

`png/f1/ios/AppIcon-*.png` + `Contents.json` — full ladder including `AppIcon-1024.png`.

**Phase 5 options:**

| Approach | Pros | Risks |
|----------|------|-------|
| A) Replace `ios.premium.logo.png` + root `icon` with F1 `AppIcon-1024.png` | Minimal config change | Squircle mask QA on device |
| B) Commit `AppIcon.appiconset` into generated `ios/` after prebuild | Full control | Requires ios folder in repo / prebuild discipline |

**Mandatory QA:** 29px settings icon (`AppIcon-29` / `58`), iPad 167, marketing 1024.

---

## 5. Website favicon / logo usage

### 5.1 Central config — `website/lib/branding-assets.ts`

| Constant | Path | Used for |
|----------|------|----------|
| `logoMark` | `/store/leylektag-icon.png` | Navbar, footer, Leylek Zeka mark |
| `logoHorizontal` | `/store/feature-graphic.png` | Hero horizontal logo |
| `favicon` / `icon192` / `icon512` / `appleTouch` | `/store/leylektag-icon.png` | All metadata icons |
| `ogImage` | `/store/feature-graphic.png` | OpenGraph / Twitter |
| `LEGACY_FALLBACK_ICON` | `/app-icon.png` | Navbar/footer fallback chain |

### 5.2 Consumers

| File | Usage |
|------|-------|
| `website/app/layout.tsx` | `metadata.icons`, OG/Twitter images via `BRANDING_PATHS` |
| `website/components/navbar.tsx` | `logoMark` + fallbacks |
| `website/components/footer.tsx` | `logoMark` + fallbacks |
| `website/components/hero-horizontal-logo.tsx` | `logoHorizontal` |
| `website/components/leylek-zeka-mark.tsx` | `logoMark` |

### 5.3 Static files (logo-related)

| Path | Status |
|------|--------|
| `website/public/store/leylektag-icon.png` | **Active** favicon + navbar |
| `website/public/store/feature-graphic.png` | **Active** OG + hero |
| `website/public/app-icon.png` | Fallback only |
| `website/public/logo-leylek.svg` | **Orphan** — gradient pin SVG, not imported in code |

### 5.4 F1 mapping (F1 pure — no F2 on favicon/icon)

| Website surface | F1 export |
|-----------------|-----------|
| Favicon 16/32/48 | `png/f1/favicon/favicon-*.png` |
| PWA 192/512 | `png/f1/128.png` + `png/f1/512.png` (replace `leylektag-icon.png` or add dedicated sizes) |
| Navbar mark | `png/f1/64.png` or `128.png` on void |
| SVG (optional) | `svg/f1-meridian-wing-master.svg` → replace orphan `logo-leylek.svg` when approved |
| OG `feature-graphic.png` | **Separate PR** — wide marketing art; do not stretch 1024 icon |

**Color note:** `layout.tsx` `themeColor` is `#0072FF` — unrelated to logo; logo PR should not change theme color without brand review.

---

## 6. Production assets folder

| Location | Status |
|----------|--------|
| Repo root `assets/` | **Empty / absent** — not used |
| `frontend/assets/` | **Live app asset root** for Expo + RN `require()` |
| `frontend/android/app/src/main/res/` | **Live native rasters** (launcher + splash) |
| `website/public/` | **Live web static** (`store/`, fallbacks) |
| `design-lab/brand-dna/v4/exports/` | **Phase 4 lab output** — not wired |

There is no separate monorepo `production-assets/` package. “Production assets” = the paths above.

---

## 7. Files that **should change** in Phase 5 (when approved)

Grouped by PR; copy from `design-lab/brand-dna/v4/exports/` only.

### P5-L1 — Website (low risk)

| Action | Path |
|--------|------|
| Replace raster | `website/public/store/leylektag-icon.png` |
| Optional | `website/public/app-icon.png` |
| Optional SVG | `website/public/logo-leylek.svg` ← `svg/f1-meridian-wing-master.svg` |
| Config only if paths change | `website/lib/branding-assets.ts` |

### P5-L2 — In-app logo surfaces (medium)

| Action | Path |
|--------|------|
| Replace PNG | `frontend/assets/images/leylek-logo-premium.png` ← `png/f1/256.png` or SVG component |
| Update requires | `SplashScreen.tsx`, `LoginBrandHeader.tsx`, `LeylekZekaChat.tsx`, `LeylekZekaWidget.tsx`, `MuhabbetWatermark.tsx` |
| Optional dead code | `components/Logo.tsx` |

### P5-L4 — App icon + splash + adaptive (high)

| Action | Path |
|--------|------|
| Replace | `frontend/assets/images/leylek-logo-premium.png` (splash + default icon) |
| Replace | `frontend/assets/ios.premium.logo.png` ← `png/f1/ios/AppIcon-1024.png` |
| Replace | `frontend/assets/images/adaptive-icon-foreground.png` |
| Replace | `frontend/assets/images/favicon.png` |
| Update colors | `frontend/app.json` (`backgroundColor` → `#0D1117` for splash/adaptive) |
| Regenerate or hand-sync | `frontend/android/app/src/main/res/mipmap-*` + `drawable-*dpi/splashscreen_logo.png` |
| Post-prebuild | iOS `Images.xcassets` if ios folder committed |

### P5-L5 — QR high-contrast (low, asset-only)

| Action | Path |
|--------|------|
| Add/replace overlay asset | New file under `frontend/assets/images/` e.g. `qr-verified-mark-f1.png` ← `png/f1/qr-hc-256.png` |
| Wire in UI | **Only** QR overlay components — not QR scan/match logic |

### P5-L3 / P5-L6 — Motion (medium, optional)

| Action | Path |
|--------|------|
| Add Lottie JSON | `frontend/assets/lottie/` ← `lottie/f1-boot-presence.json`, `f1-lock-ring.json` |
| Wire animation | `SplashScreen.tsx` or LSX motion layer — **timing only**; no backend |

### Config / flags (recommended)

| Action | Path |
|--------|------|
| Feature flags | New or existing frontend config (e.g. `extra` in `app.json` or env) — `brandLogoV4Enabled`, `brandBootLottieV4` |

---

## 8. Files / systems that must **NOT** be touched

### Hard stop (user live-system rule)

- `backend/**` — all APIs, dispatch, match, payment, journey, trust
- Socket / realtime paths — `frontend/contexts/SocketContext.tsx` (except unrelated edits)
- Dispatch queue, offer flow, quick match logic
- QR **business logic** — scan handlers, trip end, payment confirmation
- `frontend/utils/sound.ts` and `assets/sounds/**`
- `frontend/lib/mapNavMarkers.ts` and map marker PNGs
- `frontend/components/LiveMapView.tsx`, `DriverOfferScreen.tsx` match/offer UI logic
- `frontend/components/PassengerWaitingScreen.tsx` journey states
- Package manifests — `package.json`, `package-lock.json` (no new deps for static PNG swap)

### Logo migration — avoid in initial PRs

| Area | Reason |
|------|--------|
| `website/public/store/yolcu*.png`, `surucu*.png`, ipad showcase | App Store vitrin — separate marketing |
| `website/public/branding/*` | Campaign art |
| `website/public/store/feature-graphic.png` | OG wide art — not 1:1 icon swap |
| `assets/images/leylek-blue.png`, `leylek-header.png` | Muhabbet-specific art |
| Firebase / `google-services.json`, plist | unrelated |
| `eas.json` build env blocks | no icon content today |
| Admin / ops dashboards | no logo dependency |

### Constitution — do not reintroduce

- Gradient pin SVG as app icon or favicon
- `feGaussianBlur` in shipped SVG
- F2 marketing geometry on app icon, favicon, watch, QR (F2 ≥128px web only, optional)

---

## 9. Rollback plan

### Per-PR rollback

1. **Git revert** the merged PR — binary PNGs restore from parent commit.
2. **Feature flags** — if `brandLogoV4Enabled` / `brandBootLottieV4` used, set `false` without redeploying assets (when code supports dual path).
3. **Store** — previous build binaries remain on devices until user updates; icon change is forward-only on store listing after submit.

### Android / iOS native rollback

- If `res/` was regenerated: revert entire `frontend/android/app/src/main/res/` folder from last good commit.
- iOS: revert `Images.xcassets` or rebuild from previous `ios.premium.logo.png`.

### Website rollback

- Restore `leylektag-icon.png` and `app-icon.png` from git; Next.js metadata picks up immediately on deploy.

### Verification after rollback

- [ ] Cold start — no native splash flash regression
- [ ] Push notification icon visible (Android monochrome)
- [ ] Favicon in browser tab
- [ ] App Store Connect / Play Console icon preview (if store build was submitted)

### Asset archive

Keep Phase 4 exports in `design-lab/` permanently — rollback does not delete lab artifacts.

---

## 10. Android / iOS build risks

| Risk | Severity | Detail | Mitigation |
|------|----------|--------|------------|
| Stale `android/res` vs `app.json` | **High** | Checked-in mipmap/splash PNGs may not match updated `assets/images/*` | Run `expo prebuild` or scripted copy to all DPI folders; verify APK contents |
| Dual iOS icon files | **Medium** | `icon` vs `ios.icon` can diverge | Single F1 `1024` source for both keys |
| Squircle / safe zone clip | **Medium** | F1 ring near edge — Android 66.7% safe zone | Use `android-adaptive-foreground-432.png`; device matrix QA |
| Color drift | **Medium** | `#08111F` + `#22D3EE` UI vs `#0D1117` + `#00D4AA` F1 | Align splash/adaptive bg to `#0D1117`; **do not** mass-retheme UI in logo PR |
| Native splash flash | **Medium** | `_layout.tsx` hides native splash immediately; wrong asset still flashes | Update `app.json` splash + `splashscreen_logo.png` |
| Notification icon monochrome | **Medium** | Android tints small icon; F1 stroke must survive | Test offers channel; may need simplified micro tier export |
| iOS transparency | **Low** | App icons must not have alpha | Use `png/f1/ios/AppIcon-1024.png` (void background) |
| EAS autoIncrement | **Low** | `eas.json` production `autoIncrement: true` | Icon-only PR still triggers new build number — expected |
| Hermes `require()` static paths | **Low** | RN bundles asset at build time | Replace files **in place** OR update every `require()` path |
| Watch / complication | **Low** | No watch target in repo today | If added later, use F1 pure `png/f1/64.png` ladder |
| Proguard / minify | **Low** | Disabled in `app.json` build-properties | No R8 drawable name risk for icons |
| Cache busting (web) | **Low** | Same filename replace | CDN/deploy may need cache purge for `leylektag-icon.png` |

---

## F1 export inventory (migration source)

See `EXPORT_MANIFEST.json`. Key files:

```
f1-meridian-wing-master.svg
svg/f1-meridian-wing-icon-1024.svg
png/f1/{16..1024}.png
png/f1/ios/AppIcon-*.png
png/f1/favicon/favicon-{16,32,48}.png
png/f1/qr-hc-256.png
png/f1/android-adaptive-foreground-{432,1080}.png
png/f1/android-adaptive-background-1080.png
lottie/f1-boot-presence.json
lottie/f1-lock-ring.json
genom.tokens.css
```

---

## F2 / F3 policy (confirmed)

| Finalist | Phase 5 role |
|----------|----------------|
| **F1** | App icon, favicon, watch, QR, splash core mark |
| **F2** | Optional website hero ≥128px only — **not produced in Phase 4** |
| **F3** | 320ms ring-close timing in `f1-lock-ring.json` — geometry stays F1 |

---

## Recommended PR sequence (unchanged from handoff)

1. P5-L0 — Stakeholder + blind panel (no code)
2. P5-L1 — Website favicon + navbar mark
3. P5-L2 — In-app PNG / SVG component surfaces
4. P5-L4 — App icon + splash + Android adaptive (+ prebuild)
5. P5-L5 — QR HC overlay asset
6. P5-L3 / P5-L6 — Boot + lock Lottie (optional)

---

## Analysis gate

| Check | Status |
|-------|--------|
| Production paths mapped | **DONE** |
| F1 source mapped | **DONE** |
| Live-system exclusions listed | **DONE** |
| Rollback documented | **DONE** |
| Build risks documented | **DONE** |
| Production files modified | **NONE** |
| Git commit | **NONE** |

---

**Next step:** Stakeholder sign-off on `QA_REPORT.md` + blind test → execute P5-L1 with file copies only, no logic changes.
