# PNG Export Reference — B5

**Status:** SVG-first production package  
**Reference baseline:** `frontend/assets/images/leylek-logo-premium.png`

---

## Why PNG folder is reference-only

Automated vector trace from the premium PNG was not performed in B5. Production-ready **SVG approximations** are the source of truth. PNG exports must be generated from SVG via the export ladder in `manifest/brand-identity-manifest.json`.

---

## Required exports (pre-migration)

### Logo

| Size | Tier | Source SVG | Output filename |
|------|------|------------|-----------------|
| 16 | M0 | `svg/leylek-symbol-small.svg` | `leylek-symbol-16.png` |
| 24 | M1 | `svg/leylek-symbol-small.svg` | `leylek-symbol-24.png` |
| 32 | S | `svg/leylek-symbol-master-v1.svg` | `leylek-symbol-32.png` |
| 48 | S | `svg/leylek-symbol-master-v1.svg` | `leylek-symbol-48.png` |
| 128 | M | `svg/leylek-symbol-dark.svg` | `leylek-symbol-128.png` |
| 512 | L | `svg/leylek-symbol-dark.svg` | `leylek-symbol-512.png` |
| 1024 | XL | `app-icons/leylek-app-icon-1024.svg` | `leylek-app-icon-1024.png` |

### Markers (@1x from 48px artboard)

| Marker | Output |
|--------|--------|
| All 12 | `markers/png/marker-{id}-48.png` |
| Driver car @34px | `markers/png/marker-driver-car-34.png` |
| Passenger @32px | `markers/png/marker-passenger-32.png` |

---

## Side-by-side QA

Compare each export against `leylek-logo-premium-reference.png` at matching display size. Document IoU and perceptual recall in `04_BRAND_IDENTITY_QA_REPORT.md`.

---

## Limitations

- Hand-traced SVG may differ ±5% on wing apex and leg tuck from raster master
- Metallic gradient not reproduced — intentional flat/semi-flat evolution
- Re-run export after any SVG path edit
