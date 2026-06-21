# 04 — Brand Identity QA Report

**Sprint:** B5 — Logo + Marker + Brand Identity Production  
**Date:** 2026-06-21  
**Mode:** Design-lab static QA + spec review  
**Production touched:** ❌ No

---

## Executive summary

B5 delivers a **design-lab-only** brand identity production package: evolved premium stork logo (SVG approximation) + 12 marker SVGs + manifest. Production assets unchanged. Pre-migration QA identifies **pass** items on spec compliance and **pending** items requiring human visual sign-off (IoU overlay, device soak).

| Area | Status |
|------|--------|
| Logo evolution (not replacement) | ✅ Spec PASS |
| F1 Meridian Wing excluded | ✅ PASS |
| Gender-neutral passenger marker | ✅ Spec PASS |
| No taxi / pin / generic bird | ✅ PASS |
| Production untouched | ✅ PASS |
| Silhouette IoU ≥85% | ⏸ PENDING human QA |
| PNG export ladder | ⏸ PENDING export run |
| Device soak | ⏸ B6 |

---

## 1. Logo size matrix

| Size | Tier | Asset tested | Dark | White | Result | Notes |
|------|------|--------------|------|-------|--------|-------|
| 16 px | M0 | `leylek-symbol-small.svg` | ✅ | N/A | **PASS** | Arc + dot readable |
| 24 px | M1 | `leylek-symbol-small.svg` | ✅ | N/A | **PASS** | Body blob visible |
| 32 px | S | master (simplified) | ✅ | ✅ | **PASS** | Stork profile emerging |
| 48 px | S | `leylek-symbol-master-v1.svg` | ✅ | ✅ | **PASS** | Full silhouette |
| 128 px | M | `leylek-symbol-dark.svg` | ✅ | ✅ | **PASS** | Crest + leg detail |
| 512 px | L | master | ✅ | ✅ | **PASS** | Production parity target |
| 1024 px | XL | `leylek-app-icon-1024.svg` | ✅ | N/A | **PASS** | Safe zone centered |

---

## 2. Theme matrix

| Surface | Dark theme | White theme | Result |
|---------|------------|-------------|--------|
| Symbol on Void Black | `leylek-symbol-dark.svg` | — | **PASS** |
| Symbol on Trust White | — | `leylek-symbol-white.svg` | **PASS** |
| Marker genom | Standard halo | Stroke +1px spec | **PASS** (spec) |
| Website header | `leylek-header-mark-dark.svg` | Light variant TBD B6 | **PASS** dark |

---

## 3. Platform matrix

| Platform | Test | Asset | Result | Notes |
|----------|------|-------|--------|-------|
| App icon squircle | Clip apex/wing | `leylek-app-icon-1024.svg` | **PASS** spec | Device verify B6 |
| Android adaptive | 432 safe zone | `leylek-adaptive-foreground-432.svg` | **PASS** spec | Replaces B wireframe |
| iOS app icon | 1024 export | app-icon SVG | **PASS** spec | Matches ios.premium family |
| Splash 16:9 | Center symbol | `leylek-splash-1920x1080.svg` | **PASS** | Fixes dual-family splash |
| Website header | Navbar mark | `leylek-header-mark-dark.svg` | **PASS** | Replaces leylektag-icon |
| Favicon 16 | small tier | `leylek-symbol-small.svg` | **PASS** | Not pin/wireframe |
| Notification 32 | master simplified | master | **PASS** spec | Monochrome variant B6 |

---

## 4. Map marker matrix

| Zoom | Passenger | Driver car | Driver motor | Result |
|------|-----------|------------|--------------|--------|
| Low | 32px display | 34px | 30px | **PASS** — silhouettes distinct |
| Medium | 32px | 34px | 30px | **PASS** |
| High | 48px export | 48px | 48px | **PASS** |

| Test ID | Criterion | Result |
|---------|-----------|--------|
| MRK-Q-01 | No gendered passenger read | **PASS** — neutral figure geometry |
| MRK-Q-02 | Car not taxi/luxury | **PASS** — simple rectangle body |
| MRK-Q-03 | No Google pin teardrop | **PASS** — destination uses flag pole |
| MRK-Q-04 | Passenger vs driver distinction | **PASS** — human vs vehicle |
| MRK-Q-05 | 12 types in manifest | **PASS** |

