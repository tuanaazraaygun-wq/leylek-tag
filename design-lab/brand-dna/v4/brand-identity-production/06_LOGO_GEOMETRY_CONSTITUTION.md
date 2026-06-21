# 06 — Logo Geometry Constitution

**Version:** Logo Geometry v1.0 — **FROZEN**  
**Sprint:** B5.2 — Brand Geometry Freeze  
**Status:** Design-lab constitution — production unchanged  
**Master (immutable):** `frontend/assets/images/leylek-logo-premium.png`  
**Vector SSOT:** `svg/leylek-symbol-master-v1.svg` (B5.1 v1.1 trace)

---

## 0. Authority

| Rule | Detail |
|------|--------|
| Master PNG | Single source of truth — **never replaced, never redesigned** |
| Master SVG | Production vector **derived from** master PNG only |
| Similarity gate | 95–98% silhouette IoU vs master PNG |
| Change type | Vector quality / export optimization only |
| Forbidden | F1 Meridian Wing, pin family, crown, mascot, abstract icon |

**Amendment:** Requires brand council + golden test re-pass. Geometry numbers in this document are **locked**.

---

## 1. Coordinate system

| Token | Value | Locked |
|-------|-------|--------|
| `geo.canvas.symbol` | 512 × 512 px | ✅ |
| `geo.canvas.icon` | 1024 × 1024 px (512 symbol centered) | ✅ |
| `geo.origin.math` | (256, 256) | ✅ |
| `geo.origin.optical` | (268, 278) — bird mass center | ✅ |
| `geo.grid.base` | 8 px | ✅ |
| `geo.snap` | Integer coordinates only; 0.5 px offset **forbidden** | ✅ |
| `geo.aspect.symbol` | 1:1 | ✅ |
| `geo.aspect.splash` | 16:9 (1920×1080 artboard) | ✅ |

---

## 2. Grid & safe area

### 2.1 Grid

All anchor points snap to **8 px grid**. Sub-grid 4 px allowed for accent dot optical nudge only.

### 2.2 Safe area (symbol within canvas)

```
┌────────────────────────────────────── 512 ──┐
│ ░░░░░░░░░░░ 10% margin ░░░░░░░░░░░░░░░░░░░ │  ← 51 px breath
│ ░░  ╭── orbital arc ──────────────╮  ░░░ │
│ ░░  │     stork silhouette        │  ░░░ │  ← 80% live zone
│ ░░  │         ● eye               │  ░░░ │     410 × 410 px
│ ░░  ╰─────────────────────────────╯  ░░░ │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
└────────────────────────────────────────────┘
```

| Zone | Inset | px @512 | Rule |
|------|-------|---------|------|
| Outer margin | 10% | 51 px | No stroke/fill crosses |
| Live symbol zone | 80% center | 410 × 410 | All logo geometry |
| App icon safe (iOS squircle) | 80% | 410 effective | Wing apex + beak tip inside |
| Android adaptive safe | 66% center | 338 × 338 @432 fg | Beak tip must not clip |

### 2.3 Optical center

| Element | Math center | Optical center | Shift |
|---------|-------------|----------------|-------|
| Full symbol | (256, 256) | (268, 278) | +12 px X (beak mass), +22 px Y (leg mass) |
| Head cluster | — | (288, 162) | Small head, long beak right-weighted |
| Accent eye | (292, 166) | — | Locked anchor |

**Rule:** Centering for splash/app icon uses **optical center (268, 278)**, not math center.

---

## 3. Stroke philosophy

| Layer | @512 px | Scale formula | Cap | Join |
|-------|---------|---------------|-----|------|
| `arc.primary` | 11 px | `round(11 × size/512)` | round | round |
| `arc.secondary` | 5.5 px | `round(5.5 × size/512)` | round | round |
| `wing.sweep` | 4 px | `round(4 × size/512)` | round | round |
| Silhouette fill | n/a (filled path) | — | — | — |

