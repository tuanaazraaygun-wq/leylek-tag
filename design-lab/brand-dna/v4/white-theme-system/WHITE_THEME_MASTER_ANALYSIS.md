# White Theme Master Analysis

**Sprint:** B-3 — White Theme + First Login Theme Choice  
**Mode:** Read-only analysis — no production changes  
**Date:** 2026-06-21  
**Status:** Analysis complete

---

## Executive summary

LeylekTAG today runs as a **single dark premium cockpit theme**. There is no `ThemeProvider`, no persisted theme preference, and no light token layer. Expo declares `userInterfaceStyle: "automatic"` in `app.json`, but the UI ignores device appearance — colors are hardcoded via `premiumAuthStyles.ts` and thousands of inline styles in `app/index.tsx`.

This sprint defines the **LHIS White Theme system** and a **first-login theme choice flow** (Gece / Gündüz / Sistem) as design-lab documentation only. Implementation is deferred to patches B3-1 through B3-7.

**Recommended decisions:**

| Decision | Recommendation |
|----------|----------------|
| Theme choice timing | After login + legal consent, before role select |
| Skip button | No — explicit choice required; smart default pre-selected |
| Persistence | AsyncStorage first (`lh_theme_mode_v1`, per-user completion flag); optional Supabase sync in B3-5 |
| Default for existing users | Dark — zero visual change until flags enabled |
| White theme philosophy | Not inverted dark — separate LHIS light DNA (see `WHITE_THEME_DNA.md`) |
| First safe patch | **B3-1** — design-lab token JSON + alias map only |

---

## Current state (production scan)

### What exists

| Area | Finding |
|------|---------|
| Theme provider | None |
| Color SSOT | `premiumAuthStyles.ts` → `design-system/tokens/color.ts` (dark only) |
| LHIS primitives | `CockpitBackground`, `GlassSurface`, `PremiumText` — dark hardcoded |
| Persistence pattern | AsyncStorage used for `legal_accepted`, `last_role_*`, sound prefs — **no theme keys** |
| Backend profile | No `ui_theme_mode` field found |
| Boot flow | Splash → loadUser → login OR role-select; legal modal after auth |
| Settings | `settings-hub.tsx` — no theme row |
| StatusBar | Fixed `style="dark"` in `_layout.tsx` |

### Boot sequence (today)

```
Splash (dark, premium logo)
  → loading / loadUser
  → [unauthenticated] LoginScreen (KVKK checkbox on form)
  → [authenticated, !legal_accepted] Legal modal
  → [authenticated] role-select OR resume dashboard
```

### Insertion point (proposed)

```
… → Legal consent complete
  → Theme Choice (first time per userId only)
  → Role select / dashboard
```

Full rationale: `THEME_CHOICE_FLOW_ANALYSIS.md`

---

## White theme design principles

White Theme is **not** dark with inverted hex values.

| Principle | Rule |
|-----------|------|
| Canvas | Soft off-white `#F4F7FB` — never pure `#FFFFFF` full-screen |
| Glass | Frost white 72% opacity + hairline borders — not dark glass with white text |
| Accent | Meridian `#00D4AA` — shared genom with logo/marker evolution |
| Depth | Shadows replace glow halos; reduced cyan bloom |
| Map | Light chrome overlays; marker light exports required for B3-6 |
| Motion / sonic | Same LSX events; haptic unchanged; optional lighter tap sonic variant later |

Component-level rules: `WHITE_COMPONENT_SPEC.md`  
Token values: `WHITE_COLOR_TOKEN_SPEC.md`  
Design philosophy: `WHITE_THEME_DNA.md`

---

## Theme choice UX (spec summary)

| Element | Spec |
|---------|------|
| Logo | LeylekTAG premium bird, top center |
| Title | "LeylekTAG görünümünü seç" |
| Subtitle | "İstersen daha sonra ayarlardan değiştirebilirsin" |
| Cards | 3 large previews: Gece, Gündüz, Sistem |
| Interaction | Tap card → instant background + preview change |
| Selection | Premium border / glow on active card |
| CTA | "Bu temayla devam et" — disabled until tap (or smart default pre-selected) |
| Skip | **No** — avoids ambiguous default; reduces support burden |
| Accessibility | Radio group semantics, 44pt targets, contrast on both themes |
| Feedback | `ui_tap` sonic + light haptic on card select |

Full spec: `THEME_CHOICE_SCREEN_SPEC.md`

---

## Technical architecture (spec summary)

```
ThemeProvider (_layout.tsx wrap)
  ├─ hydrate from AsyncStorage (blocking gate ≤120ms)
  ├─ resolve system → dark|light via useColorScheme
  ├─ expose colors + component presets
  └─ setMode / completeThemeChoice → persist

useThemeMode() → { mode, resolvedTheme, colors, hydrated, setMode }
```

