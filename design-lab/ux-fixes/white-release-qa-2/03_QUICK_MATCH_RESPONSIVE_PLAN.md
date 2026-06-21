# 03 — Quick Match Responsive Layout Plan

**Finding:** Konumum / Farabi Sahnesi rota kartı çok büyük; “Hızlı eşleşme isteği gönder” çok altta; küçük/büyük telefonlarda simetrik olmalı.

**Primary file:** `frontend/components/superUx/QuickMatchPassengerFlow.tsx`  
**Parent:** `frontend/app/index.tsx` ~14917

---

## Layout hierarchy

```
Modal (full screen)
└─ SafeAreaView [flex:1]
   ├─ FlowHeader (fixed)
   └─ ScrollView [flexGrow:1 content]
      ├─ RouteSummaryCard        ← oversized vs searching phase
      ├─ GlassSurface contribution ← dark on light (no qmLt)
      ├─ ctaPreface (redundant copy)
      ├─ PrimaryButton "Hızlı eşleşme isteği gönder"
      └─ SecondaryButton "Kapat"
```

**Problem:** No sticky footer. CTA is last scroll child.

---

## Vertical budget (~680–770dp)

| Block | ~Height | Notes |
|-------|---------|-------|
| FlowHeader | 120–140 | Chip + title + subtitle |
| RouteSummaryCard | 170–200 | `numberOfLines={2}` both ends |
| Contribution card | 200–240 | Stepper 44×44, 2-line disclaimer |
| ctaPreface + gaps | ~100 | Duplicates header subtitle |
| Primary CTA | 52 | `minHeight: 52` |
| Secondary | 44+ | |

On **640–667dp** usable height → primary CTA **below fold**.

---

## Why route card feels large

1. **Two-line addresses** (`QuickMatchPassengerFlow.tsx` ~223–231) vs searching phase **one line** (`index.tsx` ~12448–12461).
2. `routeRow` uses `alignItems: 'flex-start'` — multi-line expands height.
3. `glassCard` padding `md` + `LDS_ELEVATION.chip` adds visual mass.
4. Distance meta row adds another line when present.

---

## Light theme gaps

| Element | `qmLt` override? |
|---------|------------------|
| modalRoot, header, route card | Yes |
| **Contribution card** | **No** — stays `rgba(16,26,43,0.88)` |
| Stepper, primary CTA | No — `PREMIUM_AUTH_*` |
| `QuickMatchLightSurfaces` type | Missing contribution/stepper/CTA keys |

Creates mixed dark slab on white canvas — card reads even heavier.

---

## Responsive gaps

- No `useWindowDimensions` breakpoints (contrast: `PassengerMatchModeCards.tsx` ~341–363).
- No `maxWidth: 440` center column (match deck convention).
- No font scale caps on QM text.

---

## Recommended patch plan

### Phase A — Layout architecture (highest impact)

1. Split: **header | scroll body | sticky footer** inside `SafeAreaView`.
2. Pin Primary + Secondary buttons in footer with bottom safe-area padding.
3. Remove or merge `ctaPreface` (~894) into header subtitle (~179).

### Phase B — Compact route card

4. Add compact breakpoints (height ≤650, width ≤360).
5. Compact: `numberOfLines={1}`; padding `sm`; align with searching route row (`index.tsx` ~6038).
6. Optional inline distance chip in header row.

### Phase C — Contribution card diet

7. Single-line label on compact.
8. Collapsible disclaimer (default collapsed).
9. Stepper 40px on very compact.

### Phase D — Light theme completion

10. Extend `QuickMatchLightSurfaces` in `usePassengerTheme.ts` (~108–129).
11. Apply `qmLt` to contribution card, stepper, primaryBtn.
12. Light-appropriate elevation (lower shadow opacity).

### Phase E — Symmetry

13. Optional `maxWidth: 440` + `alignSelf: 'center'` on card column.
14. Tall screens: `flex:1` scroll body with centered content; footer stays fixed.

**Scope:** Styles/layout only — no `useQuickMatchPassengerSession` API changes.

---

## QA matrix

| Device | Light | Dark | Pass criteria |
|--------|-------|------|---------------|
| 360×640 | ✓ | ✓ | CTA visible without scroll OR sticky footer always visible |
| 390×844 | ✓ | ✓ | Balanced vertical rhythm |
| 430×932 | ✓ | ✓ | No excessive dead zone below CTA |
| Font scale 1.3 | ✓ | ✓ | Footer not clipped |

---

## Key references

| Topic | Location |
|-------|----------|
| Request body | `QuickMatchPassengerFlow.tsx:805–911` |
| Route 2-line | `:223–231` |
| scrollContent | `:947–950` |
| Contribution no qmLt | `:812–878` |
| Light surfaces type | `usePassengerTheme.ts:108–129` |
| Searching route 1-line | `index.tsx:12445–12461` |
