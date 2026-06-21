# 07 — Navigation Arrow Premium Visual Plan

**Finding:** Navigasyon oku daha belirgin olmalı; Tesla benzeri premium, LHS uyumlu, White’da daha görünür; route/camera/GPS logic bozulmadan sadece görsel overlay.

**Component:** `DriverNavDirectionPointer` in `frontend/components/LiveMapView.tsx`  
**Mount:** Nav immersive marker only — `driverNavImmersive && navMapVehicleCoordResolved` (~6707–6717)

---

## Current implementation

Pure View/CSS triangle arrow — **no PNG asset**.

```106:191:frontend/components/LiveMapView.tsx
function DriverNavDirectionPointer() { ... }

const NAV_IMMERSIVE_POINTER_PX = 60;

navDirectionPointerStyles:
  glowOuter   — 55×55, rgba(34,211,238,0.14), cyan shadow
  glowMid     — 34×34, rgba(34,211,238,0.28)
  arrowHead   — border triangle, #22D3EE, 14×25
  arrowStem   — #5EEAD4, 10×9
  coreRing    — dark rgba(8,17,31,0.72) + teal border
  coreDot     — #F8FAFC
```

**Marker config:**
- `flat`, `rotation={navMapVehicleRotation}` — bearing from route (unchanged)
- `anchor={{ x: 0.5, y: 0.38 }}`
- `tracksViewChanges={false}` ✓
- `zIndex={6000}`

**No theme branch** — identical on light and dark map scopes.

---

## Visual issues on White (LHS)

1. **Cyan-on-light-map** — `#22D3EE` glow loses contrast on pale map tiles / light theme scope (`isScopeLight` → no dark map style).
2. **Fixed 60px** — may read small on large phones at nav zoom; no scale token.
3. **Dark core ring** — center hub reads as hole on light background; not Tesla-clean.
4. **Glow opacity tuned for dark map** — `shadowOpacity: 0.55` on cyan can look muddy on white tiles.
5. **No elevation hierarchy** — single glow layer vs premium stacked rim + white capsule (mirror `mapMarkerChrome` light pattern from WHITE-FINAL-1C).

---

## Design direction (overlay-only)

### Dark theme (unchanged baseline)

Keep current neon cyan arrow — user spec: dark existing cyan/neon unchanged.

### Light theme (`isScopeLight` via `useLiveMapChromeTheme`)

| Element | Proposed light treatment |
|---------|-------------------------|
| Outer halo | White `rgba(255,255,255,0.85)` + soft slate shadow (not cyan bloom) |
| Mid ring | Teal rim `rgba(0,212,170,0.24)` |
| Arrow head | Deep teal `#0F766E` or slate `#0F172A` fill + white stroke hairline |
| Arrow stem | Matching teal/slate |
| Core ring | White fill + teal border 2px |
| Core dot | Teal accent |
| Size | Optional `LIGHT_NAV_POINTER_SCALE = 1.15` → ~69px (visual only; anchor unchanged) |

**Tesla-like cues:** clean white capsule base, minimal glow, strong directional chevron, subtle ground shadow (optional pseudo-shadow View below anchor — cosmetic only).

---

## Implementation approach (future patch)

1. Pass `chromeTone: 'light' | 'dark'` into `DriverNavDirectionPointer` from existing `isScopeLight` in `LiveMapView` (same pattern as `mapMarkerChrome`).
2. Split `navDirectionPointerStyles` → `stylesDark` / `stylesLight` or conditional style arrays.
3. **Do not change:** `NAV_IMMERSIVE_POINTER_PX` anchor math in `driverNavImmersiveMapPaddingBottomPx` unless size scale applied equally to pointer root (keep anchor `{0.5, 0.38}` stable).
4. Optional: extract to `frontend/design-system/nav/NavDirectionPointer.tsx` for design-system parity — not required for minimal patch.

---

## Explicit non-goals

- `navMapVehicleRotation` / bearing calculation
- Camera follow / tilt / zoom
- Polyline stroke or route fetch
- GPS watch intervals
- TTS / turn-by-turn logic
- Marker PNG assets

---

## Verification checklist

- [ ] Light map + light scope: arrow visible at glance while driving
- [ ] Dark map: pixel-parity or intentional neon unchanged
- [ ] Rotation smooth at route bearing changes
- [ ] Anchor stable — arrow tip points correctly after visual resize
- [ ] Android + iOS shadow/elevation acceptable
- [ ] No impact on non-nav markers (self/peer/destination)

---

## Key references

| Topic | Location |
|-------|----------|
| Pointer component | `LiveMapView.tsx:106–191` |
| Size constant | `LiveMapView.tsx:75` |
| Nav padding uses pointer half | `LiveMapView.tsx:77–86` |
| Marker mount | `LiveMapView.tsx:6707–6717` |
| Light map chrome pattern | `frontend/lib/mapMarkerChrome.tsx` (WHITE-FINAL-1C) |
| Theme hook | `useLiveMapChromeTheme` in `LiveMapView.tsx` |
