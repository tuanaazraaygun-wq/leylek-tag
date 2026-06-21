# B5.3 — Restoration Decision

**Date:** 2026-06-21  
**Status:** ⏸ **PENDING HUMAN APPROVAL**  
**Production changes:** ❌ **NONE**

---

## Decision summary

| Field | Value |
|-------|-------|
| Approved candidate | **TBD** — A / B / C / dual-ladder (A+B512, C+small) |
| Approved by | _________________ |
| Approval date | _________________ |
| Golden test IoU | _________________ (target ≥ 0.98) |
| Human recognition | _________________ (target ≥ 70% “same logo”) |

---

## Reviewer votes

| Reviewer | A | B | C | “Same logo?” | “Higher quality?” |
|----------|---|---|---|--------------|---------------------|
| | ☐ | ☐ | ☐ | ☐ | ☐ |
| | ☐ | ☐ | ☐ | ☐ | ☐ |
| | ☐ | ☐ | ☐ | ☐ | ☐ |

---

## Recommended interim production action (until approved)

| Action | Rationale |
|--------|-----------|
| **Restore** `leylek-logo-premium.png` from `_backup-pre-b6-2/` for user-facing builds | Stops “logo değişmiş” perception immediately |
| **Pause** B6-8 DNA Freeze EXECUTED | Brand SSOT unresolved |
| **Do not** ship store RC on B5.2 flat exports | B6-7 human fail root cause |

*Ops decision — not executed in B5.3 sprint.*

---

## After approval — regeneration order

1. Freeze `leylek-symbol-master-v2.svg` from winner  
2. Update `06_LOGO_GEOMETRY_CONSTITUTION.md` → v2 (B5.3 amendment)  
3. Re-export ladder (512, 1024, 432 adaptive, splash, website)  
4. Re-derive markers / watermark / zeka-eye from v2 genom  
5. Re-run B6-2, B6-3, B6-4, B6-5 as **content swaps only**  
6. B6-7 device QA (second pass)  
7. B6-8 DNA Freeze EXECUTED

---

## Rejected paths (locked)

| Path | Reason |
|------|--------|
| F1 Meridian Wing | Forbidden |
| B5 v1 crown/mascot | Forbidden |
| New abstract icon | Forbidden |
| Auto-trace from PNG | Forbidden — manual Bézier only |
| Ship B5.2 trace as-is | **Human QA failed** |

---

## Sign-off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Brand / design | | | |
| Product | | | |
| Mobile eng | | | |

---

**B5.3 restoration decision:** ⏸ **OPEN — awaiting human panel**

When closed with PASS → proceed to production regeneration sprint (**B5.3b** or **B6-2r**).
