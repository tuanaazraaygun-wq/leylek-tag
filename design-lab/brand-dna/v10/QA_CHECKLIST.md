# QA Checklist — Master V2 Acceptance Gates

**Sprint:** RC-BRAND-V10  
**Parent:** [MASTER_V2_SPEC.md](./MASTER_V2_SPEC.md)  
**Status:** Objective pass/fail criteria — no testing executed in V10

---

## 1. Gate philosophy

| Rule | Detail |
|------|--------|
| Human gate | *"Logo aynı ama çok daha kaliteli olmuş"* → PASS |
| Human fail | *"Logo değişmiş"* → **FAIL — do not ship** |
| Automation | Supports human judgment — **never overrides human FAIL** |
| Reference | 1254 production PNG (read-only) + V2 LC-2 candidate |

---

## 2. Geometry gates

### G-GEO-01 — Silhouette IoU (bird only)

| Parameter | Pass | Fail |
|-----------|------|------|
| Metric | IoU ≥ **0.98** | < 0.98 |
| Method | Alpha mask bird paths @512 vs 1254 reference normalized |
| Excludes | Metal gradient interior, glow fringe |

### G-GEO-02 — Full symbol IoU (bird + arc)

| Parameter | Pass | Fail |
|-----------|------|------|
| Metric | IoU ≥ **0.96** | < 0.96 |
| Notes | Ring R6 allowed — lower threshold than bird-only |

### G-GEO-03 — Beak tip delta

| Parameter | Pass | Fail |
|-----------|------|------|
| Max delta | **≤ 2 px** @512 | > 2 px |

### G-GEO-04 — Eye anchor delta

| Parameter | Pass | Fail |
|-----------|------|------|
| Center delta | **≤ 0.5 px** @512 from (292, 166) | > 0.5 px |
| Radius delta | **≤ 0.5 px** @512 | > 0.5 px |

### G-GEO-05 — Hausdorff silhouette distance

| Parameter | Pass | Fail |
|-----------|------|------|
| Max distance | **≤ 3 px** @512 | > 3 px |

### G-GEO-06 — Symmetry tolerance (ring)

| Check | Pass | Fail |
|-------|------|------|
| Gap bearing | **52° ± 6°** | Outside range |
| Bottom mass center X | **268 ± 8 px** | Outside range |
| R6 pivot | **(268, 278)** exact | Any drift |
| Beak-to-arc clearance @ R6 | **≥ 18 px** | < 18 px |

### G-GEO-07 — Bézier continuity (LC-2 vector)

| Check | Pass | Fail |
|-------|------|------|
| Join tangent discontinuity | **≤ 4°** any join | > 4° |
| Visible kink on 400% zoom | None | Any unintended kink |

---

## 3. Material & glow gates

### G-MAT-01 — Glow spread @512

| Parameter | Pass | Fail |
|-----------|------|------|
| Outer glow spread | **≤ 8 px** (50% spec) | > 10 px |
| Eye halo | **0 px** | Any visible bloom |

### G-MAT-02 — Gradient discipline

| Check | Pass | Fail |
|-------|------|------|
| Arc gradient stops | **≤ 3** | > 3 |
| Violet tint in arc | None | Any purple shift |

### G-MAT-03 — SVG purity

| Check | Pass | Fail |
|-------|------|------|
| Blur filters in LC-2 SVG | **None** | Any `feGaussianBlur` |
| Raster embed in SVG | **None** | Embedded PNG |

### G-MAT-04 — S-04 gray smear @48

| Parameter | Pass | Fail |
|-----------|------|------|
| First-glance @48 px | No cyan-gray mud around arc | Visible smear |

---

## 4. Export sharpness gates

### G-EXP-01 — Edge acutance @128

| Parameter | Pass | Fail |
|-----------|------|------|
| Beak tip | ≤ 1 px fringe (single pixel column clear) | Blurred wedge |
| Arc terminal | Readable taper | Blob |

### G-EXP-02 — Downscale algorithm

| Check | Pass | Fail |
|-------|------|------|
| Method | Lanczos3 or approved bicubic | Nearest-neighbor |
| Upscale beyond 1024 | **Not present** | Any upscaled master |

### G-EXP-03 — sRGB embedding

| Check | Pass | Fail |
|-------|------|------|
| Color profile | sRGB embedded on PNG exports | Untagged |

### G-EXP-04 — Retina @2x/@3x

| Surface | Pass |
|---------|------|
| Login 100 pt @3x (300 px) | Beak + arc + eye crisp |
| Splash 168 dp @3x | No glow mud; shadow intentional |

---

## 5. OEM mask safety gates

### G-OEM-01 — iOS squircle (1024 artboard)

| Check | Pass | Fail |
|-------|------|------|
| Safe zone | **80%** — beak tip inside | Clip |
| Wing apex | Inside safe | Clip |
| Optical centering | Pivot O = (268, 278) in 512 symbol | Math center used |

### G-OEM-02 — Android adaptive (432 fg @ xxxhdpi)

| Check | Pass | Fail |
|-------|------|------|
| Safe zone | **66%** diameter — beak tip inside | Clip |
| FG transparency | Symbol only — no baked `#08111F` in FG layer | Baked plate in FG |
| Background | `#08111F` on adaptive BG layer | Mismatch |

