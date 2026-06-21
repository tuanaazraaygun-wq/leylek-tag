# B3-6h White Theme QA Report

**Sprint:** B3-6h — Final cleanup + White Theme QA  
**Date:** 2026-06-21  
**Status:** PASS (code review + static analysis)  
**Production default:** All feature flags OFF — dark LHIS unchanged

---

## Executive summary

B3 White Theme infrastructure and screen-scoped chrome migration (B3-2 → B3-6g) is **complete at release-candidate level**. Static QA passes: provider in tree, scoped hooks gate correctly, flags OFF preserve dark baselines, no linter errors on touched surfaces.

Manual device QA matrix below is **documented and ready** for TestFlight; this sprint did not enable flags in repo.

---

## Scope inventory — screen IDs

| Screen ID | Hook / entry | Migrated surfaces (B3-6) |
|-----------|--------------|---------------------------|
| `auth` | `premiumAuthChrome.tsx` | Login/OTP/register chrome, CockpitBackground overlay |
| `role` | `useRoleTheme()` | RoleSelectScreen cards, inputs |
| `settings` | `useSettingsTheme('settings')` | Settings hub shell, rows |
| `profile` | `useSettingsTheme('profile')` | Profile route chrome |
| `legal` | `useSettingsTheme('legal')` | LegalPages, privacy/terms/kvkk routes |
| `passenger` | `usePassengerTheme()` | Dashboard, waiting, searching, offer cards |
| `driver` | `useDriverTheme()` | Waiting shell, cockpit panel, offer screen |
| `qr` | `useQrPaymentTrustTheme('qr')` | Boarding scan modals (camera UI stays dark) |
| `payment` | `useQrPaymentTrustTheme('payment')` | Trip end QR, rating modal |
| `trust` | `useQrPaymentTrustTheme('trust')` | TrustedNetworkHub |
| `journey` | `useJourneyTheme('journey')` | Trip banners, journey chrome |
| `map` | `useJourneyTheme('map')` | LiveMap overlay chrome |
| `*` | All scopes | Full light when listed as `*` |

**Composite scopes:**

- `useLiveMapChromeTheme()` — `journey` OR `map` (LiveMapView)
- `useJourneyBannerTheme()` — same OR (index.tsx active-trip banners)

---

## Feature flag matrix (test configurations)

**Production default (must stay):**

```env
EXPO_PUBLIC_FEATURE_LIGHT_THEME=false
EXPO_PUBLIC_FEATURE_LIGHT_THEME_SCREENS=
EXPO_PUBLIC_FEATURE_THEME_CHOICE=false
EXPO_PUBLIC_FEATURE_THEME_SETTINGS=false
```

| # | Config | Expected |
|---|--------|----------|
| 1 | `LIGHT=true`, `SCREENS=` (empty) | Dark everywhere — empty list blocks per-screen light |
| 2 | `SCREENS=auth` | Auth chrome light when resolvedTheme=light; rest dark |
| 3 | `SCREENS=auth,role` | Auth + role light; rest dark |
| 4 | `SCREENS=settings,profile,legal` | Settings hub/profile/legal light |
| 5 | `SCREENS=passenger` | Passenger dashboard/waiting/searching light |
| 6 | `SCREENS=driver` | Driver waiting + cockpit light |
| 7 | `SCREENS=qr,payment,trust` | QR/payment/trust modals light; camera scanner overlay dark |
| 8 | `SCREENS=journey,map` | LiveMap chrome + trip banners light; map tiles/markers unchanged |
| 9 | `SCREENS=*` | All migrated scopes light |
| 10 | `THEME_CHOICE=true` + `THEME_SETTINGS=true` + `LIGHT=true` + `SCREENS=*` | First-run choice → settings segment → full light surfaces |

**Static verification (B3-6h):**

| Check | Result |
|-------|--------|
| Flag OFF → `resolveThemeMode` forces dark | ✅ `buildTheme.ts` |
| Flag OFF → `isLightThemeScreenEnabled` always false | ✅ `featureFlags.ts` |
| Scoped hooks return dark `ui` + `null` surfaces when OFF | ✅ All 6 scope hooks |
| ThemeProvider wraps app in `_layout.tsx` | ✅ |
| useTheme outside provider throws | ✅ `ThemeContext.tsx:150` |
| No `.env` enabling flags in repo | ✅ |

