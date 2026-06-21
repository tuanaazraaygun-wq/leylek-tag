# WHITE-LHS-MASTER-1A — Screen Inventory

**Sprint:** WHITE-LHS-MASTER-1A  
**Scope:** Critical passenger flows A–H

---

## Theme gate reference

Light rendering requires **both**:

1. `lightThemeEnabled` + screen id in `EXPO_PUBLIC_FEATURE_LIGHT_THEME_SCREENS` (default `*`).
2. `ThemeProvider.resolvedTheme === 'light'`.

| Screen ID | Hook | Key files |
|-----------|------|-----------|
| `role` | `useRoleTheme()` | `RoleSelectScreen.tsx`, `design-system/role-select/*` |
| `passenger` | `usePassengerTheme()` | `index.tsx` passenger branches, `PassengerWaitingScreen.tsx`, `SearchingMapView.tsx`, `PassengerMatchModeCards.tsx` |
| `journey` / `map` | `useJourneyTheme()` / `useLiveMapChromeTheme()` | `LiveMapView.tsx`, trip banners in `index.tsx` |
| `qr` / `payment` / `trust` | `useQrPaymentTrustTheme()` | Boarding/trip-end modals, `TrustedNetworkHub` |
| `settings` / `profile` / `legal` | `useSettingsTheme()` | `settings-hub`, `profile.tsx`, legal routes |
| *(none)* | — | Chat, Quick Match modal, Splash, Admin |

---

## A) Role / vehicle select

| Item | Detail |
|------|--------|
| Entry | `RoleSelectScreen.tsx` via `index.tsx` `screen === 'role-select'` |
| Background | `CockpitBackground` → token gradients ✓ |
| Cockpit shell | `GlassSurface` + `roleLt?.roleUnifiedCockpitShell` ✓ |
| Cards | `PremiumSelectionCard` + vehicle heroes (`CarHero`, `MotorcycleHero`, …) |
| Illustrations | `BlueprintIllustration` + `getBlueprintPalette('light')` ✓ |
| **Status** | **Good** — reference implementation for LHS daylight |

---

## B) Match decision

| Item | Detail |
|------|--------|
| Entry | `index.tsx` passenger idle `!activeTag` ~13301–13446 |
| Shell | `GlassSurface variant="panel"` + **`styles.roleUnifiedCockpitShell`** (dark rgba) — **no `dashLt` cockpit override** |
| Cards | `PassengerMatchModeCards` — `buildLightMatchCardTheme(tokens)` when `isScopeLight` ✓ |
| Phase copy | `PremiumText` step/caption — OK via tokens |
| Guardian | `passengerMatchGuardianSlot` for LeylekEye — orphan on light canvas |
| Below deck | `destinationBoxBig`, `passengerIdleSendOfferBtn` — dark baselines |
| **Status** | **Bad** — cards partially themed; host shell defeats light glass |

---

## C) Address search / pickup / destination

| Item | Detail |
|------|--------|
| Entry | `showDestinationPicker` Modal ~13881+ |
| Phases | `destinationPickerPhase`: `search` \| `map`; steps: `pickup` \| `destination` |
| Panel shell | `destinationFloatingPanel` + `rpLt?.floatingPanel` (partial) |
| Search | `PlacesAutocomplete` with **`visualVariant="tech"`** → dark input + dark suggestion rows |
| Map phase | Dark fallback `LinearGradient` `#08111F…`; top fade `rgba(8,17,31,…)` always applied |
| Hero typography | `destinationHeroTitle` = `#F8FAFC` — only destination step merges `rpLt?.destinationHeroTitleStep`; pickup step does not |
| CTAs | `pickupUseLocationBtnText` / `Sub` — **styles only**, `rpLt` text tokens defined but not merged in JSX |
| Recent / saved | `routeRecentCard` bg `rgba(8,17,31,0.74)` — no light surfaces in theme builder |
| **Status** | **Bad** — worst passenger-facing white-theme surface |

---

## D) Quick match searching

| Item | Detail |
|------|--------|
| Route entry | `routePickerIntent === 'quick_match'` → same picker as C, then `QuickMatchPassengerFlow` modal |
| Component | `QuickMatchPassengerFlow.tsx` — `CockpitBackground` + `PREMIUM_NAVY_DEEP` root, no `usePassengerTheme` |
| Normal searching | `index.tsx` offer cockpit ~12400 — `GlassSurface` + **`roleUnifiedCockpitShell`** dark override; `spLt` patches nav + route text only |
| Map stage | `SearchingMapView` — `searchingSurfaces` partial |
| **Status** | **Mixed** — outer shell may lighten; QM modal and offer cockpit shell remain dark-first |

---

## E) LiveMap journey

| Item | Detail |
|------|--------|
| Component | `LiveMapView.tsx` (~10k lines) |
| Hook | `useLiveMapChromeTheme()` → `jLt` (63 merge sites), `ui`, `isScopeLight` |
| Map tiles | `customMapStyle={isScopeLight ? undefined : DARK_MAP_STYLE}` ✓ (`mapStyles.ts`) |
| Top chrome | `GlassSurface` + `jLt?.topRouteShell`, phase/live/price chips |
| Bottom deck | Panel glass light; **call/chat/güven** buttons: dark `rgba(16,26,43,0.87)` baselines, **no `jLt` keys** |
| Typography | `matchedTopRouteLineText` etc. — light-colored text on now-light shells |
| Markers / polylines | Hardcoded cyan — not token-driven |
| **Status** | **Partial** — map fixed; chrome ~60% migrated |

---

## F) Chat modal

| Item | Detail |
|------|--------|
| Entry | LiveMap `onChat` → Muhabbet / trip chat screens |
| Theme | No B3-6 screen id; hardcoded dark surfaces |
| **Status** | **Out of matrix** — P1 polish |

---

## G) QR / payment modal

| Item | Detail |
|------|--------|
| Hooks | `useQrPaymentTrustTheme('qr' \| 'payment')` |
| Files | `QRTripEndModal`, `DriverBoardingQRModal`, `MuhabbetTripQr*` |
| Camera preview | Intentionally dark |
| **Status** | **Acceptable** — sheet chrome migrated; camera exception documented |

---

## H) Settings / Profile

| Item | Detail |
|------|--------|
| Settings | `useSettingsTheme('settings')` on hub |
| Profile | `app/profile.tsx` + `ProfileLightSurfaces` |
| Theme segment | `ThemeSettingsSegment` via `useTheme` |
| **Status** | **Acceptable** — P1 for row-level edge cases only |

---

## Shared primitives (cross-screen)

| Primitive | Light-aware? | Notes |
|-----------|--------------|-------|
| `GlassSurface` | ✓ | `useTheme()` → `LIGHT_GLASS_SURFACE_PRESETS` |
| `CockpitBackground` | ✓ | Light gradients in `lhisPresets.ts` |
| `PremiumSelectionCard` | ✓ | Base from tokens; often overridden by parent `style` |
| `PremiumText` | ✓ | `muted` → `#64748B` in light |
| `index.tsx` StyleSheet | ✗ hybrid | ~28k lines; dark baselines win when hooks not merged |

**SCREEN INVENTORY COMPLETE.**
