# V7.1b — Small Size Analysis

**Team:** ALPHA  
**Subjects:** Original 1254 master · B5.3 candidates A/B/C · LC-2/LC-3 targets  
**Method:** B5.3 export matrix · constitution tiers · overlay PNG inspection  
**Status:** Automated exports exist · human tier sign-off PENDING

---

## 1. Tier philosophy

> Design **small-first** — never shrink L-tier master to favicon.  
> — `06_LOGO_GEOMETRY_CONSTITUTION.md` §10 · `09_EXPORT_SYSTEM.md` §3

| Tier ID | px range | Source (target) | Purpose |
|---------|----------|-----------------|---------|
| M0 | 16 | LC-3 / `leylek-symbol-small.svg` | Favicon fragment |
| M1 | 24 | LC-3 | Notification |
| S | 32–48 | LC-3 → LC-2 transition | Toolbar · small UI |
| M | 64–128 | LC-2 master | Settings · spotlight |
| L | 256–512 | LC-2 master | UI hero · golden test |
| XL | 1024 | LC-2 app-icon artboard | Store · iOS |

---

## 2. Pass criteria by size (B5.3 + constitution)

| px | Arc | Eye | Stork profile | Beak | One-leg | Source |
|----|-----|-----|---------------|------|---------|--------|
| 16 | fragment OK | optional | blob OK | N/A | omit | SMALL_SIZE_TEST §3 |
| 24 | ✅ required | ✅ required | ✅ required | implied | omit OK | G1-4 |
| 32 | ✅ swoosh hint | ✅ | ✅ neck | hint | optional | Constitution M1 |
| 48 | ✅ full swoosh | ✅ | ✅ | ✅ hint | ✅ readable | pose.one_leg |
| 64 | ✅ | ✅ | ✅ crest | ✅ | ✅ | M tier |
| 96 | ✅ | ✅ | ✅ wing | ✅ dominant | ✅ | Near full |
| 512 | ✅ full mass | ✅ | ✅ all detail | ✅ dominant | ✅ tucked V | Golden |
| 1024 | ✅ + safe zone | ✅ | ✅ | ✅ | ✅ | OEM masks |

---

## 3. Size-by-size visual behaviour

### 24 px

| Aspect | Original 1254 master (downscaled) | B5.2 export | LC-3 (Candidate C) | LC-2 / A @24 |
|--------|-------------------------------------|-------------|--------------------|--------------|
| **Arc** | Cyan mass survives as curved band | Hairline — **near invisible** | **22px stroke export — bold arc band** | 20px — thinner than C |
| **Eye** | Often **lost** in anti-alias | Dot may survive | **r=6.0 — intentional boost** | r=5.5 — marginal |
| **Beak** | Collapses to horizontal tick | Short — **authority gone** | Right-pointing bar readable | Similar to C |
| **Leg** | Standing leg **pixel-thin — disappears** | Blob | **Merged — intentional** | Tucked noise |
| **Wing** | Gone | Gone | 5px stroke — faint | 4px — faint |
| **Read** | "Bird in green U" if arc strong | Generic dot + smudge | **Best notification tier** | Acceptable not optimal |
| **Verdict** | Do not use master shrink | FAIL | **Win @24** | Use LC-3 ladder |

Overlay refs: `candidate-c-small-size-24.png` · `candidate-a-ultra-faithful-24.png`

### 32 px

| Aspect | Behaviour |
|--------|-----------|
| Arc | Full swoosh hint visible; LC-3 preferred |
| Eye | Cyan dot stable @ r=6 (LC-3) |
| Beak | Horizontal mandible emerges |
| Neck | S-curve implied — not full detail |
| Leg | Standing leg may appear as single pixel column |
| Crest | Still lost — acceptable per DECORATIVE policy |
| **Risk** | Master downscale blurs metallic gradients into grey noise |

### 48 px

| Aspect | Behaviour |
|--------|-----------|
| Arc | Full open swoosh readable |
| Eye | Both r=5.5 and r=6 OK |
| Beak | Dominant line returns — **pose.one_leg gate** |
| Tucked leg | Must be readable @48 on LC-2; LC-3 may merge |
| Wing | Single sweep visible on master / A / B |
| **Pass** | S-tier — first size where full silhouette contract applies |

### 64 px

| Aspect | Behaviour |
|--------|-----------|
| Detail | Crest tuft begins; wing sweep clear |
| Leg | One-leg pose readable |
| Arc terminals | Taper visible |
| **Source** | LC-2 master — not small SVG |
| **Use** | Settings icons · Leylek Zeka header approaches |