| Philosophy | Rule |
|------------|------|
| Maximum stroke @512 | **12 px** — never exceed |
| Minimum stroke @512 | **3 px** — wing sweep floor |
| Glow as stroke | Never blur filter in master SVG |
| 3D metal | **Forbidden** in vector — flat/semi-flat only |
| Stroke > fill | Arc is stroke-first; bird is fill-first |

---

## 4. Curve philosophy

| Principle | Spec |
|-----------|------|
| Tool | Cubic Bézier only — no quadratic in master paths |
| Control point discipline | Handles parallel to adjacent segment ±15° max |
| Crest integration | **Single profile path** — no separate crown polygon |
| Neck | One continuous S-curve — no kink >8° at any join |
| Beak | Upper and lower tangent **horizontal ±2°** |
| Wing sweep | Single open curve — max 4 control points |
| Arc swoosh | Single path — thick bottom, tapered terminals |
| Simplification | Remove nodes only if IoU ≥95% maintained |

**B5.1 lesson:** Separate decorative paths on head = drift. All head geometry lives in `stork.silhouette`.

---

## 5. Proportional ratios (locked @512)

Measured from B5.1 master SVG trace aligned to premium PNG.

| Ratio ID | Definition | Target | Tolerance |
|----------|------------|--------|-----------|
| `R.headHeight` | Crest top → throat (Y) | 36 px (7.0%) | ±2 px |
| `R.beakLength` | Eye X → beak tip X | 52 px (10.2%) | ±3 px |
| `R.neckLength` | Throat → body shoulder (Y) | 44 px (8.6%) | ±3 px |
| `R.bodyHeight` | Shoulder → leg joint (Y) | 94 px (18.4%) | ±4 px |
| `R.legLength` | Joint → foot (Y) | 56 px (10.9%) | ±3 px |
| `R.beakAngle` | Beak upper edge vs horizontal | **0° ± 2°** | ±2° |
| `R.headToBody` | Head height : body height | **1 : 2.6** | ±0.15 |
| `R.beakToHead` | Beak length : head width | **1.45 : 1** | ±0.1 |
| `R.negSpace` | Empty canvas inside arc | **≥ 30%** | min 28% |
| `R.symbolFill` | Bird bounds : canvas | ~42% width, ~52% height | visual |

### 5.1 Head ratio

| Component | Locked behavior |
|-----------|-----------------|
| Head | **Small** relative to beak — premium, not mascot |
| Crest | 3 integrated feather points in profile — **not** separate crown |
| Eye | Single dot — non-expressive, non-cartoon |
| Beak | Dominant horizontal element — longest visible line |

### 5.2 Neck ratio

| Component | Locked behavior |
|-----------|-----------------|
| Form | Slender S-curve |
| Width | Narrowest at mid-neck (~18 px @512) |
| Flow | Throat → shoulder without bulge |
| Angle at head join | ≤12° tangent continuity |

### 5.3 Beak angle

| Property | Value |
|----------|-------|
| Upper mandible | Horizontal, tip at (344, 166) region |
| Deviation from 0° | **±2° maximum** |
| Tip sharpness | Point — not rounded bulb |
| Lower mandible | Subtle; does not droop |

---

## 6. Orbital arc geometry

