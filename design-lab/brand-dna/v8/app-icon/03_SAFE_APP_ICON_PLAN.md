# 03 — Safe App Icon Production Plan

**Sprint:** BRAND-APPICON-1A  
**Mode:** Analysis only — **no production writes in 1A**  
**Date:** 2026-06-21  
**Prerequisite:** BRAND-LOGO-EVO-1B ring refine direction (optional but recommended before export)

---

## Goal

Replace **Family B wireframe** launcher assets with **Family A premium kuş** derived from login logo — same brand, icon-optimized.

---

## Question 6 — Güvenli yeni icon planı

### Design spec

| Rule | Spec |
|------|------|
| Stork | **Pixel-faithful** to `leylek-logo-premium.png` silhouette |
| Ring | R6 shrink (−6%) + glow −50% (see `v8/logo-evolution/06`) |
| Background | **Premium soft black** — not pure `#000000` |
| Foreground | Symbol only in adaptive FG PNG; **no full-bleed black** in FG layer |
| Safe zone | Android 66% center circle @432 within 512 artboard |
| iOS | Same symbol @1024 in `ios.premium.logo.png` with embedded soft black OR full-bleed per Apple guidelines |

### Premium soft black tokens

| Token | Hex | Use |
|-------|-----|-----|
| **Recommended** | `#08111F` | Current cockpit navy — already login/splash; soft vs pure black |
| Alternate | `#0B1220` | Splash gradient mid — slightly lighter premium |
| Unify target | `#0D1117` | Brand genom (v4 docs) — future harmonize |
| **Avoid** | `#000000` | Harsh; current wireframe FG uses pure black — replace |

**1B default:** Keep `#08111F` for adaptive `backgroundColor` + `colors.xml` sync unless QA prefers `#0B1220`.

### Export pipeline (design-lab first)

```
leylek-logo-premium.png (A master)
        │
        ├─► Ring refine R6 + glow G2 (lab — LOGO-EVO-1C)
        │
        ├─► tier-S-icon-master-512.png (design-lab/brand-dna/v8/app-icon/lab-exports/)
        │
        ├─► adaptive-icon-foreground-432.png  (FG transparent, symbol in safe zone)
        ├─► ios-app-icon-1024.png           (full bleed soft black bg)
        └─► notification-mono-96.png          (optional white silhouette)
```

### Adaptive icon composition (Android)

```
┌──────────────────────────────── 512 ──┐
│ ░░░░░ 18% margin (safe) ░░░░░░░░░░░░░ │
│ ░░   ╭── premium stork + arc ──╮  ░░ │
│ ░░   │   (no outer glow bleed) │  ░░ │  ← 66% diameter safe
│ ░░   ╰──────────────────────────╯  ░░ │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
└───────────────────────────────────────┘
     Background layer: solid #08111F (app.json)
     Foreground layer: PNG with alpha (symbol only)
```

**Glow rule:** No glow extending past safe zone — OEM masks clip outer bloom.

### Small-size optimization (48 px)

| Technique | Apply |
|-----------|-------|
| Glow reduction | −50% min before export |
| Ring R6 | Tighter arc — less clutter |
| Leg detail | Keep single-leg read; merge micro-feather noise |
| Beak tip | Inside 66% safe — test Pixel squircle |
| Stroke | Slightly bolder arc @512 export (+5% stroke vs login full-size) optional A/B |

---

## Question 7 — White theme / dark theme ilişkisi

| Layer | Theme coupling | Impact on app icon |
|-------|----------------|-------------------|
| **OS launcher icon** | **None** | Static PNG/adaptive — does not switch with in-app theme |
| Login logo display | Premium dark auth UI | Uses same PNG; white theme login may use different screen bg — **logo asset unchanged** |
| `EXPO_PUBLIC_FEATURE_LIGHT_THEME` | In-app screens only (`eas.json`) | **No effect** on APK icon |
| ThemeChoiceScreen | Shows same `leylek-logo-premium.png` | Post-login; unrelated to launcher |
| Android `userInterfaceStyle: automatic` | System UI chrome | Does not regenerate icon |

**Conclusion:** App icon fix is **theme-independent**. Design for **dark premium black background** because:

