# V7.1b — Team Alpha Master Report

**Sprint:** V7.1b — Team Alpha Premium Logo Analysis  
**Team:** ALPHA — Brand Core  
**Date:** 2026-06-21  
**Mode:** Analysis only · production untouched  
**Mission:** Restore and evolve the original LeylekTAG Premium Logo without redesign

---

## 1. Sprint outcome

Team Alpha completed read-only analysis across B5.3–B5.6, V6 MEX, and V7.1 Experience Asset Lab. All primary questions (A–J) answered with evidence in the deliverable package below.

**Production status:** Untouched by this sprint. Premium logo restored to **1254 original master** per project status (`frontend/assets/images/leylek-logo-premium.png` aligned with `_backup-pre-b6-2`).

**Asset production:** **STILL BLOCKED** until G0 PASS.

---

## 2. Deliverables created

| # | File | Contents |
|---|------|----------|
| 01 | `01_MASTER_ANALYSIS.md` | Primary questions A–J · comparison chain · evidence |
| 02 | `02_LOGO_DNA_LOCK.md` | Immutable · semi-flexible · flexible · experimental |
| 03 | `03_FAILURE_ANALYSIS.md` | B5.2 technical + emotional failure · migration post-mortem |
| 04 | `04_SMALL_SIZE_ANALYSIS.md` | 24–1024 px tier behaviour · dual ladder |
| 05 | `05_GLOBAL_BRAND_COMPARISON.md` | Uber · Bolt · Lyft · BlaBlaCar · Apple · Tesla · Maps |
| 06 | `06_PRODUCTION_READINESS.md` | Pre-export checklist · 36 blockers |
| 07 | `07_RISK_REGISTER.md` | P0–P2 Alpha risks · contingencies |
| 08 | `08_TEAM_ALPHA_MASTER_REPORT.md` | This document |

**Location:** `design-lab/brand-dna/v7/team-alpha-analysis/`

---

## 3. Biggest discovery

**The logo did not fail — the migration did.**

The 1254 premium master encodes a precise emotional contract: **long beak authority + thick orbital arc mass + one-leg stork pose + satin chrome memory**. B5.2 preserved the eye anchor but destroyed the three highest-rank identity elements (beak, arc, leg), producing ~0.91–0.94 IoU and the verbatim human fail *"Logo değişmiş."* B5.3 LC-2 correctly restores geometry **without redesign** — but was never human-signed or exported. Production perception is restored via rollback; **vector production remains on the failed B5.2 manifest** until v2 freeze.

---

## 4. Biggest production blocker

**G0 human blink panel + IoU ≥0.98 — NOT RUN.**

| Blocker | Status |
|---------|--------|
| `RESTORATION_DECISION.md` | ⏸ PENDING — empty reviewer votes |
| IoU pixel script | ⏸ NOT RUN |
| `leylek-symbol-master-v2.svg` | ❌ Does not exist |
| B6-8 DNA Freeze EXECUTED | 🔴 BLOCKED |

No PNG/SVG export may begin until G0 all-green. Jury composite requirement remains **≥95** (LC-2 lab = 80 COND — still below ship bar even after G0).

---

## 5. What absolutely must NEVER change

| Priority | Element |
|----------|---------|
| 1 | **Silhouette contour** — IoU ≥0.98 vs 1254 |
| 2 | **Long horizontal beak** — tip ~356 X @512 |
| 3 | **Orbital arc bottom mass** — never return to 11px hairline |
| 4 | **One-leg + tucked leg pose** @≥48px |
| 5 | **Open arc gap** top-right |
| 6 | **Vertical stork genus** — not pin/owl/abstract |
| 7 | **Single cyan eye** (292, 166) — `#00D4AA` family |
| 8 | **Premium calm** — not mascot |
| **Forbidden forever** | F1 Meridian Wing · crown · B5.2 v1 trace · auto-trace · ship without blink |

Full lock: `02_LOGO_DNA_LOCK.md` §1.

---

## 6. What can safely evolve