| Property | Locked value @512 |
|----------|-----------------|
| Layer ID | `layer.orbitalArc` |
| Primary path | `M 146 196 C 112 246, 102 318, 128 374 C 164 422, 228 432, 288 412 C 348 392, 394 338, 404 276` |
| Type | Open swoosh — **not** closed circle |
| Gap position | Top-right (~1–2 o'clock) — beak breathes in gap |
| Thickest point | Bottom center (~Y 422–432) |
| Terminal style | Tapered — round cap |
| Relationship to bird | Bird centered in open cavity; arc does not touch beak tip |
| Sweep | ~270° effective |

**Forbidden:** Full ring, pin teardrop, F1 arc-only (no stork), equal-weight circle.

---

## 7. Cyan accent (eye)

| Property | Locked @512 |
|----------|-------------|
| Layer ID | `layer.accentDot` / `eye.accent` |
| Center | **(292, 166)** |
| Radius | **5.5 px** |
| Color | `#00D4AA` Meridian Cyan |
| Highlight | (290.5, 164.5) r=1.8 @ 32% white — optional |
| Position rule | Head center-right — **never** oversized |
| Min size @16 | r ≥ 1.5 px (2 px rendered) |

**Forbidden:** Eye as character expression, mascot wink, crown-adjacent jewel.

---

## 8. Wing sweep

| Property | Locked @512 |
|----------|-------------|
| Layer ID | `layer.wingSweep` / `wing.sweep` |
| Path | `M 260 226 C 276 232, 294 248, 306 270 C 314 284, 316 300, 308 314` |
| Stroke | 4 px `#F5F7FA` @ 90% opacity |
| Count | **One** curve — no feather texture |
| Relation | Follows body back contour |

---

## 9. Leg geometry

| Leg | Locked behavior |
|-----|-----------------|
| Standing (left) | Straight vertical — `stork.silhouette` path includes leg |
| Tucked (right) | Sharp V — separate `stork.leg.tucked` path |
| Foot | Minimal flare — no detailed toes |
| Stance | One-leg balance — signature master pose |

---

## 10. Minimum size tiers

Design **small-first** — never shrink L tier to favicon.

| Tier | px | Source SVG | Visible elements |
|------|-----|------------|------------------|
| **M0** | 16 | `leylek-symbol-small.svg` | Arc hint + accent dot + body blob |
| **M1** | 24 | `leylek-symbol-small.svg` | + simplified neck/beak |
| **S** | 32–48 | master (simplified) | Profile + arc + eye |
| **M** | 64–128 | master full | Crest + legs + wing sweep |
| **L** | 256–512 | master full | All layers |
| **XL** | 1024 | app-icon artboard | Full + safe zone padding |

### 10.1 Favicon rules (16–32 px)

| Rule | Spec |
|------|------|
| Source | `leylek-symbol-small.svg` only — **never** master shrink |
| Must survive | Arc swoosh hint + cyan dot |
| May omit | Crest detail, tucked leg, wing sweep |
| Background | `#0D1117` Void Black |
| Forbidden | Pin silhouette, wireframe-only arc, text |

### 10.2 App icon rules

| Platform | Canvas | Safe zone | Background |
|----------|--------|-----------|------------|
| iOS | 1024 | 80% squircle test | `#0D1117` |
| Android adaptive fg | 432 | 66% center | transparent |
| Android adaptive bg | — | — | `#0D1117` |

---

## 11. Layer stack (z-order)

```
1. background (dark/light variant only)
2. layer.orbitalArc (secondary under primary)
3. layer.storkBody (fill)
4. layer.wingSweep (stroke overlay)
5. layer.accentDot (top)
```

---

## 12. SVG layer IDs (mandatory)

| ID | Content |
|----|---------|
| `layer.orbitalArc` | Arc primary + secondary |
| `layer.storkBody` | `stork.silhouette`, `stork.leg.tucked` |
| `layer.wingSweep` | `wing.sweep` |
| `layer.accentDot` | `eye.accent` |

Export tools must preserve IDs for QA diff.

---

## 13. Amendment log

| Version | Date | Change |
|---------|------|--------|
| v1.0 FROZEN | 2026-06-21 | B5.2 — initial freeze from B5.1 master trace |

---

**Parent:** `02_LOGO_EVOLUTION_PRODUCTION_SPEC.md`, `B5_1_BRAND_CORRECTION.md`  
**Next:** `07_MARKER_GEOMETRY_CONSTITUTION.md`
