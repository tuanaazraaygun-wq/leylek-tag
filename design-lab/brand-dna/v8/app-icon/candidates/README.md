# BRAND-APPICON-1B — Lab Icon Candidates

**Sprint:** BRAND-APPICON-1B  
**Date:** 2026-06-21  
**Status:** Design-lab only — **production untouched**

---

## Purpose

Three Android/iOS app icon **candidates** derived from the **login production logo** (`frontend/assets/images/leylek-logo-premium.png` — Family A). Replaces the wireframe Family B currently used by `adaptive-icon-foreground.png` in analysis only; **no production files were modified**.

---

## Candidates

| File | Ring scale | Shrink | Recommendation |
|------|------------|--------|----------------|
| `candidate-r4.png` | 0.96 | −4% | Conservative |
| `candidate-r6.png` | 0.94 | −6% | **Primary ★** (BRAND-LOGO-EVO / APPICON plan) |
| `candidate-r8.png` | 0.92 | −8% | Aggressive premium |

All candidates @ **1024×1024**, background **`#08111F`**, symbol inside **66% safe diameter** (Android adaptive).

---

## Design parameters

| Parameter | Value |
|-----------|-------|
| Source (read-only) | `frontend/assets/images/leylek-logo-premium.png` (1254×1254) |
| Stork | Unscaled — same silhouette as login |
| Ring / glow layer | Scaled toward optical center (268/512, 278/512); glow alpha × **0.5** |
| Background | Premium soft black `#08111F` (not pure `#000000`) |
| Theme | OS launcher — **independent** of in-app white/dark theme |
| Adaptive safe zone | Symbol fit within 66% canvas (~676 px) |

---

## Preview assets

| File | Contents |
|------|----------|
| `preview-grid.png` | R4 / R6 / R8 side-by-side @1024 |
| `48px-preview.png` | R6 downscale — launcher legibility |
| `72px-preview.png` | R6 @ hdpi |
| `96px-preview.png` | R6 @ xhdpi |
| `192px-preview.png` | R6 @ xxhdpi |

---

## Regeneration

```bash
py -3 design-lab/brand-dna/v8/app-icon/scripts/generate_candidates.py
```

Requires: Python 3 + Pillow + NumPy (already available via `py -3` on dev machine).

---

## Production files — DO NOT overwrite (1B)

| Path | Status |
|------|--------|
| `frontend/assets/images/adaptive-icon-foreground.png` | ❌ untouched |
| `frontend/assets/images/leylek-logo-premium.png` | ❌ untouched |
| `frontend/assets/ios.premium.logo.png` | ❌ untouched |
| `frontend/android/.../mipmap-*` | ❌ untouched |
| `frontend/app.json` | ❌ untouched |

---

## Next step (BRAND-APPICON-1C — gated)

1. Product sign-off on **candidate-r6.png** (or R4/R8)
2. Export `adaptive-icon-foreground.png` (432 FG safe, alpha) + `ios.premium.logo.png` from chosen candidate
3. `npx expo prebuild --platform android` → refresh mipmaps
4. See `../04_ACCEPTANCE_CRITERIA.md`

---

## Related analysis

- `../01_APP_ICON_INVENTORY.md` — root cause (Family A vs B)
- `../03_SAFE_APP_ICON_PLAN.md` — production swap plan
- `../../logo-evolution/06_RING_REFINEMENT_DIRECTION.md` — ring shrink rationale

**BRAND-APPICON-1B CANDIDATES COMPLETE — Production untouched.**
