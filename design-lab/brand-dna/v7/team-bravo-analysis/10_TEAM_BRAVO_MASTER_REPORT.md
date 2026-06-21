# V7.2 — Team Bravo Master Report

**Sprint:** V7.2 — Team Bravo Map Experience Analysis  
**Team:** BRAVO — Map Instrument  
**Date:** 2026-06-21  
**Mode:** Read-only · production untouched  
**Mission:** Analyze complete LeylekTAG map language before creating any marker

---

## 1. Sprint outcome

Team Bravo completed read-only analysis of production map markers, navigation chrome, zoom/speed/weather visibility, competitor benchmarks, DNA inheritance, state system, and production readiness. **No markers were created. No frontend files modified.**

---

## 2. Deliverables created

| # | File | Contents |
|---|------|----------|
| 01 | `01_CURRENT_MARKER_ANALYSIS.md` | Production inventory · wiring gaps · recognition timing |
| 02 | `02_NAVIGATION_LANGUAGE.md` | Route · pointer · beacons · chips · unified family |
| 03 | `03_MARKER_DNA.md` | Logo arc/eye/premium/trust atoms — not mini logos |
| 04 | `04_MARKER_STATE_SYSTEM.md` | States · transitions · QM/trust gaps |
| 05 | `05_ZOOM_BEHAVIOUR.md` | z13–20 · speed-zoom coupling |
| 06 | `06_REAL_WORLD_VISIBILITY.md` | Dark/light · driving · weather · contrast |
| 07 | `07_COMPETITOR_COMPARISON.md` | Google · Apple · Uber · Bolt · Tesla · etc. |
| 08 | `08_PRODUCTION_READINESS.md` | Pre-export blockers |
| 09 | `09_RISK_REGISTER.md` | P0–P2 Bravo risks |
| 10 | `10_TEAM_BRAVO_MASTER_REPORT.md` | This document |

**Location:** `design-lab/brand-dna/v7/team-bravo-analysis/`

---

## 3. Biggest discovery

**Half the B6-5 marker pack is dead code — and the half that runs fails at highway speed.**

Twelve PNGs were exported to `frontend/assets/markers/`, but **only passenger, driver-car, and driver-motor** appear on live maps. Pickup and destination use **Ionicons components** (`MapPickupPin`, `MapDestinationFlagPin`) instead of exported PNGs. DriverOffer field maps use a **third dialect** (Ionicons + pulse Views). Seven state markers (journey, QM, trust, cluster, offline, searching) exist on disk but have **zero component references**.

Meanwhile, live entity markers share a **`#22D3EE` glow wrapper** (legacy token) with **no logo arc-foot chassis**, inside circular badges that make car and motor **~1.13× width ratio** instead of the required **≥1.35×** — causing B5.6's **90 km/h · 0.4s map test FAIL**.

---

## 4. Biggest readability problem

**Car vs motorcycle discrimination at z15–16 while driving @ 70–90 km/h.**

`zoomTargetForSpeedMps` pulls camera to **z14.8–16.5** at highway speeds — exactly where production markers collapse to **identical glowing circles**. Users get **0.4s** to decide vehicle type; jury evidence says they **guess** (B5.6 map test narrative). Glow cannot fix identical bounding boxes.

Secondary: **pickup vs destination** relies on Ionicons grammar that fails **deuteranopia** (color-only field pins on DriverOffer).

---

## 5. Why production markers fail

| # | Cause | Evidence |
|---|-------|----------|
| 1 | **Wrong design grammar** — circular glow badges, not MEX-M arc-foot instruments | `mapMarkerChrome.tsx` · no arc foot in PNG art |
| 2 | **Wrong cyan token** — `#22D3EE` not `#00D4AA` | manifest · routes · pointer · chrome |
| 3 | **Three dialects** — PNG entity · Ionicons field · neon pointer | B5.6 nav 41/100 · CF-06 |
| 4 | **Car/motor form** — no wedge width discriminator | Jury z16 FAIL · MARKER_PIXEL 34 vs 30 in circles |
| 5 | **Incomplete migration** — 9/12 types unwired | grep: no quick-match/trust/cluster usage |
| 6 | **QM absent on map** | Jury 38/100 |
| 7 | **Shipped before identity + device proof** | B6-5 before G2 · CF-09 pattern |
| 8 | **Glow substitutes for geometry** | Sunlight T8 FAIL · "Uber 2018" risk |

