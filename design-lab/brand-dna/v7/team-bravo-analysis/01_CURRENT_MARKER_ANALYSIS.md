# V7.2 — Team Bravo: Current Marker Analysis

**Team:** BRAVO — Map Instrument  
**Mode:** Read-only · no production changes  
**Date:** 2026-06-21  
**Goal:** Most readable navigation system while driving — not beautiful markers

---

## Executive summary

Production map identity is **fragmented across three dialects** (B6-5 PNG badges, Ionicons field pins, programmatic nav chrome) with **wrong glow token** (`#22D3EE` vs constitution `#00D4AA`). Of 12 B5.2 marker PNGs exported to `frontend/assets/markers/`, **only three are wired to live maps** (passenger, driver-car, driver-motor). Pickup/destination on journey maps use **Ionicons components**, not exported PNGs. Seven state markers (journey, QM, trust, cluster, offline, searching) are **orphan assets** — present on disk, unused in map components.

**Jury composite:** Markers **43/100 FAIL** · Navigation **41/100 FAIL** · Map @90 km/h **FAIL** (B5.6).

---

## 1. Production inventory vs live usage

| Type | PNG asset | Wired to map? | Live implementation | Screen |
|------|-----------|---------------|---------------------|--------|
| **Passenger** | `passenger-neutral.png` | ✅ | `MapEntityMarkerImage` @32px | LiveMapView, SearchingMapView, PassengerWaitingScreen |
| **Driver car** | `driver-car.png` | ✅ | `MapEntityMarkerImage` @34px | Same + heading rotate in nav |
| **Driver motor** | `driver-motor.png` | ✅ | `MapEntityMarkerImage` @30px | Same |
| **Pickup** | `pickup.png` | ❌ | `MapPickupPin` — Ionicons `navigate` | LeylekTripMapPreview only |
| **Destination** | `destination.png` | ❌ | `MapDestinationFlagPin` — Ionicons `flag` | LiveMapView, SearchingMapView, PassengerWaiting |
| **Journey active** | `journey-active.png` | ❌ | Route polyline only (`#22D3EE`) | LiveMapView |
| **Quick Match** | `quick-match.png` | ❌ | UI chips/API only — **no map marker** | — |
| **Trust network** | `trust-network.png` | ❌ | — | — |
| **Trusted driver** | `trusted-driver.png` | ❌ | `TrustedAddButton` chip — not map pin | LiveMapView overlay |
| **Cluster** | `cluster.png` | ❌ | — | — |
| **Offline driver** | `offline-driver.png` | ❌ | — | — |
| **Searching** | `searching-pulse.png` | ❌ | DriverOffer heat blobs + Ionicons | DriverOfferScreen |

**Source:** `frontend/lib/mapNavMarkers.ts` · grep across `frontend/**/*.tsx` · B5.6 `03_MARKER_JURY.md` · B6-7 device QA plan.

---

## 2. Shared chrome wrapper (all entity PNGs)

`frontend/lib/mapMarkerChrome.tsx` wraps every entity PNG:

| Property | Production value | Constitution target |
|----------|------------------|---------------------|
| Glow color | `#22D3EE` @12–28% | `#00D4AA` @12–22% |
| Glow shape | Circular halo `size+12` | MEX-M arc foot + controlled halo |
| Shadow | Ellipse `size×0.7` @22% black | Optional — not standardized |
| Arc foot (logo DNA) | **Absent** | Required on all MEX-M types |

**Evidence:** `mapMarkerChrome.tsx` lines 8–9, 70–74 · manifest `legacyHorizonGlow: #22D3EE` vs `meridianCyan: #00D4AA`.

---

## 3. Per-type analysis

### Passenger (`passenger-neutral.png` @32px)

| Aspect | Observation |
|--------|-------------|
| Silhouette | Stick figure in circular badge — cyan dot on torso |
| DNA | Partial eye echo; **no arc foot** |
| Anchor | `{0.5, 1}` bottom — correct for feet |
| Recognition @0.5s | **Conditional** — reads "person pin" not LeylekTAG |
| vs B5.5 MK-01 | Lab adds arc foot chassis — production lacks it |
| Gender | Neutral ✅ — replaces woman/man PNGs (B6-5) |

