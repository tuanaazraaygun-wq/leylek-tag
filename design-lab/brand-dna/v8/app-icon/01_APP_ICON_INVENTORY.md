# 01 — App Icon Inventory

**Sprint:** BRAND-APPICON-1A  
**Mode:** Read-only analysis  
**Date:** 2026-06-21  
**Production:** Untouched

---

## Executive summary — root cause

**APK home-screen icon ≠ login logo because they are different asset families.**

| Surface | Asset family | Visual |
|---------|--------------|--------|
| **Login / splash / JS app** | **A — Premium kuş** | 3D metal leylek + glowing blue orbital arc |
| **Android launcher (APK icon)** | **B — Wireframe arc** | Flat white stick-bird + thin teal U-arc on black |
| **iOS home screen** | **B′ — Wireframe (flat export)** | Same wireframe language as adaptive FG |

`app.json` `expo.icon` points at Family A, but **Android ignores it for the launcher** when `android.adaptiveIcon` is set. Native `res/mipmap/ic_launcher_foreground.png` is derived from **`adaptive-icon-foreground.png` (B)**, not `leylek-logo-premium.png`.

**User perception:** “APK icon alakasız” — correct; it is literally a different logo design.

---

## Question 1 — Android APK icon şu an hangi assetten geliyor?

### Runtime chain (API 26+)

```
AndroidManifest.xml
  android:icon="@mipmap/ic_launcher"
  android:roundIcon="@mipmap/ic_launcher_round"
        │
        ▼
mipmap-anydpi-v26/ic_launcher.xml  (+ ic_launcher_round.xml)
  <background android:drawable="@color/iconBackground"/>     → #08111F
  <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
        │
        ▼
mipmap-{mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}/ic_launcher_foreground.png
  (prebuild / Expo türevi — wireframe stork + teal arc)
```

### Expo config source (prebuild input)

```json
// frontend/app.json
"android": {
  "adaptiveIcon": {
    "foregroundImage": "./assets/images/adaptive-icon-foreground.png",
    "backgroundColor": "#08111F"
  }
}
```

| Layer | Production file | Value |
|-------|-----------------|-------|
| **Foreground (launcher)** | `frontend/assets/images/adaptive-icon-foreground.png` | Wireframe B |
| **Foreground (native)** | `frontend/android/app/src/main/res/mipmap-*/ic_launcher_foreground.png` | Same B (5 DPI) |
| **Background** | `app.json` + `colors.xml` `iconBackground` | `#08111F` |
| **Legacy fallback** | `mipmap-*/ic_launcher.png` | Flat raster (pre-API26 / OEM) |

### What does NOT drive the Android launcher icon

| Config | Path | Why ignored on Android launcher |
|--------|------|----------------------------------|
| `expo.icon` | `leylek-logo-premium.png` | Overridden by `adaptiveIcon` |
| `plugins.expo-notifications.icon` | `leylek-logo-premium.png` | Notification tray only |
| `splash.image` | `leylek-logo-premium.png` | Splash only |

### EAS / APK build

`frontend/eas.json` profiles (`simple`, `preview`, `production`) use standard Expo prebuild → Gradle `assembleRelease` / AAB. **No custom icon override in EAS env.** Icon = native `res/` as committed + last prebuild sync.

---

## Full icon asset map

### Config (`frontend/app.json`)

| Key | Asset path | Used for |
|-----|------------|----------|
| `expo.icon` | `./assets/images/leylek-logo-premium.png` | Expo default; fallback; notification plugin |
| `expo.ios.icon` | `./assets/ios.premium.logo.png` | iOS App Store / home screen |
| `expo.android.adaptiveIcon.foregroundImage` | `./assets/images/adaptive-icon-foreground.png` | **Android launcher FG** |
| `expo.android.adaptiveIcon.backgroundColor` | `#08111F` | **Android launcher BG** |
| `expo.splash.image` | `./assets/images/leylek-logo-premium.png` | Native splash config |
| `expo.web.favicon` | `./assets/images/favicon.png` | Web |
| `plugins.expo-notifications.icon` | `./assets/images/leylek-logo-premium.png` | FCM status bar icon |

### `frontend/assets/images/` (icon-related)

| File | Family | Role |
|------|--------|------|
| `leylek-logo-premium.png` | **A** | Login, splash, Zeka, expo.icon |
| `adaptive-icon-foreground.png` | **B** | **Android adaptive FG source** |
| `favicon.png` | **B** | Web favicon |
| `leylek-blue.png` | C/legacy | Not app icon |
| `_backup-pre-b6-3/adaptive-icon-foreground.png` | B | Rollback archive |