**Composite:** Markers **43/100 FAIL** (B5.6).

---

## 6. What absolutely must NEVER happen

| # | Rule |
|---|------|
| 1 | **Never** put stork/logo silhouette on map markers |
| 2 | **Never** ship car/motor markers with identical circular bounding grammar |
| 3 | **Never** use `#22D3EE` on new map/nav assets |
| 4 | **Never** keep Ionicons field pins alongside PNG journey markers (dual language) |
| 5 | **Never** rely on glow alone for @0.4s highway readability |
| 6 | **Never** export markers without **G2 z16 video proof** |
| 7 | **Never** treat DriverOffer field and LiveMapView as separate visual systems |
| 8 | **Never** increase glow to "fix" failed discrimination |
| 9 | **Never** ship QM without map lock ring (strategic invisible = fail) |
| 10 | **Never** wire orphan PNGs without MEX-M chassis redesign |

---

## 7. What can safely evolve (within MEX)

| Element | Bounds |
|---------|--------|
| Display px | Car 34 · motor 30 · passenger 32 — tune ±2 if ratio holds |
| Glow | `#00D4AA` 12–22% only |
| Arc foot stroke | 2–3px @48 |
| LOD simplification | @ z≤15 hide legs/detail |
| Trust ring | `#C8E6D0` @20% overlay |
| QM lock | 480ms ephemeral ring |
| Cluster count | Integer ≥2px stroke |
| Route outline | +1px `#0D1117` on satellite |

---

## 8. Recommended next sprint

### Sprint: **V7.2b Marker Asset Production** (after Alpha G0 + MC sign-off)

| Week | Action | Gate |
|------|--------|------|
| **W0** | Human pick MC-1/2/3 finalists · freeze MEX-M template | Design sign-off |
| **W1** | SVG ×12 from template · turn wedge linked to car | Internal review |
| **W1** | Static z15/z16/z18 proof sheet | Pre-export |
| **W2** | PNG ladder 24–64 in design-lab only | — |
| **W2** | G2 device video suite (5 drivers · 90/50/30 km/h) | G2-1…G2-5 |
| **W3** | Eng swap: mapNavMarkers + retire Ionicons + token migration | G4-3 · G4-4 |
| **W3** | Route/pointer color sprint (separate PR) | Nav unity |

**Do not** start V7.2b until Alpha **G0 PASS** (cyan genom locked).

**Do not** swap `frontend/assets/markers/` until **G2 video PASS**.

---

## 9. Evidence sources read

1. `design-lab/brand-dna/v7/team-alpha-analysis/`  
2. `design-lab/brand-dna/v7/experience-asset-lab/`  
3. `design-lab/brand-dna/v6/master-experience-studio/03_MAP_SYSTEM.md` · `04_NAVIGATION_SYSTEM.md`  
4. B5.6 `03_MARKER_JURY.md` · `06_NAVIGATION_JURY.md` · `11_CRITICAL_FAILURES.md`  
5. B5.5 `03_MARKER_BOARD.md` · `06_FINALISTS.md`  
6. `brand-identity-production/03_MARKER_PRODUCTION_SPEC.md` · `07_MARKER_GEOMETRY_CONSTITUTION.md`  
7. `frontend/lib/mapNavMarkers.ts` · `frontend/lib/mapMarkerChrome.tsx`  
8. `frontend/components/LiveMapView.tsx` · `SearchingMapView.tsx` · `DriverOfferScreen.tsx`  
9. `frontend/assets/markers/*.png` (visual inspection)

---

## 10. Sign-off template

| Role | Name | Date | Approved |
|------|------|------|----------|
| Map UX lead | | | ☐ |
| Brand | | | ☐ |
| Product | | | ☐ |
| Echo / QA | | | ☐ |

**Approving schedules G2 test plan — not marker export.**

---

## Final statement

LeylekTAG's map language today optimizes for **glow aesthetics at rest**, not **form discrimination at speed**. The path forward is V6 **MEX-M**: shared arc-foot chassis, meridian cyan, wedge-vs-narrow vehicles, unified pickup/dest beacons, and device-proven z16 discrimination — **not** more PNG badges with halos.

---

**TEAM BRAVO ANALYSIS COMPLETE**  
**Production untouched.**  
**Ready for Team Bravo Asset Production** *(pending Alpha G0 + G2 proof plan)*.
