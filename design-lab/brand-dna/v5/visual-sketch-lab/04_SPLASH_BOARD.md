# B5.5 — Splash Board

**Assets:** `splash/sp-01.svg` … `splash/sp-10.svg`  
**Viewport:** 390×844 phone mock · `#000000` field · logo monochrome

---

## Composition index (10)

| ID | File | Logo scale | Y position | Brand feeling |
|----|------|------------|------------|---------------|
| SP-01 | `splash/sp-01.svg` | 0.29 | center 380 | Classic calm presence |
| SP-02 | `splash/sp-02.svg` | 0.32 | low 420 | Breathe · grounded |
| SP-03 | `splash/sp-03.svg` | 0.26 | upper 280 | Hero ascent |
| SP-04 | `splash/sp-04.svg` | 0.28 | golden 322 | Mathematical calm |
| SP-05 | `splash/sp-05.svg` | 0.30 | center 400 | Arc pulse hint (spec) |
| SP-06 | `splash/sp-06.svg` | 0.24 | 360 | Compact cold start |
| SP-07 | `splash/sp-07.svg` | 0.34 | 390 | Wide premium presence |
| SP-08 | `splash/sp-08.svg` | 0.29 | 350 | Optical nudge upward |
| SP-09 | `splash/sp-09.svg` | 0.30 | 400 | Motion arc trail (concept) |
| SP-10 | `splash/sp-10.svg` | 0.28 | 400 | Premium calm hold bar |

---

## Animation direction (concept only — no implementation)

| ID | Motion concept | Duration hint |
|----|----------------|---------------|
| SP-01 | Fade in logo 0.92→1.0 opacity | 600 ms |
| SP-02 | Ellipse breathe scale 1.0→1.02 | 1200 ms loop |
| SP-05 | Arc stroke dash offset pulse | 800 ms |
| SP-09 | Trail path draw-on | 400 ms |
| SP-10 | Progress bar fill post-logo | 300 ms |

**Rule:** Logo silhouette static — motion only on arc/opacity, never morph geometry.

---

## Scale reference

| % viewport width | Sketch |
|------------------|--------|
| ~38% | SP-01, SP-08, SP-10 |
| ~34% | SP-07 |
| ~32% | SP-02 |
| ~30% | SP-05, SP-09 |
| ~28% | SP-04 |
| ~26% | SP-03 |
| ~24% | SP-06 |

---

## Review questions

1. Does logo feel **premium** not **startup splash template**?
2. Is arc mass visible before app chrome appears?
3. Does composition survive notch + home indicator safe areas?
4. Same logo recognition as production PNG?

---

**Strip:** `sheets/splash-comparison-strip.svg` (all 10 side by side)

---

**No implementation · no native splash export this sprint.**
