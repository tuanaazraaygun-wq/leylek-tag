# Role / Vehicle White Theme Analysis

**Sprint:** WHITE-THEME-B3-7A  
**Section:** A — Role & vehicle selection screen  

---

## A1. Which component renders what?

| UI block | Component | Path |
|----------|-----------|------|
| Screen shell | `RoleSelectScreen` | `frontend/components/premium/RoleSelectScreen.tsx` |
| Orchestration + StyleSheet baselines | Inline branch in `app/index.tsx` (`screen === 'role-select'`) | ~3946–4335, styles ~24440–25800 |
| Backdrop | `CockpitBackground` | `design-system/primitives/CockpitBackground.tsx` → `RoleSelectAmbienceBackground` |
| Rol kartları (Yolcu / Sürücü) | `PremiumSelectionCard` + `PassengerSeatHero` / `DriverCockpitHero` | `RoleSelectScreen.tsx` ~584–695 |
| Araç kartları (Araba / Motor) | `PremiumSelectionCard` + `CarHero` / `MotorcycleHero` | `RoleSelectScreen.tsx` ~721–818 |
| Step indicator (1-2-3) | Inline in `RoleSelectScreen` | ~393–561 |
| Theme gate | `useRoleTheme()` | `frontend/lib/theme/useRoleTheme.ts` |

**Vehicle cards are not a separate screen** — they replace role cards in the same cockpit shell when `selectedRole` is set (`roleDeckVehicleStack`).

---

## A2. Theme application model

```
useTheme() → resolvedTheme
       ↓
useRoleTheme(): isRoleLight = isLightThemeScreenEnabled('role') && resolvedTheme === 'light'
       ↓
isRoleLight ? buildRoleLightSurfaces(tokens) : null  →  roleLt spread onto styles
       ↓
effectiveTokens forced to dark when !isRoleLight (buildThemeTokens('dark'))
```

**Important:** `RoleSelectScreen` merges `styles.*` (dark baseline from `index.tsx`) with optional `roleLt?.*` overrides. Light mode is an **overlay**, not a full re-skin.

---

## A3. Hardcoded dark colors (washed-out sources)

### `index.tsx` StyleSheet (always applied as base)

| Style key | Example value | Light impact |
|-----------|---------------|--------------|
| `roleUnifiedCockpitShell` | `backgroundColor: 'rgba(5,11,24,0.44)'` | Semi-dark panel on light canvas → muddy grey-violet “wash” |
| `roleCardCompact` | `PREMIUM_ROLE_CARD_BG` (`rgba(16,26,43,0.87)`) | Overridden by `roleLt.roleCardCompact` when light — **but** shadow still navy |
| `roleStepCircle` | `rgba(16,26,43,0.55)` | Overridden by `roleLt` when light |
| `roleStatusStripCompact` | `rgba(6,12,24,0.52)` | Overridden by `roleLt` when light |
| `roleTopTitle` / accents | Light text colors in baseline | Overridden by `roleLt.roleTopTitle` |

### `premiumAuthStyles.ts` constants

- `PREMIUM_ROLE_CARD_BG`, `PREMIUM_ROLE_CARD_BORDER`, `PREMIUM_ROLE_COCKPIT_FILL` — dark cockpit DNA; referenced ~30+ times in role styles.

### Partially fixed via `useRoleTheme` (good)

- Cockpit frame, step circles, card borders, CTA border, status strip — mapped to `LhThemeTokens` in `buildRoleLightSurfaces()`.

### Not fixed (icon / illustration layer)

| Asset layer | Issue |
|-------------|-------|
| `BlueprintIllustration` / `getBlueprintPalette()` | Single palette: cyan at 4–22% opacity, highlight `rgba(243,248,255,*)` — designed for **dark** hero wells |
| `PassengerSeatHero`, `DriverCockpitHero`, `CarHero`, `MotorcycleHero` | All use blueprint palette; no `useTheme` or `active + light` branch |
| `PremiumSelectionCard` hero slot | Uses `tokens.selectionCard.heroBackground` (light grey `#EEF2F7` area) — **palette strokes too faint** on that background |

---

## A4. Low-contrast icons / illustrations

**Symptom:** Vehicle and role blueprints look like faint cyan ghosts on white cards.

**Mechanism:**

```typescript
// BlueprintIllustration.tsx — getBlueprintPalette(active)
stroke: active ? 'rgba(34,211,238,0.88)' : 'rgba(94,210,230,0.56)'  // OK on dark
fill: active ? 'rgba(34,211,238,0.11)' : 'rgba(34,211,238,0.045)'   // Nearly invisible on white
grid: 'rgba(34,211,238,0.07)'                                         // Invisible on light hero
```

On light theme, `LIGHT_SELECTION_CARD_PRESETS.heroBackground` is `rgba(238,242,247,0.88)` — cyan-at-4% fill disappears.

**Ionicons** (checkmark, logout, settings) use `roleIn.accent` / explicit `#EF4444` — generally OK on light.

---

## A5. LHIS / LDS clarity without full redesign

Minimal visual-language fixes (styles + tokens only):

1. **Blueprint light palette** — Add `getBlueprintPalette(active, resolvedTheme)` with higher stroke opacity, darker teal stroke base (`#0D9488`), grid at `rgba(15,23,42,0.08)`, fill at 12–18% on light.
2. **Reduce double-glass stacking** — On light, use solid `#FFFFFF` cockpit shell (not translucent navy overlay); rely on `borderColors.cockpitPanel*` from LHIS light presets.
3. **Hero slot contrast ring** — One-pixel inner border on hero well using `tokens.border.emphasis` (already in selection card tokens).
4. **Active card lift** — Increase selected border width + `glowMid` on light; reduce dark-era `textShadowColor` on labels (currently cyan glow — weak on dark text).
5. **Step indicator** — Active step: filled accent circle + white numeral (LHIS light CTA pattern); inactive: `text.muted` outline only.

**Do not redesign:** card layout, 3-step flow, hero SVG geometry, animation timings.

---

## A6. File touch map (role/vehicle only)

| Priority | File | Change type |
|----------|------|-------------|
| P1 | `design-system/role-select/BlueprintIllustration.tsx` | Light palette branch |
| P1 | `lib/theme/useRoleTheme.ts` | Optional `blueprintPalette` export or illustration hint |
| P2 | `app/index.tsx` role StyleSheet | Replace dark rgba baselines with token references OR strip bases that duplicate `roleLt` |
| P2 | `components/premium/RoleSelectScreen.tsx` | Pass theme hint to heroes; tune title gradient fallback |
| P3 | Hero SVG files (`CarHero.tsx`, etc.) | Only if palette hook insufficient |

---

## A7. Expected outcome after patch

- Light role screen: white cockpit panel, readable navy/teal typography, **legible** blueprint icons.
- Dark role screen: unchanged (palette branch defaults to current values).
- Vehicle step: same card system — no new UI patterns.
