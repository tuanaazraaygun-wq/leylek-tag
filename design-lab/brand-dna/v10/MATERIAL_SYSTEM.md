# Material System — Five-Layer Compositing Stack

**Sprint:** RC-BRAND-V10  
**Parent:** [MASTER_V2_SPEC.md](./MASTER_V2_SPEC.md)  
**Status:** Design-lab specification — no assets produced

---

## 1. Design principle

Separate the logo into **five independent compositing layers**. Each layer has a vector definition (LC-2) and a raster render recipe (hero tier). **No single flattened mystery PNG** as geometry source.

**Evolution scope:** Material refinement + glow reduction. **Stork silhouette paths locked.**

---

## 2. Layer stack overview

```
Z-index  Layer ID                  Render domain
───────  ────────────────────────  ──────────────────────────
   5     layer.groundShadow        Raster hero + marketing only
   4     layer.accentDot           Vector fill + raster glow (controlled)
   3     layer.wingHighlight       Vector stroke
   2     layer.storkBody           Vector fill + raster metal passes
   1     layer.orbitalArc          Vector fill/stroke + raster rim/glow
   0     background                Variant surface
```

---

## 3. Layer 1 — Orbital ring (`layer.orbitalArc`)

### Role

Technology orbit, coverage metaphor. **Support role** — must not overpower stork after V2.

### Vector (LC-2)

| Sub-pass | ID | Spec |
|----------|-----|------|
| Body fill | `orbitalArc.fill` | Variable-width swoosh — see RING_ENGINEERING |
| Rim | `orbitalArc.rim` | 1 px equivalent highlight path |
| Inner depth | `orbitalArc.innerShadow` | Inset 2 px, no blur filter |

### Color stops (dark variant)

| Stop | Position | Hex | Usage |
|------|----------|-----|-------|
| Deep base | 0% | `#1E3A5F` | Shadow side |
| Mid | 55% | `#0891B2` | Body |
| Rim | 100% | `#22D3EE` | Top-left specular edge |

Max **3 stops** — no violet, no neon underglow.

### Raster passes (hero @1254)

| Pass | Operation | @512 equivalent |
|------|-----------|-----------------|
| Core gradient | Linear along arc normal | 2–3 stops above |
| Metal rim | `#F5F7FA` @ **35%** opacity, 1 px | Sharpened, no blur |
| Inner shadow | `#08111F` @ **15%**, feather **≤ 2 px** | Soft depth only |
| Outer glow | See §5 Glow Engineering | **50% production** |

### Light variant (`logo.symbol.light`)

| Stop | Hex |
|------|-----|
| Deep | `#0891B2` |
| Rim | `#00D4AA` |
| Stork cavity | transparent |

---

## 4. Layer 2 — Metal body (`layer.storkBody`)

### Role

Primary recognition anchor. **Locked silhouette.**

### Vector paths

| Path ID | Content |
|---------|---------|
| `stork.silhouette` | Head + neck + body + standing leg (single profile) |
| `stork.leg.tucked` | Tucked V-leg (separate path) |
| `stork.crest` | Integrated in silhouette — **not** separate crown |

### Color (dark variant)

| Pass | Spec |
|------|------|
| Base gradient | `#E8EEF4` (highlight) → `#B8C4D0` (shadow) |
| Specular boost | **+10%** on luminance > 150 (Preview B) |
| Shadow crush | **−3%** on luminance < 90 |
| Edge | Optional UnsharpMask radius 1.2, 90%, threshold 2 |

### Vector rule

Flat fill `#F5F7FA` acceptable for LC-2 export @≤128. Metal rendering = **raster hero tier only**.

**Forbidden in V2:** Path edits, beak shorten, leg merge, chibi head scale.

---

## 5. Layer 3 — Wing highlight (`layer.wingHighlight`)

### Role

Kinetic memory — separates body from static teardrop.

### Vector

| Property | @512 value |
|----------|------------|
| Path ID | `wing.sweep` |
| Path | `M 260 226 C 276 232, 294 248, 306 270 C 314 284, 316 300, 308 314` |
| Stroke width | **4 px** |
| Color | `#F5F7FA` @ **90%** opacity |
| Cap / join | Round |

### Micro tier (LC-3)

May reduce to **3 px** @512 artboard or omit @≤24 px display.

---

## 6. Layer 4 — Eye glow (`layer.accentDot`)

### Role

“System alive” — links bird to arc DNA. **Not** a character eye.

### Vector

