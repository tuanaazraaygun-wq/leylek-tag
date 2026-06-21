# 04 — Safe Patch Plan

**Sprint:** WHITE-FINAL-1A (read-only)  
**Ordering:** Smallest diff first; dark regression gates on every step.

---

## P0 — Already done (verify only)

| Item | Sprint | Action |
|------|--------|--------|
| Hide Yerime Al card | UX-MATCHCARD-2A | QA confirm `RENDER_PROXY_MATCH_CARD=false` |
| Center Sürücülerim / Yolcularım | UX-MATCHCARD-2A | QA solo row on devices |
| Match cockpit white LHS shell | WHITE-LHS-P0-1 | Regression pass |
| Role / guardian eye light | WHITE-ROLE-2A | Eye identity on light |

**No code unless QA fails centering** (width tweak only).

---

## P1 — Leylek Zeka light FAB + hint (frontend only)

**Goal:** FAB and contextual hint match LHS daylight; guardian eye unchanged.

| Step | File | Change |
|------|------|--------|
| 1 | `LeylekZekaWidget.tsx` | Branch on `resolvedTheme === 'light'` for `fabOuter`, `orbHintCapsule`, `orbAiBadge`, shadows |
| 2 | Same | Light: white/teal capsule; slate hint text; reduce shadow opacity ~40% |
| 3 | Optional | Swap FAB `Image` for `LeylekEye` size 56–60, `themeVariant` synced |

**Keep:** Chat open logic, socket, guardian anchors, motion profiles.

**Test:** Light map dashboard FAB; dark unchanged; hint readable.

---

## P1 — Leylek Zeka chat voice row light tokens

| Step | File | Change |
|------|------|--------|
| 1 | `LeylekZekaChat.tsx` | `voiceStatusTitle/Body` light variants using `tokens.text.*` |
| 2 | Same | `emptyState` title/body use theme tokens when `isLightShell` |

**Keep:** Panel structure, keyboard, voice pipeline.

---

## P1 — Markers white premium (frontend only, no assets)

| Step | File | Change |
|------|------|--------|
| 1 | `frontend/lib/theme/useMapMarkerTheme.ts` (new) | Return `{ sizeScale, glowOpacity, chromeTone }` from `resolvedTheme` |
| 2 | `mapMarkerChrome.tsx` | Optional `chromeTone` prop on `MapEntityMarkerImage` |
| 3 | `LiveMapView.tsx` | Apply scale + chrome from hook |
| 4 | `index.tsx` | `peerMapPinScale` from hook or replace with theme scale |

**Constants proposal:**

```typescript
// light
sizeScale: 1.2
glowOpacity: 0.55
// dark — today
sizeScale: 1.04
glowOpacity: 1.0
```

**Test:** APK light in-trip; dark pixel match baseline photos.

---

## P2 — Match card light token polish

| Step | File | Change |
|------|------|--------|
| 1 | `PassengerMatchModeCards.tsx` | `trustedHeroCard` light → `tokens.selectionCard.cardBackground` |
| 2 | Same | Optional solo width 48% → 52% if product wants |

---

## P2 — Marker light PNG pair (design-lab → assets)

1. Export in design-lab per `WHITE_THEME_STRATEGY.md`.
2. Add `getDriverMarkerImage(kind, theme)` selector — **new files**, no overwrite.
3. Wire in `mapNavMarkers.ts`.

---

## P3 — Deferred

| Item | Reason |
|------|--------|
| Map tile auto theme | Needs map style API audit |
| Trusted card driver panel flow | Logic unchanged |
| Chat panel height by flow | UX preference |
| Re-enable Yerime Al | Feature not ready |

---

## Suggested sprint split

| Sprint | Scope |
|--------|-------|
| **WHITE-FINAL-1B** | P1 Zeka FAB + hint light |
| **WHITE-FINAL-1C** | P1 markers scale/chrome |
| **WHITE-FINAL-2A** | P2 match card tokens + optional width |
| **WHITE-FINAL-2B** | P2 light PNG assets |

---

## Files touched summary (future)

| File | P1 Zeka | P1 Markers | P2 Cards |
|------|---------|------------|----------|
| `LeylekZekaWidget.tsx` | ✓ | | |
| `LeylekZekaChat.tsx` | ✓ | | |
| `mapMarkerChrome.tsx` | | ✓ | |
| `LiveMapView.tsx` | | ✓ | |
| `index.tsx` | | ✓ peer scale | |
| `useMapMarkerTheme.ts` | | ✓ new | |
| `PassengerMatchModeCards.tsx` | | | ✓ optional |

**Not in scope:** `backend/*`, QR, payment, socket, asset overwrite.
