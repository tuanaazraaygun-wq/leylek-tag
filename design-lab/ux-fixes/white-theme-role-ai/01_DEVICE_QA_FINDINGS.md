# WHITE-THEME-B3-7A — Device QA Findings

**Sprint:** WHITE-THEME-B3-7A  
**Mode:** Read-only analysis  
**Date:** 2026-06-21  
**Production:** Untouched  

---

## Reported device bugs → code mapping

| # | User report | Primary surface | Root cause (code-level) | Severity |
|---|-------------|---------------|-------------------------|----------|
| 1 | Role/vehicle screen looks washed out | `role-select` | Light canvas + partial `roleLt` overlay on dark baseline StyleSheet in `index.tsx`; stacked glass panels lose edge definition | P1 |
| 2 | Role/vehicle icons not clear enough | Role + vehicle hero SVGs | `getBlueprintPalette()` is dark-cockpit tuned (low-opacity cyan); no light-theme palette; hero slot uses light `heroBackground` with dark-era stroke weights | P1 |
| 3 | Match decision screen confusing in White Theme | Passenger idle home (`Eşleşme kararı`) | `PassengerMatchModeCards` has **zero** theme hook; hardcoded `PREMIUM_*` dark card shells override token-aware `PremiumSelectionCard` | P1 |
| 4 | “Eşleşme Kararı” cards need clearer hierarchy | Same | All four cards share similar weight; primary/secondary tiers not differentiated in light; badges live in checkmark slot; disabled cards only differ by opacity | P2 |
| 5 | Leylek Zeka eye inconsistent (round dot vs real eye) | Guardian + FAB + modal | **Three render paths:** SVG `LeylekEye`, PNG `leylek-zeka-eye.png`, dark capsule chrome; guardian uses 49px SVG at 74–88% opacity on light bg | P1 |
| 6 | AI Control Center should show real eye + “AI” clearly | `LeylekZekaChat` header | Header uses PNG eye in dark capsule; modal body is fully dark (`COCKPIT_HERO_GRADIENT`); no theme bridge — reads heavy on white app shell | P1 |

---

## Screens in scope

| Flow step | Screen id (flags) | Entry component |
|-----------|-------------------|-----------------|
| Rol + araç seçimi | `role` | `components/premium/RoleSelectScreen.tsx` via `app/index.tsx` |
| Eşleşme kararı (yolcu idle) | `passenger` | `app/index.tsx` ~13314 + `PassengerMatchModeCards.tsx` |
| Leylek Zeka guardian | Cross-cutting | `LeylekZekaWidget.tsx` |
| Leylek Zeka modal | No scope id | `LeylekZekaChat.tsx` |

---

## What is already working (post WHITE-THEME-FIX-1)

- Theme flags default ON for local release (`featureFlags.ts`).
- `useRoleTheme()` and `usePassengerTheme()` gates exist and activate when `resolvedTheme === 'light'` and screen id is enabled.
- `CockpitBackground`, `GlassSurface`, `PremiumSelectionCard` (base layer) consume `useTheme()` tokens.
- `LeylekZekaChat` header already has **“Leylek Zeka” + AI badge** — but styling is dark-cockpit only.

---

## What is still broken on device (white theme)

1. **Hybrid styling** — Theme hooks patch surfaces; `index.tsx` StyleSheet baselines remain dark (`PREMIUM_ROLE_*`, navy rgba stacks).
2. **Match cards bypass passenger theme** — `PassengerMatchModeCards` StyleSheet is self-contained dark premium auth palette.
3. **Blueprint illustrations are theme-blind** — Same cyan-opacity palette on light hero wells → faint “wireframe ghost” icons.
4. **Leylek eye family split** — SVG guardian vs PNG FAB/modal vs `LeylekEyeTrigger`; no shared light/dark chrome tokens.
5. **Zeka modal always dark** — Full-screen sheet ignores `useTheme()`; backdrop `rgba(2,6,14,0.72)` feels heavy over light dashboard.

---

## Non-issues / out of scope for B3-7

- Match/socket/QR/chat **logic** — not involved in visual bugs.
- Feature flag visibility — addressed in prior sprint; rebuild required on device.
- Splash, admin, Muhabbet chat routes — not in B3-6 screen matrix.