| Concern | Approach |
|---------|----------|
| Flicker | Hydrate before first themed paint; neutral splash; default dark |
| Migration default | Missing key → `dark` + mark choice incomplete for new auth only |
| Offline | Local AsyncStorage authoritative |
| System mode | Subscribe Appearance API; debounce 100ms |
| Feature flags | `FEATURE_THEME_CHOICE`, `FEATURE_LIGHT_THEME`, per-screen list |
| Rollback | Flags off → identical to pre-B3 behavior |

Full architecture: `THEME_PROVIDER_ARCHITECTURE.md`  
Settings: `SETTINGS_THEME_INTEGRATION_SPEC.md`

---

## Risk summary

| P0 risks | Mitigation |
|----------|------------|
| Existing users theme breaks | B3-2 dark-only path; flags off |
| Legal flow regression | Theme after legal; no legal copy on theme screen |
| Dark regressions | Dark tokens = exact PREMIUM_* alias |

| P1 risks | Mitigation |
|----------|------------|
| Startup flicker | Hydrate gate + resolved cache |
| Low contrast light mode | WCAG matrix in QA plan |
| Map / offer UI | Gradual B3-6 migration |

Full register (20 items): `WHITE_THEME_RISK_REGISTER.md`

---

## Patch plan (B3-1 → B3-7)

| Patch | Scope | Production? |
|-------|-------|-------------|
| **B3-1** | Token JSON + design-lab docs | No |
| B3-2 | ThemeProvider + storage, dark default, no UI change | Yes (invisible) |
| B3-3 | Theme choice screen, flag OFF | Yes (dormant) |
| B3-4 | Light primitives (CockpitBackground, GlassSurface, PremiumText) | Yes (flagged) |
| B3-5 | Settings integration | Yes (flagged) |
| B3-6 | Gradual screen migration | Yes (per-screen flags) |
| B3-7 | QA + staged release | Yes |

Detail: `WHITE_THEME_PATCH_PLAN.md`  
Release gates: `WHITE_THEME_RELEASE_GATE.md`  
QA matrix: `WHITE_THEME_QA_PLAN.md`

---

## Recommended Patch B3-1 (next action)

**B3-1 — Theme token architecture (design-lab only)**

Deliverables already specified in this folder:

1. `tokens/lh-theme-tokens.json` — semantic dark/light/system token SSOT
2. Cross-reference docs (this sprint's 13 MD files)
3. Stakeholder review of accent migration `#22D3EE` → `#00D4AA`

**Zero production file changes.** No frontend, backend, website, or asset edits.

---

## Safe implementation order

```
1. B3-1  Review token JSON + WHITE_THEME_DNA sign-off
2. B3-2  Ship ThemeProvider (dark only) — verify QA-DR-* regression
3. B3-3  Ship theme choice behind FEATURE_THEME_CHOICE=false
4. B3-4  Light primitives behind FEATURE_LIGHT_THEME=false
5. B3-5  Settings row (same flags)
6. B3-6  Migrate: settings → login → theme choice → role → map screens
7. B3-7  Enable flags staged per WHITE_THEME_RELEASE_GATE.md
```

**Do not** enable theme choice before B3-2 hydrate is stable.  
**Do not** enable light theme before B3-4 primitives pass QA-V-*.

---

## Document index

| # | File | Purpose |
|---|------|---------|
| 1 | `WHITE_THEME_MASTER_ANALYSIS.md` | This document |
| 2 | `CURRENT_THEME_INVENTORY.md` | Production theme scan |
| 3 | `THEME_CHOICE_FLOW_ANALYSIS.md` | Flow timing + 10 questions |
| 4 | `WHITE_THEME_DNA.md` | Design principles |
| 5 | `WHITE_COLOR_TOKEN_SPEC.md` | Semantic color tokens |
| 6 | `WHITE_COMPONENT_SPEC.md` | Per-component light rules |
| 7 | `THEME_PROVIDER_ARCHITECTURE.md` | Provider, hook, hydration |
| 8 | `THEME_CHOICE_SCREEN_SPEC.md` | First-run UX spec |
| 9 | `SETTINGS_THEME_INTEGRATION_SPEC.md` | Settings hub integration |
| 10 | `WHITE_THEME_RISK_REGISTER.md` | 20 risks |
| 11 | `WHITE_THEME_QA_PLAN.md` | Test matrix |
| 12 | `WHITE_THEME_PATCH_PLAN.md` | B3-1–B3-7 detail |
| 13 | `WHITE_THEME_RELEASE_GATE.md` | Staged rollout gates |

**B3-1 artifact:** `tokens/lh-theme-tokens.json`

---

## Cross-program dependencies

| Dependency | Impact |
|------------|--------|
| Logo evolution P2 | Light logo variant on white canvas |
| Marker evolution B2 | Light map marker PNG exports |
| Brand v4 `#00D4AA` | Accent token finalization |
| LSX sonic/haptic | Theme choice feedback tokens exist |

---

## Production untouched confirmation

This sprint created **only** files under:

`design-lab/brand-dna/v4/white-theme-system/`

No changes to: `frontend/`, `backend/`, `website/`, assets, `app.json`, package files, navigation, or git state.

---

**End of B-3 analysis.**
