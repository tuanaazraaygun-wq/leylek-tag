# LSDS v1 → v2 Changelog

**Genome:** 1.0 *Cyan Meridian* → 2.0 *Cyan Meridian Body*

---

## Summary

v2 addresses the v1 “simple ping” feedback by adding **Meridian Body** synthesis while preserving v1 interval logic, urgency map, and duration limits.

---

## Synthesis

| Aspect | v1 | v2 |
|--------|----|----|
| Primary osc | Sine | Sine + body undertone (A2) |
| Harmonics | h2 ~0.10–0.125, h3 sparse | h2 ~0.17–0.20, h3/h4 selective |
| Attack | Envelope ramp only | + shaped noise transient |
| FM | QM only, ≤0.08 | QM only, ≤0.06 |
| Lowpass | 0.9992 | 0.9988 (warmer) |
| Max partials | 3 | 4 |
| Peak target | 0.85 | 0.85 (unchanged) |

---

## Timing

| Token | v1 typical | v2 typical |
|-------|------------|------------|
| Offer classic gap | 240 ms | 260–275 ms |
| Offer urgent gap | 180 ms | 170–185 ms |
| QM ops gap | 220 ms | 230–245 ms |
| Match gap | 350 ms | 360–375 ms |
| QR success | 0.24 s | 0.30–0.35 s |
| Payment gap | 260 ms | 220–240 ms |

---

## Files

| v1 | v2 |
|----|-----|
| `generate_sonic_v1.py` | `generate_sonic_v2.py` (new) |
| `output/wav/*_v1..v3.wav` | `v2/output/wav/*_v2a..c.wav` |
| — | `v2/output/manifest.json` |

v1 files are **not modified or deleted**.

---

## Breaking changes

None for production code until promotion. WAV filenames differ (`v2a` vs `v1`).

---

## Compatible

- Token names (`sonic.*`) unchanged  
- Production `require()` paths unchanged at promotion (rename winner → prod filename)  
- Cooldown/dedupe in `sound.ts` unchanged

---

## Recommended listen order

1. Driver stack: classic v2a/b/c → urgent v2a/b/c → QM v2a/b/c  
2. Resolve: match v2a/b/c → payment v2a/b  
3. Micro: qr v2a/b → qr_error → feedback → ui_tap ×10  
4. Discrimination replay vs v1 production WAV
