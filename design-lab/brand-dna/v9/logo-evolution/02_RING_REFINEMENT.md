# 02 — Ring Refinement

**Sprint:** BRAND-LOGO-EVO-2A  
**Primary target:** **R6** (scale **0.94**, −6%)

---

## Transform rule

```
Pivot: optical center (268, 278) @512  →  (657, 681) @1254 source
Bird layer: FIXED (no scale, no path edit)
Ring + glow layer: scale inward by ring_scale
```

---

## R6 intent

| Goal | Effect |
|------|--------|
| Leyleğe yaklaşsın | Inner arc edge ~6% closer to beak/tail |
| Daha dengeli otursun | Arc görsel ağırlığı azalır; kuş hero kalır |
| Premium | Halka “çerçeve” değil “mücevher rim” hissi |

---

## Comparison matrix

| Variant | Scale | Beak clearance @512 | Premium read | V2 preview |
|---------|-------|---------------------|--------------|------------|
| R4 | 0.96 | Geniş | Güvenli | Preview A |
| **R6** | **0.94** | OK | **Balanced ★** | **Preview B, C** |
| R8 | 0.92 | Dar | Aggressive | — (v8 lab only) |

---

## Constitution alignment

From `06_LOGO_GEOMETRY_CONSTITUTION.md`:

- Arc remains **open swoosh** — not closed circle
- Gap top-right preserved
- `R.negSpace` — ring shrink **increases** perceived inner breath (arc less dominant)
- Stork IoU vs production ≥ **98%** (golden test)

---

## Glow coupling

Ring refinement alone insufficient if outer bloom remains:

| Pass | R6 ring | Glow alpha on fringe pixels |
|------|---------|----------------------------|
| Production | 1.0 | 1.0 (full neon) |
| V2 Preview B | 0.94 | 0.5 |
| V2 Preview C | 0.94 | 0.4 (core arc opacity retained higher) |

**Fringe vs core:** Outer glow pixels reduced more; arc metal core keeps ~92% opacity for rim readability @48px.

---

## Implementation (lab script)

`scripts/generate_v9_previews.py` — color-mask separation bird/ring, inward remap, no vector path edit.

**Not in 2A:** SVG master path update (vector trace sprint).
