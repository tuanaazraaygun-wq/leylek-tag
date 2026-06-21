# B3-6 Map / Journey Analysis

**Group:** 5 — Map / Journey  
**Patch:** B3-6g (late — after shells)

---

## Scope

- `LiveMapView.tsx` (~118 color refs)
- `SearchingMapView.tsx`
- `mapNavMarkers.ts`, `mapMarkerChrome.tsx`
- `LeylekTripLiveRideChrome.tsx`
- Pickup/dropoff overlays in index + waiting screens
- Driver/passenger entity markers (PNG)

---

## Current hardcoded colors

| Layer | Examples |
|-------|----------|
| LiveMapView | `#0F172A` sheets, cyan route, white pill labels |
| Map overlays | rgba scrims, bottom card borders |
| Nav markers | PNG paths — **no theme dimension** |
| mapMarkerChrome | Ionicons tint, halo rgba |
| Google Maps style | Default (not custom JSON yet) |

---

## LHIS primitives

**Weak** — LiveMapView is monolithic; limited GlassSurface adoption. Most styling inline StyleSheet.

---

## Risk: **P0 (highest)** | Complexity: **Critical**

| Risk | Why |
|------|-----|
| Marker visibility | Dark PNG on light map fails |
| Overlay contrast | White text on white sheet |
| Performance | Re-render on theme toggle mid-ride |
| Regression | fitToCoordinates, marker anchor math |

**Cross-ref:** `design-lab/brand-dna/v4/marker-evolution/WHITE_THEME_STRATEGY.md`

---

## Tokens needed

| Token | Use |
|-------|-----|
| `tokens.map.overlay.scrim` | Full-screen dim |
| `tokens.map.sheet.bg` | Bottom journey card |
| `tokens.map.route.active` | Polyline accent |
| `tokens.map.pill.*` | ETA / status pills |
| `tokens.marker.*` | Resolve PNG set by theme |
| `tokens.text.inverse` | Labels on map pills |

---

## Migrate first

1. Bottom sheet chrome in LiveMapView (not markers)
2. Journey status card surfaces
3. `mapMarkerChrome.tsx` tint → tokens
4. `mapNavMarkers.ts` — add `themeMode` param → light PNG paths
5. Entity markers (car/human/motor) — asset pipeline
6. Map style JSON (optional phase — out of B3-6 scope if not present)

---

## Files affected

```
frontend/components/LiveMapView.tsx
frontend/components/SearchingMapView.tsx
frontend/lib/mapNavMarkers.ts
frontend/lib/mapMarkerChrome.tsx
frontend/components/LeylekTripLiveRideChrome.tsx
frontend/components/PassengerWaitingScreen.tsx (map overlay sections)
frontend/components/DriverOfferScreen.tsx (field map section)
```

---

## Must NOT change

- Marker coordinate math, anchor points
- Route polyline decoding
- Camera animation timing
- Driver/passenger location subscription
- Pickup/dropoff pin logic

---

## QA

| ID | Test |
|----|------|
| QA-6g-01 | Active ride map dark regression |
| QA-6g-02 | Light map — all marker types visible |
| QA-6g-03 | Bottom sheet text WCAG AA |
| QA-6g-04 | Theme toggle mid-ride (no crash) |
| QA-6g-05 | Searching state passenger |

---

## Rollback

**Do not enable map in screen flag until marker assets ship.** Rollback = remove `map` from flag + revert LiveMapView diff.

---

## Blockers

- Light marker PNG exports (marker-evolution)
- Logo on map callout (logo-evolution light variant)
