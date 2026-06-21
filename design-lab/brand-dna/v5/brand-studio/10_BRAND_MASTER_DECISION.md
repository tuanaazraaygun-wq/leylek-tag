# B5.4 — Brand Master Decision

**Sprint:** B5.4 — LeylekTAG Brand Studio  
**Date opened:** 2026-06-21  
**Status:** ⏸ **PENDING HUMAN APPROVAL**  
**Production changes:** ❌ **NONE**

---

## Decision summary

| Field | Value |
|-------|-------|
| **Logo finalist** | TBD — F1 / F2 / F3 / dual-ladder (F2+F3) |
| **Marker studio spec** | TBD — approve / revise |
| **Approved by** | _________________ |
| **Approval date** | _________________ |
| **Human logo recognition** | _____% (target ≥70% “same logo”) |
| **Human marker recognition** | _____% (target ≥70% “LeylekTAG map”) |
| **Golden test IoU** | _____ (target ≥ 0.98) |

---

## Context lock

| Event | Finding |
|-------|---------|
| B6-7 Technical QA | ✅ PASS |
| B6-7 Human Brand QA | ❌ FAIL — logo + markers feel generic |
| B5.3 restoration | Candidates A/B/C ready for panel |
| B5.4 Brand Studio | 30 → 3 finalists · marker language · ecosystem spec |

---

## Studio recommendation (pre-human)

| Domain | Recommendation | Confidence |
|--------|----------------|------------|
| **Logo master @512/1254** | **F2 — Meridian Balance** | High |
| **Micro ladder @24/48** | **F3 — Meridian Horizon** | High |
| **Marker family** | Approve `06_MARKER_STUDIO.md` chassis | Medium — pending zoom test mock |
| **Ecosystem** | F2 primary · F3 micro · mono watermark | High |

**Rationale:** F2 scores highest on app icon + 10-year timeless without breaking CORE genome. F3 fixes map/favicon tiers B6-7 flagged. F1 remains fallback if overlay purists reject optical nudge.

---

## Reviewer votes — Logo

| Reviewer | F1 | F2 | F3 | Dual | “Same logo?” | “More premium?” |
|----------|----|----|-----|------|--------------|-----------------|
| | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |

---

## Reviewer votes — Markers

| Reviewer | Approve studio spec | Revise | “Generic old markers?” | “LeylekTAG family?” |
|----------|---------------------|--------|------------------------|---------------------|
| | ☐ | ☐ | ☐ | ☐ |
| | ☐ | ☐ | ☐ | ☐ |

---

## Golden rule outcome

| User sentence | Result |
|---------------|--------|
| “Logo değişmiş.” | **FAIL** — do not approve |
| “Logo aynı ama çok daha kaliteli olmuş.” | **PASS** — eligible |

| User sentence | Result |
|---------------|--------|
| “Harita pinleri başka uygulama gibi.” | **FAIL** markers |
| “Harita artık LeylekTAG gibi duruyor.” | **PASS** markers |

---

## Rejected paths (locked)

| Path | Reason |
|------|--------|
| B5.2 flat trace | B6-7 human fail |
| New abstract logo | Violates sprint charter |
| F1 Meridian Wing | Forbidden |
| Production swap before sign-off | Violates B5.4 freeze |
| Generic icon-template markers | Root cause of perception fail |

---

## On approval — authorized actions

1. Execute `09_IMPLEMENTATION_PLAN.md` Stage 1–6  
2. Promote SVG v2 to production pipeline  
3. Regenerate surfaces (B6-2r … B6-5r)  
4. Re-run B6-7 device QA  
5. Unblock B6-8 DNA Freeze EXECUTED

---

## On rejection — required actions

1. Document failure mode in this file  
2. Iterate design-lab SVG/spec only  
3. **Do not** touch production assets  
4. Reconvene human panel

---

## Sign-off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Brand / Design | | | |
| Product | | | |
| Mobile Engineering | | | |
| QA / Device | | | |

---

## Document index

| # | File |
|---|------|
| 01 | `01_BRAND_DNA_ANALYSIS.md` |
| 02 | `02_LOGO_GENOME.md` |
| 03 | `03_30_SKETCH_CATALOG.md` |
| 04 | `04_ELIMINATION.md` |
| 05 | `05_FINALISTS.md` |
| 06 | `06_MARKER_STUDIO.md` |
| 07 | `07_VISUAL_ECOSYSTEM.md` |
| 08 | `08_HUMAN_REVIEW_BOARD.md` |
| 09 | `09_IMPLEMENTATION_PLAN.md` |
| 10 | `10_BRAND_MASTER_DECISION.md` (this file) |

---

**B5.4 Brand Studio status:** ✅ **COMPLETE (design-lab)** · ⏸ **AWAITING HUMAN DECISION**
