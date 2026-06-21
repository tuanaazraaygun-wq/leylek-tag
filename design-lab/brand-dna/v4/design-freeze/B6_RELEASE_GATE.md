# B6 — Release Gate

**Sprint:** B6 — Final Design QA + DNA Freeze  
**Date:** 2026-06-21  
**Prerequisite:** B3 + B4 + B5 complete  
**Production default:** All theme + LSX flags OFF

---

## Gate levels

| Gate | Name | B6 status | Production change |
|------|------|-----------|-------------------|
| **G6-0** | B6 analysis + freeze PREPARED | ✅ PASS | None |
| **G6-1** | B6-1 Website logo/favicon | ⏸ Ready | Website only |
| **G6-2** | B6-2 Splash sync | ⏸ Blocked on IoU | Frontend + Android res |
| **G6-3** | B6-3 App icon + adaptive | ⏸ After G6-2 | Native rebuild |
| **G6-4** | B6-4 Leylek Zeka + watermark | ⏸ | Frontend components |
| **G6-5** | B6-5 Marker migration | ⏸ | Frontend assets |
| **G6-6** | B6-6 Orphan cleanup | ⏸ After G6-1…5 | Delete/archive |
| **G6-7** | B6-7 Final QA | ⏸ | Verification |
| **G6-8** | DNA Freeze EXECUTED | ⏸ After G6-7 | Constitution signed |

---

## G6-0 — B6 analysis gate (THIS SPRINT)

| ID | Criterion | Required | Status |
|----|-----------|----------|--------|
| G6-0-01 | Master QA report published | ✅ | ✅ |
| G6-0-02 | 5 domain QA summaries | ✅ | ✅ |
| G6-0-03 | Migration plan B6-1…B6-8 | ✅ | ✅ |
| G6-0-04 | DNA Freeze constitution PREPARED | ✅ | ✅ |
| G6-0-05 | Consolidated risk register | ✅ | ✅ |
| G6-0-06 | Production untouched | ✅ | ✅ |
| G6-0-07 | No commits in B6 analysis | ✅ | ✅ |
| G6-0-08 | Feature flags unchanged | ✅ | ✅ |

**G6-0 verdict:** ✅ **PASS — SPRINT B6 ANALYSIS COMPLETE**

---

## G6-1 — Website logo/favicon gate

| ID | Criterion | Required |
|----|-----------|----------|
| G6-1-01 | PNG export 16–512 from B5 SVG | ✅ |
| G6-1-02 | Navbar + favicon visual QA | ✅ |
| G6-1-03 | PWA manifest icons updated | ✅ |
| G6-1-04 | No backend change | ✅ |
| G6-1-05 | Rollback tested | ✅ |
| G6-1-06 | Dark + light page spot check | ✅ |

**First production patch:** **B6-1** — lowest risk entry point.

---

## G6-2 — Splash gate

| ID | Criterion | Required |
|----|-----------|----------|
| G6-2-01 | IoU ≥85% vs premium PNG | ✅ |
| G6-2-02 | JS + native Android same family | ✅ |
| G6-2-03 | `#0D1117` / `#08111F` ground harmonized | ✅ |
| G6-2-04 | 200ms first impression test | ✅ |

---

## G6-3 — App icon gate

| ID | Criterion | Required |
|----|-----------|----------|
| G6-3-01 | iOS squircle clip pass | ✅ |
| G6-3-02 | Android adaptive safe zone pass | ✅ |
| G6-3-03 | iOS = Android family | ✅ |
| G6-3-04 | TestFlight soak 48h | ✅ |

---

## G6-4 — Leylek Zeka gate

| ID | Criterion | Required |
|----|-----------|----------|
| G6-4-01 | Eye color `#00D4AA` | ✅ |
| G6-4-02 | Watermark 12% opacity | ✅ |
| G6-4-03 | Animation performance neutral | ✅ |

---

## G6-5 — Marker gate

| ID | Criterion | Required |
|----|-----------|----------|
| G6-5-01 | passenger-neutral deployed | ✅ |
| G6-5-02 | No gender read @32px | ✅ |
| G6-5-03 | Driver field map unified | ✅ |
| G6-5-04 | Light marker bundle (if theme S5) | ✅ |
| G6-5-05 | Map zoom low/med/high QA | ✅ |

---

## G6-7 — Final QA gate

| ID | Criterion | Required |
|----|-----------|----------|
| G6-7-01 | FQA-01…FQA-10 pass | ✅ |
| G6-7-02 | Zero open P0 in R-B6-* | ✅ |
| G6-7-03 | Theme flags OFF regression | ✅ |
| G6-7-04 | LSX flags OFF regression | ✅ |
| G6-7-05 | Single logo family verified | ✅ |

---

## G6-8 — DNA Freeze EXECUTED gate

| ID | Criterion | Required |
|----|-----------|----------|
| G6-8-01 | Constitution signed | ✅ |
| G6-8-02 | SSOT manifest locked | ✅ |
| G6-8-03 | Drift rules communicated to eng | ✅ |
| G6-8-04 | Post-freeze roadmap published | ✅ |

---

## Post-freeze gates (reference)

| Gate | Source | When |
|------|--------|------|
| Theme S2–S6 | `WHITE_THEME_RELEASE_GATE.md` | After G6-8 |
| LSX G4-3–G4-5 | `B4_RELEASE_GATE_FINAL.md` | After call-site migration |
| Marker DNA freeze | `MARKER_DNA_FREEZE_GATE.md` | After G6-5 |

---

## Rollback runbook (summary)

| Level | Action |
|-------|--------|
| L1 | Revert single B6-n patch from backup |
| L2 | All theme flags OFF |
| L3 | All LSX flags OFF |
| L4 | Freeze REVOKED + root cause review |

Full detail: `B6_DNA_FREEZE_CONSTITUTION.md` §4.

---

## Abort criteria

| Trigger | Action |
|---------|--------|
| P0 brand harm (wrong logo shipped) | Immediate rollback + freeze REVOKED |
| Recognition <70% | Stop G6-2/3 |
| Crash +0.5% post migration | Rollback last patch |
| Gendered marker in prod | Hotfix B6-5 rollback |

---

## Current release decision

| Decision | Status |
|----------|--------|
| B6 analysis ship to design-lab | ✅ APPROVED |
| B6-1 website migration | ⏸ **Ready — await explicit approval** |
| DNA Freeze EXECUTED | ⏸ After G6-7 |
| Theme flag ON | ⏸ Post-freeze |
| LSX flag ON | ⏸ Post-freeze |

---

**Parent:** `B6_FINAL_DESIGN_QA_MASTER_REPORT.md`, `B6_DNA_FREEZE_CONSTITUTION.md`
