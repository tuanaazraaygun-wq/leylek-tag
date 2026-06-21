# V7.2 — Production Readiness (Team Bravo)

**Team:** BRAVO  
**Question:** What is missing before any marker production begins?  
**Rule:** V7.2 asset production **BLOCKED** until dependencies + G2 gates green

---

## 1. Readiness verdict

| Area | Status |
|------|--------|
| Marker design language | 🔴 NOT READY — three dialects in prod |
| MEX-M chassis | 🔴 NOT DEFINED in production assets |
| Alpha dependency | 🟡 G0 logo — parallel but cyan token must lock |
| Device proof | 🔴 ZERO z16 videos |
| Orphan PNG cleanup spec | 🔴 NOT DONE |
| State system | 🔴 7/12 types unwired |
| Navigation unification | 🔴 Ionicons + `#22D3EE` route |

**Verdict: NOT READY** for marker SVG/PNG export.

---

## 2. Hard dependencies (block Bravo export)

| ID | Dependency | Status | Owner |
|----|------------|--------|-------|
| BR-01 | Alpha G0 PASS (brand continuity) | ⏸ PENDING | Alpha |
| BR-02 | `#00D4AA` token lock in design-lab | ✅ Spec · ❌ production code | Alpha + Eng |
| BR-03 | MC-1/2/3 human finalist pick | ⏸ B5.5 unsigned | Brand |
| BR-04 | MEX-M chassis SVG frozen | ❌ | Bravo |
| BR-05 | Pickup vs dest grammar signed | ⏸ | Brand |
| BR-06 | Car/motor width ratio proof sketch | MK-03/MK-05 — lab only | Bravo |

---

## 3. Missing design artifacts (Bravo must create in V7.2b)

| ID | Artifact | Count |
|----|----------|-------|
| BR-07 | Marker master SVG ×12 (MEX-M) | 12 files |
| BR-08 | LOD simplified tier @z≤15 | 12 variants or rules |
| BR-09 | PNG export ladder 24/32/48/64 | ~48 files |
| BR-10 | Pickup/dest beacon components spec | 2 (replace Ionicons) |
| BR-11 | Turn wedge spec linked to car SVG | 1 |
| BR-12 | QM lock ring Lottie/SVG | 1 |
| BR-13 | MK-19 searching pulse spec | 1 animation |
| BR-14 | Marker constitution v2 | 1 doc |
| BR-15 | Manifest marker section v2 | 1 JSON |

**From V7.1 inventory:** B-01…B-27 — **zero produced**.

---

## 4. Missing QA / gates (before production swap)

| Gate | Test | Status |
|------|------|--------|
| G2-1 | z16 car vs motor 90% @0.4s | ❌ NOT RUN |
| G2-2 | z18 pickup vs dest 90% | ❌ NOT RUN |
| G2-3 | Sunlight 1000 nit | ❌ NOT RUN |
| G2-4 | Deuteranopia sim | ❌ NOT RUN |
| G2-5 | QM lock visible 480ms | ❌ NOT RUN |
| G4-3 | No Ionicons field pins grep | ❌ **FAIL today** |
| G4-4 | `#00D4AA` only grep | ❌ **FAIL today** (`#22D3EE` widespread) |

---

## 5. Missing engineering spec (post-export — not V7.2 analysis scope)

| ID | Item | Notes |
|----|------|-------|
| BR-16 | Wire all 12 types to `mapNavMarkers.ts` | Today: 3 wired |
| BR-17 | Replace `MapPickupPin` / `MapDestinationFlagPin` | Ionicons removal |
| BR-18 | `mapMarkerChrome.tsx` token migration | Single MERIDIAN_CYAN |
| BR-19 | Route stroke color migration LiveMapView | Large diff — separate eng sprint |
| BR-20 | DriverOffer field pin swap | DriverOfferScreen |
| BR-21 | Cluster logic | New feature |
| BR-22 | Offline opacity state | Driver presence |
| BR-23 | Android/iOS tracksViewChanges matrix | B6-7 partial |

*V7.2 analysis documents these — does not implement.*

---

## 6. What IS ready (reuse)

| Item | Status |
|------|--------|
| B5.5 MK-01…20 wireframes | ✅ Lab |
| `07_MARKER_GEOMETRY_CONSTITUTION v1` | ✅ Base — needs v2 MEX amend |
| `03_MARKER_PRODUCTION_SPEC` | ✅ 12-type definitions |
| V6 `03_MAP_SYSTEM.md` MEX-M | ✅ Target spec |
| Production anchors car/motor | ✅ `{0.5,0.54}` documented |
| `mapNavMarkers.ts` central registry pattern | ✅ Extend not replace |
| Gender-neutral passenger policy | ✅ Shipped |

---

## 7. Minimum path to "Ready for Bravo asset production"

```
Step 1  Alpha G0 PASS (cyan token + logo DNA locked)
Step 2  Human pick MC-1 + MC-2 + MC-3 finalists
Step 3  Freeze MEX-M chassis SVG template
Step 4  Draw 12 types from template — no stork silhouettes
Step 5  Internal z16/z18 static proof sheet
Step 6  V7.2b export PNG ladder in design-lab only
Step 7  G2 device video BEFORE frontend swap
```

**Parallel:** Navigation language doc (`02`) informs route/pointer migration sprint (Eng) — can follow marker export.

---

## 8. Explicitly NOT blockers (avoid scope creep)

| Item | Note |
|------|------|
| Logo LC-2 SVG export | Alpha — markers derive genom after |
| Website CSS markers | Delta — separate |
| Sonic/haptic | Charlie — after markers exist |
| Full B5.7 jury | After G2–G4 |

---

## 9. Sign-off checklist

| # | Criterion | PASS |
|---|-----------|------|
| 1 | MEX-M template frozen | ☐ |
| 2 | 12 SVG types drawn | ☐ |
| 3 | MC finalists signed | ☐ |
| 4 | z16 static proof | ☐ |
| 5 | G2 video plan scheduled | ☐ |
| 6 | V7.2 analysis approved | ☐ |
| 7 | Alpha G0 green | ☐ |

**All ☐ → V7.2b marker export may open.**

---

**Production readiness: NOT READY**
