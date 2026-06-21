# UX-P1-NAV-1A — Navigation Arrow Current Flow

**Sprint:** UX-P1-NAV-1A  
**Mode:** Read-only analysis  
**Date:** 2026-06-21  
**Scope:** Driver immersive navigation direction arrow (Yolcuya Git / Hedefe Git)

---

## Executive summary

The **driver navigation direction arrow** (neon cyan pointer at the vehicle position) is **not** a screen `absolute` overlay. It is a **custom React Native view inside a `react-native-maps` `Marker`** (`flat` + `rotation`), pinned to the driver GPS coordinate. Its on-screen vertical position is controlled indirectly by:

1. **`mapPadding.bottom`** — reserves lower screen space so the padded map center sits higher
2. **Camera look-ahead** — camera center is offset forward along the route; GPS sits “behind” center → arrow appears in the lower half
3. **Marker `anchor`** — `{ x: 0.5, y: 0.5 }` (center of 52×52 px widget at GPS)
4. **Internal arrow geometry** — `arrowWrap.top: 4` places the arrow head above the core dot within the marker view

If the arrow reads **too high**, the most likely cause is **miscalibration between `mapPadding` constants and the 52 px marker**, not missing route logic. The constant `DRIVER_NAV_OVERLAY_ABOVE_BOTTOM_DP = 112` was named for an older “overlay” model; comments still reference overlay positioning while the implementation uses a map marker.

---

## Which arrow is which?

| UI element | Component | Position model | User complaint target? |
|------------|-----------|----------------|------------------------|
| **Neon direction pointer** (vehicle puck) | `DriverNavDirectionPointer` | Map `Marker` at GPS | **Yes — primary target** |
| Turn-by-turn maneuver icon | `NavManeuverArrowIcon` | `absolute` top banner (`navManeuverBanner`) | No — top banner is intentional |
| Legacy PNG driver car (non-nav) | `TripMapMarkerImage` + `NAV_MARKER_IMG` | Map `Marker`, hidden when `driverNavActive` | No |
| `InAppNavigation.tsx` modal | Separate full-screen modal | Not wired into current `LiveMapView` flow | Out of scope |

---

## Activation path

```
Driver taps "Yolcuya Git" / enters navigation
  → LiveMapView: navigationMode = true
  → driverNavImmersive = isDriver && navigationMode
  → MapView: mapPadding immersive branch
  → Marker: DriverNavDirectionPointer @ navMapVehicleCoordResolved
  → useEffect: camera heading + pitch + look-ahead (lines ~3582–3745)
```

**State / props (LiveMapView.tsx):**

| Symbol | Role |
|--------|------|
| `navigationMode` | Local state; toggles immersive nav |
| `driverNavImmersive` | Alias: `isDriver && navigationMode` |
| `navigationStage` | `'pickup'` \| `'destination'` — route polyline + banner copy |
| `driverNavRouteHeadingDeg` | Smoothed route bearing for marker rotation |
| `navMapVehicleCoordResolved` | Snapped GPS for marker (stable ref fallback) |
| `navMapVehicleRotation` | `driverNavRouteHeadingDeg + getDriverNavRotationOffsetDeg(...)` (180° offset) |

**index.tsx:** Passes `LiveMapView` with `isDriver={true}` and trip coords. No arrow-specific props; navigation is fully internal to `LiveMapView`.

---

## Rendering — `DriverNavDirectionPointer`

**File:** `frontend/components/LiveMapView.tsx` (lines ~97–182, ~6697–6707)

```tsx
<Marker
  coordinate={navMapVehicleCoordResolved}
  flat
  rotation={navMapVehicleRotation}
  anchor={{ x: 0.5, y: 0.5 }}
  zIndex={6000}
  tracksViewChanges={false}
>
  <DriverNavDirectionPointer />
</Marker>
```

**Structure (all relative inside 52×52 root):**

| Layer | Style | Notes |
|-------|-------|-------|
| `root` | 52×52, centered | `NAV_IMMERSIVE_POINTER_PX` |
| `glowOuter` | 48×48 absolute | Halo |
| `glowMid` | 30×30 absolute | Mid glow |
| `arrowWrap` | `position: 'absolute', top: 4` | Arrow sits **above** vertical center |
| `arrowHead` | CSS triangle, 12+12×22 | Points **up** in marker-local space |
| `arrowStem` | 9×8 | Below head |
| `coreRing` + `coreDot` | 16×16 centered in root | “Vehicle hub” at marker center |

