# UX-P1-NAV-1B — Navigation Arrow Patch Plan (proposed)

**Sprint:** UX-P1-NAV-1A analysis → UX-P1-NAV-1B implementation  
**Target file:** `frontend/components/LiveMapView.tsx` only (minimal hotfix)  
**Goal:** Move neon nav pointer ~**15% screen height lower**; make it **slightly larger**  
**Constraint:** No route/socket/backend changes; IBAN/payment/QR untouched

---

## Recommended approach (single file, two coordinated edits)

Use **Option A + Option B together** — they solve different parts of “too high”:

| Option | What moves | Route logic impact |
|--------|------------|-------------------|
| **A — Marker anchor** | Visual puck vs GPS pin | **None** (safest) |
| **B — Bottom mapPadding bump** | Camera framing in padded viewport | **None** on polyline; minor camera framing |
| **C — Pointer scale** | Size only | **None** if `NAV_IMMERSIVE_POINTER_PX` kept in sync |

Avoid changing `offsetCameraCenterForward` / look-ahead constants in the first pass — those affect all camera follow behavior and are harder to QA.

---

## Patch 1 — Lower pointer ~15% (marker anchor) ★ Primary

**Location:** `LiveMapView.tsx` ~6697–6707 (Marker render)

**Current:**
```tsx
anchor={{ x: 0.5, y: 0.5 }}
```

**Proposed:**
```tsx
anchor={{ x: 0.5, y: 0.38 }}
```

**Rationale:** In `react-native-maps`, lowering `anchor.y` (below 0.5) attaches the coordinate higher within the marker bitmap, shifting the drawn puck **downward** on screen without moving GPS or route data. `0.38` ≈ 12 px down on a 52 px marker (~1.5% of ~800 px screen); combine with Patch 2 for full ~15% screen shift.

**Tune in QA:** `0.35`–`0.42` range on iPhone + Android tall aspect ratios.

---

## Patch 2 — Bottom mapPadding +15% screen ★ Primary

**Location:** `LiveMapView.tsx` ~74–81 `driverNavImmersiveMapPaddingBottomPx`

**Current:**
```ts
function driverNavImmersiveMapPaddingBottomPx(insetsBottom: number): number {
  const iconHalf = NAV_IMMERSIVE_POINTER_PX * 0.5;
  const raw =
    DRIVER_NAV_OVERLAY_ABOVE_BOTTOM_DP +
    iconHalf +
    Math.max(insetsBottom, 0) +
    10;
  return Math.round(Math.min(210, Math.max(96, raw)));
}
```

**Proposed:**
```ts
import { Dimensions } from 'react-native'; // already imported

function driverNavImmersiveMapPaddingBottomPx(insetsBottom: number): number {
  const screenH = Dimensions.get('window').height;
  const screenShiftPx = Math.round(screenH * 0.15);
  const iconHalf = NAV_IMMERSIVE_POINTER_PX * 0.5;
  const raw =
    DRIVER_NAV_OVERLAY_ABOVE_BOTTOM_DP +
    iconHalf +
    Math.max(insetsBottom, 0) +
    10 +
    screenShiftPx;
  return Math.round(Math.min(280, Math.max(96, raw))); // raise cap from 210 → 280
}
```

**Rationale:** Padding formula still uses legacy `DRIVER_NAV_OVERLAY_ABOVE_BOTTOM_DP = 112` from overlay era; adding `screenH * 0.15` matches the product ask explicitly. Increase max clamp so tall phones are not capped at 210.

**Alternative (more conservative):** Add fixed `+48` dp instead of 15% if product prefers device-agnostic constant.

---

## Patch 3 — Enlarge pointer ~15% (styles + constant)

**Location:** `LiveMapView.tsx` ~72, ~114–181 `navDirectionPointerStyles`

| Token | Current | Proposed (~×1.15) |
|-------|---------|-------------------|
| `NAV_IMMERSIVE_POINTER_PX` | 52 | **60** |
| `glowOuter` | 48×48 | **55×55** |
| `glowMid` | 30×30 | **34×34** |
| `arrowHead` borders | 12 / 22 | **14 / 25** |
| `arrowStem` | 9×8 | **10×9** |
| `coreRing` | 16×16 | **18×18** |
| `coreDot` | 6×6 | **7×7** |
| `arrowWrap.top` | 4 | **5** (keep proportional) |

**Important:** Update `NAV_IMMERSIVE_POINTER_PX` **before** padding uses `iconHalf` — Patch 2 auto-adjusts padding for larger icon.

---

## Patch 4 — Internal arrow balance (optional micro-tune)

**Location:** `navDirectionPointerStyles.arrowWrap`

If after Patch 1–3 the arrow still reads “top-heavy”, change:

```ts
arrowWrap: {
  position: 'absolute',
  top: 8,        // was 4 — pushes arrow mass toward center/bottom of root
  alignItems: 'center',
},
```

Purely visual; no map impact.

---

## Patch 5 — Copy / comments only (optional)

Update stale comment ~3578–3580:

> ~~araç ikonu MapView dışında overlay~~ → `DriverNavDirectionPointer` map Marker + immersive mapPadding

Prevents future regressions from re-introducing duplicate overlay.

---

## Do NOT change (this sprint)

| Item | Reason |
|------|--------|
| `offsetCameraCenterForward` / look-ahead meters | Affects camera follow for all speeds |
| `bearingAlongRouteAheadDeg` / smoothing lerp | Route bearing logic |
| `NavManeuverArrowIcon` / top banner | Different UI; top placement is correct |
| `mapNavMarkers.ts` PNG anchors | Non-nav markers |
| `index.tsx` | No props needed |
| Backend / socket | Out of scope |

---

## Exact line targets (LiveMapView.tsx)

| Lines | Function / symbol | Change |
|-------|-------------------|--------|
| 72 | `NAV_IMMERSIVE_POINTER_PX` | 52 → 60 |
| 74–81 | `driverNavImmersiveMapPaddingBottomPx` | +15% screen height |
| 114–181 | `navDirectionPointerStyles` | Scale dimensions |
| 6697–6707 | Marker `anchor` | `{ x: 0.5, y: 0.5 }` → `{ x: 0.5, y: 0.38 }` |

---

## QA checklist (APK)

1. **Driver → matched → Yolcuya Git** — pointer visible, lower third of map, not under top banner  
2. **Rotate / heading-up** — arrow points along route; no 90° flip jitter  
3. **Pickup → destination stage switch** — pointer persists; padding unchanged  
4. **iPhone safe area** (notch + home indicator) vs **Android gesture bar** — pointer not clipped by bottom sheet  
5. **Recenter FAB** — `navForceRecenterOnceRef` still snaps; pointer aligned with road  
6. **Exit navigation** — classic map markers restore; no ghost pointer  
7. **Tall phone (≥844 h) and small phone (≤667 h)** — 15% shift feels consistent  
8. **Passenger map** — no pointer regression (driver-only branch)

---

## Rollback

Single-file revert of `LiveMapView.tsx` constants + anchor + styles. No migrations, no API changes.
