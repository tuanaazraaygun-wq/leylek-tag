# 07 — Ring Size Test Plan

**Sprint:** BRAND-LOGO-EVO-1B  
**Mode:** Analysis / QA plan only  
**Date:** 2026-06-21  
**Candidates:** R4 (−4%), R6 (−6%), R8 (−8%) + glow reduction variants

---

## Test matrix overview

```
                    ┌─────────────┬─────────────┬─────────────┐
                    │     R4      │     R6      │     R8      │
                    │   scale     │   scale     │   scale     │
                    │    0.96     │    0.94     │    0.92     │
├───────────────────┼─────────────┼─────────────┼─────────────┤
│ G0 (glow as-is)   │  lab only   │  lab only   │  reject     │
│ G1 (−40% glow)    │  A/B        │  A/B        │  optional   │
│ G2 (−50% glow) ★  │  ship cand. │  PRIMARY ★  │  A/B        │
│ G3 (−60% glow)    │  optional   │  A/B        │  ship cand. │
└───────────────────┴─────────────┴─────────────┴─────────────┘

★ = recommended primary evaluation cell
```

**Primary cell:** **R6 + G2** (6% ring shrink, 50% glow reduction)

---

## Lab asset üretim spec

### Dosya adlandırma (design-lab only)

```
design-lab/brand-dna/v8/logo-evolution/lab-exports/
  ring-refine-r4-g2-512.png
  ring-refine-r6-g2-512.png
  ring-refine-r8-g2-512.png
  ring-refine-r6-g0-512.png   (glow baseline compare)
  ring-refine-r6-g2-168.png   (splash/login sim)
  ring-refine-r6-g2-48.png    (icon sim)
  ring-refine-r6-g2-1024.png  (ios tier)
```

### Üretim adımları (Figma / Affinity / PS — production’a yazma)

1. Master PNG import @512 (or native resolution).
2. **Kuş katmanını kilitle** (group: `stork.silhouette`).
3. Arc + glow mask group → transform scale from **(268, 278)** @512:
   - R4: 96%
   - R6: 94%
   - R8: 92%
4. Glow pass:
   - G0: unchanged
   - G1: outer glow opacity ×0.6, spread ×0.6
   - G2: opacity ×0.5, spread ×0.5
   - G3: opacity ×0.4, spread ×0.4
5. Export PNG-24, sRGB, `#08111F` flat background (no premultiply surprise).
6. **Do not** overwrite `frontend/assets/images/leylek-logo-premium.png`.

---

## Ölçüm checklist (her aday)

### A. Geometry (512 px artboard)

