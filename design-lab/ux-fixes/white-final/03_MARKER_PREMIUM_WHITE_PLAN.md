# 03 — Marker Premium White Plan

**Sprint:** WHITE-FINAL-1A (read-only)  
**Assets:** `frontend/assets/markers/*.png` (18 files)  
**Code:** `mapNavMarkers.ts`, `mapMarkerChrome.tsx`, `LiveMapView.tsx`, `index.tsx`

**Note:** No `frontend/design-system/markers/` production module — marker logic lives in `frontend/lib/`. Design specs in `design-lab/brand-dna/v4/marker-evolution/`.

---

## Current production baseline

### PNG inventory (`frontend/assets/markers/`)

| Asset | Role |
|-------|------|
| `driver-car.png`, `driver-motor.png` | Peer / self vehicle |
| `passenger-neutral.png` | Passenger peer (gender-neutral B5.2) |
| `pickup.png`, `destination.png` | Route endpoints |
| `journey-active.png`, `quick-match.png`, `trust-network.png`, `trusted-driver.png` | Context / hub |
| `cluster.png`, `offline-driver.png`, `searching-pulse.png` | Meta states |
| `_backup-pre-b6-5/*` | Legacy backups — do not ship |

### Pixel sizes (`mapNavMarkers.ts`)

```typescript
MARKER_PIXEL = {
  driverCar: 34,
  driverMotor: 30,
  passenger: 32,
}
```

### Runtime scale

- `LiveMapView`: `TripMapMarkerImage` → `MapEntityMarkerImage` with optional `scale` prop.
- `index.tsx`: `peerMapPinScale={1.04}` on passenger/driver live map — **+4% only**.
- Nav immersive driver marker: separate `Marker` + rotation (same PNG sizes).

### Chrome wrapper (`mapMarkerChrome.tsx`)

- `MapEntityMarkerImage`: cyan glow ring `rgba(34,211,238,0.12)`, shadow ellipse `rgba(0,0,0,0.22)`.
- **No theme prop** — optimized for dark map + dark app chrome.
- `MapDestinationFlagPin` / `MapPickupPin`: navy stem (`#101A2B`), cyan accents — read as dark-theme pins on light map.

---

## White theme problem statement

On **Google standard / light map tiles** + **LHS white cockpit**:

| Issue | Cause |
|-------|-------|
| Markers feel small | 30–34 px base; 1.04 scale negligible |
| Low contrast | Dark-silhouette PNG on pale map without light stroke variant |
| Glow muddy | Cyan halo at full opacity clashes with white UI |
| Pin components dark | Flag/pickup vector chrome uses INK navy |

Design-lab strategy already documented: `design-lab/brand-dna/v4/marker-evolution/WHITE_THEME_STRATEGY.md` — **form fixed, token swap**, optional `-light.png` pair.

---

## Premium white plan (phased)

### Phase A — Token-only chrome (no asset overwrite)

**New hook (proposed):** `useMapMarkerTheme()` in `frontend/lib/theme/`

| Token | Dark | Light |
|-------|------|-------|
| `entitySizeScale` | 1.0 | 1.18–1.22 |
| `glowOpacity` | 1.0 | 0.55 |
| `shadowOpacity` | 0.22 | 0.12 |
| `strokeEmphasis` | off | subtle slate ring |

**Files:** `mapMarkerChrome.tsx`, `LiveMapView.tsx` — pass `chromeTone: 'light' | 'dark'`.

**`MARKER_PIXEL` light bump (alternative to scale):**

| Kind | Current | Light proposed |
|------|---------|----------------|
| driverCar | 34 | 40 |
| driverMotor | 30 | 36 |
| passenger | 32 | 38 |

Use **`resolvedTheme`** or **`isScopeLight`** from passenger/driver theme gates — not map tile auto (future).

### Phase B — Light PNG exports (design-lab → production)

Per constitution W-01: **same siluet**, adjusted stroke/fill:

- Export `@2x` pairs: e.g. `driver-car-light.png` OR single PNG with stronger outline (preferred: pair for QA).
- **Do not overwrite** existing dark PNGs — add sibling assets + selector in `mapNavMarkers.ts`.

### Phase C — Map tile coupling (P2)

When app uses light map style, prefer light marker set even if app chrome dark — per WHITE_THEME_STRATEGY § Map tile interaction.

---

## LiveMapView touchpoints

```text
TripMapMarkerImage(source, size=MARKER_PIXEL.*, scale=peerMapPinScale)
MapDestinationFlagPin(compact?)
MapPickupPin(compact?)
```

- Peer marker branch: ~lines 6720–6760 — single place to inject theme scale.
- Searching/waiting maps: `PassengerWaitingScreen`, `SearchingMapView` — same PNG pipeline (grep `getDriverMarkerImage`).

---

## index.tsx

- `peerMapPinScale={1.04}` — candidate to replace with theme-aware `peerMapPinScale={isScopeLight ? 1.18 : 1.04}` (frontend-only P0).
- Destination picker pins: separate Ionicons rings — out of PNG scope but should follow same light stroke rules in P1.

---

## What not to do

- No asset overwrite in WHITE-FINAL patch wave.
- No change to bearing/anchor/rotation (`DRIVER_NAV_ROTATION_OFFSET_DEG`, `DRIVER_NAV_MARKER_ANCHOR`).
- No backend/socket/match logic.

---

## QA matrix (post-patch)

| Scenario | Pass criteria |
|----------|---------------|
| Light theme + in-trip map | Driver/passenger PNG visibly larger; readable at arm's length |
| Dark theme regression | Size unchanged vs today |
| White map + white cockpit | Glow not dirty grey; pin stem visible |
| Android tracksViewChanges | No pin disappear after scale change |
| Nav immersive | Rotation anchor still aligned |

---

## Effort / risk summary

| Phase | Effort | Risk |
|-------|--------|------|
| A — chrome + scale tokens | S | Low — style only |
| B — light PNG pair | M | Medium — asset QA |
| C — map style coupling | M | Medium — dual theme state |

**Recommended first ship:** Phase A + index `peerMapPinScale` gate (no new PNGs).