### 96 px

| Aspect | Behaviour |
|--------|-----------|
| Detail | Near-complete master geometry |
| Material | Raster hero still shows chrome; vector flat acceptable |
| **Use** | Android notification large · in-app chrome |
| **Test** | T-A5 splash sub-element scale |

### 512 px

| Aspect | Behaviour |
|--------|-----------|
| **Golden tier** | All layers: arc mass, beak tip, tucked V, wing |
| B5.2 failure | Visible hairline arc + short beak — **human fail** |
| LC-2 target | 19–20px arc · beak ~356 · optical nudge |
| LC-3 @512 | **Must match A/B silhouette ≥98%** — else reject as master |
| **QA** | IoU ≥0.98 · overlay 50% blink |

### 1024 px

| Aspect | Behaviour |
|--------|-----------|
| Canvas | App icon artboard · 512 symbol centered |
| Safe zone | iOS 80% squircle · Android 66% circle @432 fg |
| LC-2 | translate(4,6) prevents beak clip / heavy-bottom feel |
| **Failure mode** | Arc apex clipped in OEM mask — T-A3/T-A4 |
| **Arc mass** | Critical for App Store grid blind test G1-1 |

---

## 4. Original master raster vs vector ladder

| Property | 1254 PNG master | LC-2 vector | LC-3 micro |
|----------|-----------------|-------------|------------|
| Metallic gradients | ✅ Full chrome | ❌ Flat fill | ❌ Flat |
| Glow / halo | ✅ Eye + arc | ❌ Forbidden in SVG | Dot only |
| Thin leg @24px | ❌ Lost on shrink | ❌ Lost if master shrink | ✅ Merged simplify |
| Splash hero | ✅ **Mandatory tier** | SVG alone insufficient | N/A |
| Favicon | ❌ Wrong source | ❌ Wrong source | ✅ **Only source** |

**Policy:** Raster 1254 for splash/login hero · vector LC-2 for icon pipeline · LC-3 for ≤48px (`V7.1` RA-1).

---

## 5. A vs B vs C @ small tiers

| Test | Winner | Evidence |
|------|--------|----------|
| 24px blink | **C (LC-3)** | Arc 22px + eye r=6 · B5.3 CANDIDATE_C |
| 48px readability | **C ≥ A** | SMALL_SIZE_TEST §4 |
| 512px silhouette | **A or B** | C must ≥98% match — not bolder brand |
| iOS squircle @1024 | **B (LC-2)** | Optical nudge +4,+6 · jury store 9/10 |
| Purist fidelity | **A (LC-1)** | Maximum overlay match · 78 composite |

**Recommended dual ladder:** LC-2 (or LC-1) @512+ · LC-3 @16–48.

---

## 6. What disappears @ each tier (production B5.2 path — avoid)

| Size | Lost on B5.2 ladder | Lost on master shrink |
|------|---------------------|------------------------|
| 24px | Arc mass, beak authority, brand association | Eye, leg, crest, metallic read |
| 48px | Tucked leg mnemonic | Wing energy |
| 512px | Premium feel (flat) | N/A |
| Maps | N/A logo | Watermark uses wrong tier |

B5.6: @24px production becomes **"bird dot"** not LeylekTAG.

---

## 7. Tests before production (Team Alpha)

| ID | Test | Pass |
|----|------|------|
| T-A5 | Notification @24px LC-3 | Eye + arc read |
| T-A3 | iOS squircle clip | No arc clip |
| T-A4 | Android adaptive circle | Center mass OK |
| T-A7 | Splash 38% width | Arc visible |
| G1-6 | Favicon @16px | Fragment recognizable |
| G0-2 | IoU @512 | ≥0.98 |

---

## 8. Export filenames (future — not produced in V7.1b)

| px | Source | Output |
|----|--------|--------|
| 16, 24 | LC-3 | `leylek-symbol-16.png`, `-24.png` |
| 32, 48 | LC-3 / simplified master | `-32.png`, `-48.png` |
| 512 | LC-2 dark | `leylek-symbol-dark-512.png` |
| 1024 | app-icon SVG | `leylek-app-icon-1024.png` |
| 1254 | LC-2 export or restored backup | `leylek-logo-premium.png` hero |

---

**Small size analysis complete.**  
Human sign-off: `logo-restoration/SMALL_SIZE_TEST.md` §6 — ⏸ PENDING
