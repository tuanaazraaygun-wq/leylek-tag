# LEYLEKTAG PREMIUM MASTER V2 — Production Specification

**Sprint:** RC-BRAND-V10  
**Version:** Premium Master V2.0 (design-lab)  
**Date:** 2026-06-24  
**Status:** Specification only — **production untouched**

---

## 0. Authority & scope

| Rule | Detail |
|------|--------|
| **Silhouette** | **LOCKED** — no redesign, no mascot drift, no pin/wireframe family |
| **Perceptual SSOT** | `frontend/assets/images/leylek-logo-premium.png` (1254×1254) — read-only reference |
| **V2 output location** | `design-lab/brand-dna/v10/` only until gated ship |
| **Forbidden in V10** | Production asset swap, frontend edits, SVG/PNG export, commits |

### V2 mission

Formalize the **existing premium stork + orbital arc** as an enterprise-grade brand operating system:

- One **authoritative vector master** (no raster dependency for geometry)
- Controlled **R6 ring refinement** + **50% glow** (evolution, not rebrand)
- **Dual export ladder**: Hero (LC-2) + Micro (LC-3)
- Layered material system, motion spec, and objective QA gates

---

## 1. Document map

| Document | Purpose |
|----------|---------|
| [RING_ENGINEERING.md](./RING_ENGINEERING.md) | Orbital arc geometry, R6 transform, wobble remediation |
| [MATERIAL_SYSTEM.md](./MATERIAL_SYSTEM.md) | Five-layer compositing stack |
| [EXPORT_LADDER.md](./EXPORT_LADDER.md) | Size tiers, Hero vs Micro routing |
| [MICRO_LOGO_RULES.md](./MICRO_LOGO_RULES.md) | LC-3 simplification minimums |
| [MOTION_SPEC.md](./MOTION_SPEC.md) | Subtle brand motion (no cartoon) |
| [QA_CHECKLIST.md](./QA_CHECKLIST.md) | Objective pass/fail gates |

---

## 2. Coordinate system (inherited + V2 amendment)

| Token | @512 symbol | @1254 source | Locked |
|-------|-------------|--------------|--------|
| `geo.canvas.symbol` | 512 × 512 | — | ✅ |
| `geo.canvas.icon` | 1024 × 1024 (512 symbol centered) | — | ✅ |
| `geo.canvas.hero` | — | 1254 × 1254 | ✅ raster hero tier |
| `geo.origin.math` | (256, 256) | (628, 628) | ✅ |
| `geo.origin.optical` | **(268, 278)** | **(657, 681)** | ✅ ring pivot |
| `geo.grid.base` | 8 px | 19.6 px (~20) | ✅ |
| Scale factor 512→1254 | — | **2.44921875** | derived |

**V2 amendment (ring/glow only):**

- `layer.orbitalArc` may scale **uniform 0.94** about optical center (R6)
- Glow outer pass capped at **50% production intensity** (see MATERIAL_SYSTEM)
- `stork.silhouette` paths: **zero edit** — IoU ≥ 0.98 vs 1254 reference

Parent: `design-lab/brand-dna/v4/brand-identity-production/06_LOGO_GEOMETRY_CONSTITUTION.md`

---

## 3. V2 evolution delta (single page)

| Dimension | Production V1 (current) | Master V2 (target) |
|-----------|------------------------|---------------------|
| Bird geometry | 1254 raster hero | **Unchanged** — same paths / same IoU |
| Ring scale | 1.00 | **R6 = 0.94** about (268, 278) |
| Ring path type | Open swoosh (variable width) | Same topology — **rebuilt as clean Bézier** |
| Glow | ~100% (~20 px spread @512) | **50%** (~8 px spread @512) |
| Material | Skeuomorphic + neon bloom | Cam/metal stack (Preview B tier) |
| Vector SSOT | Hand trace v1 (wrong arc mass) | **New LC-2 SVG** — constitution paths |
| Micro tier | Master shrink (fails @24) | **LC-3** dedicated artboard |
| Export manifest | Ad hoc copies | **JSON manifest** with checksums |

---

## 4. Layer stack (z-order)

```
5. layer.groundShadow     (raster hero + optional PNG export only)
4. layer.accentDot        (eye + controlled glow — vector: fill only)
3. layer.wingHighlight    (wing sweep stroke)
2. layer.storkBody        (metal body fill paths)
1. layer.orbitalArc       (ring — primary + rim + inner shadow)
0. background             (variant: dark #08111F / light / transparent)
```

Detail: [MATERIAL_SYSTEM.md](./MATERIAL_SYSTEM.md)

---

## 5. Production values (recommended)

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Ring scale | **R6 = 0.94** | V8/V9 lab consensus — jewel rim, less wobble perception |
| Glow intensity | **50%** | Removes neon smear @48px; retains premium rim |
| Material tier | **Preview B** | metal_boost 1.10 + light sharpen |
| Vector master | **LC-2 @512 viewBox** | Single geometry SSOT |
| Micro master | **LC-3 @512 viewBox** | 24–48 px surfaces |
| Raster hero | **1254 PNG** | Splash/login cinematic tier only |
| Background (consumer) | `#08111F` | Soft premium black — not pure `#000` |

