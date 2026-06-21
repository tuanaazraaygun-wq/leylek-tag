# Map Behavior Analysis

**Sprint:** B-2 — Marker Evolution  
**Mode:** Read-only  
**Date:** 2026-06-21

---

## Executive summary

Harita marker davranışı **platform (RN Maps vs Leaflet)**, **ekran (trip vs field)**, ve **zoom LOD** ile üçe ayrılır. Yoğun şehir senaryosunda DriverOfferScreen LOD filtreleri var; görsel cluster yok. Gece/gündüz harita tile farkı marker kontrastını etkiler — marker dark-primary optimize.

---

## Zoom seviyeleri

### Mobile — DriverOfferScreen field map

| Band | Delta threshold | Marker behavior |
|------|-----------------|-----------------|
| `near` | `< FIELD_ZOOM_NEAR_MAX_DELTA` | All seeking, all light (capped), heat top-N |
| `mid` | `< FIELD_ZOOM_MID_MAX_DELTA` | Seeking listed only; light top distance cap |
| `far` | else | Seeking/light hidden; heat full grid |

Heat visual scales with band (`resolveFieldHeatZoomPresence`: size 0.86–1.2, alpha 0.58–0.94).

### Mobile — LiveMapView trip

Fixed pixel markers (32–34 px) — **do not scale with zoom**. Relative screen size shrinks as user zooms out — MARKER_DNA ≤14: core siluet only (glow should reduce — **not implemented**).

### MARKER_DNA target zoom table

| Zoom | Target |
|------|--------|
| ≤ 14 | Core siluet; minimal glow |
| 15–17 | Full marker + direction |
| ≥ 18 | Glow + trail + state ring |

**Gap:** No `onRegionChange` glow reduction in LiveMapView.

### Website — Leaflet marketing maps

District markers with labels — zoom via map container, CSS pulse. Heat zones size prop in HTML. Not operational app.

---

## Overlap

| Scenario | Mevcut | Risk |
|----------|--------|------|
| Passenger + pickup same coord | Single passenger PNG | OK |
| Multiple drivers waiting | Up to `WAIT_MAP_MAX_DRIVER_MARKERS` | Overlap stack |
| Seeking pins dense | No offset — full overlap | P1 Ankara |
| Destination + route line | zIndex 3000 flag | OK |
| Leylek Zeka FAB + Google watermark | Layout offset only | OK |

**Hedef:** Spiral offset or cluster (Marker 10) for 3+ same cell.

---

## Clustering

| System | Status |
|--------|--------|
| Visual cluster badge | ❌ Not implemented |
| LOD filter / cap | ✅ DriverOfferScreen |
| Server-side thinning | Unknown — client caps only |

---

## Yoğun şehir (Ankara vb.)

- Field map: mid zoom hides unlisted seeking — reduces noise.
- Trip waiting: driver marker cap — good.
- Heat cells: near zoom top intensity slice — good.
- **Gap:** Listed seeking at near zoom — unlimited count → overlap storm.

---

## Küçük ilçe / kırsal

- Far zoom: only heat grid — seeking invisible (driver may miss sparse demand visual).
- Low driver density: PNG markers sufficient.
- Network latency: marker position stale >10s — `LeylekTripLiveRideChrome` hint, not marker style.

---

## Gece / gündüz

| Factor | Effect |
|--------|--------|
| Google dark map tiles | Production default — markers designed dark |
| Day map (rare) | Cyan glow lower contrast — white theme strategy needed |
| OLED black | Void shadows OK |
| Website | Always dark marketing aesthetic |

Marker evolution **must** test on both Google dark and standard light map styles before white app theme.

---

## Platform split

| Platform | Map engine | Marker render |
|----------|------------|---------------|
| iOS/Android app | react-native-maps Google | View children + PNG Image |
| Web app fallback | No map / placeholder | Ionicons |
| Website | Leaflet divIcon | CSS HTML markers |

Evolution PNG exports serve mobile first; website marketing markers separate track (CSS sync tokens only).

---

## Sorunlar özeti

| ID | Sorun | Severity |
|----|-------|----------|
| MAP-01 | No zoom-adaptive glow LiveMapView | P2 |
| MAP-02 | No visual cluster dense urban | P1 |
| MAP-03 | Field vs trip marker language split | P0 |
| MAP-04 | Fixed px markers zoom out tiny | P2 |

---

## Migration implications

1. Unified marker chrome across trip + field before cluster work.
2. Cluster pilot on DriverOfferScreen seeking layer.
3. Optional `MapMarkerZoomPolicy` hook — glow scale by latitudeDelta.

---

**İlişkili:** `markers/MARKER_10_CLUSTER.md`, `PERFORMANCE_ANALYSIS.md`