| Property | @512 value |
|----------|------------|
| Center | **(292, 166)** — locked |
| Radius | **5.5 px** (hero) / **6.0 px** (LC-3 micro source) |
| Fill | `#00D4AA` (Meridian Cyan) |
| Highlight | (290.5, 164.5) r=1.8 @ 32% `#F5F7FA` — optional |

### Glow (raster hero only)

| Property | V1 production | **V2 spec** |
|----------|---------------|-------------|
| Eye halo | Visible cyan bloom | **Removed** — dot only |
| Outer glow radius | ~4 px | **0 px** |
| Rationale | Eye survives @48 without halo; halo causes smear |

**Forbidden:** Wink, pupil, white sclera, oversized jewel eye.

---

## 7. Layer 5 — Ground shadow (`layer.groundShadow`)

### Role

Grounds stork on dark surfaces; adds premium weight at hero scale.

### Spec (raster hero only — **not in master SVG**)

| Property | @512 | @1254 |
|----------|------|-------|
| Type | Elliptical soft shadow under standing foot | |
| Center | ~(248, 418) | ~(607, 1024) |
| Size | 32 × 8 px | 78 × 20 px |
| Color | `#000000` @ **25%** | |
| Blur | Gaussian σ **4 px** @512 | σ **10 px** @1254 |
| Opacity fade | 100% → 0% over 8 px vertical | |

### Surfaces

| Include shadow | Exclude shadow |
|----------------|----------------|
| Splash hero, marketing 1254 | App icon FG (transparent) |
| Login @100px (optional subtle) | Notification mono |
| Website hero | Micro LC-3 exports |
| Press kit hero | Favicon |

---

## 8. Background variants

| Variant ID | Fill | Surfaces |
|------------|------|----------|
| `bg.dark` | `#08111F` | Login, splash, app icon plate |
| `bg.dark.deep` | `#0B1220` | Optional radial hero (Preview C) |
| `bg.light` | `#FFFFFF` or `#F8FAFC` | Print, email light |
| `bg.transparent` | Alpha 0 | Adaptive icon FG, web overlay |

**Rule:** Never pure `#000000` as brand ground — use `#08111F` minimum.

---

## 9. Glow engineering

### 9.1 Reference levels (@512 outer glow on ring)

Baseline = **production V1 ≈ 100%**.

| Level | Spread (px) | Peak fringe alpha | Visual read |
|-------|-------------|-------------------|-------------|
| **100%** | ~20 | ~0.40 | Current — neon, gaming |
| **75%** | ~15 | ~0.30 | Still dominant @48px |
| **50% ★** | **~8** | **~0.20** | **V2 production** — tight premium rim |
| **35%** | ~5 | ~0.14 | Ultra-restrained; risk flat @192 |

### 9.2 Production recommendation: **Glow 50%**

| Criterion | 50% result |
|-----------|------------|
| @48px launcher | No gray cyan smear (S-04 pass) |
| @100px login | Retains rim life without halo |
| Enterprise/press | Reads metal/cam not neon |
| Pairing with R6 | Combined wobble perception −70% est. |

**Coupling rule:** Glow 50% **requires** R6 ring — glow-only reduction on V1 scale still reads heavy.

### 9.3 Glow implementation

| Domain | Method |
|--------|--------|
| Vector master | **No glow** — rim path only |
| Raster hero | Outer glow layer in compositor; spread 8 px @512 |
| Export ≤128 | **Strip glow layer entirely** — rim path sufficient |
| Micro LC-3 | No glow |

### 9.4 Forbidden glow

- `feGaussianBlur stdDeviation > 3` in any master export
- Violet / purple bloom
- Separate underglow beneath entire symbol
- Animated glow > 0.25 peak except splash boot (see MOTION_SPEC)

---

## 10. Preview B material tier (production default)

From V9 material guide — **recommended render recipe**:

| Parameter | Value |
|-----------|-------|
| `metal_boost` | **1.10** |
| Sharpen | Yes (UnsharpMask 1.2 / 90% / 2) |
| Ring scale | R6 (0.94) |
| Glow | 50% |
| Background | `#08111F` flat |

---

## 11. Layer edit authority

| Layer | V2 editable? |
|-------|--------------|
| orbitalArc geometry | Scale R6 only |
| orbitalArc material | Yes — glow, gradient, rim |
| storkBody geometry | **No** |
| storkBody material | Yes — specular ±10% |
| wingHighlight | Stroke width ±1 px @512 |
| accentDot position/size | **No** (LC-3 r=6 allowed for micro **export** only) |
| groundShadow | Yes — opacity/blur |

---

**Cross-reference:** [RING_ENGINEERING.md](./RING_ENGINEERING.md) · [EXPORT_LADDER.md](./EXPORT_LADDER.md)
