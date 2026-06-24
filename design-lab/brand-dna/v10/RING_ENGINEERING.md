# Ring Engineering — Orbital Arc Specification

**Sprint:** RC-BRAND-V10  
**Parent:** [MASTER_V2_SPEC.md](./MASTER_V2_SPEC.md)  
**Status:** Design-lab specification — no assets produced

---

## 1. Executive summary

The LeylekTAG orbital ring is an **open swoosh**, not a closed circle. Perceived “wobble” in production V1 comes from:

1. **Variable-width stroke by design** (bottom mass 3:1 vs top terminals)
2. **3D lighting + dual rim** reading as thickness inconsistency
3. **Excessive outer glow** (~20 px @512) creating false edge bumps
4. **Legacy circular-arc trace** (`A 138 138` in v1 SVG) that **does not match** the production swoosh path

**V2 fix:** Rebuild ring from constitution **cubic swoosh path**, apply **R6 uniform scale**, reduce glow to **50%**, enforce **C¹ continuity** at all Bézier joins. Bird layer **untouched**.

---

## 2. Production baseline measurements (@512 symbol canvas)

All measurements relative to optical pivot **O = (268, 278)** unless noted.

### 2.1 Path authority

**Authoritative path** (constitution §6 — open swoosh):

```
M 146 196
C 112 246, 102 318, 128 374
C 164 422, 228 432, 288 412
C 348 392, 394 338, 404 276
```

| Property | Value | Notes |
|----------|-------|-------|
| Path type | Cubic Bézier × 3 segments | **Not** a single circular arc |
| Effective sweep | ~270° | Open gap top-right |
| Path ID | `layer.orbitalArc.primary` | |

**Deprecated for V2:** `A 138 138` circular arc in `leylek-symbol-master-v1.svg` — wrong topology for production hero.

### 2.2 Radius family (effective outer contour)

Because the swoosh is tapered, “radius” is **local normal distance** from O to outer edge:

| Station | Approx. point on outer edge | Distance from O | Clock position |
|---------|----------------------------|-----------------|----------------|
| Bottom mass (thickest) | (288, 432) | **~155 px** | 6 o'clock |
| Left ascent | (128, 374) | **~148 px** | 8 o'clock |
| Left terminal | (146, 196) | **~147 px** | 10 o'clock |
| Right descent | (394, 338) | **~142 px** | 4 o'clock |
| Gap terminal | (404, 276) | **~136 px** | 2 o'clock |

| Metric | Production V1 | Tolerance |
|--------|---------------|-----------|
| Mean effective outer radius | **~146 px** | ±4 px |
| Radius variance (max − min) | **~19 px** | Intentional taper — not a defect |
| Deviation from perfect circle | **≤ 13%** radial delta | By design (bottom-heavy) |

**Mathematically circular?** **No** — and must remain non-circular per brand DNA (`arc.open_swoosh`).

### 2.3 Inner radius & thickness

Ring rendered as **variable-width stroke** (production) or **dual offset paths** (vector target):

| Station | Outer r | Inner r (est.) | **Thickness** |
|---------|---------|----------------|---------------|
| Bottom center | 155 px | ~133 px | **~22 px** |
| Mid-left | 148 px | ~138 px | **~10 px** |
| Top terminals | 136–147 px | ~130 px | **~6–8 px** |
| **Taper ratio** (bottom : top) | — | — | **~3.0 : 1** |

| Token | @512 | Scale formula |
|-------|------|---------------|
| `arc.thickness.max` | **22 px** | `round(22 × s/512)` |
| `arc.thickness.min` | **6 px** | `round(6 × s/512)` |
| `arc.thickness.mid` | **11 px** | constitution secondary stroke ref |

### 2.4 Optical center & pivot

| Token | @512 | @1254 |
|-------|------|-------|
| `geo.origin.optical` | **(268, 278)** | **(657, 681)** |
| Math center | (256, 256) | (628, 628) |
| Shift | +12 X (beak mass), +22 Y (leg mass) | ×2.449 |

**R6 transform pivot:** optical center O — **not** math center.

### 2.5 Gap geometry

