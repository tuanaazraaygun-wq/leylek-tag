# 02 — Match Card Visibility (Sürücülerim / Yolcularım)

**Finding:** Yolcu girişinde “Sürücülerim” görünmüyor veya çok küçük/kaymış. Sürücü yolcu modunda “Yolcularım” görmeli. Yerime AI gizli kalacak.

---

## Render tree

```
index.tsx (passenger match cockpit)
└─ ScrollView
   └─ GlassSurface.passengerMatchDecisionCockpit
      ├─ passengerMatchTopBar (back / logout)
      ├─ passengerMatchGuardianSlot (empty, 52dp reserved)
      ├─ passengerMatchPhaseBlock (“Eşleşme kararı”)
      └─ PassengerMatchModeCards
         ├─ Row 1: PRIMARY — Hemen Eşleş + Normal
         └─ Row 2: SECONDARY — Sürücülerim (solo centered)
```

**Integration:** `frontend/app/index.tsx` ~13371–13455  
**Component:** `frontend/components/superUx/PassengerMatchModeCards.tsx`

---

## Visibility controls

| Control | Value | Effect |
|---------|-------|--------|
| `RENDER_PROXY_MATCH_CARD` | `false` (line 123) | **Yerime Al hidden** — correct per spec |
| `visibleSecondaryCards` | filters out `proxy` when flag false | Only `trusted` (Sürücülerim) remains |
| `isEnabled` for trusted | `onTrustedPress` wired → always enabled | Card is interactive |
| Title swap | `isDriverViewer && hasDriverRegistration` | **Yolcularım** + “Sürücü Paneline Git” CTA |

Card is **not omitted from render tree** in current code. User reports likely describe **perceived** invisibility (below fold, narrow, low contrast).

---

## Root causes

### A. “Too small / misaligned”

```686:693:frontend/components/superUx/PassengerMatchModeCards.tsx
  heroCellSoloCentered: {
    flex: 0,
    flexGrow: 0,
    flexShrink: 0,
    width: '48%',
    maxWidth: (MATCH_DECK_MAX_WIDTH - LDS_SPACING.sm) / 2,
    alignSelf: 'center',
  },
```

- Primary row cards are ~50% each; solo secondary is **48% centered** → visually smaller and not edge-aligned with row above.
- UX-MATCHCARD-2A intentionally solo-centered after proxy hide; side effect is asymmetric deck.

### B. “Not visible” (below fold)

- `passengerMatchGuardianSlot` reserves **52dp** with no content (`index.tsx:13360`, styles ~21207).
- Two card rows + phase copy + top bar ≈ **300dp+** before secondary row.
- `ScrollView` with `flexGrow:1` — secondary card may require scroll on height &lt; ~720dp.

### C. Light theme readability

- `trustedHeroCard` uses hardcoded indigo rgba on white shell (`PassengerMatchModeCards.tsx` ~249–255).
- `PremiumSelectionCard` subtitle `opacity: 0.82` stacks on muted token.
- Driver CTA pill **fontSize 8** in corner (`PassengerMatchModeCards.tsx` ~745–767) — nearly invisible on light.

### D. Driver viewer (Yolcularım)

- Same 48% solo layout.
- `trustedPassengerCount` prop **declared but never passed** from `index.tsx` — subtitle falls back to generic copy.

---

## Yerime AI

**Status: correctly hidden.**

```122:123:frontend/components/superUx/PassengerMatchModeCards.tsx
/** UX-MATCHCARD-2A — Yerime Al placeholder; definition kept, UI hidden until feature ships. */
const RENDER_PROXY_MATCH_CARD = false;
```

Do not re-enable until product ships proxy feature.

---

## Recommended patch (style-only)

| Priority | Change | Files |
|----------|--------|-------|
| P1 | Widen `heroCellSoloCentered` to **52–56%** or fixed 220dp | `PassengerMatchModeCards.tsx` |
| P1 | Tokenize `trustedHeroCard` light fills to `tokens.selectionCard.*` | `PassengerMatchModeCards.tsx`, `usePassengerTheme.ts` |
| P1 | Move “Sürücü Paneline Git” from 8px corner pill to subtitle/footer CTA | `PassengerMatchModeCards.tsx` |
| P2 | Reduce `passengerMatchGuardianSlot.minHeight` or wire `LeylekZekaWidget` guardian eye into slot | `index.tsx`, `LeylekZekaWidget.tsx` |
| P2 | Pass `trustedPassengerCount` from index | `index.tsx` |
| P3 | Subtitle opacity override for match cards | `PremiumSelectionCard.tsx` or card prop |

**Do not change:** proxy hide flag, title swap logic, trusted press routing, backend.

---

## Verification checklist

- [ ] Yerime Al absent on light + dark
- [ ] Sürücülerim visible row 2 without scroll on 390×844
- [ ] Scroll reveals card on 360×640
- [ ] Driver + registration → Yolcularım title
- [ ] Card width visually balanced vs Hemen Eşleş / Normal row
