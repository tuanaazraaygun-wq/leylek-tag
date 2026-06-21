# WHITE-LHS-MASTER-1A — Device QA Master

**Sprint:** WHITE-LHS-MASTER-1A  
**Mode:** Read-only master analysis  
**Date:** 2026-06-21  
**Production code:** Untouched (design-lab deliverables only)

---

## Git status (session start)

`git status` was run at sprint open. Workspace treated as read-only for application code; this folder is the only intended write surface.

---

## Device findings → verdict matrix

| Screen / flow | Device verdict | Release gate | Primary code surface |
|---------------|----------------|--------------|----------------------|
| A) Role / vehicle select | **Acceptable** | Pass | `RoleSelectScreen.tsx` + `useRoleTheme()` |
| B) Match decision (“Eşleşme kararı”) | **Bad** | **Blocker** | `index.tsx` ~13314 + `PassengerMatchModeCards.tsx` |
| C) Address search / pickup / destination | **Bad** | **Blocker** | `index.tsx` route-picker Modal ~13881–14600 + `PlacesAutocomplete.tsx` |
| D) Quick match searching | **Mixed dark/light** | **Blocker** | `QuickMatchPassengerFlow.tsx` + route-picker intent branch |
| E) LiveMap journey | **Improved, inconsistent** | **Blocker (P0 chrome)** | `LiveMapView.tsx` + `useJourneyTheme.ts` |
| F) Chat modal | **Not in light matrix** | P1 | `MuhabbetChatScreen.tsx` / trip chat entry |
| G) QR / payment modal | **Mostly migrated** | Pass (P1 polish) | `useQrPaymentTrustTheme.ts` + QR modals |
| H) Settings / Profile | **Migrated shell** | Pass (P1 polish) | `useSettingsTheme.ts`, `settings-hub`, `profile.tsx` |

---

## What “good” looks like on device (reference: Role / vehicle)

- `CockpitBackground` reads light gradient tokens (`#F8FAFC` → `#EEF2F7`).
- `GlassSurface` + **`roleLt?.roleUnifiedCockpitShell`** overrides the shared dark `roleUnifiedCockpitShell` baseline in `index.tsx`.
- `PremiumSelectionCard` + `BlueprintIllustration` use `resolvedTheme === 'light'` palette.
- Text uses `tokens.text.primary` / `muted`, not `PREMIUM_TEXT_SOFT` (designed for navy cards).

---

## Release blockers (must fix before white theme ship)

1. **Shared cockpit shell forces dark glass on light flows** — `styles.roleUnifiedCockpitShell` (`rgba(5,11,24,0.44)`) applied on `GlassSurface` for match decision and offer/searching cockpit **without** a light override (role screen has `roleLt`; passenger dashboard does not).
2. **Route picker is dark-first** — `PlacesAutocomplete` forced to `visualVariant="tech"` (dark input/list); hero titles and CTA copy use light-on-dark typography on panels that `rpLt` tries to lighten.
3. **Incomplete `rpLt` wiring** — surface tokens exist in `usePassengerTheme.buildPassengerRoutePickerLightSurfaces` but many JSX nodes never merge them (pickup CTA labels, pickup step hero title, route-recent cards).
4. **Quick Match flow is 100% dark premium** — `QuickMatchPassengerFlow.tsx` has no theme gate; sits on white route-picker path → maximum clash.
5. **LiveMap hybrid** — map tiles now respect light (`customMapStyle` undefined when `isScopeLight`); ~100+ StyleSheet baselines and comm-row FABs still navy-dark; `ui.ctaIcon` uses inverse fill on light QR shells.

---

## Acceptable / non-blocker

- Auth, role, settings hub, profile, legal routes (B3-6 hooks present).
- QR/payment modal chrome (`useQrPaymentTrustTheme`) when scope flags on.
- Offer card list (`ocLt`) and searching phase partial patches (`spLt`).
- Semantic token layer (`LIGHT_SEMANTIC_TOKENS`, `LIGHT_GLASS_SURFACE_PRESETS`) — constitution exists; consumption is the gap.

---

## White theme is not “dark inverted”

Current failure mode on device:

| Dark inverted (wrong) | LHS Premium daylight (target) |
|----------------------|-------------------------------|
| Navy rgba panels with white text dropped on `#F4F7FB` canvas | Opaque white / glass-muted cards with slate primary text |
| Cyan glow borders at dark-mode opacity on white | Teal accent as rim + badge, not full-card tint |
| `PREMIUM_TEXT_SOFT` on light surfaces | `rgba(13,17,23,0.92)` primary |
| Dark map + light cards (accidental contrast) | Google default / soft POI map + frosted chrome |
| Disabled = whole-card grey fog (`opacity: 0.58`) | Desaturated illustration + “Yakında” pill + muted copy |

---

## QA acceptance (master)

When P0 patches land, re-run on device with `EXPO_PUBLIC_FEATURE_LIGHT_THEME=true`, `SCREENS=*`, theme **Gündüz**:

1. Match decision cockpit reads as **same family** as role select (not a dark island).
2. Pickup/destination search: input, suggestions, saved/recent rows — **all** daylight LHS; no navy list cells.
3. Quick Match modal/overlay — single theme family end-to-end.
4. LiveMap: map tiles light; top route card + bottom deck readable at arm’s length; call/chat/güven icons visible.
5. Dark theme regression: flag off or theme **Gece** — pixel parity with current production.

**DEVICE QA MASTER COMPLETE.**
