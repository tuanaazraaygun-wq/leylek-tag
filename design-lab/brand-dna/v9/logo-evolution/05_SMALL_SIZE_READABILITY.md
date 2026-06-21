# 05 — Small Size Readability

**Sprint:** BRAND-LOGO-EVO-2A  
**Reference preview:** **Preview B** (R6 + glow −50%)

---

## Test sizes (APK / launcher ladder)

| Size | DPI context | File |
|------|-------------|------|
| **48 px** | mdpi launcher / notification | `readability/48px.png` |
| **72 px** | hdpi | `readability/72px.png` |
| **96 px** | xhdpi | `readability/96px.png` |
| **192 px** | xxhdpi | `readability/192px.png` |

Generated from `preview-b.png` @1024 downscale (LANCZOS).

---

## Pass criteria (first-glance @ arm's length)

| ID | Criterion | 48 | 72 | 96 | 192 |
|----|-----------|----|----|-----|-----|
| S-01 | Stork silhouette recognizable | req | req | req | req |
| S-02 | Arc hint visible (not blob) | req | req | req | req |
| S-03 | Cyan eye/accent dot | opt | req | req | req |
| S-04 | No gray neon smear | req | req | req | req |
| S-05 | Same brand as login @100px | req | req | req | req |

---

## Production vs V2 Preview B (expected delta)

| Issue @48px | Production master | V2 Preview B |
|-------------|-------------------|--------------|
| Outer glow | Muddy cyan halo | Tight — glow −50% |
| Ring dominance | Thick arc ring | R6 tighter |
| Stork | Often survives | Unchanged silhouette |
| Background | Black in PNG | `#08111F` soft |

---

## Wireframe B comparison (APK today)

Current `adaptive-icon-foreground.png` @48px reads **stick figure + U-arc** — wrong family but sharp edges.

V2 goal: **Family A silhouette** with **equal or better** edge clarity than wireframe — achieved via glow reduction + optional sharpen, not simplification to wireframe.

---

## Android adaptive safe zone

Symbol fit @1024: **72%** canvas (logo master; icons use 66%). Beak tip + wing apex inside safe circle on Preview B — verify in 1C device QA.

---

## Regenerate readability set

```bash
py -3 design-lab/brand-dna/v9/logo-evolution/scripts/generate_v9_previews.py
```