| Element | Bounds |
|---------|--------|
| Arc stroke width | 14–24 px @512 (LC-2 19–20px) |
| Optical center nudge | ±6 px — LC-2 translate(4,6) |
| Vector body fill | Flat silver tones if silhouette holds |
| Tucked leg detail | Simplify @≤32px · LC-3 merge @24px only |
| Wing stroke | 2–5 px |
| Raster hero tier | 1254 chrome for splash/login |
| Export ladder | LC-2 master + LC-3 micro dual path |
| Monochrome watermark | Stroke-only variant |

Full policy: `02_LOGO_DNA_LOCK.md` §2–§3.

---

## 7. Recommended next sprint

### Sprint: **V7.1b Asset Production** (after G0 PASS only)

| Week | Action | Gate |
|------|--------|------|
| **W0** | Convene 5-reviewer human panel · blind blink 1254 ↔ LC-2 | G0-1 ≥70% |
| **W0** | Run IoU script @512 · beak tip manual check | G0-2 ≥0.98 |
| **W0** | Sign `RESTORATION_DECISION.md` · pick LC-2 or LC-1 | G0 |
| **W1** | Freeze `leylek-symbol-master-v2.svg` + LC-3 small | Alpha |
| **W1** | Publish constitution v2 + manifest dual ladder | Alpha |
| **W1–2** | Export PNG ladder 16→1254 · app icon · splash SVG | G1 |
| **W2** | Echo OEM matrix 12 devices · notification @24px | G1 |
| **W3+** | Bravo/Charlie/Delta parallel · B5.7 re-jury | G5 |

**Do not:** regenerate markers, splash native, or app.json until Alpha v2 SVG frozen.

**Comms:** "Logo restoration" — not rebrand.

---

## 8. Answer index (A–J quick reference)

| Q | One-line answer |
|---|-----------------|
| **A** | Users recognize name-aligned stork, one-leg pose, beak direction, arc mass, premium chrome |
| **B** | Silhouette > beak > arc > one-leg > arc gap > genus > eye > neck > weight > wing > head > material |
| **C** | Never: CORE 13 tokens · Safe: stroke, optical nudge, tier simplification, raster hero |
| **D** | B5.2: 11px arc, −12px beak, merged leg, IoU fail → "logo değişmiş" + ClipArt premium |
| **E** | Full matrix in `01_MASTER_ANALYSIS.md` §E |
| **F** | DNA Lock in `02_LOGO_DNA_LOCK.md` |
| **G** | Dual ladder required; master shrink fails @24px; LC-3 wins micro | `04_SMALL_SIZE_ANALYSIS.md` |
| **H** | Hero raster strong on dark splash; weak on embroidery/laser/light until variants |
| **I** | Original hero can compete regionally; B5.2 cannot; LC-2 conditional with dual ladder |
| **J** | 36 items missing — G0 human + IoU is critical path | `06_PRODUCTION_READINESS.md` |

---

## 9. Evidence sources (read order completed)

1. `design-lab/brand-dna/v7/experience-asset-lab/`  
2. `design-lab/brand-dna/v6/master-experience-studio/`  
3. `design-lab/brand-dna/v5/global-design-jury/`  
4. `design-lab/brand-dna/v5/visual-sketch-lab/`  
5. `design-lab/brand-dna/v5/brand-studio/`  
6. `design-lab/brand-dna/v4/logo-restoration/`  
7. `design-lab/brand-dna/v4/brand-identity-production/`  
8. `frontend/assets/images/leylek-logo-premium.png` (visual)  
9. `frontend/assets/images/_backup-pre-b6-2/leylek-logo-premium.png` (visual)  
10. `logo-restoration/overlay/b52-failed-trace-512.png` (visual)

---

## 10. Sign-off template

| Role | Name | Date | Approved |
|------|------|------|----------|
| Brand / Design | | | ☐ |
| Product | | | ☐ |
| Alpha lead | | | ☐ |
| Echo / QA | | | ☐ |

**Approving this package authorizes scheduling G0 human panel — not asset export.**

---

## Final statement

Team Alpha confirms: the original LeylekTAG premium logo is **sacred, restorable, and evolvable** through LC-2 restoration + LC-3 micro ladder — not through redesign or B5.2 resurrection. Production PNG perception is restored; **vector production system remains broken until G0 passes**.

---

**TEAM ALPHA ANALYSIS COMPLETE**  
**Production untouched.**  
**Ready for Team Alpha Asset Production** *(pending G0 PASS only)*.