| ID | Test | Pass | R4 | R6 | R8 |
|----|------|------|----|----|-----|
| G-01 | Kuş alpha mask IoU vs production ≥ **98%** | | | | |
| G-02 | Beak tip → arc inner edge ≥ **8 px** @512 | | | | |
| G-03 | Tail left → arc inner edge ≥ **8 px** @512 | | | | |
| G-04 | Arc gap still top-right (1–2 o'clock) | | | | |
| G-05 | Arc thickest point still bottom center | | | | |
| G-06 | Optical center drift ≤ **2 px** vs (268,278) | | | | |
| G-07 | Outer glow spread ≤ **8 px** @512 (G2/G3) | | | | |

### B. Visual premium rubric (1–5, hedef ≥4)

| ID | Soru | Weight |
|----|------|--------|
| V-01 | Halka “destek”, kuş “hero” mu? | 25% |
| V-02 | Neon yerine cam/metal mi? | 25% |
| V-03 | Koyu zemin (#08111F) üzerinde sakin mi? | 20% |
| V-04 | 2 m mesafe telefon okuma (168 px sim) | 15% |
| V-05 | Production’a yan yana “aynı marka” mı? | 15% |

**Fail:** V-05 < 4 → aday elenir (rebrand algısı).

---

## Boyut tier testleri

### T1 — Splash / login (168 px box)

**Simülasyon:** `SplashScreen.tsx` `LOGO_BOX = min(SHORT_EDGE×0.34, width×0.4, 168)`  
**Login:** `LoginBrandHeader` logo 100×100 (compact 88×88)

| Test | Method | Pass criteria |
|------|--------|---------------|
| S-01 | Export @168 on `#08111F` | Arc readable; glow not blob |
| S-02 | Login 100×100 contain mock | Kuş siluet tanınır |
| S-03 | Side-by-side current vs R6-G2 | Ring visibly smaller; bird identical |

**Splash UI overlay (ayrı test — asset dışı):**

`SplashScreen.tsx` adds animated halos:

| Param | Value | 1B notu |
|-------|-------|---------|
| `haloR` | `LOGO_BOX × 0.58` | PNG glow azalınca UI halo **−10%** değerlendir (kod değişikliği 1C+) |
| `ringBreath` | scale 0.92–1.08 | Timing dokunulmaz (user rule) |

**Test S-04:** Static PNG only first; then PNG + JS halo composite screenshot — çift glow riski.

### T2 — App icon / APK (48 px → 1024 px)

**Config references (`frontend/app.json`):**

| Key | Asset | Ring refine |
|-----|-------|-------------|
| `expo.icon` | `leylek-logo-premium.png` | Direct — R6-G2 replaces on ship |
| `expo.ios.icon` | `ios.premium.logo.png` | Re-export tier-S from master |
| `android.adaptiveIcon.foregroundImage` | `adaptive-icon-foreground.png` | **Separate B family — not fixed by ring refine alone** |
| `plugins.expo-notifications.icon` | `leylek-logo-premium.png` | Direct — **glow reduction critical** (mono tint) |

| Test | Size | Pass |
|------|------|------|
| I-01 | 1024 squircle mask sim | Beak + wing apex inside 80% safe |
| I-02 | 432 adaptive safe (66%) | Arc terminals not clipped |
| I-03 | 48 launcher | Silhouette ≠ blob; arc hint visible |
| I-04 | 24 notification mono | Readable without glow dependency |
| I-05 | iOS vs Android **same R6-G2 bird** | Visual match when adaptive unified (future) |

**Android adaptive blocker:** Mevcut `adaptive-icon-foreground.png` wireframe (B) ring refine testinden **bağımsız** — I-05 fail expected until unify sprint.

### T3 — In-app surfaces

| Surface | File | Size context | Test |
|---------|------|--------------|------|
| Leylek Zeka chat | `LeylekZekaChat.tsx` | Header logo | Z-01 avatar clarity |
| Theme choice | `ThemeChoiceScreen.tsx` | Center logo | Z-02 |
| Logo component | `Logo.tsx` | 50/100/150 box | Z-03 small tier |
| Watermark | Muhabbet / map | Low opacity | Z-04 no glow noise |

---

## A/B comparison protocol

1. **Baseline:** production `leylek-logo-premium.png`
2. **Backup ref:** `_backup-pre-b6-2/leylek-logo-premium.png` (regression guard)
3. **Blind review:** 3 reviewer, 5 s flash @168 px — “same brand?” Y/N
4. **Device matrix (1C QA):**
   - iPhone SE (compact)
   - iPhone 15 Pro Max (tall)
   - Pixel 7 (adaptive icon)
   - Samsung A-series (OEM mask)

---

## Decision tree

```
Start
  │
  ├─ G-01 fail (kuş IoU <98%) → REJECT candidate
  │
  ├─ V-05 < 4 → REJECT (not same brand)
  │
  ├─ R8 + G-02/G-03 fail G-02 beak clearance → drop R8
  │
  ├─ R4 + G2 pass all but V-01 < 4 → try R6
  │
  └─ R6 + G2 pass all → RECOMMEND for 1C production export
         │
         └─ Optional: R6 + G3 if glow still heavy on I-04
```

---

## Deliverables (1B analysis complete)

| Artifact | Location | Status |
|----------|----------|--------|
| This test plan | `07_RING_SIZE_TEST_PLAN.md` | ✅ |
| Lab PNG exports | `v8/logo-evolution/lab-exports/` | ⏳ 1C (not 1B) |
| Golden test report | `v8/logo-evolution/09_GOLDEN_TEST_REPORT.md` | ⏳ post-lab |
| Sign-off record | Release gate doc | ⏳ |

---

## Out of scope (1B)

- Production PNG overwrite
- `app.json` icon path change
- Splash timing / animation code
- Android native `splashscreen_logo.png` pin replacement
- Vector master SVG path commit