### Driver car (`driver-car.png` @34px)

| Aspect | Observation |
|--------|-------------|
| Silhouette | Top-down rounded rectangle + two window squares in **circle badge** |
| Wedge | **Absent** — MK-03 front wedge not implemented |
| Width @34px display | ~34px circle — motor ~30px — ratio **~1.13× not 1.35×** |
| Rotation | `flat` + bearing in nav mode ✅ |
| Anchor | `{0.5, 0.54}` in nav · `{0.5, 1}` in entity mode — **inconsistent** |
| z16 discrimination | **FAIL** — jury: car/motor merge |

### Driver motorcycle (`driver-motor.png` @30px)

| Aspect | Observation |
|--------|-------------|
| Silhouette | Oval body + two wheel circles in circle badge |
| Jury critique | MK-05 "lollipop on motorbike" at z16 |
| vs car | Similar bounding circle — **form not width** discriminates |
| Recognition @0.5s driving | **FAIL** for many reviewers (B5.6 map test) |

### Pickup (not on live journey map)

| Production path | `MapPickupPin` — cyan circle + Ionicons `navigate` |
|-----------------|------------------------------------------------------|
| Exported PNG | `pickup.png` — ring + dot + stem (closer to spec) **unused** |
| DriverOffer field | Orange/green **Ionicons navigate** circles — third dialect |
| Recognition | Generic Uber-era pin — **not MEX diamond stem** |

### Destination

| Production path | `MapDestinationFlagPin` — pole + Ionicons `flag` |
|-----------------|-----------------------------------------------------|
| Exported PNG | `destination.png` — **unused** |
| Anchor | `{0.15, 0.95}` flag base |
| vs Google | Reads Google-adjacent flag — not pennant-on-stem MK-09 |

### Journey active

| Production | Cyan polyline `#22D3EE` 4–6px — no journey marker PNG on map |
|------------|----------------------------------------------------------------|
| Spec | MK-11 arc path + arrowhead marker |
| Pulse | No `pulse.journey` on route (motion spec ignored) |

### Quick Match

| Production | **Zero map presence** — API + UI only |
|------------|----------------------------------------|
| PNG | `quick-match.png` exists — unwired |
| Jury | **38/100 FAIL** — strategically invisible |
| V6 fix | Ephemeral lock ring 480ms between nodes |

### Trust

| Production | Warm UI chips (`TrustedAddButton`) — **no map ring** |
|------------|------------------------------------------------------|
| PNGs | `trusted-driver.png`, `trust-network.png` — unwired |
| Spec | MK-15 double ring overlay on driver entity |

### Offline

| Production | No faded driver marker state |
|------------|------------------------------|
| PNG | `offline-driver.png` — unwired |

### Searching

| Production | DriverOffer: Ionicons + pulse Views — not MK-19 orbit |
|------------|------------------------------------------------------|
| PNG | `searching-pulse.png` — unwired |
| Passenger search | Text banner only on SearchingMapView |

### Cluster

| Production | **Not implemented** on map |
|------------|----------------------------|
| PNG | `cluster.png` — unwired |

### Navigation (driver immersive)

| Element | Implementation | DNA match |
|---------|----------------|-----------|
| Direction pointer | `DriverNavDirectionPointer` — `#22D3EE` triangles | **FAIL** vs MEX turn wedge |
| Route line | `#22D3EE` bright/dim/hot layers | Should be `#00D4AA` + `#0D1117` outline |
| Self vehicle | PNG in entity mode · Ionicons car/motor on DriverOffer | Split |
| ETA/distance | Glass chips in chrome — not marker-linked | Partial |

---

## 4. Recognition timing (evidence-based estimates)

Method: B5.6 jury @0.4s exposure · V6 T5 projected fail · form analysis @ display px.

