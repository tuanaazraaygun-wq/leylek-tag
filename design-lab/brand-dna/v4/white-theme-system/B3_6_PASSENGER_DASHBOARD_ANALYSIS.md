# B3-6 Passenger Dashboard Analysis

**Group:** 3 — Passenger Home / Dashboard  
**Patch:** B3-6d

---

## Scope

- `index.tsx` PassengerDashboard branch (~majority of file)
- `PassengerWaitingScreen.tsx`
- `SearchingMapView.tsx`
- `QuickMatchPassengerFlow.tsx`, `PassengerMatchModeCards.tsx`
- `TagMatchTransitionOverlay.tsx`
- Route picker / destination UI in index

---

## Current hardcoded colors

| File | Approx refs | Patterns |
|------|-------------|----------|
| `index.tsx` passenger | Very high | `#0F172A`, `#3FA9F5`, white chips on map |
| `PassengerWaitingScreen` | ~53 | PREMIUM + map overlay rgba |
| `SearchingMapView` | ~9 | Map chrome |
| `QuickMatchPassengerFlow` | ~37 | Glass + cyan CTAs |

---

## LHIS primitives

| Area | Primitives |
|------|------------|
| Waiting screen | Partial GlassSurface, PremiumText |
| Match mode cards | PremiumSelectionCard pattern |
| Main dashboard | **Mostly legacy** StyleSheet in index.tsx |
| Map overlays | Custom bottom sheets |

---

## Risk: **P0–P1** | Complexity: **Very High**

index.tsx passenger shell is largest migration surface after LiveMapView.

---

## Tokens needed

- `tokens.map.overlay`, `tokens.map.chrome`
- `tokens.bg.card`, `tokens.bg.elevated`
- `tokens.text.primary` on light sheets
- Destination chips → `tokens.chip.*` (new semantic)
- Offer cards → glass + border emphasis

---

## Migrate first

1. Extract **passenger shell wrapper** styles in index to token hook (scoped)
2. `PassengerWaitingScreen.tsx` shell
3. `PassengerMatchModeCards.tsx`
4. Route search bar fill/border
5. Defer full index.tsx pass to incremental PRs

---

## Files affected

```
frontend/app/index.tsx (passenger sections — multiple PRs)
frontend/components/PassengerWaitingScreen.tsx
frontend/components/SearchingMapView.tsx
frontend/components/superUx/QuickMatchPassengerFlow.tsx
frontend/components/superUx/PassengerMatchModeCards.tsx
frontend/components/TagMatchTransitionOverlay.tsx
```

---

## Must NOT change

- Match state machine
- Socket offer handlers
- Map camera behavior
- Quick match timing
- Bottom sheet snap points

---

## QA

| ID | Test |
|----|------|
| QA-6d-01 | Passenger search → waiting → matched dark |
| QA-6d-02 | Light mode bottom sheet contrast |
| QA-6d-03 | Offer list readability |
| QA-6d-04 | QM flow end-to-end |

---

## Rollback

Per-screen flag `passenger` off; index partial revert by section tags.

---

**Dependency:** Map markers (B3-6g) for full passenger map light experience.
