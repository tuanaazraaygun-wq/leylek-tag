# B5.4 — Phase 2: Logo Genome

**Sprint:** B5.4 — LeylekTAG Brand Studio  
**Parent:** `01_BRAND_DNA_ANALYSIS.md`  
**SSOT geometry:** `frontend/assets/images/leylek-logo-premium.png`

---

## Genome tiers

| Tier | Rule | Change policy |
|------|------|---------------|
| **CORE DNA** | Never change | Block release if violated |
| **SECONDARY DNA** | May evolve within bounds | Human review required |
| **DECORATIVE** | May disappear per surface | Surface-specific ladder |

---

## CORE DNA — immutable

These tokens define “LeylekTAG” across 10 years. Any concept that alters them is **not LeylekTAG** — reject regardless of aesthetic score.

| Token | Definition | Lock |
|-------|------------|------|
| `genus.stork` | Vertical stork profile — not owl, crane, phoenix, abstract pin | ✅ |
| `pose.one_leg` | Standing leg + tucked leg readable at ≥48 px | ✅ |
| `beak.horizontal_dominant` | Beak longest element; extends right; ~0° ±2° | ✅ |
| `beak.tip_sharp` | Pointed terminus — not blunt or duck-bill | ✅ |
| `head.scale_modest` | Head smaller than beak span; not chibi | ✅ |
| `eye.single_cyan_dot` | One dot; arc-hue family; non-cartoon scale | ✅ |
| `eye.position` | Upper cranium; anchor ~(292,166) @512 | ✅ |
| `arc.open_swoosh` | Open orbital arc — not closed ring/badge | ✅ |
| `arc.bottom_mass` | Thickest stroke at bottom center | ✅ |
| `arc.gap_top_right` | Breathing gap — arc does not close | ✅ |
| `silhouette.contour` | Recognizable pre-post overlay @512 | ✅ |
| `emotion.premium_calm` | Not playful mascot; not aggressive predator | ✅ |
| `name.metaphor` | Stork + orbit + forward journey — not generic mobility | ✅ |

**Constitutional test:** Blink test vs master PNG — silhouette IoU target ≥ 0.98.

---

## SECONDARY DNA — evolvable

May improve across surfaces **without breaking recognition**.

| Token | Current | Evolution bounds |
|-------|---------|------------------|
| `arc.stroke_width` | Visual ~18–22 px @512 | ±4 px for tier; never &lt;14 @512 master |
| `arc.terminal_radius` | Rounded caps | Cap radius ±2 px |
| `arc.color` | `#00D4AA` flat vector | Gradient allowed on raster hero only |
| `body.fill` | Silver memory / `#F0F4F8` vector | Flat fill OK if silhouette holds |
| `neck.curvature` | Subtle S | Handle tuning ±5% path length |
| `wing.stroke` | 3–4 px secondary | 2–5 px; never merge into body fill at master |
| `leg.standing.width` | Hairline | ±1 px |
| `leg.tucked.detail` | Full @512 | May simplify @≤32 px tiers |
| `optical.center` | (268, 278) | Nudge ±6 px for mask/safe-zone |
| `crest.tuft` | Integrated profile bump | May soften — not remove at master |
| `canvas.safe_zone` | 512 artboard | 1024/1254 export ladders |
| `monochrome.mode` | White + cyan | Black mono for watermark tiers |

---

## DECORATIVE — surface optional

May disappear without breaking brand genome on that surface.

| Token | Surfaces | Policy |
|-------|----------|--------|
| `material.brushed_silver` | Hero PNG, splash, marketing | Raster-only OK |
| `beak.highlight_line` | 1254 master | Omit @≤512 vector |
| `arc.gradient` | Premium PNG | Flat `#00D4AA` @ icon/favicon |
| `eye.glow_halo` | Splash, login | Dot only @≤48 px |
| `wing.separate_stroke` | Master | Merge @24 px if silhouette holds |
| `leg.tucked` | Master | Omit @24 px favicon if one-leg implied |
| `shadow.drop` | UI chrome | Never in logo master |
| `motion.trail` | Lottie only | Not in static master |

---

## Shared genom with markers

Logo genome exports **marker atoms** — not copies of the bird on every pin.

| Logo element | Marker atom |
|--------------|-------------|
| Arc swoosh fragment | Pin base ring / heading halo |
| Cyan eye dot | Active state core |
| Stroke weight ratio | Min 2 px @48 marker |
| Bottom mass | Anchor weight at map pin foot |
| Open gap | Direction wedge on vehicle markers |
| Premium calm | No bounce, no comic outlines |

---

## Genome hash (conceptual)

```
LEYLEKTAG_LOGO_GENOME_v5
├── CORE (13 locks)
├── SECONDARY (11 tunable)
└── DECORATIVE (8 optional)
```

---

## Rejection triggers (automatic)

| Violation | Example |
|-----------|---------|
| Mascot eye | Large white sclera |
| Pin drop | Teardrop map pin as logo |
| Badge seal | Closed circle around bird |
| F1 Meridian Wing | Forbidden competitor-adjacent direction |
| Crown / royal | Separate crown polygon |
| Abstract geometry | Bird reduced to triangle only |
| Generic bird | Robin/duck proportions |

---

## B5.3 alignment

| Candidate | Genome compliance |
|-----------|-------------------|
| A — Ultra-faithful | CORE 100% · SECONDARY minimal |
| B — Optical balance | CORE 100% · SECONDARY optical nudge |
| C — Small-size | CORE 100% · SECONDARY + DECORATIVE tier merges |

---

**Next:** `03_30_SKETCH_CATALOG.md`