### G-OEM-03 — Round launcher

| Check | Pass | Fail |
|-------|------|------|
| 48 px round mask | Arc fragment + eye visible | Blank or blob |

---

## 6. App Store thumbnail gate

### G-STORE-01 — Blind grid test

| Parameter | Pass | Fail |
|-----------|------|------|
| Context | 10×10 mock App Store grid @60 px icon | — |
| Recognition | **≥ 80%** reviewers identify LeylekTAG without label | < 80% |
| Confusion | Not mistaken for weather/messaging app | Generic bird/pin |

### G-STORE-02 — Arc mass @60 px

| Check | Pass | Fail |
|-------|------|------|
| Arc readable | Cyan swoosh visible | Hairline invisible |
| Stork readable | Profile + beak direction | Blob |

---

## 7. Small-size readability gates (S-series)

| ID | Criterion | 48 | 32 | 24 |
|----|-----------|----|----|-----|
| S-01 | Stork silhouette recognizable | req | req | req |
| S-02 | Arc hint visible | req | req | fragment OK |
| S-03 | Cyan eye visible | req | req | **req** |
| S-04 | No gray neon smear | req | req | req |
| S-05 | Same brand as login @100 px | req | req | req |

**Micro routing:** S-series @48 and below must use **LC-3** exports.

---

## 8. Brand human panel

### G-HUMAN-01 — Recognition score

| Parameter | Pass | Fail |
|-----------|------|------|
| Reviewers | **≥ 3** independent | — |
| Question | "Is this the same LeylekTAG logo, refined?" | — |
| Score | Average **≥ 4.5 / 5** | < 4.5 |
| Fail quote trigger | Any reviewer says *"logo değişmiş"* | Automatic fail |

### G-HUMAN-02 — Premium perception

| Parameter | Pass | Fail |
|-----------|------|------|
| Question | "Does this feel premium next to banking/travel apps?" | — |
| Score | Average **≥ 4.0 / 5** | < 3.5 |

---

## 9. Vector production gates

### G-VEC-01 — Single source of truth

| Check | Pass | Fail |
|-------|------|------|
| LC-2 SVG exists | Yes, frozen hash | Raster-only pipeline |
| LC-3 SVG exists | Yes, for micro | Master shrink for micro |

### G-VEC-02 — Layer IDs preserved

Required IDs present: `layer.orbitalArc`, `layer.storkBody`, `layer.wingHighlight`, `layer.accentDot`

### G-VEC-03 — No raster dependency for geometry

| Check | Pass | Fail |
|-------|------|------|
| Path source | Constitution + golden overlay | Auto-trace from PNG without QA |

---

## 10. Consistency gates

### G-CON-01 — Family unification

| Surface | Pass |
|---------|------|
| Login, splash JS, theme, website | Hero Family A |
| Native splash drawable | **Must match** Hero A (post unify sprint) |
| Android/iOS launcher | LC-2-ICON — **not** Family B wireframe |

### G-CON-02 — Manifest checksum

| Check | Pass | Fail |
|-------|------|------|
| All committed logo PNGs listed in manifest | Yes | Orphan file |
| sha256 matches | Yes | Drift |

---

## 11. Master V2 ship checklist (all must pass)

```
Phase A — Spec (V10)
  [x] MASTER_V2_SPEC.md
  [x] RING_ENGINEERING.md
  [x] MATERIAL_SYSTEM.md
  [x] EXPORT_LADDER.md
  [x] MICRO_LOGO_RULES.md
  [x] MOTION_SPEC.md
  [x] QA_CHECKLIST.md
  [ ] Brand council sign-off on spec

Phase B — Build (future)
  [ ] LC-2 SVG frozen
  [ ] LC-3 SVG frozen
  [ ] G-GEO-01 through G-GEO-07 pass
  [ ] G-MAT-01 through G-MAT-04 pass
  [ ] G-VEC-01 through G-VEC-03 pass

Phase C — Export (future)
  [ ] Full export ladder generated
  [ ] G-EXP-01 through G-EXP-04 pass
  [ ] G-OEM-01 through G-OEM-03 pass
  [ ] S-01 through S-05 @48/32/24 pass

Phase D — Human (future)
  [ ] G-HUMAN-01 pass
  [ ] G-HUMAN-02 pass
  [ ] G-STORE-01 pass

Phase E — Ship (future, gated)
  [ ] Backup pre-v2 PNG archived
  [ ] Single targeted production swap
  [ ] G-CON-01 family unify scheduled/complete
```

---

## 12. Severity routing

| Gate failure | Severity | Action |
|--------------|----------|--------|
| G-GEO-01 bird IoU | **P0** | Block all exports |
| G-HUMAN-01 fail quote | **P0** | Block ship |
| G-OEM-02 beak clip | **P0** | Fix LC-2-ICON centering |
| G-MAT-01 glow spread | **P1** | Reduce glow pass |
| S-04 @48 fail | **P1** | Route to LC-3 or strip glow |
| G-EXP-01 soft beak @128 | **P2** | Sharpen export recipe |

---

**Cross-reference:** `design-lab/brand-dna/v4/logo-restoration/GOLDEN_TEST.md` · [EXPORT_LADDER.md](./EXPORT_LADDER.md)
