# Export Ladder — Hero vs Micro Routing

**Sprint:** RC-BRAND-V10  
**Parent:** [MASTER_V2_SPEC.md](./MASTER_V2_SPEC.md)  
**Status:** Design-lab specification — no assets produced

---

## 1. Philosophy

> Design **small-first** — never shrink the Hero master to favicon.

Two authoritative artboards:

| Ladder | Artboard ID | ViewBox | Purpose |
|--------|-------------|---------|---------|
| **Hero** | LC-2 | 512 × 512 | Full geometry + optional raster metal/glow |
| **Micro** | LC-3 | 512 × 512 | Bold simplification for ≤48 px display |
| **Icon plate** | LC-2-ICON | 1024 × 1024 | 512 symbol centered on optical pivot |

**Forbidden:** Single PNG downscale chain from 1254 → 24 for all surfaces.

---

## 2. Size ladder specification

| Export px | Source | Render mode | Primary surfaces |
|-----------|--------|-------------|------------------|
| **1024** | LC-2-ICON | Raster hero or vector + metal pass | iOS App Store, Play Store, press kit |
| **512** | LC-2 | Golden reference / vector SSOT | Design QA, marketing master |
| **256** | LC-2 | Hero flat or light metal | Website hero, email header |
| **192** | LC-2 | Hero flat | xxhdpi marketing, splash sub-element |
| **128** | LC-2 | Flat vector preferred | In-app settings, Leylek Zeka header |
| **96** | LC-2 | Flat vector | xhdpi notification large, spotlight |
| **64** | LC-2 | Flat vector | Toolbar, compact chrome |
| **48** | **LC-3** | Micro bold | mdpi launcher, notification tray |
| **32** | **LC-3** | Micro bold | Favicon, status bar |
| **24** | **LC-3** | Micro bold | Notification mono source, watch complication |

### 2.1 Transition rule

- **≥64 px:** LC-2 Hero (full crest, tucked leg, wing sweep)
- **≤48 px:** LC-3 Micro (merged leg, boosted arc/eye)
- **64 px:** LC-2 preferred; LC-3 acceptable if glow-strip fails S-04

---

## 3. Hero ladder detail (LC-2)

### 3.1 Export matrix

| Size | Format | Background | Glow layer | Metal pass |
|------|--------|------------|------------|------------|
| 1024 | PNG RGBA / SVG | `#08111F` or transparent | Ring 50% @ scaled | Full |
| 512 | PNG / SVG | `#08111F` | Ring 50% | Full |
| 256 | PNG | `#08111F` or transparent | **Strip** | Optional light |
| 192 | PNG | `#08111F` | **Strip** | No |
| 128 | PNG / SVG | transparent | **Strip** | No |
| 96 | PNG / SVG | transparent | **Strip** | No |
| 64 | PNG / SVG | transparent | **Strip** | No |

### 3.2 Resampling

| Rule | Spec |
|------|------|
| Downscale algorithm | **Lanczos3** or bicubic — no nearest-neighbor |
| Upscale | **Forbidden** beyond 1024 |
| Sharpen on downscale | UnsharpMask 0.8 / 85% / 3 @ ≤128 only if S-04 fails |
| Color profile | sRGB IEC61966-2.1 embedded |

### 3.3 Hero raster master (1254)

| Property | Value |
|----------|-------|
| Role | Cinematic tier only — splash, login reference render |
| Source | Composited from LC-2 + Preview B material @1254 |
| **Not used for** | 48 px launcher, favicon, notification |

---

## 4. Micro ladder detail (LC-3)

### 4.1 Design intent

Maximize **arc band + eye + beak tick** at minimum pixel count. See [MICRO_LOGO_RULES.md](./MICRO_LOGO_RULES.md).

### 4.2 Export matrix

| Size | Format | Background | Notes |
|------|--------|------------|-------|
| 48 | PNG RGBA | `#08111F` or transparent | Android mdpi launcher test |
| 32 | PNG | `#08111F` | Favicon |
| 24 | PNG | `#08111F` | Notification tray mono input |

### 4.3 Micro artboard rules

