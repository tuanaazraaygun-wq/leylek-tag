# B5.5 — Implementation After Approval

**Prerequisite:** Human sign-off on `07_HUMAN_REVIEW.md`  
**Status:** 🔒 **BLOCKED**  
**Production:** No changes until this plan is explicitly authorized

---

## 1. Record decisions

| Lane | Human pick | Date | Signed by |
|------|------------|------|-----------|
| Logo | LC-___ | | |
| App Icon | IC-___ | | |
| Markers | MC-___ | | |
| Splash | SP-___ | | |

Store signed picks in `design-lab/brand-dna/v5/brand-studio/10_BRAND_MASTER_DECISION.md` (update).

---

## 2. Promote SVG masters (design-lab → production pipeline)

| Output | Source |
|--------|--------|
| `leylek-symbol-master-v2.svg` | Winning LC-* merged paths |
| `markers/svg/*.svg` | MC-* winning sketches |
| Icon master 1024 | IC-* winning composition |
| Splash spec | SP-* composition + motion notes |

Run golden test: silhouette IoU ≥ 0.98 vs premium PNG backup.

---

## 3. Regeneration sprints (content swap only)

| Sprint | Surfaces |
|--------|----------|
| B6-2r | premium PNG, splash, ios premium logo |
| B6-3r | app icon, adaptive, favicon, mipmaps |
| B6-4r | Leylek Zeka eye, watermark |
| B6-5r | 12 marker PNGs in `frontend/assets/markers/` |
| Website | Header, OG, favicon |

**Do not touch:** map logic, navigation, backend, dispatch.

---

## 4. Marker production checklist

- [ ] Export @48 master → display sizes per `MARKER_PIXEL`
- [ ] Fix glow `#22D3EE` → `#00D4AA` in `mapMarkerChrome.tsx`
- [ ] Zoom 16/18/20 device verify
- [ ] Gender-neutral passenger sign-off

---

## 5. QA gate

| Gate | Criteria |
|------|----------|
| B6-7r technical | Build PASS |
| B6-7r human logo | ≥70% “same logo, better quality” |
| B6-7r human markers | ≥70% “LeylekTAG map” |
| B6-8 | DNA Freeze EXECUTED |

---

## 5. Rollback

Keep `_backup-pre-b6-*` until B6-7r PASS.  
If human FAIL → restore backup PNG · do not ship new assets.

---

## 6. Explicitly not in scope until approval

- `frontend/assets/**` writes
- `website/**` asset writes
- PNG/ICO generation to production paths
- git commits touching production assets

---

**This document activates only after human review PASS.**
