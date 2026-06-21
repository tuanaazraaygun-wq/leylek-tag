# B3-6 Risk Register

**Sprint:** B3-6 — Screen migration risks  
**Date:** 2026-06-21

---

## Risk matrix

| ID | Risk | Likelihood | Impact | Level | Mitigation |
|----|------|------------|--------|-------|------------|
| R-01 | Hybrid UI (light bg + dark inputs) | High | High | **P0** | Migrate shell + inputs same PR per screen |
| R-02 | LiveMapView marker invisible on light map | High | Critical | **P0** | Block B3-6g until light PNGs |
| R-03 | index.tsx merge conflicts | Medium | High | P1 | Small scoped diffs; section tags |
| R-04 | Theme toggle mid-ride crash/re-render | Low | High | P1 | QA-6g-04; avoid unmount map |
| R-05 | QR scan overlay too light | Medium | High | P1 | Keep scan overlay dark constant |
| R-06 | Logo low contrast on white | Medium | Medium | P1 | logo-evolution light variant |
| R-07 | LegalPages dual palette drift | Medium | Low | P2 | Token bridge in B3-6c |
| R-08 | Splash dark-only vs app light jarring | Low | Medium | P2 | Document policy; defer |
| R-09 | Performance regression (useTheme in list) | Low | Medium | P2 | Memoize tokens; avoid per-row hook |
| R-10 | Flag misconfiguration prod light ON | Low | Critical | P0 | Release gate triple-check |
| R-11 | DriverOfferScreen COLORS object stale | High | Medium | P1 | Replace COLORS with tokens |
| R-12 | Hero illustrations wrong on white | Medium | Low | P2 | Overlay dim, not redraw |
| R-13 | Settings toggle without screen migrate | Medium | Medium | P2 | Screen flag list documents gap |
| R-14 | Admin panel legacy breaks | Low | Low | P3 | B3-6h only |

---

## Highest risk screens (ranked)

| Rank | Screen / File | Primary risk |
|------|---------------|--------------|
| 1 | `LiveMapView.tsx` | Markers + overlays + monolith |
| 2 | `DriverOfferScreen.tsx` | Map field + 102 color refs |
| 3 | `index.tsx` (passenger/driver) | Volume + inline styles |
| 4 | `PassengerWaitingScreen.tsx` | Map overlay + waiting UX |
| 5 | `BoardingScanModal.tsx` | Camera + glass hybrid |

---

## Safest surfaces (low risk)

| Surface | Why |
|---------|-----|
| `ThemeSettingsSegment` | Already token-native |
| `RoleSelectScreen` | Strong B3-4 primitives |
| `RatingModal` | Small, primitive-based |
| `LoginScreen` + chrome | Isolated, limited scope |
| `settings-hub` cards | GlassSurface already themed |

---

## Rollback triggers

| Trigger | Action |
|---------|--------|
| Auth unreadable contrast | Disable `auth` screen flag |
| Map marker report | Disable `map`; hotfix assets |
| Payment modal regression | Disable `qr` |
| Crash on theme change | Disable `lightThemeEnabled` globally |

---

## Open decisions

| ID | Question | Recommendation |
|----|----------|----------------|
| D-01 | Splash light variant? | Keep dark (brand boot) until B3-6h |
| D-02 | Legal modal in auth light? | B3-6c LegalPages migrate |
| D-03 | Per-screen vs global flag? | Per-screen until B3-6h cleanup |
