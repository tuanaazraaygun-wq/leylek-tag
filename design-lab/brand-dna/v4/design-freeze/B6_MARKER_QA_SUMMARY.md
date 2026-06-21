# B6 — Marker QA Summary

**Sprint:** B6 cross-QA (source: B5)  
**Primary refs:** `brand-identity-production/03_MARKER_PRODUCTION_SPEC.md`, `marker-evolution/PRODUCTION_MARKER_INVENTORY.md`  
**Production code:** `frontend/lib/mapNavMarkers.ts`, `frontend/lib/mapMarkerChrome.tsx`  
**Design-lab:** `brand-identity-production/markers/marker-*.svg` (12 types)

---

## Verdict: **PASS** (design-lab genom) · **FAIL** (production migration)

12 marker SVGs delivered with shared genom. Production uses legacy PNG + Ionicons field markers. Gendered filename remains in production references.

---

## Marker type matrix

| # | Type | B5 SVG | Production asset | Gender / taxi check |
|---|------|--------|------------------|---------------------|
| 1 | Passenger | ✅ marker-01 | `passenger-woman.png` | ⚠️ filename gendered; code neutral |
| 2 | Driver car | ✅ marker-02 | `driver-car.png` | ✅ vehicle-based |
| 3 | Driver motorcycle | ✅ marker-03 | `driver-motor.png` | ✅ vehicle-based |
| 4 | Quick Match | ✅ marker-04 | **none** | ✅ relay arc, not taxi |
| 5 | Trusted driver | ✅ marker-05 | UI overlay only | ✅ warm ring |
| 6 | Trust network | ✅ marker-06 | list UI only | ✅ linked nodes |
| 7 | Destination | ✅ marker-07 | MapDestinationFlagPin | ✅ flag pole, not pin |
| 8 | Pickup | ✅ marker-08 | MapPickupPin | ✅ ring+dot |
| 9 | Journey active | ✅ marker-09 | polyline only | ✅ path pulse |
| 10 | Cluster | ✅ marker-10 | not implemented | ✅ spec ready |
| 11 | Offline driver | ✅ marker-11 | API only | ✅ desaturated |
| 12 | Searching pulse | ✅ marker-12 | DriverOfferScreen rings | ✅ concentric |

---

## Gender-neutral passenger

| Check | B5 design-lab | Production |
|-------|---------------|------------|
| No female silhouette | ✅ round head + neutral torso | ⚠️ PNG unknown / filename implies woman |
| No male silhouette | ✅ | ⚠️ verify on migration |
| App Store 5.1.1 | ✅ spec | ✅ code ignores gender param |
| B6 verdict | **PASS** spec | **FAIL** until B6-5 rename + PNG |

---

## Driver markers

| Check | Result |
|-------|--------|
| Vehicle-based not person | ✅ PASS |
| Not luxury sedan | ✅ PASS spec |
| Not taxi yellow/checker | ✅ PASS |
| Top-down rotation support | ✅ production `Marker.flat` |
| Field map Ionicons split (System B) | ⚠️ P0 brand — unify at B6-5 |

---

## Trust / Quick Match

| Marker | Visual language | Taxi implication |
|--------|-----------------|------------------|
| Trust network | Triangle linked nodes | None |
| Trusted driver | Car + warm ring | None |
| Quick Match | Relay arc | None — not dispatch taxi |

---

## Zoom readability

| Zoom | Requirement | B5 spec | Production PNG |
|------|-------------|---------|----------------|
| Low (≤14) | Silhouette @ 24–32px | ✅ PASS | 32px passenger OK |
| Medium (15–17) | Full genom | ✅ PASS | OK |
| High (≥18) | Premium @ 48px | ✅ PASS | Limited PNG detail |

---

## Dark / white theme

| Theme | B5 spec | Production |
|-------|---------|------------|
| Dark map | Standard genom + cyan halo | ✅ cyan glow wrapper |
| White theme map | +1px stroke, reduced glow | ❌ light PNG bundle missing (B3 GAP-05) |
| Logo DNA alignment | Shared `#00D4AA` | ⚠️ production uses `#22D3EE` glow |

---

## Performance risk

| Risk | Severity | Mitigation |
|------|----------|------------|
| PNG @48 >4KB | P2 | SVG export + optimize |
| `tracksViewChanges` Android | P2 | Static PNG preferred |
| Cluster N-render | P1 | Single sprite (spec ready) |
| Field + PNG dual system | P1 | B6-5 unify |

---

## B6 category score

| Metric | Score |
|--------|-------|
| Design-lab 12-type coverage | 95% |
| Genom spec quality | 90% |
| Gender-neutral spec | 100% |
| Production migration | 15% |
| Light theme markers | 0% |
| **Category readiness** | **78%** |

**Pass/Fail:** **PASS** design-lab · **FAIL** production until B6-5

---

**Parent:** `B6_FINAL_DESIGN_QA_MASTER_REPORT.md`
