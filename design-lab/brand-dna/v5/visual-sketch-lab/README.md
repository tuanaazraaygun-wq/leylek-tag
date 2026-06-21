# B5.5 — Visual Sketch Lab

**Mode:** Design · not documentation · **production freeze**  
**Date:** 2026-06-21

---

## Mission

Visual exploration for LeylekTAG brand evolution — sacred premium logo, no redesign.

---

## Generated assets

| Category | Count | Path |
|----------|-------|------|
| Logo wireframes | **30** | `logo/ls-*.svg` |
| App icon concepts | **10** | `app-icon/ai-*.svg` |
| Marker wireframes | **20** | `markers/mk-*.svg` |
| Splash compositions | **10** | `splash/sp-*.svg` |
| Comparison sheets | **6** | `sheets/*.svg` |

**Total SVG files:** 76 + generator script

### Comparison sheets
- `sheets/logo-human-review-sheet.svg`
- `sheets/logo-small-size-sheet.svg`
- `sheets/app-icon-size-ladder.svg`
- `sheets/marker-zoom-sheet.svg`
- `sheets/marker-family-board.svg`
- `sheets/splash-comparison-strip.svg`

---

## Boards

| File | Purpose |
|------|---------|
| `01_LOGO_SKETCH_BOARD.md` | 30 logo index |
| `02_APP_ICON_BOARD.md` | 10 icon index |
| `03_MARKER_BOARD.md` | 20 marker index |
| `04_SPLASH_BOARD.md` | 10 splash index |
| `05_ELIMINATION_MATRIX.md` | 30→3 · 20→3 · 10→3 |
| `06_FINALISTS.md` | LC / MC / IC finalists |
| `07_HUMAN_REVIEW.md` | Side-by-side protocol |
| `08_IMPLEMENTATION_AFTER_APPROVAL.md` | Blocked until PASS |

---

## Quick start (human review)

1. Open `sheets/logo-human-review-sheet.svg`
2. Open `logo/ls-01.svg`, `ls-29.svg`, `ls-30.svg` beside production PNG
3. Open `sheets/marker-zoom-sheet.svg`
4. Open `sheets/app-icon-size-ladder.svg`
5. Fill scorecard in `07_HUMAN_REVIEW.md`

---

## Regenerate sketches

```bash
node design-lab/brand-dna/v5/visual-sketch-lab/_generate-sketches.mjs
```

---

## Prohibitions

- ❌ Production / frontend / website changes
- ❌ PNG export to asset folders
- ❌ Automatic winner

---

**Parent:** B5.3 Restoration · B5.4 Brand Studio