---

## 6. Ship gate sequence (reference — not executed in V10)

```
V10 spec sign-off
  → LC-2 SVG build (future sprint)
  → Golden test IoU ≥ 0.98
  → Export ladder generation
  → Product panel ≥ 4/5 “same logo, better”
  → Single commit: leylek-logo-premium.png (gated)
  → App icon / splash unify (separate sprints)
```

---

## 7. Explicit non-goals

- Redesigning stork silhouette, beak length, pose, or crest
- Closed circular ring or pin teardrop metaphor
- Family B wireframe revival for any consumer surface
- Blur filters inside master SVG
- Cartoon motion (spin, bounce, particle burst)

---

## 8. Traceability

| Source | Use in V2 |
|--------|-----------|
| V4 Geometry Constitution | Path anchors, ratios, layer IDs |
| V8 Ring Refinement | R4/R6/R8 matrix, glow spread targets |
| V9 Premium Direction | Preview B recommendation, material tiers |
| V7 LC-2 / LC-3 analysis | Export ladder philosophy |
| RC-BRAND-V9 audit | P0/P1 weakness ranking |

---

## 9. Vector production plan (LC-2 authoritative master)

### 9.1 Requirements

| Requirement | Spec |
|-------------|------|
| Single source of truth | **LC-2 SVG** — all PNGs derived, not reverse-traced ad hoc |
| No raster dependency | Paths from constitution + golden overlay QA — PNG is render output only |
| Bézier continuity | **C¹** minimum; tangent discontinuity ≤ 4° at joins |
| Constant geometry | Locked anchors; R6 scale on ring group only |
| Editable layers | Mandatory IDs per §4 layer stack |

### 9.2 File structure (future — not created in V10)

```
design-lab/brand-dna/v10/exports/   ← future sprint only
  leylek-symbol-lc2-master.svg      ← Hero @512 viewBox
  leylek-symbol-lc3-micro.svg       ← Micro @512 viewBox
  leylek-symbol-lc2-icon-1024.svg ← 1024 plate, 512 symbol centered on O
```

### 9.3 SVG document spec

| Property | Value |
|----------|-------|
| viewBox (LC-2) | `0 0 512 512` |
| viewBox (LC-2-ICON) | `0 0 1024 1024` — symbol group translate (256, 256) from O offset |
| Units | User units = px @512 |
| Precision | 1 decimal max in path data export |
| Fonts / text | **None** in symbol master |
| Filters | **Forbidden** (`feGaussianBlur`, etc.) |
| Embedded raster | **Forbidden** |

### 9.4 Layer groups (mandatory structure)

```xml
<svg viewBox="0 0 512 512">
  <g id="layer.orbitalArc" transform="scale(0.94)" transform-origin="268px 278px">
    <path id="orbitalArc.fill" ... />
    <path id="orbitalArc.rim" ... />
    <path id="orbitalArc.innerShadow" ... />
  </g>
  <g id="layer.storkBody">
    <path id="stork.silhouette" ... />
    <path id="stork.leg.tucked" ... />
  </g>
  <g id="layer.wingHighlight">
    <path id="wing.sweep" ... />
  </g>
  <g id="layer.accentDot">
    <circle id="eye.accent" cx="292" cy="166" r="5.5" />
  </g>
</svg>
```

**Note:** R6 transform applied to `layer.orbitalArc` group only — bird groups have **no transform**.

### 9.5 Path sources (locked anchors)

| Path | Source |
|------|--------|
| `orbitalArc` | Constitution §6 cubic swoosh + RING_ENGINEERING width profile |
| `stork.silhouette` | Constitution §5–§9 paths — **overlay IoU vs 1254** |
| `wing.sweep` | Constitution §8 |
| `eye.accent` | Constitution §7 — (292, 166) r=5.5 |

**Reject as source:** `leylek-symbol-master-v1.svg` circular arc (`A 138 138`) — wrong topology.

### 9.6 Build pipeline (future)

```
1254 reference PNG (read-only)
        ↓ manual Bézier rebuild (not auto-trace)
LC-2 SVG draft
        ↓ resvg @512 + overlay @50% opacity
Golden test G-GEO-01…07
        ↓ pass
LC-2 SVG FROZEN (content hash)
        ↓ derive LC-3 simplification
LC-3 SVG FROZEN
        ↓ render ladder
PNG export family + manifest
```

### 9.7 Variant SVG policy

| Variant | Method |
|---------|--------|
| Dark symbol | Default LC-2 fills |
| Light symbol | CSS class swap — same paths |
| Monochrome | Single fill override — same paths |
| Micro | Separate LC-3 file — simplified paths |

**Forbidden:** Separate hand-drawn light/micro SVGs with different geometry.

---

**Next action (post-V10):** Brand council review → LC-2 vector build sprint → golden overlay QA.
