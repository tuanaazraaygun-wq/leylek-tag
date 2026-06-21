# LeylekTAG Brand Identity Production — B5

**Status:** Design-lab only — production untouched  
**Primary source:** `frontend/assets/images/leylek-logo-premium.png`  
**Decision:** Evolve premium stork + orbital arc (NOT F1 Meridian Wing)

---

## Package contents

| Folder | Contents |
|--------|----------|
| `svg/` | Logo symbol master + variants |
| `app-icons/` | 1024 app icon + Android adaptive foreground |
| `splash/` | 16:9 splash artboard |
| `website/` | Navbar header mark |
| `markers/` | 12 marker SVGs (v4 DNA) |
| `png/` | Reference baseline + export instructions |
| `manifest/` | `brand-identity-manifest.json` |

---

## Docs

| File | Phase |
|------|-------|
| `01_PRODUCTION_IDENTITY_INVENTORY.md` | A — Inventory |
| `02_LOGO_EVOLUTION_PRODUCTION_SPEC.md` | B — Logo spec |
| `03_MARKER_PRODUCTION_SPEC.md` | C — Marker spec |
| `04_BRAND_IDENTITY_QA_REPORT.md` | E — QA |
| `05_PRODUCTION_MIGRATION_PLAN.md` | F — Migration |

---

## PNG export (not bundled)

Generate PNGs from SVG using Inkscape, Figma, or:

```bash
# Example — Inkscape CLI
inkscape svg/leylek-symbol-dark.svg -w 1024 -h 1024 -o png/leylek-symbol-dark-1024.png
```

Reference raster: copy `frontend/assets/images/leylek-logo-premium.png` to `png/leylek-logo-premium-reference.png` for side-by-side QA.

---

## Do not ship to production without

1. `04_BRAND_IDENTITY_QA_REPORT.md` sign-off
2. Silhouette IoU ≥85% vs premium PNG
3. Explicit migration approval per `05_PRODUCTION_MIGRATION_PLAN.md`

---

**Parent:** `design-lab/brand-dna/v4/logo-evolution/`, `marker-evolution/`
