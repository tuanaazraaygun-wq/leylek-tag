# B3-6 Role Select Analysis

**Group:** 2 — Role Selection  
**Patch:** B3-6b

---

## Scope

- `RoleSelectScreen.tsx` (887 lines)
- `index.tsx` role-select branch (handlers, overlays)
- `PremiumSelectionCard` (B3-4 theme-aware ✅)
- Role hero illustrations (`CarHero`, `DriverCockpitHero`, etc.)
- `RoleSelectAmbienceBackground` grid
- Leylek Zeka entry (chrome context — not full screen)

---

## Current hardcoded colors

| Area | Values |
|------|--------|
| RoleSelectScreen styles | `PREMIUM_TEXT_SOFT`, cyan edges, overlay gradients |
| index.tsx overlays | `PREMIUM_ROLE_OVERLAY`, foreground ambient |
| Hero illustrations | SVG/asset embedded dark palette |
| Ambience grid | Cyan grid lines on dark |

---

## LHIS primitive usage

| Component | Status |
|-----------|--------|
| CockpitBackground | ✅ Theme-aware |
| GlassSurface | ✅ Used in header/chrome |
| PremiumSelectionCard | ✅ Theme-aware (B3-4) |
| PremiumText | ✅ Theme-aware |
| Hero SVGs | ❌ Fixed colors |
| Admin modal embed | ❌ Legacy AdminPanel |

**High primitive coverage** — role select benefits most from `lightThemeEnabled` after auth.

---

## Risk: **P1** | Complexity: **Medium**

Illustrations on white canvas may need opacity overlay adjustment — **not** redraw.

---

## Tokens needed

- `tokens.selectionCard.*` (done)
- `tokens.gradients.*` cockpit
- `tokens.borderColors.selected`
- `tokens.bg.glass` header panels
- Role overlay → new semantic `tokens.overlay.roleCinematic` (design-lab add)

---

## Migrate first

1. `RoleSelectScreen.tsx` StyleSheet → `useTheme()` for text/border
2. index.tsx role overlay constants → token refs
3. `RoleSelectAmbienceBackground` — theme prop for grid opacity
4. Hero components — **phase 2** (asset tint only)

---

## Files affected

```
frontend/components/premium/RoleSelectScreen.tsx
frontend/app/index.tsx (role-select overlay imports only)
frontend/design-system/role-select/RoleSelectAmbienceBackground.tsx
frontend/design-system/role-select/*Hero.tsx (phase 2)
```

---

## Must NOT change

- Card layout, hero height formulas
- Vehicle selection logic
- Continue CTA enable rules
- Admin panel embed behavior
- Selection motion (useSelectionMotion)

---

## QA

| ID | Test |
|----|------|
| QA-6b-01 | Dark regression role cards |
| QA-6b-02 | Light mode card selection glow |
| QA-6b-03 | Illustrations readable (overlay dim) |
| QA-6b-04 | Passenger + driver paths |

---

## Rollback

Remove `role` from screen flag list; PremiumSelectionCard dark path unchanged.
