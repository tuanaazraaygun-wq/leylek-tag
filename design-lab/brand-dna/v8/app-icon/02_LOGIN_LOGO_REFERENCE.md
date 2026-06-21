# 02 — Login Logo Reference

**Sprint:** BRAND-APPICON-1A  
**Mode:** Read-only analysis  
**Date:** 2026-06-21

---

## Question 2 — Login ekranındaki logo hangi assetten geliyor?

### Primary asset (SSOT for in-app brand)

```
frontend/assets/images/leylek-logo-premium.png
```

**Family A — Premium kuş + orbital arc**

- 3D metallic silver-white stork profile (single leg)
- Cyan eye accent
- Blue-cyan gradient orbital arc (~270° open swoosh)
- Outer glow on arc (neon bloom on black)

---

## Code references (all → same PNG)

| Consumer | File | Usage |
|----------|------|-------|
| **Login (premium theme)** | `frontend/components/auth/LoginBrandHeader.tsx` L76, L101 | `require('../../assets/images/leylek-logo-premium.png')` |
| **JS Splash** | `frontend/components/SplashScreen.tsx` L459 | Same require + animated halos |
| **Theme choice** | `frontend/components/theme/ThemeChoiceScreen.tsx` L27 | Center logo |
| **Leylek Zeka** | `frontend/components/LeylekZekaChat.tsx` L46 | Header avatar |
| **Generic Logo** | `frontend/components/Logo.tsx` L26 | 50/100/150 box tiers |

### Login display spec

From `LoginBrandHeader.tsx` styles:

| Token | Value |
|-------|-------|
| Default logo box | **100 × 100** px |
| Compact | **88 × 88** px |
| `resizeMode` | `contain` |
| Padding | 6 px horizontal/vertical inside box |
| Theme | `premium` → dark cockpit (`LoginBrandHeader` + `premiumAuthStyles`) |

**Background behind logo (login UI):** Not baked into PNG — app uses premium auth gradient (`#08111F` family via `premiumAuthStyles` / screen wrapper). Logo PNG has transparent/black surround in file.

---

## Config references (same asset)

| Config key | `app.json` value |
|------------|------------------|
| `expo.splash.image` | `./assets/images/leylek-logo-premium.png` |
| `expo.icon` | `./assets/images/leylek-logo-premium.png` |
| `expo-notifications` plugin icon | `./assets/images/leylek-logo-premium.png` |

**Note:** Splash native Android drawable (`splashscreen_logo.png`) is **NOT** this file — pin/wireframe B. JS splash after `hideAsync` shows correct A.

---

## Backup / archive copies

| Path | Purpose |
|------|---------|
| `frontend/assets/images/_backup-pre-b6-2/leylek-logo-premium.png` | Pre-B6-2 rollback |
| `frontend/assets/images/_backup-pre-b6-4/leylek-logo-premium.png` | Additional archive |
| `website/public/store/leylek-logo-premium.png` | Marketing copy (verify sync separately) |

**1A rule:** Do not overwrite backups.

---

## Geometry & identity lock (reference)

From `design-lab/brand-dna/v4/brand-identity-production/06_LOGO_GEOMETRY_CONSTITUTION.md`:

| Property | Locked |
|----------|--------|
| Canvas | 512 × 512 symbol |
| Optical center | (268, 278) |
| Stork silhouette | **Immutable** for app icon export |
| Arc | Open swoosh — not closed circle |
| Gap | Top-right (~1–2 o'clock) |

**App icon export must trace this asset**, not `adaptive-icon-foreground.png` or `ios.premium.logo.png` wireframes.

---

## Question 3 — Neden APK icon farklı görünüyor?

### Root causes (ordered by impact)

| # | Cause | Detail |
|---|-------|--------|
| **1** | **Different source files** | Login = `leylek-logo-premium.png` (A). Launcher = `adaptive-icon-foreground.png` + native mipmaps (B). |
| **2** | **Android adaptive override** | `expo.icon` does not apply to launcher when `adaptiveIcon.foregroundImage` is set. |
| **3** | **Prebuild / native drift** | Committed `android/res/mipmap-*` may lag Expo config if prebuild not re-run after asset change — currently consistent with B wireframe. |
| **4** | **iOS same drift** | `ios.premium.logo.png` is wireframe B′, not 3D premium — iPhone users also see mismatch vs login. |
| **5** | **Visual scale @ icon size** | Even if same family, 48 px launcher would simplify detail — but current issue is **wrong family**, not just scale. |
| **6** | **Splash double identity** | Native splash pin (B) → JS splash/login kuş (A) reinforces “two apps” feeling before login. |

### What it is NOT

| Ruled out | Reason |
|-----------|--------|
| White/dark theme toggle | OS icon is static; theme is in-app only |
| Wrong `require()` in login | Login correctly requires premium PNG |
| EAS env override | No icon env in `eas.json` |
| ProGuard stripping assets | Icon is native `res/`, not JS bundle |

---

## Target identity for new app icon (1B brief)

**Base:** `leylek-logo-premium.png` stork + arc geometry (unchanged silhouette).

**Adjustments (from product + BRAND-LOGO-EVO-1B):**

| Parameter | Direction |
|-----------|-----------|
| Ring | ~6% smaller (R6 candidate) |
| Glow | −50% outer bloom for small-size clarity |
| Background | **Premium soft black** — not harsh `#000000` |
| Tier | Simplified export for 48–192 px (leg/beak safe zone) |

**Forbidden:** Switching to wireframe B, pin metafor, new mascot, violet hero glow.

---

## Login vs icon — side-by-side expectation (post-fix)

| Check | Login | New launcher icon |
|-------|-------|-------------------|
| Same stork profile | ✅ | ✅ must match |
| Same arc family | ✅ open swoosh | ✅ same path scaled |
| Same cyan accent | ✅ | ✅ |
| 3D metal readable @100px | ✅ | N/A |
| Readable @48px | ✅ contain | ✅ tier-S simplify glow only |
| User says “same app” | baseline | **acceptance gate** |
