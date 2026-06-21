# UX-P1-NAV-1A — Navigation Arrow Risk Register

**Sprint:** UX-P1-NAV-1A  
**Mode:** Read-only analysis  
**Production code touched in 1A:** None (design-lab docs only)

---

## Risk matrix (proposed UX-P1-NAV-1B patches)

| ID | Risk | Likelihood | Impact | Mitigation |
|----|------|------------|--------|------------|
| R1 | **Bottom padding cap (210)** prevents 15% shift on tall devices | High | Pointer still too high on Pro Max / tall Android | Raise max to ~280 in Patch 2 |
| R2 | **Anchor + padding double-move** overshoots — pointer too low, overlaps bottom sheet | Medium | UX | Ship anchor first OR padding first; QA both form factors; tune anchor.y 0.35–0.42 |
| R3 | **`Dimensions.get('window').height`** stale on rotation / split-screen | Low | Wrong padding until remount | Accept for v1; optional `useWindowDimensions` hook in 1B if needed |
| R4 | **Larger pointer (`60px`)** occludes narrow side streets at high zoom | Low | Visual | Keep scale ≤1.15; verify at zoom 17–18 |
| R5 | **`tracksViewChanges={false}`** — size change may not redraw on some Android until marker remount | Low | Stale size | Toggle nav off/on in QA; remount already happens on `navigationMode` |
| R6 | **Padding change shifts maneuver distance perception** — road ahead looks different | Medium | Low UX | Expected for nav apps; do not change look-ahead in same PR |
| R7 | **Confusion with top `NavManeuverArrowIcon`** — testers report “arrow still at top” | Medium | False bug | Document two arrows in QA script (see 01_CURRENT_FLOW.md) |
| R8 | **Legacy comment “overlay”** leads dev to add duplicate absolute pointer | Medium | Double arrow bug | Patch 5 comment cleanup in 1B |
| R9 | **`DRIVER_NAV_OVERLAY_ABOVE_BOTTOM_DP` name drift** — future edit adjusts wrong constant | Low | Regression | Rename to `NAV_IMMERSIVE_BOTTOM_BASE_DP` in optional follow-up (not required for hotfix) |
| R10 | **Web fallback** — no MapView; no pointer | None | N/A | Driver nav is mobile-only |

---

## Route / logic safety

| Area | Touched by proposed patch? | Risk |
|------|------------------------------|------|
| Polyline fetch / OSRM | No | None |
| Turn-by-turn / TTS / `navManeuverUi` | No | None |
| GPS snap / `navMapVehicleCoordResolved` | No | None |
| Socket location updates | No | None |
| `bearingAlongRouteAheadDeg` smoothing | No | None |
| Camera heading / pitch follow | Indirect via padding only | Low — framing only |
| Trip completion / QR / payment | No | None |

**Verdict:** Style + anchor + padding hotfix is **low risk** to route correctness. Highest risk is **vertical over-correction** (R2), not data corruption.

---

## Platform-specific notes

| Platform | Watch item |
|----------|------------|
| **iOS** | Safe area bottom + home indicator; mapPadding interacts with `driverNavCloseFab` at `bottom: 18 + insets.bottom` |
| **Android** | `elevation` on glow may clip differently at new sizes; test gesture navigation bar inset |
| **Both** | Google Maps padding API behavior is consistent; no separate arrow fork today |

---

## Out of scope / do not fix in arrow sprint

- Top maneuver banner layout (`navManeuverBanner` at `top: 0`)
- `InAppNavigation.tsx` modal (unused in main driver flow)
- Passenger map markers
- Camera look-ahead meter retuning (separate sprint if road still misaligned under puck)

---

## Sign-off criteria (1B)

- [ ] Pointer center of mass visibly ~15% lower vs baseline on reference device (screenshot A/B)
- [ ] Pointer ~15% larger without clipping glow
- [ ] Havale/QR/payment flows untouched (no file changes outside LiveMapView)
- [ ] No new linter errors
- [ ] iOS + Android smoke on one tall + one compact device
