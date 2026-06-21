# WHITE-LHS-MASTER-1A — P1 Patch Plan (Polish)

**Sprint:** WHITE-LHS-MASTER-1A  
**Timing:** After P0 device sign-off  
**Guarantee:** Style / token only

---

## P1-1 — Offer searching phase completeness

**Problem:** `searchingStyles` baselines dark; `spLt` covers ~8 keys; `offersTitle` / list chrome OK via `PremiumText` but live chip base `rgba(5,11,24,0.55)` pre-merge.

**Files:**

- `frontend/lib/theme/usePassengerTheme.ts` — extend `PassengerSearchingPhaseLightSurfaces`: `offerCockpitShell`, `phaseStep`, `offersTitle`, `mapChromeWrap`
- `frontend/app/index.tsx` — searching branch ~12400–12520
- `frontend/components/SearchingMapView.tsx` — marker/price tag contrast on light stage

---

## P1-2 — Passenger waiting screen

**Problem:** `PassengerWaitingScreen.tsx` merges `waitingSurfaces` but StyleSheet retains `PREMIUM_NAVY_DEEP` container baseline.

**Files:**

- `frontend/components/PassengerWaitingScreen.tsx`
- `frontend/lib/theme/usePassengerTheme.ts` — verify all nav/map stats keys wired

---

## P1-3 — Price offer modal (passenger idle)

**Problem:** `showPriceModal` block ~13504+ — dark payment option gradients, hardcoded `#22D3EE` arrays; partial `rpLt` on warn card only.

**Files:**

- `frontend/lib/theme/usePassengerTheme.ts` — `priceModalLightSurfaces` builder
- `frontend/app/index.tsx` — price modal styles merge when `isScopeLight`

---

## P1-4 — LiveMap markers & polylines

**Problem:** Cyan `#22D3EE` hardcoded; acceptable on light map but not constitution-aligned.

**Files:**

- `frontend/components/LiveMapView.tsx` — `ui.accent` for stroke colors when `isScopeLight`
- `frontend/lib/theme/useJourneyTheme.ts` — optional `mapPolyline`, `mapMarkerLabel` in `JourneyUiColors`

---

## P1-5 — Settings / Profile edge rows

**Problem:** Generally migrated; occasional dark row baseline on nested navigations.

**Files:**

- `frontend/app/settings-hub.tsx`
- `frontend/components/ProfileScreen.tsx`
- `frontend/lib/theme/useSettingsTheme.ts`

---

## P1-6 — Chat modal daylight shell

**Problem:** No B3-6 screen id; dark sheet on light trip.

**Files:**

- `frontend/components/MuhabbetChatScreen.tsx` (or active trip chat component)
- New scope id `chat` in `featureFlags.ts` + `usePassengerTheme` or dedicated `useChatTheme` **(flag only, no message logic)**

---

## P1-7 — Leylek Zeka / guardian on light canvas

**Problem:** Guardian slot between match header and title; eye capsule dark on light.

**Files:**

- `frontend/components/LeylekZekaWidget.tsx` (or guardian host)
- `frontend/design-system/leylek-eye/LeylekEye.tsx` — light chrome ring tokens
- `frontend/app/index.tsx` — `passengerMatchGuardianSlot` spacing/contrast

---

## P1-8 — Design-system consolidation

**Problem:** Duplicate light builders across `useRoleTheme`, `usePassengerTheme`, cards.

**Files:**

- `frontend/lib/theme/lhisPresets.ts` — export shared cockpit shell helper
- `frontend/design-system/theme/index.ts` — document constitution link

*(Refactor-only; zero runtime logic change.)*

---

## P1 file summary

| Priority | Files |
|----------|-------|
| High | `PassengerWaitingScreen.tsx`, `SearchingMapView.tsx`, price modal section in `index.tsx` |
| Medium | `LiveMapView.tsx` polylines, chat screen, Leylek guardian |
| Low | Settings/profile touch-up, DS consolidation |

---

## P2 (later — not in P1)

| Item | Notes |
|------|-------|
| Splash screen | `SplashScreen.tsx` dark gradient |
| Admin panel | Out of product scope |
| Trust video / Muhabbet home tabs | Low traffic |
| Map marker PNG redesign | Asset pipeline |
| ThemeChoiceScreen | Already previews both |
| Driver offer screen hybrid baselines | Driver scope, separate sprint |

**P1 PATCH PLAN COMPLETE.**
