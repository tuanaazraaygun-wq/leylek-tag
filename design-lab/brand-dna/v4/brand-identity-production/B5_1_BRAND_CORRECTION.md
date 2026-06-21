# B5.1 — Brand Correction Record

**Date:** 2026-06-21  
**Type:** Refinement sprint — NOT redesign  
**Trigger:** Website feedback — B5 v1 drifted mascot-like (crown, head/neck/eye changes)

---

## Master (immutable)

`frontend/assets/images/leylek-logo-premium.png` — **MASTER LOGO**. All vectors derived from this file.

---

## What was wrong (B5 v1)

| Issue | Status |
|-------|--------|
| Separate crown polygon on head | **Removed** — crest integrated in profile path |
| Altered head proportions | **Corrected** — small head, long horizontal beak |
| Altered neck S-curve | **Corrected** — matches master profile |
| Oversized / mascot eye | **Corrected** — r=5.5 @ master position |
| Simplified circular arc | **Corrected** — premium swoosh path |
| Playful marker language | **Refined** — genom stroke + arc fragment |

---

## Golden test

Side-by-side old PNG vs new SVG @512:

- First glance: **same logo**
- Close look: cleaner curves, sharper production vector
- Target similarity: **95–98%**

---

## Files updated (v1.1)

- `svg/leylek-symbol-master-v1.svg` and all logo variants
- `app-icons/*`, `splash/*`, `website/*`
- Markers: passenger, quick-match (DNA alignment)
- Re-export: `png/leylek-symbol-dark-512.png` → website icons

---

## Rules going forward

1. No redesign without master PNG diff approval  
2. No crown, mascot, cartoon, abstract icon  
3. Silhouette locked — only vector quality improvements  
4. Markers inherit logo stroke / arc / cyan dot genom  

---

**Parent:** `02_LOGO_EVOLUTION_PRODUCTION_SPEC.md`
