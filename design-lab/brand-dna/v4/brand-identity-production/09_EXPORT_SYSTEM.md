# 09 — Export System

**Version:** Export System v1.0 — **FROZEN**  
**Sprint:** B5.2 — Brand Geometry Freeze  
**SSOT SVG:** `svg/leylek-symbol-master-v1.svg`  
**Master PNG:** `frontend/assets/images/leylek-logo-premium.png` (validation reference)

---

## 1. Export hierarchy

```
MASTER PNG (immutable reference)
    └── MASTER SVG (production vector)
            ├── PNG ladder (raster exports)
            ├── Platform packs (iOS / Android / Web)
            └── Surface packs (splash / watermark / QR)
```

**Rule:** PNG is **never** master. PNG is always **exported from SVG** (or validated against master PNG).

---

## 2. SVG export constitution

| Rule | Spec |
|------|------|
| Format | SVG 1.1 / Tiny — no proprietary filters |
| viewBox | `0 0 512 512` (symbol) unless surface artboard |
| Gradients | **Forbidden** in master |
| Filters (blur/glow) | **Forbidden** |
| Embedded raster | **Forbidden** in master |
| Layer IDs | Mandatory per `06` §12 |
| Decimal precision | 1 decimal max in path coords |
| Tool | resvg / Inkscape / Figma — same output ±1 px |

### 2.1 Frozen SVG files

| File | Surface |
|------|---------|
| `svg/leylek-symbol-master-v1.svg` | Symbol only — transparent |
| `svg/leylek-symbol-dark.svg` | + Void Black ground |
| `svg/leylek-symbol-white.svg` | + Trust White ground |
| `svg/leylek-symbol-small.svg` | M0/M1 tier |
| `svg/leylek-watermark-v1.svg` | 12% opacity |
| `svg/leylek-zeka-eye-v1.svg` | 64×64 eye |
| `app-icons/leylek-app-icon-1024.svg` | iOS / store |
| `app-icons/leylek-adaptive-foreground-432.svg` | Android fg |
| `splash/leylek-splash-1920x1080.svg` | Native splash artboard |
| `website/leylek-header-mark-dark.svg` | Navbar lockup |
| `markers/marker-*.svg` | 12 types @48 |

---

## 3. PNG export ladder

### 3.1 Logo PNG

| Tier | px | Source SVG | Output filename | QA |
|------|-----|------------|-----------------|-----|
| M0 | 16 | `leylek-symbol-small.svg` | `leylek-symbol-16.png` | Dot + arc visible |
| M1 | 24 | `leylek-symbol-small.svg` | `leylek-symbol-24.png` | Body blob |
| S | 32 | master simplified | `leylek-symbol-32.png` | Profile |
| S | 48 | master | `leylek-symbol-48.png` | Full silhouette |
| M | 128 | `leylek-symbol-dark.svg` | `leylek-symbol-128.png` | Detail |
| L | 512 | `leylek-symbol-dark.svg` | `leylek-symbol-dark-512.png` | **Golden test** |
| XL | 1024 | app-icon SVG | `leylek-app-icon-1024.png` | Safe zone |

**Command (resvg):**
```bash
npx @resvg/resvg-js-cli svg/leylek-symbol-dark.svg png/leylek-symbol-dark-512.png --fit-width 512
```

### 3.2 Marker PNG

| px | Source | Output pattern |
|----|--------|----------------|
| 24 | `markers/marker-NN-*.svg` | `markers/png/{id}-24.png` |
| 32 | same | `{id}-32.png` |
| 34 | driver-car only | `driver-car-34.png` |
| 48 | same | `{id}-48.png` |
| 64 | same | `{id}-64.png` |

**Max file size @48:** 4 KB target.

---

## 4. Android export pack

| Asset | Size | Source | Production target (B6+) |
|-------|------|--------|-------------------------|
| Adaptive foreground | 432×432 | `leylek-adaptive-foreground-432.svg` | `adaptive-icon-foreground.png` |
| Adaptive background | solid | `#0D1117` | `app.json` backgroundColor |
| Legacy launcher | 512 | dark 512 PNG | mipmap |
| Native splash | 512 center | dark 512 PNG | `splashscreen_logo.png` ×dpi |
| Notification icon | 96 mono | simplified small | optional |

**Safe zone test:** Beak tip inside 66% center circle @432.

---

## 5. iOS export pack

| Asset | Size | Source | Production target (B6+) |
|-------|------|--------|-------------------------|
| App Store icon | 1024×1024 | app-icon SVG | `ios.premium.logo.png` |
| Spotlight | 128 | dark 128 | — |
| Settings | 64 | dark 64 | — |

**Squircle clip test:** Required on device before ship.

---

## 6. Website export pack

| Asset | Size | Source | Path (B6-1+) |
|-------|------|--------|--------------|
| Favicon / mark | 512 | dark 512 | `/store/leylektag-icon.png` |
| Legacy fallback | 512 | dark 512 | `/app-icon.png` |
| Branding copy | 512 | dark 512 | `/branding/leylektag-icon.png` |
| PWA 192 | 192 | dark export | same file scaled |
| PWA 512 | 512 | dark 512 | same file |

**Rule:** Same filename — content swap only (no code change).

---

## 7. Splash export

| Property | Value |
|----------|-------|
| Artboard | 1920×1080 |
| Source | `splash/leylek-splash-1920x1080.svg` |
| Symbol scale | 1.35× centered optical |
| Background | `#0D1117` |
| PNG export | 1920×1080 + 512 center for native |
| QA | JS splash = native splash same symbol |

---

## 8. Watermark export

| Property | Value |
|----------|-------|
| Source | `leylek-watermark-v1.svg` |
| Opacity | 12% |
| Max width on content | 120 px typical |
| Format | SVG preferred; PNG optional |
| Production | `MuhabbetWatermark.tsx` (B6-4) |

---

## 9. QR export (scanner chrome)

| Property | Value |
|----------|-------|
| Logo in QR center | **Forbidden** — breaks scan reliability |
| Scanner frame | May use arc corner brackets — stroke 2 px `#00D4AA` |
| Success flash | Motion only — not logo embed |
| QR modal | Camera UI stays dark — logo outside viewport |

---

## 10. Pre-export QA gate

| ID | Check | Block export if fail |
|----|-------|----------------------|
| EXP-01 | Layer IDs present | ✅ |
| EXP-02 | No gradients/filters | ✅ |
| EXP-03 | Golden test vs master PNG ≥95% | ✅ |
| EXP-04 | 16 px tier readable | ✅ |
| EXP-05 | File size within budget | ⚠️ warn |
| EXP-06 | Color tokens match `08` | ✅ |

---

## 11. Export manifest (machine-readable)

Update `manifest/brand-identity-manifest.json` on each export batch:

```json
{
  "lastExport": "ISO date",
  "exportTool": "resvg-js 2.6.x",
  "goldenTestPass": true,
  "files": ["png/leylek-symbol-dark-512.png"]
}
```

---

## 12. Rollback

| Level | Action |
|-------|--------|
| Single PNG | Restore from `_backup-pre-b6-n/` |
| SVG change | Git revert design-lab SVG only |
| Full pack | Re-export from last frozen SVG tag |

---

## 13. Amendment log

| Version | Date | Change |
|---------|------|--------|
| v1.0 FROZEN | 2026-06-21 | B5.2 export constitution |

---

**Parent:** `06_LOGO_GEOMETRY_CONSTITUTION.md`, `manifest/brand-identity-manifest.json`  
**Next:** `10_BRAND_DRIFT_RULES.md`
