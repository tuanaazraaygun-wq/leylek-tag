# V7.1b — Production Readiness

**Team:** ALPHA  
**Question:** What is still missing before any asset production starts?  
**Rule:** V7.1b asset production is **BLOCKED** until every P0 item below is green.

---

## 1. Readiness summary

| Area | Status | Blocker count |
|------|--------|---------------|
| Human governance | 🔴 NOT READY | 3 |
| Metric / QA automation | 🔴 NOT READY | 2 |
| Vector master | 🔴 NOT READY | 2 |
| Constitution / manifest | 🔴 NOT READY | 2 |
| Export ladder | 🔴 NOT READY | ~18 files |
| OEM device matrix | 🔴 NOT READY | 1 |
| Ecosystem coupling | 🟡 PARTIAL | markers/nav separate teams |
| Production rollback | 🟢 DONE | Master restored (project status) |

**Verdict:** **NOT READY** for Team Alpha asset production.

---

## 2. P0 — Must complete before first SVG/PNG export

### G0 gates (all NOT RUN)

| ID | Item | Status | Owner | Evidence |
|----|------|--------|-------|----------|
| PR-01 | Human blink panel — 1254 vs LC-2 | ⏸ PENDING | Brand | `RESTORATION_DECISION.md` empty votes |
| PR-02 | Silhouette IoU ≥0.98 @512 | ⏸ NOT RUN | Echo | `GOLDEN_TEST.md` §6 pending script |
| PR-03 | ≥70% reviewers "same logo, better quality" | ⏸ NOT RUN | Brand | `OVERLAY_VALIDATION.md` §3 |
| PR-04 | Beak tip delta ≤2px verified | ⏸ NOT RUN | Alpha | Manual anchor |
| PR-05 | Arc mass visual jury OK | ⏸ NOT RUN | Brand council | Side-by-side vs 1254 |
| PR-06 | LC-1 vs LC-2 split resolution path | ⏸ UNDEFINED | Brand council | B5.6 refuses auto-pick |

### Master assets (not created)

| ID | Item | Status | Path (future) |
|----|------|--------|---------------|
| PR-07 | `leylek-symbol-master-v2.svg` | ❌ Missing | design-lab → brand-identity-production/svg |
| PR-08 | `leylek-symbol-small.svg` v2 from LC-3 | ❌ Missing | Re-derive from approved C |
| PR-09 | Constitution v2 | ❌ Missing | Amend 11px arc · 1254 SSOT |
| PR-10 | Manifest bump B5.3-v1.0 | ❌ Missing | Dual ladder documented |

### Governance sign-offs

| ID | Item | Status |
|----|------|--------|
| PR-11 | B5.3 `RESTORATION_DECISION.md` signed | ⏸ OPEN |
| PR-12 | V7.1 analysis sign-off (this sprint) | ⏸ In progress |
| PR-13 | B5.7 re-jury scheduled | ❌ Not scheduled |
| PR-14 | B6-8 DNA Freeze EXECUTED | 🔴 BLOCKED |

---

## 3. P0 — Alpha export inventory (planned ~25 files — zero exist)

From `V7.1/02_ASSET_PRODUCTION_INVENTORY.md` — **none produced**:

| Asset ID | Description | Depends on |
|----------|-------------|------------|
| A-01 | Symbol master v2 SVG | PR-07 |
| A-02 | Symbol small SVG | PR-08 |
| A-03 | Premium PNG 1254 hero | PR-07 + resvg/export |
| A-04 | Premium PNG 512 UI | PR-07 |
| A-05 | App icon SVG 1024 | LC-2 |
| A-06 | Adaptive foreground 432 | LC-2 |
| A-07 | App icon PNG 1024 | A-05 export |
| A-08 | Adaptive PNG 432/1024 | A-06 export |
| A-09 | Favicon 16/32 | LC-3 |
| A-10 | Notification 24/48 | LC-3 |
| A-11 | iOS premium logo 1024 | LC-2 |
| A-12 | Splash SVG 1920×1080 | LC-2 + SP-10 pick |
| A-13 | Android splash ×5 DPI | A-12 export |
| A-14 | Symbol dark/white SVG | LC-2 variants |

### Export tooling

| ID | Item | Status |
|----|------|--------|
| PR-15 | resvg export pipeline scripted | ⚠️ Documented only (`09_EXPORT_SYSTEM.md`) |
| PR-16 | Golden PNG hash per tier | ❌ Not implemented |
| PR-17 | CI filename gate LC-3 ≠ master | ❌ Not implemented |