- Designed at **512 viewBox**, exported to target px
- Arc stroke **22 px @512** (bold band)
- Eye **r = 6 @512**
- Tucked leg **merged** into body blob
- Wing sweep **omitted**
- Crest **omitted**
- Glow **none**

---

## 5. Surface routing table

| Surface | Size(s) | Ladder | Variant | File naming (future) |
|---------|---------|--------|---------|----------------------|
| iOS App Store icon | 1024 | LC-2-ICON | dark + `#08111F` plate | `logo-icon-1024-dark.png` |
| Android adaptive FG | 432 @xxxhdpi | LC-2-ICON | transparent | `logo-adaptive-fg-1024.png` |
| Android legacy launcher | 48–192 | LC-3 / LC-2 | dark | `logo-launcher-{size}.png` |
| Expo splash config | 1152+ | Hero 1254 | dark | `logo-splash-hero-1254.png` |
| JS SplashScreen | ~168 dp box | Hero 1254 | dark + shadow | production ref |
| Login header | 100 dp | Hero 1254 downscale | dark | production ref |
| Theme selection | 80 dp | Hero 1254 downscale | dark | production ref |
| Leylek Zeka empty | 40 dp | LC-2 @128 → 40 | dark chip | |
| Notification tray | 24 dp | **LC-3** | mono white | `logo-mono-white-24.png` |
| Favicon | 32 | **LC-3** | dark | `logo-favicon-32.png` |
| Website hero | 256 | LC-2 | dark or transparent | `website/public/store/` |
| Website Zeka mark | 64–128 | LC-2 | dark | |
| Press kit | 1024 + SVG | LC-2 + LC-2-ICON | all variants | `press-kit/` |
| Email signature | 128 | LC-2 flat | light symbol | `logo-symbol-light-128.png` |

---

## 6. Variant exports (from one LC-2 master)

Each size tier may generate:

| Variant ID | Description | Min size |
|------------|-------------|----------|
| `logo.symbol.dark` | Stork + arc on `#08111F` | 64 |
| `logo.symbol.dark.transparent` | Symbol only, no plate | 64 |
| `logo.symbol.light` | Slate stork + cyan arc on white/transparent | 64 |
| `logo.mono.white` | White silhouette | 24 |
| `logo.mono.black` | `#0D1117` silhouette | 24 |
| `logo.mono.cyan` | Cyan-only arc + dot | 32 |

**Rule:** All variants = **same LC-2 paths** — color/material only.

---

## 7. Export manifest (future JSON schema)

```json
{
  "masterVersion": "v2.0.0",
  "vectorSource": "design-lab/brand-dna/v10/exports/leylek-symbol-lc2-master.svg",
  "microSource": "design-lab/brand-dna/v10/exports/leylek-symbol-lc3-micro.svg",
  "exports": [
    {
      "path": "logo-icon-1024-dark.png",
      "px": 1024,
      "ladder": "LC-2-ICON",
      "variant": "logo.symbol.dark",
      "sha256": "<pending>",
      "surfaces": ["ios-app-store", "play-store"]
    }
  ]
}
```

**V10 status:** Schema defined — **no files generated**.

---

## 8. Anti-patterns (current V1 violations)

| Violation | Fix in V2 |
|-----------|-----------|
| 1254 PNG → 24 px notification | Route to LC-3 |
| Same file for login + adaptive icon | Separate LC-2-ICON with safe zone |
| Family B wireframe on native splash | Regenerate from LC-2 ladder |
| Light theme flat sketch PNG | `logo.symbol.light` from LC-2 |

---

## 9. Regeneration order (future implementation)

```
1. Freeze LC-2 SVG (geometry QA)
2. Freeze LC-3 SVG (micro QA @24/32/48)
3. Render 1254 hero raster from LC-2 + Preview B material
4. Export PNG ladder (Lanczos from vector or hero as appropriate)
5. Write manifest + checksums
6. CI diff against manifest on PR touching assets/
```

---

**Cross-reference:** [MICRO_LOGO_RULES.md](./MICRO_LOGO_RULES.md) · [QA_CHECKLIST.md](./QA_CHECKLIST.md)
