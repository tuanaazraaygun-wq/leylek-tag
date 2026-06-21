# White Theme Patch Plan

**Sprint:** B-3 — Planning only  
**Date:** 2026-06-21

---

## Patch sequence overview

```
B3-1  design-lab tokens + docs        (no prod)
B3-2  ThemeProvider + storage         (prod, invisible)
B3-3  Theme choice screen             (flag OFF default)
B3-4  Light primitives                (flag OFF default)
B3-5  Settings integration            (flag OFF default)
B3-6  Gradual screen migration        (flag per screen)
B3-7  QA + release gate               (flags ON staged)
```

---

## B3-1 — Theme token architecture (design-lab only)

**Goal:** SSOT token JSON + bridge docs — zero production touch.

| Deliverable | Path |
|-------------|------|
| Token JSON | `design-lab/brand-dna/v4/white-theme-system/tokens/lh-theme-tokens.json` |
| Dark→semantic map | `tokens/PREMIUM_ALIAS_MAP.md` |
| Component preset schema | `tokens/COMPONENT_PRESET_SCHEMA.md` |

**Production changes:** None

**Exit:** Stakeholder token review

---

## B3-2 — ThemeProvider + storage

**Goal:** Infrastructure; **default dark; UI visually unchanged**.

| File | Change |
|------|--------|
| `contexts/ThemeContext.tsx` | New |
| `lib/theme/themeStorage.ts` | New |
| `lib/theme/buildTheme.ts` | New — dark maps to exact PREMIUM_* |
| `app/_layout.tsx` | Wrap ThemeProvider |
| `hooks/useThemeMode.ts` | New |

**Flags:** None required — dark-only path

**QA:** Q1 dark regression

**Rollback:** Remove provider wrap

---

## B3-3 — Theme choice screen

**Goal:** First-run UX; **feature flag OFF** in production builds initially.

| File | Change |
|------|--------|
| `components/onboarding/ThemeChoiceScreen.tsx` | New |
| `app/index.tsx` | Gate after legal; `screen='theme-choice'` |
| `lib/featureFlags.ts` | `FEATURE_THEME_CHOICE` |

**Default:** Flag false → bypass to role-select

**QA:** Q2 theme choice flow (internal TestFlight flag true)

---

## B3-4 — White theme primitives

**Goal:** CockpitBackground, GlassSurface, PremiumText theme-aware.

| File | Change |
|------|--------|
| `design-system/primitives/*.tsx` | `useTheme()` colors |
| `tokens/gradient.ts` | Light gradients OR buildTheme |

**Flag:** `FEATURE_LIGHT_THEME` — when false, force dark preset in primitives

**Scope:** Primitives only — not index.tsx mass migration

---

## B3-5 — Settings integration

**Goal:** User can change theme post first-run.

| File | Change |
|------|--------|
| `app/settings-hub.tsx` | Görünüm section |
| Optional backend | `users.ui_theme_mode` + API |

**Flag:** `FEATURE_THEME_SETTINGS`

---

## B3-6 — Gradual screen migration

**Priority order (safest first):**

| Order | Screen / area | Rationale |
|-------|---------------|-----------|
| 1 | `settings-hub.tsx` | Small, already LDS |
| 2 | `LoginScreen` + auth chrome | Isolated |
| 3 | Theme choice screen | Self-dogfood |
| 4 | Role select | High visibility — after primitives stable |
| 5 | `DriverOfferScreen` | Map + lists — high risk |
| 6 | `LiveMapView` / waiting | Map tokens |
| 7 | `index.tsx` remainder | Largest debt last |

**Per-screen flag:** `FEATURE_LIGHT_THEME_SCREENS=settings,login` env list

---

## B3-7 — QA + release gate

| Step | Action |
|------|--------|
| 1 | Internal QA full matrix |
| 2 | TestFlight 10% `FEATURE_THEME_CHOICE=true` |
| 3 | Monitor crash + flicker reports |
| 4 | Enable light theme flags staged |
| 5 | Production 100% per `WHITE_THEME_RELEASE_GATE.md` |

---

## Dependencies

| Dependency | Blocks |
|------------|--------|
| Logo evolution `#00D4AA` | Accent token finalization — can alias `#22D3EE` interim |
| Marker light exports | Map screens in B3-6 |
| Legal flow stable | Theme choice insertion point |

---

## Rollback summary

| Patch | Rollback |
|-------|----------|
| B3-1 | Delete design-lab files |
| B3-2 | Revert _layout + delete context |
| B3-3 | Flag off |
| B3-4 | Flag off — primitives use dark branch |
| B3-5 | Hide settings section |
| B3-6 | Per-screen flag off |
| B3-7 | All flags off |

---

**Sonraki:** `WHITE_THEME_RELEASE_GATE.md`
