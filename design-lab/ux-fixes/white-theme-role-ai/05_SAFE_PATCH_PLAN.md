# Safe Patch Plan — WHITE-THEME-B3-7B

**Sprint:** WHITE-THEME-B3-7A (analysis) → **B3-7B** (execution)  
**Constraints:** No backend, no match logic, no storage, no app.json/eas.json  

---

## Phase ordering (minimal blast radius)

```
Phase 1 — Shared blueprint light palette     (1 file, fixes role + match icons)
Phase 2 — Match card theme bridge            (2 files, fixes Eşleşme kararı)
Phase 3 — Role shell token cleanup           (2 files, fixes wash-out)
Phase 4 — LeylekEye light/dark variant       (2 files, fixes guardian dot)
Phase 5 — LeylekZeka modal light shell       (1 file, optional P1.5)
```

Each phase is independently shippable and dark-theme regression testable.

---

## Phase 1 — Blueprint light palette (styles only)

| File | Change |
|------|--------|
| `frontend/design-system/role-select/BlueprintIllustration.tsx` | `getBlueprintPalette(active, theme?: ResolvedTheme)` |

**Behavior:**

- `dark` / unset → exact current palette (no regression).
- `light` → stronger strokes (`rgba(13,148,136,0.85)` active), fills 12–18%, grid visible on `#EEF2F7`.

**Consumers (call-site one-liner):** `CarHero`, `MotorcycleHero`, `PassengerSeatHero`, `DriverCockpitHero`, `NormalMatchOfferHero`, `QuickMatchHero`, `TrustedNetworkHero`, `ProxyPickupHero` — pass `useTheme().resolvedTheme` or accept via context hook inside `BlueprintIllustration`.

**Tests:** Role select + match cards — icons readable on white APK.

---

## Phase 2 — Match decision cards

| File | Change |
|------|--------|
| `frontend/components/superUx/PassengerMatchModeCards.tsx` | Import `useTheme` or `usePassengerTheme`; replace `PREMIUM_*` StyleSheet colors with token-driven `useMemo` styles |
| `frontend/lib/theme/usePassengerTheme.ts` | Add optional `matchCardSurfaces` (title, subtitle, shell normal/quick/trusted/disabled) |

**Do not change:** card data model, `PRIMARY_CARDS` / `SECONDARY_CARDS`, press handlers, trusted driver branch.

**Hierarchy tweaks (styles only):**

- Enabled Normal: `borderWidth: 2`, `borderColor: tokens.borderColors.selected`
- Titles: `tokens.text.primary` not `PREMIUM_TEXT_SOFT`
- Disabled: illustration desaturate via palette `active: false`; card opacity 0.72 max

| File | Change |
|------|--------|
| `frontend/app/index.tsx` | Optional: extend `dashboardSurfaces` for `passengerMatchPhaseStep` accent color |

---

## Phase 3 — Role screen wash-out

| File | Change |
|------|--------|
| `frontend/lib/theme/useRoleTheme.ts` | Ensure `roleUnifiedCockpitShell` uses opaque white on light (not translucent navy) |
| `frontend/components/premium/RoleSelectScreen.tsx` | Prefer `roleLt` over dark baseline where both apply; pass theme to heroes |

| File | Change (surgical) |
|------|-------------------|
| `frontend/app/index.tsx` | Only if needed: remove conflicting `backgroundColor` on `roleUnifiedCockpitShell` when `roleLt` present — **avoid** mass StyleSheet refactor |

**Scope cap:** Max ~20 lines in `index.tsx` role styles OR zero if `roleLt` override sufficient.

---

## Phase 4 — Leylek Zeka eye consistency

| File | Change |
|------|--------|
| `frontend/design-system/leylek-eye/LeylekEye.tsx` | Add `themeVariant?: 'light' \| 'dark'`; light capsule + adjusted SVG stops |
| `frontend/components/LeylekZekaWidget.tsx` | Pass `themeVariant={resolvedTheme}`; light: `roleSelectEyeAnchor.opacity: 1` |

**Optional same phase:**

| File | Change |
|------|--------|
| `frontend/components/superUx/LeylekEyeTrigger.tsx` | Light capsule for driver header (P2) |

**Do not change:** motion profiles, socket, chat send logic.

**AI badge on guardian:** Out of scope for guardian modes — user asked AI Control Center = modal; FAB already has badge. Consider small “AI” micro-badge on match guardian only if product confirms (P3).

---

## Phase 5 — Leylek Zeka modal (white theme shell)

| File | Change |
|------|--------|
| `frontend/components/LeylekZekaChat.tsx` | Read `useTheme()`; when `resolvedTheme === 'light'`: light sheet gradient, `BlurView tint="light"`, light header bar, theme-aware message bubbles |

**Scope cap:** Header + sheet background + backdrop opacity first; message list can stay dark-readable in v1 or get light bubbles in v2.

**Preserve:** PNG eye + AI badge in header; `HeaderLogoMark` animation.

---

## What stays styles-only vs needs assets

| Item | Styles only | Asset work later |
|------|-------------|------------------|
| Role/vehicle blueprint contrast | ✓ Phase 1 | — |
| Match card colors/hierarchy | ✓ Phase 2 | — |
| Cockpit panel wash | ✓ Phase 3 | — |
| SVG guardian eye on light | ✓ Phase 4 | Optional PNG light export |
| Modal eye mark | ✓ Phase 5 (chrome) | Optional `leylek-zeka-eye-light.png` |
| FAB PNG eye | Current asset OK | Tier 2 if brand supplies light PNG |
| v4 SVG master swap | — | ✓ Requires brand approval + manifest |

---

## Explicit non-goals (B3-7B)

- `MatchRequestsScreen`, Quick Match session logic, trusted API
- QR / chat / socket / dispatch
- `themeStorage`, feature flags (already fixed)
- Full `index.tsx` StyleSheet migration (~144 PREMIUM refs)
- Production asset overwrite in `brand-identity-production/`

---

## Suggested commit slices

1. `fix(theme): light blueprint palette for role and match heroes`
2. `fix(theme): tokenize passenger match mode cards for light theme`
3. `fix(theme): reduce role cockpit wash on light surfaces`
4. `fix(theme): LeylekEye light variant for guardian slots`
5. `fix(theme): light shell for Leylek Zeka chat modal` (optional)

---

## QA checklist (post B3-7B)

- [ ] White / light: role select — icons, steps, cards, CTA
- [ ] White / light: vehicle step — car/motor heroes
- [ ] White / light: Eşleşme kararı — title, Normal vs disabled cards
- [ ] White / light: guardian eye recognizable (not dot)
- [ ] White / light: open Leylek Zeka — header eye + AI badge, sheet not oppressive
- [ ] Dark theme: all above unchanged (screenshot diff)
- [ ] Gradle release APK without env vars (flags default ON)
