# WHITE-LIVEMAP-1A — Device QA Findings

**Sprint:** WHITE-LIVEMAP-1A  
**Mode:** Read-only analysis  
**Date:** 2026-06-21  
**Production:** Untouched  

---

## Git status (read-only snapshot)

Branch: `working-final`. No production files modified for this sprint. Untracked `design-lab/` analysis artifacts only (brand-dna, prior ux-fixes sprints). Frontend theme commits through `68ef0b60` remain the last touched production theme work.

---

## Reported device bugs → code mapping

| # | User report | Primary surface | Root cause (code-level) | Severity |
|---|-------------|-----------------|-------------------------|----------|
| 1 | Cards look semi-transparent on matched journey | Passenger/driver top route shell + bottom deck | `GlassSurface` light presets use `rgba(255,255,255,0.72–0.94)` and `jLt` uses `tokens.bg.glassMuted` (`rgba(238,242,247,0.88)`) layered over **always-dark** map tiles → dark bleed-through reads as “frosted gray”, not solid white | P0 |
| 2 | Map stays dark in White Theme | `MapView` in `LiveMapView.tsx` | `customMapStyle={mapStyle}` — module-level **dark-only** Google Maps JSON (~30 rules, `#101A2B` landscape). No `isScopeLight` branch; no light map style exists in repo | P0 |
| 3 | Text looks washed out / low contrast | Top journey card, chips, route lines | StyleSheet hardcodes **light-on-dark** text (`rgba(243,248,255,0.92)`, `rgba(186,230,253,0.95)`) on surfaces that are now light glass; `PremiumText` token colors overridden | P0 |
| 4 | CTAs feel mixed / confusing | Bottom comm row + QR primary | Hybrid stack: some buttons keep dark navy baselines (`rgba(16,26,43,0.88)`), QR buttons get light `jLt` override; `ui.ctaIcon` on light scope = `tokens.text.inverse` (`#F5F7FA`) → **near-white icons on light gray QR button** | P0 |
| 5 | Danger / force-end hard to read | `paxBottomEndBtn`, driver force-end | Dark-era danger shell `rgba(127,29,29,0.22)` + pastel red text; no `jLt` light override; low contrast on white deck | P1 |
| 6 | Driver “Yolcuya Git” chip looks dark-cockpit | Driver matched nav CTA | `driverYolcuyaGitChipLabel` hardcoded `rgba(243,248,255,0.94)`; gradient uses `ui.ctaGradient` (light-aware) but label color is not | P1 |
| 7 | Trusted-add compact chip cyan-on-navy | Top trusted invite strip | `trustedAddCompactChip*` styles dark navy + cyan text; `jLt` only patches bg/border — text colors stay dark-theme cyan | P2 |

---

## Screens in scope

| Flow step | Screen id (flags) | Entry component |
|-----------|-------------------|-----------------|
| Matched journey — passenger map | `journey` \| `map` | `app/index.tsx` → `LiveMapView` (`isDriver={false}`) |
| Matched journey — driver map | `journey` \| `map` | `app/index.tsx` → `LiveMapView` (`isDriver={true}`) |
| Pre-map trip banners | `journey` \| `map` | `app/index.tsx` → `useJourneyBannerTheme()` overlays |
| QR / chat / trust actions | `qr` / (chat unscoped) / trust via LiveMap chrome | Bottom deck in `LiveMapView`; modals separate |

---

## What is already working (post B3-6 + FIX-1)

- `useLiveMapChromeTheme()` wired at `LiveMapView` root (`chromeSurfaces: jLt`, `ui`).
- Light gate active when `EXPO_PUBLIC_FEATURE_LIGHT_THEME` defaults ON and `journey` or `map` in screens (or `*`).
- ~34 overlay slots apply `jLt?.` patches (top route shell, phase/live chips, price/near chips, bottom deck, QR btn borders, trusted chip shells, nav maneuver banner).
- `GlassSurface` reads global `useTheme()` → light header/panel/plain presets apply on matched cards.
- `ui.routeDotPrimary`, `ui.activity`, `ui.errorIcon` follow light semantic tokens when scope is light.
- Trip banners in `index.tsx` share `useJourneyBannerTheme()` with `tripBanner*` light surfaces.

---

## What is still broken on device (white theme, matched LiveMap)

1. **Map substrate never flips** — dark cockpit map under light chrome.
2. **Hybrid StyleSheet** — ~50+ hardcoded light-text / dark-bg literals in matched-journey styles; hooks patch only bg/border on subset of nodes.
3. **`ui.ctaIcon` semantic mismatch** — `buildJourneyUi` sets `ctaIcon: tokens.text.inverse` (light color) for all light-scope icons, including buttons that end up on light surfaces.
4. **No `isScopeLight` branch in component** — `LiveMapView` never reads `isScopeLight`; cannot swap map style or text styles without extending hook usage.
5. **Comm buttons mostly unpatched** — `paxBottomCallBtn`, `paxBottomChatBtn`, `paxBottomGuvenBtn` have no `jLt` entries in `useJourneyTheme.ts`.
6. **Chat route** — in-map chat opens via `onChat` callback; `ChatScreen` / `MuhabbetChatScreen` not in B3-6 matrix (separate dark baseline).

---

## Non-issues / out of scope for LIVEMAP-1A

- Match/socket/QR scan **logic**, GPS, navigation camera, polyline geometry.
- QR camera preview (intentionally dark in `useQrPaymentTrustTheme`).
- Map marker PNG assets (not token-driven).
- `index.tsx` bulk StyleSheet outside trip-banner branches.

**DEVICE QA FINDINGS COMPLETE.**