1. Brand cockpit default is dark (`#08111F`).
2. Login first impression is dark premium auth.
3. iOS/Android do not ship separate light/dark launcher icons today (monochrome layer optional later).

**Future (out of 1A):** Android 13 themed icon monochrome layer — separate spec.

---

## Question 8 — Geri dönüş planı

### Before any production swap

1. **Timestamp backup folder:**
   ```
   frontend/assets/images/_backup-pre-appicon-YYYYMMDD/
     adaptive-icon-foreground.png
     (copy current ios.premium.logo.png → ../_backup-pre-appicon-YYYYMMDD/)
   ```

2. **Native Android backup** (already partially exists):
   ```
   frontend/android/app/src/main/res/_backup-pre-b6-3/mipmap-*/
   ```
   Create fresh `_backup-pre-appicon-YYYYMMDD/` mirroring current `mipmap-*/ic_launcher*`.

3. **Document git SHA** in PR description for one-command revert.

### Rollback procedure

```text
1. Restore adaptive-icon-foreground.png from backup
2. Restore ios.premium.logo.png from backup
3. Restore android/res/mipmap-* from backup OR run expo prebuild from restored assets
4. Rebuild APK/AAB
5. Verify launcher shows wireframe B (known state)
```

**No app.json rollback needed** if paths unchanged — only assets + native res.

---

## Phased implementation (1B — not executed in 1A)

### Phase 0 — Lab (design-lab only)

- [ ] Export tier-S candidates to `v8/app-icon/lab-exports/`
- [ ] 48 / 72 / 96 / 192 / 432 / 1024 px review grid
- [ ] Side-by-side login @100px vs launcher mock

### Phase 1 — Asset swap (gated)

| Step | File | Git add |
|------|------|---------|
| 1 | Backup current assets | N/A |
| 2 | `adaptive-icon-foreground.png` | ✅ targeted |
| 3 | `ios.premium.logo.png` | ✅ targeted |
| 4 | `npx expo prebuild --platform android` OR manual mipmap copy | native res |
| 5 | Verify `colors.xml` `iconBackground` | optional |

**Do NOT:** `git add .`

### Phase 2 — Config (optional minimal)

| File | Change |
|------|--------|
| `app.json` | Only if `backgroundColor` token change; paths stay |
| `colors.xml` | Sync `iconBackground` with app.json |

### Phase 3 — Verify

- Install APK on Pixel + Samsung
- Compare launcher vs login screenshot
- Notification icon still from `leylek-logo-premium.png` — verify mono readability separately

### Phase 4 — Follow-ups (separate PRs)

| Item | PR |
|------|-----|
| `splashscreen_logo.png` ×5 unify | APPICON-1C or SPLASH-UNIFY |
| `favicon.png` | WEB-ICON |
| `expo.icon` @1024 tier-S | optional unify |
| Store listing icons | marketing |

---

## Risk register (summary)

| Risk | Mitigation |
|------|------------|
| Prebuild overwrites manual native edits | Document prebuild command; commit native res intentionally |
| Glow clip on OEM mask | G2 glow limit; safe zone test |
| iOS/Android still differ | Same lab master → both exports same sprint |
| Login master changed separately | Freeze master hash before icon export |
| Pure black FG baked in | Export FG with transparency only |

---

## File change checklist (production — future 1B)

| File | Change in 1B? |
|------|---------------|
| `adaptive-icon-foreground.png` | **YES** |
| `ios.premium.logo.png` | **YES** |
| `mipmap-*/ic_launcher_foreground.png` | **YES** (regen) |
| `mipmap-*/ic_launcher.png` | **YES** (regen) |
| `leylek-logo-premium.png` | Only if ring refine ships first (LOGO-EVO) |
| `app.json` | Optional BG hex only |
| `LoginBrandHeader.tsx` | **NO** |
| `SplashScreen.tsx` | **NO** (timing rule) |
| `splashscreen_logo.png` | Recommended separate |

---

## Cross-sprint dependency

```
BRAND-LOGO-EVO-1B (ring direction)
        ↓ optional
BRAND-APPICON-1B (this plan — asset swap)
        ↓
BRAND-APPICON-1C (splash native unify)
```

**1A delivers analysis only.** No files under `frontend/assets/` or `android/res/` modified.
