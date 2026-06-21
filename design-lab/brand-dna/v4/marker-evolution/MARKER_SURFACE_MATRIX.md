# Marker Surface Matrix

**Sprint:** B-2 — Patch B2-1 companion  
**Mode:** Read-only mapping  
**Date:** 2026-06-21

---

## Component → marker type → asset

| Component | Marker type(s) | Current implementation | Target (post B-8) |
|-----------|----------------|------------------------|-------------------|
| `LiveMapView.tsx` | Passenger, Driver car/motor, Destination | PNG A + MapDestinationFlagPin | PNG genom + MeridianDestinationPin |
| `PassengerWaitingScreen.tsx` | Passenger, Drivers, Destination | PNG A + flag | Same unified |
| `SearchingMapView.tsx` | Passenger, Drivers, Destination | PNG A | Same unified |
| `DriverOfferScreen.tsx` | Driver self, Seeking, Light, Heat | View B icons | PNG A + overlays |
| `OfferMapScreen.tsx` | User, Pickup, Dropoff, Items | Generic circles | MapPickupPin + Meridian pins |
| `app/index.tsx` | Destination picker | Cyan circle B | MeridianDestinationPin |
| `LeylekTripMapPreview.tsx` | Driver, Passenger, Pickup, Dest | PNG A + chrome | Unified |
| `DriverRequestMap.tsx` | Request markers | Colored circles | Out of scope v1 / retire |
| `real-city-map.tsx` (web) | District, heat, light | CSS C | Token sync only |
| `intercity-real-map.tsx` (web) | Endpoint | CSS C | Token sync only |

---

## Marker type → primary files (migration)

| Type | Production files to change (B-8) |
|------|----------------------------------|
| Passenger | `mapNavMarkers.ts`, `assets/markers/passenger-woman.png`, `mapMarkerChrome.tsx` |
| Driver car | `driver-car.png`, `DriverOfferScreen` driverMarker |
| Motorcycle | `driver-motor.png`, `DriverOfferScreen` isMotor branch |
| Quick Match | `LiveMapView` conditional overlay (new) |
| Trusted | `LiveMapView` + `mapMarkerChrome` trust ring |
| Destination | `mapMarkerChrome.tsx`, `index.tsx` styles |
| Pickup | `mapMarkerChrome.tsx`, `OfferMapScreen.tsx` |
| Journey | `LiveMapView.tsx` polyline stroke constants |
| Cluster | New module + `DriverOfferScreen` |
| Offline | `MapEntityMarkerImage` opacity |
| Searching | `DriverOfferScreen.tsx` seeking styles → PNG overlay |

---

## Shared chrome API (B-5 target)

```typescript
// Spec only — not implemented
MapEntityMarkerImage({
  source, size, scale,
  glowTone: 'dark' | 'light',
  stateOverlay?: 'qm' | 'trust' | 'offline' | 'seeking-listed' | 'seeking-near',
  breathe?: boolean,
})
```

---

**İlişkili:** `PRODUCTION_MARKER_INVENTORY.md`, `MARKER_EVOLUTION_MASTER_ANALYSIS.md` §11
