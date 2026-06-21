# 03 — Splash Double-Logo Root Cause

**Sprint:** BRAND-LAUNCH-2A (read-only)  
**Bug:** App opens with old/different logo, then real login logo appears.

---

## Symptom (user-visible)

1. **Frame 0–~300ms:** Flat wireframe stork + teal arc on navy (feels “old” / non-premium).
2. **~300ms–2.5s:** Premium 3D stork + ring, animated halos, “Leylek TAG” glass plate (`SplashScreen.tsx`).
3. **Login:** Same premium PNG at smaller size + typography (`LoginBrandHeader.tsx`).

User describes this as “eski logo sonra gerçek logo” — accurate: **two raster families**, not two files with identical pixels.

---

## Root cause #1 — Native vs JS asset mismatch (primary)

| Stage | Source file | Family |
|-------|-------------|--------|
| **Native Android splash** | `android/app/src/main/res/drawable-*dpi/splashscreen_logo.png` | **B — wireframe** |
| **Expo config (intent)** | `app.json` → `splash.image: leylek-logo-premium.png` | **A — premium** |
| **JS splash** | `SplashScreen.tsx` require premium PNG | **A — premium** |
| **Login** | `LoginBrandHeader.tsx` require premium PNG | **A — premium** |

Committed Android drawables were **not regenerated** after `app.json` pointed splash at premium PNG, or an older pin/wireframe export was kept in `res/`.

Visual proof: `drawable-xxhdpi/splashscreen_logo.png` = minimalist white bird + teal U-stroke; `leylek-logo-premium.png` = metallic bird + blue ring.

---

## Root cause #2 — Two splash systems stacked

### System A — Native (Android 12+ SplashScreen API)

```8:12:frontend/android/app/src/main/res/values/styles.xml
  <style name="Theme.App.SplashScreen" parent="Theme.SplashScreen">
    <item name="windowSplashScreenBackground">@color/splashscreen_background</item>
    <item name="windowSplashScreenAnimatedIcon">@drawable/splashscreen_logo</item>
    <item name="postSplashScreenTheme">@style/AppTheme</item>
    <item name="android:windowSplashScreenBehavior">icon_preferred</item>
  </style>
```

- Runs in `MainActivity` before React paints.
- Uses **Family B** bitmap from `res/`.
- Background `#08111F` matches JS — **logo art differs**.

### System B — JS splash (`SplashScreen.tsx`)

- Gated by `showSplash` in `app/index.tsx`.
- Runs **after** RN bridge ready.
- 2500ms timer + `onFinish` callback (timing intentionally stable — do not change in brand patch).
- Full cinematic treatment; same premium PNG as login.

### Bridge — `hideAsync()` in `_layout.tsx`

```53:56:frontend/app/_layout.tsx
  useEffect(() => {
    void ExpoSplashScreen.hideAsync().catch(() => {});
  }, []);
```

- Dismisses **Expo-managed native splash** as soon as root layout mounts.
- Does **not** remove Android 12 `windowSplashScreenAnimatedIcon` flash that already occurred at activity start.
- Comment documents past bug: native layer stuck over JS — hideAsync was added as fix.

**Result:** User always gets **native flash (B)** then **JS splash (A)** when both differ.

---

## Root cause #3 — Presentation jump (secondary)

Even if native + JS used **same PNG**, transition would still feel like a “logo change” because:

| Property | Native splash | JS SplashScreen | Login |
|----------|---------------|-----------------|-------|
| Size | System icon slot (~240dp scaled) | `LOGO_BOX` ~34% short edge | 100×100 |
| Chrome | Plain centered bitmap | Halos, beam, glass plate | Wordmark text only |
| Motion | Static | Fade/scale/spring | Static |
| Typography | None | “Leylek TAG” + taglines | “Leylek” + “TAG” split styles |

Same raster ≠ same **brand moment**.

---

## Why `app.json` splash does not fix APK alone

`expo.splash` in `app.json` drives **prebuild code generation**. This repo **commits** `frontend/android/` native project. Local/EAS release builds use committed `splashscreen_logo.png` unless:

- `npx expo prebuild` re-run after config change, **and**
- Generated drawables committed, **or**
- CI runs prebuild every build.

Current state: config says premium; **drawables say wireframe**.

---

## iOS note

No committed `ios/` folder — splash assets come from EAS prebuild at build time. iOS may show premium PNG on native flash (closer to JS), while Android APK shows wireframe — **platform skew** possible.

---

## Fix direction (analysis only — see 04)

1. Regenerate `splashscreen_logo.png` ×5 from **same master as login** (Family A), with splash-appropriate padding.
2. Align `adaptive-icon-foreground` separately (launcher scope).
3. Optional: tune native splash duration vs JS handoff — **out of scope** unless product wants single splash (timing change = risk).

---

## What is NOT the cause

- Login using a different PNG file (same `leylek-logo-premium.png`).
- Splash timer / `onFinish` logic (timing works; asset mismatch is visual).
- Theme light/dark (splash always navy `#08111F`).
- LeylekEye SVG (not used on splash/login).

---

## Key references

| Topic | Path |
|-------|------|
| Native splash PNG | `frontend/android/app/src/main/res/drawable-xxhdpi/splashscreen_logo.png` |
| Premium PNG | `frontend/assets/images/leylek-logo-premium.png` |
| Prior analysis | `design-lab/brand-dna/v4/logo-evolution/full-analysis/SPLASH_LOGO_ANALYSIS.md` |
| JS splash | `frontend/components/SplashScreen.tsx` L458–466 |
| Splash gate | `frontend/app/index.tsx` L2917–2938 |
