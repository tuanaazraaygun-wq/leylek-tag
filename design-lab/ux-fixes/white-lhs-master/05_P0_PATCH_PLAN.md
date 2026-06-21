# WHITE-LHS-MASTER-1A — P0 Patch Plan (Release Blockers)

**Sprint:** WHITE-LHS-MASTER-1A  
**Guarantee:** Style / token / variant only — **no** backend, socket, QR scan, chat, or match logic changes.

**Est. effort:** 3–5 focused dev days  
**Device re-test:** Match decision → route picker pickup → destination → QM overlay → active LiveMap

---

## P0-1 — Shared cockpit shell light override (Match + Searching)

**Problem:** `roleUnifiedCockpitShell` dark rgba defeats `GlassSurface` on passenger flows.

**Files:**

| File | Change |
|------|--------|
| `frontend/lib/theme/usePassengerTheme.ts` | Extend `PassengerDashboardLightSurfaces` + builder: `matchCockpitShell`, `searchingCockpitShell` (mirror `roleLt.roleUnifiedCockpitShell` values) |
| `frontend/app/index.tsx` | ~13318: merge `dashLt?.matchCockpitShell`; ~12408: merge `dashLt?.searchingCockpitShell` |

**Acceptance:** Match decision and offer cockpit match role-select glass on Gündüz.

---

## P0-2 — Route picker daylight pass (Address search / pickup / destination)

**Problem:** Dark tech autocomplete + unwired `rpLt` text + dark recent cards + map chrome.

**Files:**

| File | Change |
|------|--------|
| `frontend/lib/theme/usePassengerTheme.ts` | Add to `PassengerRoutePickerLightSurfaces`: `pickupHeroTitle`, `routeRecentCard`, `routeRecentCardTitle`, `routeRecentIconRing`, `pickupRouteSubtitle`, `destinationModalTopFade`, `mapFallbackGradient`, `changeAreaBtn` (container) |
| `frontend/components/PlacesAutocomplete.tsx` | Add `visualVariant="lhs-daylight"` OR `useTheme()` branch: light input/suggestion styles per constitution §9; keep `tech` for dark |
| `frontend/app/index.tsx` | Route picker block ~13881–14600: |
| | — Switch `visualVariant` to `lhs-daylight` when `isScopeLight` |
| | — Merge all `rpLt` text keys on pickup step hero, CTAs, subtitles |
| | — Conditional top fade / map fallback gradient (no `#08111F` when light) |
| | — Apply `rpLt` to `routeRecentCard*`, `savedQuickCardTitle`, icon rings |

**Acceptance:** Full picker readable on white panel; suggestion list not navy; pickup hero title dark slate.

---

## P0-3 — Quick Match flow theme gate

**Problem:** `QuickMatchPassengerFlow.tsx` 100% dark premium.

**Files:**

| File | Change |
|------|--------|
| `frontend/lib/theme/usePassengerTheme.ts` | Optional `QuickMatchLightSurfaces` builder (header, route card, contribution stepper, status panels) |
| `frontend/components/superUx/QuickMatchPassengerFlow.tsx` | `usePassengerTheme()`; replace `PREMIUM_*` styles with `[baseline, lt?.key]` pattern; `CockpitBackground` already tokenized |
| `frontend/app/index.tsx` | Pass `isScopeLight` if needed for modal backdrop only (style) |

**Acceptance:** QM modal visually continuous with route picker on Gündüz.

---

## P0-4 — Match decision card + host polish

**Problem:** Device still reports confusing hierarchy; host buttons/deck dark.

**Files:**

| File | Change |
|------|--------|
| `frontend/components/superUx/PassengerMatchModeCards.tsx` | Light: enabled primary `normal` card — 2px `borderColors.selected`; disabled — illustration opacity only; badge contrast bump |
| `frontend/lib/theme/usePassengerTheme.ts` | `matchCardSurfaces` optional centralization (reduce duplication with cards file) |
| `frontend/app/index.tsx` | `destinationBoxBig`, `passengerIdleSendOfferBtn`, `passengerRouteCtaLabel` — light surfaces via `dashLt` extension |

**Acceptance:** “Normal Eşleşme” obviously primary; disabled cards legible; no dark porthole (depends P0-1).

---

## P0-5 — LiveMap comm row + typography (journey chrome)

**Problem:** Call/chat/güven invisible; route text pastel on white.

**Files:**

| File | Change |
|------|--------|
| `frontend/lib/theme/useJourneyTheme.ts` | Add `jLt` keys: `paxBottomCallBtn`, `paxBottomChatBtn`, `paxBottomGuvenBtn`, `drvBottomCallBtn`, …; `matchedTopRouteLineText`, `paxTopLiveChipText`, chip text colors |
| `frontend/lib/theme/useJourneyTheme.ts` | Fix `buildJourneyUi`: `ctaIcon` → `text.primary` on light (inverse only on filled accent) |
| `frontend/components/LiveMapView.tsx` | Merge new `jLt` keys; replace hardcoded `matchedTopRouteLineText` color when `isScopeLight`; marker label pills → token text |
| `frontend/lib/theme/mapStyles.ts` | *(already correct)* — verify no regression |

**Acceptance:** Bottom deck icons visible; route addresses readable; map stays Google default on light.

---

## P0 file list (exact)

```
frontend/lib/theme/usePassengerTheme.ts
frontend/lib/theme/useJourneyTheme.ts
frontend/app/index.tsx                    # passenger match, searching, route picker sections
frontend/components/PlacesAutocomplete.tsx
frontend/components/superUx/QuickMatchPassengerFlow.tsx
frontend/components/superUx/PassengerMatchModeCards.tsx
frontend/components/LiveMapView.tsx
```

**Out of P0 scope (explicit):** Chat, Splash, Admin, socket handlers, price API, QM session logic.

---

## P0 test matrix

| # | Step | Pass criteria |
|---|------|---------------|
| 1 | Role → passenger home | Canvas light; match cockpit not navy |
| 2 | Normal Eşleşme → pickup search | Daylight input; recent rows white |
| 3 | Map confirm pickup/dest | Light fade; confirm CTA gradient |
| 4 | Quick Match path | Modal matches picker |
| 5 | Accept offer → LiveMap | Light map; readable deck |
| 6 | Toggle Gece | Dark parity with current prod |

**P0 PATCH PLAN COMPLETE.**
