# Genom Token Bridge — Logo ↔ Marker

**Sprint:** B-2 — Patch B2-1 companion  
**Mode:** Specification schema only — no JSON file production yet  
**Date:** 2026-06-21

---

## Purpose

Logo evolution ve marker evolution **aynı token dosyasından** beslenir. Bu belge shared schema tanımlar — implementation Logo P2 + Marker B-3 sonrası.

---

## Shared tokens

| Token ID | Hex / value | Logo use | Marker use |
|----------|-------------|----------|------------|
| `genom.meridianCyan` | `#00D4AA` | Accent dot, arc peak | Glow, rings, pickup core |
| `genom.trustWhite` | `#F5F7FA` | Body stroke | Marker edge stroke |
| `genom.depthSlate` | `#1A2332` | — | Marker body fill |
| `genom.voidBlack` | `#0D1117` | Ground | Shadow |
| `genom.warmResolve` | `#C8E6D0` | — | Trust ring |
| `genom.cautionAmber` | `#FFB020` | — | Seeking near, errors |
| `genom.splashNavy` | `#08111F` | Splash | Map chrome ink |

---

## Deprecated (migrate away)

| Legacy | Location | Replace with |
|--------|----------|--------------|
| `#22D3EE` | `mapMarkerChrome.tsx` CYAN | `genom.meridianCyan` |
| `#67E8F9` | website `.leylek-marker-core` | `genom.meridianCyan` |
| `#059669` / `#EA580C` | DriverOfferScreen seeking | PNG + ring overlays |
| `#0EA5E9` | index destinationPinCore | meridian dot |

---

## Stroke scale bridge

| Logo @512 | Marker @48 |
|-----------|------------|
| 2.5 px primary | 2 px min |
| 2 px ring | 1.5 px state ring |
| Corner 2–4 px | Same |

---

## Manifest schema (future)

```json
{
  "version": "1.0.0",
  "logoVectorMaster": "leylek-symbol-master-v1.svg",
  "markerExports": {
    "passenger-dark-32": { "sha256": "...", "tier": "M" },
    "driver-car-dark-34": { "sha256": "...", "tier": "M" }
  },
  "frozenAt": null
}
```

Path target: `design-lab/markers/exports/manifest.json`

---

## Dependency graph

```
Logo P2 vector master
    → Marker B-3 SVG traces (shared stroke)
    → GENOM manifest freeze
    → Marker B-8 + Logo P8 can parallelize tint-only if manifest locked
```

---

**İlişkili:** `design-lab/brand-dna/v4/logo-production-lab/GENOM_TOKENS_SPEC.md`