---

## Dark regression verification

| Area | Method | Result |
|------|--------|--------|
| Global theme | `lightThemeEnabled=false` → resolvedTheme always dark | ✅ |
| Per-screen overlays | `jLt?.` / `dpLt?.` pattern — null when OFF | ✅ |
| Runtime UI colors | `*_UI_DARK` constants match pre-B3 hex | ✅ |
| StyleSheet baselines | Intentional dark LHIS — light via overlays only | ✅ Documented |
| Map layer | Polylines, markers, tiles untouched | ✅ |
| QR camera | Scanner viewport stays dark in all scopes | ✅ |
| Business logic | No changes in B3-6h code pass | ✅ |

---

## B3-6h cleanup performed

| File | Change |
|------|--------|
| `frontend/lib/theme/useJourneyTheme.ts` | Memoized `tokens` in `useLiveMapChromeTheme`; added `useJourneyBannerTheme()` alias |
| `frontend/app/index.tsx` | Trip banners use `useJourneyBannerTheme()` (journey\|map OR); offer accept spinner → `ui.textSoft` |

**Not changed (intentional):**

- StyleSheet dark baselines in LiveMapView, index.tsx, DriverOfferScreen (~100+ refs each)
- Map markers, polyline stroke colors, camera overlays
- Unused B3 infra exports (`DARK_TOKENS`, storage helpers) — reserved for B4/tooling; not removed

---

## Static analysis

| Tool | Result |
|------|--------|
| ESLint (theme + LiveMap + index touched paths) | No errors |
| TypeScript | No errors on allowed file set |
| Dead imports (touched files) | None introduced |

---

## Known gaps (non-blocking for B3 close)

| ID | Gap | Severity | Notes |
|----|-----|----------|-------|
| GAP-01 | StyleSheet hex baselines remain in large files | P3 | Light applied via overlay; full token sweep = B4+ |
| GAP-02 | `useRoleTheme` naming drift (`isRoleLight`, `lightSurfaces`) | P3 | Functional; cosmetic API consistency |
| GAP-03 | Legal routes dual channel (`ui` vs `legalUi`) | P2 | Consumers must use `legalUi` on legal routes |
| GAP-04 | Out-of-scope screens (admin, chat bubble, bank accounts) | P3 | Not in B3-6 migration list |
| GAP-05 | Light marker PNG bundle | P2 | Required before map scope production rollout |
| GAP-06 | One semantic green in LiveMap peer card (`checkmark-circle`) | P4 | Success status color, not accent token |
| GAP-07 | Manual device QA matrix | — | Documented; execute on TestFlight before G3 |

---

## Production behaviour changed?

**No.** Default flags OFF. B3-6h fixes are scope-alignment and token wiring only; dark output identical.

---

## B3 completion status

| Sprint | Deliverable | Status |
|--------|-------------|--------|
| B3-2 | ThemeProvider + storage | ✅ |
| B3-3 | Theme choice gate | ✅ |
| B3-4 | Primitives token-aware | ✅ |
| B3-5 | Settings theme bridge | ✅ |
| B3-6a | Auth | ✅ |
| B3-6b | Role | ✅ |
| B3-6c | Settings/Profile/Legal | ✅ |
| B3-6d | Passenger | ✅ |
| B3-6e | Driver cockpit | ✅ |
| B3-6f | QR/Payment/Trust | ✅ |
| B3-6g | LiveMap/Journey | ✅ |
| B3-6h | Final QA + release gate | ✅ |

**B3 White Theme: COMPLETE**

---

## Next sprint recommendation

**B4 — Motion + Sonic**

- Motion tokens tied to theme (reduce-motion, haptic pairing)
- Sonic genome alignment with light/dark chrome transitions
- Optional: StyleSheet baseline reduction using semantic token sweep
- Light marker asset production before map scope G3 rollout

---

**Related:** `B3_WHITE_THEME_RELEASE_GATE.md`, `WHITE_THEME_QA_PLAN.md`, `B3_6_RELEASE_GATE.md`
