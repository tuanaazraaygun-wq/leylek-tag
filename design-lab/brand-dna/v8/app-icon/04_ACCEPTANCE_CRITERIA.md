# 04 — Acceptance Criteria

**Sprint:** BRAND-APPICON-1A  
**Mode:** Read-only — criteria for **BRAND-APPICON-1B** implementation gate  
**Date:** 2026-06-21

---

## Primary acceptance (must pass all)

| ID | Criterion | Method | Pass |
|----|-----------|--------|------|
| **AC-01** | Android launcher icon shows **same stork silhouette** as login logo | Side-by-side screenshot: login @100px vs home screen | Visual match; blind review ≥4/5 “same brand” |
| **AC-02** | **Not** wireframe stick-bird (Family B) | Compare to current `adaptive-icon-foreground.png` | Old B icon gone |
| **AC-03** | Orbital arc present (open swoosh, not pin) | 48 px launcher inspect | Arc hint readable |
| **AC-04** | Background = **premium soft black** (`#08111F` ± approved token) | Color picker on launcher BG | Not pure `#000000` harsh |
| **AC-05** | Ring visibly **≤ login** full-size ring (R4–R6) | Overlay lab export on login PNG | Ring shrink confirmed |
| **AC-06** | Glow **≤ login** production glow | 48 px no blob; 192 px controlled rim | No neon halo bleed past safe zone |
| **AC-07** | Logo identity unchanged — no new mascot/pin/crown | Brand council / diff review | Silhouette IoU ≥95% vs premium master |
| **AC-08** | iOS home icon matches Android symbol family | iPhone + Android same session | Same A family both platforms |

---

## Platform matrix

### Android APK (primary bug report)

| ID | Test | Device / context | Pass |
|----|------|------------------|------|
| **AND-01** | Install fresh APK (`eas` preview/simple) | Pixel or physical Android | Icon on launcher |
| **AND-02** | Adaptive circle mask (Pixel launcher) | Default launcher | No beak/wing clip |
| **AND-03** | Adaptive squircle (Samsung) | One UI | No clip |
| **AND-04** | Legacy `ic_launcher.png` pre-26 fallback | Emulator API 24 if available | Not broken |
| **AND-05** | App drawer + home screen | Same icon both | Consistent |
| **AND-06** | Long-press shortcut / settings | System shows same icon | Match |

### iOS (parity)

| ID | Test | Pass |
|----|------|------|
| **IOS-01** | Home screen @1024 downscale | Matches Android symbol |
| **IOS-02** | Settings → Leylek TAG row 29px icon | Silhouette readable |
| **IOS-03** | TestFlight build | Same as local export |

---

## Size tier tests (export QA)

| Size | Context | Pass criteria |
|------|---------|---------------|
| **48 px** | Launcher base | Stork + arc distinguishable; not gray blob |
| **72 px** | hdpi | Same |
| **96 px** | xhdpi | Eye dot visible |
| **192 px** | xxhdpi | Metal read hint OK |
| **432 px** | Adaptive FG artboard | Full safe zone respected |
| **1024 px** | iOS / store | Soft black bg uniform |

---

## Login / splash consistency (informational — full pass optional in 1B)

| ID | Test | Required for 1B? |
|----|------|------------------|
| **SPL-01** | JS Splash after load = login logo family | Already ✅ (A) |
| **SPL-02** | Native Android splash drawable | ❌ separate sprint |
| **LOG-01** | LoginBrandHeader 100×100 | Must still match post-swap |
| **NOT-01** | Notification tray icon | Separate test — still `leylek-logo-premium.png` |

---

## Theme / feature flag (explicit non-requirements)

| ID | Statement |
|----|-----------|
| **TH-01** | Pass/fail **does not** depend on light theme enabled |
| **TH-02** | Pass/fail **does not** require ThemeChoiceScreen change |
| **TH-03** | In-app white theme screens may use same PNG — no second icon asset required in 1B |

---

## Regression guards

| ID | Guard |
|----|-------|
| **REG-01** | Rollback backup exists (`_backup-pre-appicon-*`) |
| **REG-02** | `git add .` not used — staged files listed in PR |
| **REG-03** | Splash `onFinish` timing untouched |
| **REG-04** | QR / payment / match / socket code untouched |
| **REG-05** | No change to `LoginBrandHeader` require path unless intentional |

---

## Sign-off rubric

| Role | Approves |
|------|----------|
| Product | AC-01, AC-08 — “same app as login” |
| Brand / design | AC-05, AC-06, AC-07 — premium restraint |
| Engineering | AND-01–06, rollback documented |
| QA | Full platform matrix green |

**Ship blockers:** AC-01 fail, AC-02 fail (B still showing), AND-02 clip on reference device.

---

## Definition of done (BRAND-APPICON-1B)

- [ ] New `adaptive-icon-foreground.png` in repo (lab-approved export)
- [ ] New `ios.premium.logo.png` in repo
- [ ] Native `mipmap-*/ic_launcher*` regenerated and committed OR prebuild doc in PR
- [ ] Backup folder committed or documented in PR body
- [ ] APK installed — AND-01 screenshot attached
- [ ] Login vs launcher comparison screenshot attached
- [ ] All **Primary acceptance AC-01–AC-08** checked
- [ ] Rollback steps verified once on dev machine

---

## 1A status

| Deliverable | Status |
|-------------|--------|
| Root cause documented | ✅ |
| Safe plan documented | ✅ |
| Acceptance criteria defined | ✅ |
| Production assets modified | ❌ **None (by design)** |
| `app.json` modified | ❌ **None (by design)** |

**BRAND-APPICON-1A ANALYSIS COMPLETE — Production untouched.**