| Property | Value |
|----------|-------|
| Gap position | Top-right, **1–2 o'clock** |
| Gap angular width | **38° ± 4°** (opening between path terminals) |
| Gap center bearing | **~52°** from vertical (clockwise from 12 o'clock) |
| Beak clearance in gap | Beak tip ~(344, 166) — **must not intersect** arc @ R6 |
| Min beak-to-arc distance @512 | **≥ 18 px** after R6 (was ~12 px @ R4) |

**Gap purpose:** Beak breathing room + prevents badge/seal read.

### 2.6 Terminal angles

Measured as tangent bearing at path endpoints (degrees, 0° = east, CCW positive):

| Terminal | Point | Tangent angle | Cap style |
|----------|-------|---------------|-----------|
| **Start** (upper-left) | (146, 196) | **~235°** (−125° from east) | Round, tapered width → 6 px |
| **End** (upper-right, gap) | (404, 276) | **~15°** | Round, tapered width → 7 px |

| Token | Spec |
|-------|------|
| `arc.terminal.cap` | Round |
| `arc.terminal.taper` | Linear width falloff last 12% of path length |
| `arc.terminal.minWidth` | 6 px @512 |

---

## 3. Wobble root-cause matrix

| Symptom | Primary cause | V2 remediation |
|---------|---------------|----------------|
| Left inner arc “kink” | 3D highlight misalignment + glow bloom | R6 + glow 50%; separate rim layer |
| Thickness looks random | Variable taper + dual stroke in raster | Document taper stations; vector width profile |
| “Not a circle” complaint | Open swoosh + asymmetric mass | **Expected** — educate; do not circularize |
| Bumps at terminals | Round cap + glow overlap | Cap taper rule; glow mask inset 2 px |
| SVG ≠ PNG | v1 used wrong arc primitive | Rebuild from constitution path |

---

## 4. R6 geometry specification

### 4.1 Transform

```
For every point P on ring geometry (path, width profile, glow mask):
  P' = O + 0.94 × (P − O)

Where O = (268, 278) @512  |  (657, 681) @1254

Bird layers: IDENTITY (no transform)
```

| Parameter | Value |
|-----------|-------|
| Scale factor | **0.94** (−6%) |
| Pivot | Optical center O |
| Bird IoU gate | **≥ 0.98** vs 1254 reference |

### 4.2 R6 derived measurements (@512)

| Metric | V1 (1.00) | **R6 (0.94)** | Delta |
|--------|-----------|---------------|-------|
| Bottom outer radius | ~155 px | **~146 px** | −6% |
| Bottom thickness | ~22 px | **~21 px** | −4% (width scales with path normal) |
| Mean outer radius | ~146 px | **~137 px** | −6% |
| Beak-to-arc clearance | ~12 px | **~18 px** | +50% breath |
| `R.negSpace` (arc cavity) | ~32% | **~36%** | Arc less dominant ✅ |
| Gap angular width | 38° | **38°** | Unchanged (topology preserved) |

### 4.3 Why R6 removes perceived wobble

| Mechanism | Effect |
|-----------|--------|
| Inward scale | Inner arc edge moves away from high-curvature left zone — highlight alignment simpler |
| Reduced glow | False edge bumps (−50%) — primary wobble perception driver |
| Jeweler rim | Thinner visual dominance — eye reads intentional taper not error |
| Preserved gap | Identity unchanged — no “new logo” reaction |

**Alternatives:**

| Variant | Scale | Use case |
|---------|-------|----------|
| R4 | 0.96 | Conservative ship if panel rejects R6 @48px |
| R6 ★ | **0.94** | **V2 production default** |
| R8 | 0.92 | Lab only — beak clearance risk |

---

## 5. Vector construction rules (LC-2)

### 5.1 Path structure

| Sub-layer | ID | Construction |
|-----------|-----|--------------|
| Primary fill | `layer.orbitalArc.fill` | Closed path: outer swoosh + inner offset (−width normal) |
| Rim highlight | `layer.orbitalArc.rim` | 1 px offset path, top-left lit |
| Inner shadow | `layer.orbitalArc.innerShadow` | 2 px inset, `#08111F` @ 15% — **no blur in SVG** |

### 5.2 Bézier continuity

| Rule | Spec |
|------|------|
| Join type | **C¹** minimum at segment joins |
| Max tangent discontinuity | **≤ 4°** at any join |
| Control handle discipline | Parallel to adjacent segment ± **15°** max |
| Node count | ≤ **12** anchors for full swoosh (3 cubic segments = 9 + terminals) |
| Grid snap | 8 px grid; 4 px allowed for optical nudge only |

### 5.3 Width profile function

Define stroke width `w(t)` along path parameter t ∈ [0, 1]:

| t region | w(t) @512 |
|----------|-----------|
| 0.00–0.15 (start terminal) | 6 → 10 px ramp |
| 0.15–0.45 (left ascent) | 10 → 18 px |
| 0.45–0.55 (bottom mass) | **22 px** peak |
| 0.55–0.85 (right descent) | 18 → 8 px |
| 0.85–1.00 (gap terminal) | 8 → 6 px |

**Forbidden:** Constant-width stroke on hero tier (loses bottom mass identity).

---

## 6. Symmetry tolerance

| Check | Tolerance | Fail action |
|-------|-----------|-------------|
| Bilateral mirror of full symbol | **Not required** — asymmetric by design | — |
| Bottom mass centered on vertical through O ± | **8 px** | Rebuild width profile |
| Gap bearing (1–2 o'clock) | **52° ± 6°** | Adjust end terminal only |
| R6 pivot drift | **0 px** — locked to O | Reject export |
| Arc centroid vs V1 | **≤ 6 px** delta after R6 | Review scale application |

---

## 7. Ring QA measurements (pre-export)

Automated checks @512:

1. Sample 36 radial rays from O; outer edge distance σ/μ < **0.14** (coefficient of variation cap — allows taper)
2. Bottom thickness peak within **20–24 px**
3. Gap angular width **34°–42°**
4. Beak tip distance to nearest arc edge **≥ 18 px** @ R6
5. Hausdorff distance ring-only vs R6-applied V1 mask **≤ 2 px** (confirms scale-only change)

---

**Sign-off required:** Brand design + product — ring path overlay @50% vs 1254 reference before LC-2 freeze.