---

## 4. P1 — Required before RC1 (can parallel after G0 PASS)

| ID | Item | Status | Team |
|----|------|--------|------|
| PR-18 | G1 App Store grid blind test | ❌ | Echo |
| PR-19 | iOS squircle OEM ×6 | ❌ Empty matrix CF-22 | Echo |
| PR-20 | Android adaptive OEM ×6 | ❌ | Echo |
| PR-21 | Notification @24px proof | ❌ | Echo |
| PR-22 | Splash arc visible @38% width | ❌ | Alpha |
| PR-23 | `app.json` icon path fix | ⏸ Phase 1.8 — wrong tier noted | Eng |
| PR-24 | 3-meter print test T-A6 | ❌ | Brand |
| PR-25 | Light theme white variant audit | ❌ | Alpha |

---

## 5. P1 — Documentation gaps

| ID | Document | Status |
|----|----------|--------|
| PR-26 | `06_LOGO_GEOMETRY_CONSTITUTION v2` | Not written |
| PR-27 | Export ladder amend for 1254 tier | `09_EXPORT_SYSTEM` v1 lacks 1254 row |
| PR-28 | Dual-ladder policy in manifest | Missing |
| PR-29 | Comms guide: restoration not rebrand | R-P2-06 |
| PR-30 | Physical mono lockup (embroidery/laser) | Not scoped |

---

## 6. Ecosystem dependencies (block full brand RC — not Alpha-only)

| ID | Item | Team | Blocks |
|----|------|------|--------|
| PR-31 | Marker MC-1 z16 device proof | Bravo | G2 · RC2 |
| PR-32 | Kill Ionicons field dialect | Eng | G4-3 |
| PR-33 | Watermark mono stroke D-03 | Delta | CF-12 |
| PR-34 | Zeka eye v2 five states | Delta | G4 |
| PR-35 | Motion splash `presence.pulse` | Charlie | CF-17 |
| PR-36 | Glow `#00D4AA` only grep gate | Eng | G4-4 |

Alpha logo production can start after G0 — **store RC** still blocked until G1–G5.

---

## 7. What IS ready (do not redo)

| Item | Status |
|------|--------|
| B5.3 candidates A/B/C SVG | ✅ Lab complete |
| B5.5 LC-1/2/3 sketch finalists | ✅ Defined |
| B5.3 overlay PNG matrix 24/48/512/1254 | ✅ Generated |
| V6 MEX design spec | ✅ 96 design score |
| V7.1 asset inventory + gate matrix | ✅ Defined |
| Production premium PNG rollback | ✅ Restored (project status) |
| Failure analysis + jury package | ✅ B5.6 complete |

---

## 8. Minimum path to "ready for Alpha asset production"

```
Step 1  Human panel LC-2 vs 1254 (5 reviewers)
Step 2  IoU script ≥0.98
Step 3  Sign RESTORATION_DECISION.md (B or fallback A)
Step 4  Freeze leylek-symbol-master-v2.svg
Step 5  Publish constitution v2 + manifest v2
Step 6  V7.1b sprint BEGIN — export ladder only
```

**Earliest RC1 (brand assets):** ~2 weeks post-G0 PASS (`V7.1/05_PRODUCTION_MIGRATION_SEQUENCE.md`)

---

## 9. Explicitly NOT missing (common false blockers)

| Misconception | Truth |
|---------------|-------|
| "Need new logo design" | ❌ Restoration only — LC-2 not redesign |
| "Need F1 Meridian Wing" | ❌ Forbidden |
| "Need auto-trace" | ❌ Forbidden — manual Bézier from 1254 |
| "Need to change stork to pin" | ❌ Forbidden |
| "Vector must reproduce chrome" | ❌ Silhouette contract; raster hero for material |

---

## 10. Production readiness checklist (sign-off template)

| # | Criterion | PASS |
|---|-----------|------|
| 1 | G0-1 human blink ≥70% | ☐ |
| 2 | G0-2 IoU ≥0.98 | ☐ |
| 3 | LC-2 v2 SVG frozen | ☐ |
| 4 | LC-3 small SVG frozen | ☐ |
| 5 | Constitution v2 published | ☐ |
| 6 | Manifest dual ladder | ☐ |
| 7 | V7.1b analysis approved | ☐ |
| 8 | B5.2 resurrection guard in CI | ☐ |

**All ☐ must be ☑ before V7.1b asset production sprint opens.**

---

**Production readiness: NOT READY**  
**Next gate:** G0 human panel + IoU
