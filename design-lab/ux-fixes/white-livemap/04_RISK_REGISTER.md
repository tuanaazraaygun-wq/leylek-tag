# WHITE-LIVEMAP-1A — Risk Register

**Sprint:** WHITE-LIVEMAP-1A  
**Mode:** Read-only  
**Implementation sprint:** TBD (WHITE-LIVEMAP-1B recommended)

---

## Risk matrix

| ID | Risk | Likelihood | Impact | Mitigation |
|----|------|------------|--------|------------|
| R1 | Light map reduces cyan polyline contrast | Med | Med | Keep accent stroke `#00D4AA`; test pickup/destination nav layers at zoom 14–18; retain dark style when `!isScopeLight` |
| R2 | Style-only diff accidentally touches handler | Low | High | PR scope: no changes inside `onPress`/`useEffect` bodies; grep diff for `onChat`, `handlePrimaryTripQrPress`, `performTrustedPrimaryAction` |
| R3 | `LiveMapView.tsx` size (~11k lines) — merge conflicts | High | Med | Extract `mapStyles.ts` + optional `liveMapMatchedStyles.ts`; minimal inline edits with clear `isScopeLight` blocks |
| R4 | Driver nav immersive mode regression | Med | Med | Test `driverNavImmersive` + `driverRideUiModern` branches separately; many styles shared with matched layout |
| R5 | Android vs iOS map style rendering differences | Med | Low | QA both platforms; Google Maps style JSON well-supported but water/road colors vary slightly |
| R6 | Web fallback map (no native MapView) | Low | Low | `jLt.webFallback` already tokenized; verify `webFallbackText` hardcoded color |
| R7 | Feature flag off → dark path broken | Low | High | All changes gated on `isScopeLight`; dark baselines remain default StyleSheet |
| R8 | `ui.ctaIcon` API change breaks other consumers | Low | Med | Add new keys (`ctaIconOnLight`) rather than repurpose `ctaIcon`; audit 4 subcomponents in LiveMapView that call `useLiveMapChromeTheme()` |
| R9 | Semi-opaque glass required for brand “premium” feel | Med | Low | Product sign-off: opaque white for journey cards only; keep glass on passenger waiting/search if desired |
| R10 | index.tsx trip banners still hybrid after LiveMap fix | Med | Med | Include banner text audit in 1B; share `jLt` keys |
| R11 | QR modal light + LiveMap light double-migration edge | Low | Low | Modals already use `useQrPaymentTrustTheme`; no coupling to LiveMap hook |
| R12 | Performance — runtime style arrays vs StyleSheet | Low | Low | Prefer prebuilt `stylesLight` object via `useMemo` on `isScopeLight` |

---

## Regression test checklist (for 1B implementer)

### Visual (Gündüz + SCREENS=*)

- [ ] Passenger matched: top card readable (route, price, phase, Canlı)
- [ ] Passenger bottom: call / chat / güven / QR distinct hierarchy
- [ ] QR icon visible on boarding + trip-end states
- [ ] Force end readable (not pastel ghost)
- [ ] Driver matched: top card + Yolcuya Git / Hedefe Git chip
- [ ] Driver bottom deck parity
- [ ] Map tiles light; traffic layer still visible
- [ ] Dark theme unchanged (Gece or flag off)

### Logic smoke (must be identical)

- [ ] QR opens correct modal flow (boarding vs trip end)
- [ ] Chat blocked after boarding with same alert copy
- [ ] Güven AL disabled/pending states unchanged
- [ ] Trusted invite chip actions unchanged
- [ ] Call FAB still invokes `handleCall`
- [ ] Driver nav / Yolcuya Git still invokes `handleYolcuyaGitPress`
- [ ] No new socket subscriptions or GPS interval changes

### Accessibility

- [ ] Text contrast ≥ 4.5:1 on primary labels (WCAG AA) for light cards
- [ ] Touch targets unchanged (52px call FAB, etc.)

---

## Rollback plan

1. Revert `mapStyles` gate → dark map always (single line).
2. Revert `jLt` opaque surfaces → previous `glassMuted` (hook-only rollback).
3. Full revert = 2–3 files; no migrations or API changes.

---

## Dependencies

| Dependency | Status |
|------------|--------|
| WHITE-THEME-FIX-1 (flags default ON) | ✅ Shipped `9ca101af` |
| B3-6 journey/map hooks | ✅ Present |
| B3-7B role/passenger light patterns | ✅ Reference for opaque cards + CTA tiers |
| Light map asset spec | ❌ Not in repo — must be authored in 1B |

---

## Open questions (product)

1. **Map light spec:** Custom LHIS JSON vs Google default?
2. **Driver nav immersive:** Full light pass in same sprint or defer?
3. **Chat screen:** Accept dark sheet over light map for v1?

**RISK REGISTER COMPLETE.**