| Marker (production) | @0.5s driving | @1s | @2s | Evidence |
|---------------------|---------------|-----|-----|----------|
| Passenger PNG | ⚠️ Generic person | ✅ Person | ✅ Person | Not LeylekTAG-branded |
| Driver car | ⚠️ "Vehicle blob" | ⚠️ Car? | ✅ Car | z16 merge risk |
| Driver motor | ⚠️ "Vehicle blob" | ⚠️ Motor? | ✅ Motor | Same circle container |
| Car vs motor discriminate | ❌ | ⚠️ | ✅ | B5.6 map test FAIL |
| Pickup Ionicons | ✅ Green/orange circle | ✅ Pickup | ✅ | Not brand — fast but wrong |
| Destination flag | ✅ Flag | ✅ Dest | ✅ | Generic nav DNA |
| QM | N/A | N/A | N/A | Missing |
| Trust on map | N/A | N/A | N/A | Missing |
| Field seeking (DriverOffer) | ✅ Dot | ✅ | ✅ | Ionicons — wrong language |

**Standing still @2s:** Most entities readable as generic map icons.  
**90 km/h @0.4s:** Car/motor discrimination **fails** — primary Bravo blocker.

---

## 5. Screen-by-screen marker dialect count

| Screen | Dialects used | Count |
|--------|---------------|-------|
| LiveMapView (journey) | Entity PNG + Ionicons dest + nav pointer + polyline | **4** |
| SearchingMapView | Entity PNG + Ionicons dest | **2** |
| DriverOfferScreen | Ionicons field + Ionicons self + (no B5 PNG on field) | **2–3** |
| PassengerWaitingScreen | Entity PNG + Ionicons dest | **2** |
| LeylekTripMapPreview | PNG + Ionicons pickup + dest | **3** |
| OfferMapScreen | Ionicons circles only | **1 (generic)** |

**B5.6 CF-06:** Dual marker language — **still open** (Ionicons field + PNG entity).

---

## 6. Comparison to design-lab spec

| Spec doc | Production gap |
|----------|----------------|
| `03_MARKER_PRODUCTION_SPEC.md` | 12 types defined · 3 live · 7 orphan PNGs |
| `07_MARKER_GEOMETRY_CONSTITUTION.md` | No arc foot · wrong cyan · circular badge not 48×48 chassis |
| V6 `03_MAP_SYSTEM.md` MEX-M | Not implemented |
| B5.5 MC-1/2/3 | Lab wireframes only |

---

## 7. Key code references

```6:24:frontend/lib/mapNavMarkers.ts
export const NAV_MARKER_IMG = {
  driverCar: require('../assets/markers/driver-car.png'),
  driverMotor: require('../assets/markers/driver-motor.png'),
  passenger: require('../assets/markers/passenger-neutral.png'),
  pickup: require('../assets/markers/pickup.png'),
  // ... 7 more — exported but largely unwired
};
```

```8:31:frontend/lib/mapMarkerChrome.tsx
const CYAN = '#22D3EE';
// MapEntityMarkerImage — circular glow wrapper on all entity PNGs
```

```6762:6771:frontend/components/LiveMapView.tsx
{destinationLocation && (
  <Marker anchor={{ x: 0.15, y: 0.95 }}>
    <MapDestinationFlagPin />  {/* Ionicons — not destination.png */}
  </Marker>
)}
```

---

## 8. Conclusions

1. **Production markers fail readability at speed** because car/motor share circular badge grammar without width wedge discriminator.  
2. **Production markers fail brand** because glow hue, missing arc foot, and Ionicons field dialect break logo genom.  
3. **B6-5 migration created assets without wiring** — half the marker pack is dead code on disk.  
4. **Navigation language is split** between PNG entities, Ionicons pins, and `#22D3EE` route chrome.

**Next:** `02_NAVIGATION_LANGUAGE.md` · `03_MARKER_DNA.md` · G2 device proof before any marker production.

---

**Team Bravo current marker analysis — COMPLETE**  
Evidence-only · production read-only.