**Rotation:** `flat` + `rotation` rotates the entire custom view with map bearing. `getDriverNavRotationOffsetDeg` adds 180° so the arrow’s local “up” aligns with travel direction (see `mapNavMarkers.ts`).

---

## Vertical position — why it appears “too high”

### 1. Map marker at GPS (not screen-fixed)

The pointer is **not** `position: 'absolute'` on the screen. It moves with the map. The design intent (comment ~3578–3580) describes a fixed overlay, but **current code uses a Marker**. Vertical placement on screen = f(camera, padding, GPS, look-ahead).

### 2. `mapPadding` (immersive branch)

```tsx
mapPadding={
  driverNavImmersive ? {
    top: driverNavImmersiveMapPaddingTopPx,   // insets.top + 118
    bottom: driverNavImmersiveMapPaddingBottomPx(insets.bottom),
    ...
  } : ...
}
```

**Bottom padding formula (lines ~74–81):**

```ts
const raw =
  DRIVER_NAV_OVERLAY_ABOVE_BOTTOM_DP +  // 112
  (NAV_IMMERSIVE_POINTER_PX * 0.5) +    // 26
  Math.max(insetsBottom, 0) + 10;
return clamp(raw, 96, 210);
```

Larger `bottom` padding → Google Maps places the camera target higher in the **padded** viewport → vehicle marker tends to sit **lower** on the physical screen (standard nav-app pattern).

If the arrow feels too high, **`bottom` padding is likely too small** for current device sizes / bottom chrome, or **`NAV_IMMERSIVE_POINTER_PX` half (26) underestimates** visual extent after arrow `top: 4` and 22 px head.

### 3. Camera look-ahead

`computeNavCameraCenterFromLookAhead` / `offsetCameraCenterForward` move the camera center **forward** along the route (~214–292 m). The GPS marker trails behind that center along inverse heading, which pushes the puck toward the **lower** screen area when heading-up.

Comment at line ~2019: forward offset was tuned (`forwardM *= 1.04`) because the road line sat under the icon — evidence of ongoing vertical calibration debt.

### 4. Internal arrow bias

`arrowWrap.top: 4` shifts the arrow **upward** within the 52 px box. The core dot is centered, but the visible “direction” mass sits above center → reads higher than a typical nav puck.

---

## Platform behavior

| Platform | Arrow implementation | Platform-specific styling |
|----------|---------------------|---------------------------|
| **iOS** | Same Marker + custom view | `shadowColor` on glow |
| **Android** | Same Marker + custom view | `elevation: 6` on glow |
| **Web** | Early return — no MapView | Arrow not shown |

No `Platform.OS` branch for arrow **position**; iOS and Android share the same logic. Any “only on one platform” report likely comes from **safe-area / inset differences** (`insets.bottom` in padding) or Google Maps padding interpretation, not separate arrow code paths.

---

## Related files (read, not primary)

| File | Relevance |
|------|-----------|
| `frontend/lib/mapNavMarkers.ts` | PNG markers + `DRIVER_NAV_ROTATION_OFFSET_DEG` (180°); used for rotation offset, not the neon pointer geometry |
| `frontend/components/InAppNavigation.tsx` | Legacy/alternate modal nav — not the immersive map arrow |
| `frontend/components/SearchingMapView.tsx` | No nav pointer |
| `frontend/app/index.tsx` | Mounts `LiveMapView`; no arrow layout |

---

## Data / route logic coupling

**Does not affect arrow drawing:**

- OSRM / polyline fetch, traffic tint, maneuver TTS
- `bearingAlongRouteAheadDeg`, smoothing constants
- Socket GPS updates → `navMapVehicleCoordResolved`

**Does affect where the arrow appears on screen (not route geometry):**

- `mapPadding` values
- Camera look-ahead meters
- Marker `anchor`
- Pointer pixel size / internal layout

Route polylines and turn-by-turn instructions are independent of pointer styles.

---

## Maneuver banner (separate, top of screen)

When `driverNavImmersive`, an **absolute top banner** shows stage + `NavManeuverArrowIcon` (44 px). Styles: `navManeuverBanner` → `position: 'absolute', top: 0, zIndex: 100`. This is **supposed** to be at the top; do not conflate with the vehicle direction pointer.