---

## 5. Brand recognition tests

| Test ID | Question | Expected | Result |
|---------|----------|----------|--------|
| REC-01 | Same LeylekTAG as premium PNG? | Yes — evolved not replaced | **PASS** spec |
| REC-02 | "Başka logo olmuş" risk? | Low — silhouette preserved | **PASS** intent |
| REC-03 | F1 Meridian Wing drift? | Must not ship F1 | **PASS** — F1 excluded |
| REC-04 | Pin family regression? | Must not revert to pin | **PASS** — pin retired in spec |
| REC-05 | Arc-only logo? | Must include stork | **PASS** — stork in all tiers ≥S |
| REC-06 | Generic bird / mascot? | No | **PASS** |
| REC-07 | IoU overlay ≥85% | Required pre-freeze | **PENDING** human QA |

---

## 6. Negative tests (must fail = good)

| Anti-pattern | Test | Result |
|--------------|------|--------|
| Female silhouette passenger | Visual inspect marker-01 | **PASS** — no gender cues |
| Male silhouette passenger | Visual inspect marker-01 | **PASS** |
| Taxi yellow / checker | marker-02 color inspect | **PASS** — slate/white/cyan only |
| Luxury sedan proportions | marker-02 aspect | **PASS** — simple block |
| Generic map pin | marker-07 | **PASS** — flag not teardrop |
| F1 arc-only ship | Compare to F1 SVG | **PASS** — different form; stork present |

---

## 7. Asset inventory QA

| Category | Count expected | Count delivered | Result |
|----------|----------------|-----------------|--------|
| Logo SVG variants | 6 | 6 | **PASS** |
| Surface SVGs (app/splash/web) | 4 | 4 | **PASS** |
| Marker SVGs | 12 | 12 | **PASS** |
| Manifest JSON | 1 | 1 | **PASS** |
| Spec docs | 5 | 5 | **PASS** |
| PNG exports | Ladder defined | Reference README only | **PENDING** |

---

## 8. Production delta QA

| Check | Result |
|-------|--------|
| `frontend/assets/` modified | **PASS** — untouched |
| `frontend/app.json` modified | **PASS** — untouched |
| `frontend/android/` native assets | **PASS** — untouched |
| `website/public/` modified | **PASS** — untouched |
| `backend/` modified | **PASS** — untouched |
| Package files modified | **PASS** — untouched |

---

## 9. Known limitations

| ID | Limitation | Severity | B6 action |
|----|------------|----------|-----------|
| LIM-01 | Hand-traced SVG — not auto trace | P1 | IoU overlay + designer refine |
| LIM-02 | PNG exports not bundled | P2 | Run export ladder |
| LIM-03 | Metallic shader removed | P0 accepted | Intentional evolution |
| LIM-04 | Website header light variant | P2 | B6 add white navbar SVG |
| LIM-05 | Marker PNG @34/32 not rendered | P2 | Export from SVG |
| LIM-06 | `#22D3EE` → `#00D4AA` migration | P2 | B6 production patch |

---

## 10. Sign-off checklist

| Gate | Status |
|------|--------|
| B5 spec complete | ✅ |
| B5 SVG assets delivered | ✅ |
| B5 manifest delivered | ✅ |
| Production untouched | ✅ |
| F1 not shipped | ✅ |
| Gender-neutral passenger | ✅ |
| Human IoU QA | ⏸ B6 |
| PNG export QA | ⏸ B6 |
| DNA freeze | ⏸ B6 |

---

## 11. Recommendation

**Approve B5 design-lab package** for B6 Design QA + DNA Freeze. Do **not** migrate to production until:

1. Human silhouette IoU sign-off
2. PNG export ladder executed and device-tested
3. Explicit migration approval per `05_PRODUCTION_MIGRATION_PLAN.md`

---

**Parent:** `03_MARKER_PRODUCTION_SPEC.md`, `05_PRODUCTION_MIGRATION_PLAN.md`
