# 06 — Map Loading / Blank Map Analysis

**Finding:** Sürücüye teklif geldiğinde (hızlı/normal eşleşme) bazı telefonlarda harita çok geç geliyor; bazen uzun süre boş görünüyor.

**Primary file:** `frontend/components/LiveMapView.tsx`  
**Orchestration:** `frontend/app/index.tsx`  
**Transition:** `frontend/components/TagMatchTransitionOverlay.tsx`

---

## Map lifecycle (driver post-match)

```
Accept / socket match
  → (optional) TagMatchTransitionOverlay 3s
  → activeTag.status === 'matched' | 'in_progress'
  → LiveMapView mounts (key: driver-map-${tagId})
  → mapTilesReady = false → showMapLoadingOverlay
  → onMapReady / onMapLoaded → mapTilesReady = true
  → (Android fallback) 2.8s timer if ready never fires
```

---

## Stacked blockers (worst case ~5.8s)

| Layer | Duration | Source |
|-------|----------|--------|
| Match transition overlay | **3000ms** | `TAG_MATCH_TRANSITION_HOLD_MS` — `TagMatchTransitionOverlay.tsx:24` |
| Map loading overlay | **up to 2800ms** | `MAP_TILES_READY_DRIVER_FALLBACK_MS` — `LiveMapView.tsx:2702–2703, 5898–5911` |
| **Combined** | **~5.8s** | Full-screen or semi-opaque cover before usable map |

After overlays hide, map may still **look blank** if:
- Google tiles not painted (`mapTilesReady` ≠ painted tiles)
- `userLocation` null — no driver marker; default Ankara center
- `otherLocation` null until pickup poll (10s interval post-match)
- OSRM/route fetch in flight — empty polylines

---

## Mount conditions

**LiveMapView renders when:**

```19365:19365:frontend/app/index.tsx
{activeTag && !shouldDisableActivityMap && (activeTag.status === 'matched' || activeTag.status === 'in_progress') ? (
```

**MapView remount key:**

```6515:6515:frontend/components/LiveMapView.tsx
key={isDriver ? `driver-map-${String(tagId ?? 'active')}` : 'map-default'}
```

Every new tag → **cold native map teardown + tile re-fetch**.

**`mapTilesReady` resets on `tagId` change** (`LiveMapView.tsx:2704–2707`).

---

## Quick Match vs normal match

| Aspect | Normal TAG | Quick Match |
|--------|------------|-------------|
| `activeTag` set | Optimistic on accept (`index.tsx:19206`) or socket | **`await loadActiveTag()`** after accept |
| Transition overlay | 3s on accept | First tag id may skip overlay on first key |
| LiveMapView mount | Faster (optimistic tag) | **Delayed until API returns** |
| Post-mount path | Same overlays, OSRM, traffic | Same |

QM adds **network-bound gap** before map tree exists — driver stays on cockpit + `DriverQuickMatchInviteCard`.

---

## Performance bottlenecks

| Bottleneck | Impact | Location |
|------------|--------|----------|
| `tracksViewChanges={pinTracks}` true 2.4s on PNG markers | Android snapshot churn; blank pin risk | `LiveMapView.tsx:2693–2698, 6725, 6752, 6791` |
| `showsTraffic={true}` | Extra tile layer on mount | `LiveMapView.tsx:6571` |
| `customMapStyle={DARK_MAP_STYLE}` | Styled map parse cost (non-light) | `LiveMapView.tsx:6570` |
| Cold MapView remount per tag | Native teardown | `LiveMapView.tsx:6515` |
| OSRM + backend metrics on mount | Network + polyline + camera fit | `LiveMapView.tsx:5255–5880` |
| DriverOfferScreen field map (idle) | Separate MapView when expanded — not post-match issue | `DriverOfferScreen.tsx:2493` |
| No GMS guard in LiveMapView | Huawei/no-Play blank surface | Contrast: `PassengerWaitingScreen.tsx:377` |

**`showMapLoadingOverlay` logic:**

```6313:6314:frontend/components/LiveMapView.tsx
const showMapLoadingOverlay =
  !driverRideUiModern && !driverNavImmersive && !mapTilesReady;
```

`modernLeylekOfferUi` not passed from index → classic overlay always applies.

---

## Device-specific factors

- **Android:** dual ready path (`onMapReady` + `onMapLoaded`); 2.8s fallback documents known gap.
- **Low RAM:** remount + traffic + dark style + simultaneous OSRM → grey tiles / jank.
- **Location:** `userLocation` may be null at first paint; lastKnown seed after `activeTag` (`index.tsx:17367–17399`).
- **Passenger poll:** 10s interval — peer pin missing longer on slow networks.

---

## Recommended fixes (ranked, analysis only)

| Rank | Fix | Impact | Touch surface |
|------|-----|--------|---------------|
| 1 | Shorten or fade transition overlay when map mounting underneath | High perceived | `TagMatchTransitionOverlay`, `index.tsx` |
| 2 | QM optimistic `setActiveTag` from accept response (mirror normal) | High QM mount latency | `useQuickMatchDriverSession.ts`, `index.tsx` |
| 3 | Defer OSRM/metrics until after first tile paint | Medium CPU/network | `LiveMapView.tsx` |
| 4 | Disable `showsTraffic` on initial matched view | Medium Android | `LiveMapView.tsx:6571` |
| 5 | `tracksViewChanges={false}` for PNG markers (match DriverOfferScreen) | Medium Android | `LiveMapView.tsx` markers |
| 6 | Narrow MapView remount key — only on tag id change mid-session | Medium cold start | `LiveMapView.tsx:6515` |
| 7 | GMS probe gate (PassengerWaitingScreen pattern) | Medium Huawei | `LiveMapView.tsx` |
| 8 | Prefetch/warm MapView during offer visible state | Low–medium | `DriverOfferScreen.tsx` |
| 9 | Passenger 2.8s fallback parity | Low if pax reports | `LiveMapView.tsx` |
| 10 | Tile-painted signal beyond `onMapReady` (e.g. camera idle) | Medium blank-after-spinner | `LiveMapView.tsx` |

**Explicit non-goals:** route algorithm changes, GPS interval changes, socket protocol.

---

## Verification checklist

- [ ] Normal accept → map visible within **3s target** (overlay policy TBD)
- [ ] QM accept → no extended cockpit-only gap beyond network RTT
- [ ] Android mid-range: no grey tile field >5s
- [ ] Low memory device: accept → map without crash
- [ ] Light theme: loading overlay readable on white map chrome
- [ ] Nav immersive: overlay bypass still works

---

## Key references

| Topic | Location |
|-------|----------|
| Driver fallback timer | `LiveMapView.tsx:2702–2703, 5898–5911` |
| Loading overlay | `LiveMapView.tsx:6313–6314, 6798–6802` |
| pinTracks | `LiveMapView.tsx:2693–2698` |
| Trip shell mount | `index.tsx:19335–19411` |
| Normal accept + overlay | `index.tsx:19206–19286` |
| QM accept flow | `useQuickMatchDriverSession.ts:374–380`, `index.tsx:17997–18004` |
| Transition constant | `TagMatchTransitionOverlay.tsx:24` |
