# 01 — Match Card Simplification

**Sprint:** WHITE-FINAL-1A (read-only)  
**Scope:** Passenger match decision cockpit — `PassengerMatchModeCards.tsx` + `index.tsx` shell

---

## Goal recap

1. Hide **“Yerime Al”** (proxy / AI placeholder) card.
2. **Sürücülerim** (passenger) / **Yolcularım** (driver viewer) — single bottom card, **centered** below primary row.

---

## Current state (production)

### Already shipped — UX-MATCHCARD-2A

| Mechanism | Location | Effect |
|-----------|----------|--------|
| `RENDER_PROXY_MATCH_CARD = false` | `PassengerMatchModeCards.tsx:123` | Proxy card filtered from render; definition kept |
| `visibleSecondaryCards` | `:333–336` | `SECONDARY_CARDS.filter(... card.id !== 'proxy')` when flag false |
| `soloSecondaryRow` | `:338` | `visibleSecondaryCards.length === 1` |
| `heroRowSolo` | `:651, :677–679` | `justifyContent: 'center'` on bottom row |
| `heroCellSoloCentered` | `:523, :686–693` | Solo cell: `width: '48%'`, `maxWidth: (440 - gap) / 2`, `alignSelf: 'center'` |

**Result:** With proxy hidden, bottom row is **one card** (trusted / Sürücülerim / Yolcularım) at ~48% deck width, horizontally centered.

### Layout structure (unchanged top row)

```
┌─────────────────────────────────────┐
│  Hemen Eşleş  │  Normal Eşleşme     │  ← PRIMARY_CARDS (2-up)
├─────────────────────────────────────┤
│         ┌──────────────┐            │
│         │ Sürücülerim  │            │  ← solo secondary, centered
│         └──────────────┘            │
└─────────────────────────────────────┘
```

- Deck max width: `MATCH_DECK_MAX_WIDTH = 440` (aligned with role-select cockpit).
- Guardian eye slot sits **above** cards in `index.tsx` (`passengerMatchGuardianSlot`), not inside the card deck.

---

## Remaining gaps (White / UX polish)

| Gap | Severity | Notes |
|-----|----------|-------|
| **Card title “Yerime Al”** still in `SECONDARY_CARDS` source | P3 | Intentional — flip `RENDER_PROXY_MATCH_CARD` when feature ships |
| **Solo width 48%** may feel narrow on large phones | P2 | Product may want 52–56% or fixed dp (e.g. 200) for “hero” presence |
| **Light theme trusted card** uses hardcoded indigo rgba fills | P1 | `buildLightMatchCardTheme` `:249–255` — not fully tokenized vs LHS white elevated card |
| **Disabled “Hemen Eşleş”** light opacity | P2 | `heroCardDisabledShell` light uses `opacity: 1` + glassMuted — OK; dark uses 0.58 |
| **Driver “Yolcularım”** uses same solo layout | OK | `hasDriverRegistration` swaps title/subtitle + driver panel CTA pill |
| **Phase caption** still mentions “Hızlı otomatik” | P3 | Copy-only; not a layout bug |

---

## index.tsx integration

- Match cockpit: `dashLt?.matchCockpitShell` (from `usePassengerTheme`) — P0 white LHS patch applied in WHITE-LHS-P0-1.
- `PassengerMatchModeCards` receives `onTrustedPress`, `onQuickPress`, `onNormalPress`; trusted wired when handler present.
- Guardian: empty `passengerMatchGuardianSlot` reserves space; **Leylek Zeka eye** renders in overlay via `LeylekZekaWidget` (`homeFlowScreen === 'dashboard'`, passenger match guardian mode).

---

## Verification checklist (no code change)

- [ ] Proxy card not visible (passenger + driver roles).
- [ ] Bottom card centered on 360 / 390 / 430 dp widths.
- [ ] Light theme: trusted card readable (title, subtitle, illustration).
- [ ] Driver with registration: “Yolcularım” + panel CTA centered same as Sürücülerim.
- [ ] Re-enable path: set `RENDER_PROXY_MATCH_CARD = true` → two-up bottom row returns.

---

## Recommendation for next patch (WHITE-FINAL-1B)

**P2 only if product wants visual tweak:**

- Adjust `heroCellSoloCentered.width` from `48%` → `52%` (style-only).
- Tokenize `trustedHeroCard` light fills to `tokens.selectionCard.*` (no layout change).

**No action needed** for hide + center — **already implemented**.