### `frontend/assets/` (root)

| File | Family | Role |
|------|--------|------|
| `ios.premium.logo.png` | **B′** wireframe | **iOS home screen** (not 3D premium) |

### Native Android (`frontend/android/app/src/main/res/`)

| Resource | Path pattern | Family |
|----------|--------------|--------|
| Adaptive XML | `mipmap-anydpi-v26/ic_launcher.xml` | BG color + FG mipmap |
| Launcher FG | `mipmap-*/ic_launcher_foreground.png` ×5 | **B** |
| Launcher legacy | `mipmap-*/ic_launcher.png` ×5 | B raster |
| Splash native | `drawable-*/splashscreen_logo.png` ×5 | **B** (pin/wireframe) |
| Colors | `values/colors.xml` | `iconBackground` `#08111F` |

### Orphan / unused icon paths

| File | Status |
|------|--------|
| `assets/images/adaptive-icon.png` | Orphan |
| `assets/images/icon.png` | Orphan |
| `_backup-pre-b6-6/icon.png` | Archive |

---

## Question 5 — Adaptive icon foreground/background var mı?

**Evet — tam adaptive stack:**

| Component | Present | Source |
|-----------|---------|--------|
| Foreground image | ✅ | `adaptive-icon-foreground.png` → `ic_launcher_foreground` |
| Background color | ✅ | `#08111F` (`app.json` + `colors.xml`) |
| Adaptive XML | ✅ | `ic_launcher.xml`, `ic_launcher_round.xml` |
| Monochrome (Android 13+) | ❌ | Not configured — future optional |

**Foreground asset issue:** FG is **Family B wireframe**, not login **Family A premium kuş**. Background is correct brand navy but FG mismatch dominates user perception.

---

## Question 4 — Hangi dosyalar production app icon için değişmeli? (1B plan — not executed in 1A)

### Android (required for APK fix)

| Priority | File | Action |
|----------|------|--------|
| P0 | `frontend/assets/images/adaptive-icon-foreground.png` | Replace with tier-S export from login logo (A) |
| P0 | `frontend/android/.../mipmap-*/ic_launcher_foreground.png` | Regenerate via `npx expo prebuild` or manual 5-DPI ladder |
| P0 | `frontend/android/.../mipmap-*/ic_launcher.png` | Regenerate legacy fallbacks |
| P1 | `frontend/android/.../mipmap-anydpi-v26/ic_launcher*.xml` | Keep; verify BG color |
| P1 | `frontend/android/app/src/main/res/values/colors.xml` | Optional: soft premium black token |
| P2 | `frontend/android/.../drawable-*/splashscreen_logo.png` | Unify to A (splash consistency — separate but recommended) |

### iOS (parity — APK sprint context but same brand break)

| Priority | File | Action |
|----------|------|--------|
| P0 | `frontend/assets/ios.premium.logo.png` | Re-export from same tier-S master as Android |

### Config (minimal)

| File | Change |
|------|--------|
| `frontend/app.json` | Paths may **stay same**; optional `backgroundColor` tweak to soft premium black |
| `expo.icon` | Optional unify to tier-S @1024 embedded in PNG or keep premium master |

### Out of scope for icon-only (same sprint family)

| File | Note |
|------|------|
| `leylek-logo-premium.png` | Login/splash master — ring refine (BRAND-LOGO-EVO) may precede icon export |
| `favicon.png` | Web B family — follow-up |
| `LoginBrandHeader.tsx` | No code change — already correct asset |

---

## Visual diff summary (observed)

| Element | Login (`leylek-logo-premium.png`) | APK (`adaptive-icon-foreground.png`) |
|---------|-----------------------------------|--------------------------------------|
| Stork | 3D silver metal, detailed profile | Flat white line art |
| Ring | Thick glowing blue gradient arc | Thin teal stroke U-shape |
| Eye | Cyan glow dot in metal head | Teal dot on white triangle |
| Background | Black in PNG (contain in UI) | Pure black baked in FG |
| Read @48px | Silhouette rich (heavy glow risk) | Minimal but **wrong brand** |

---

## Related docs

- `design-lab/brand-dna/v4/logo-evolution/PRODUCTION_LOGO_AUDIT.md` — P0 dual-family finding
- `design-lab/brand-dna/v4/logo-evolution/full-analysis/ANDROID_ADAPTIVE_ANALYSIS.md`
- `design-lab/brand-dna/v8/logo-evolution/06_RING_REFINEMENT_DIRECTION.md` — ring shrink for export
