# Match Decision White Theme Analysis

**Sprint:** WHITE-THEME-B3-7A  
**Section:** B — “Eşleşme kararı” screen  

---

## B1. Which component renders “Eşleşme Kararı”?

**Host:** `app/index.tsx` passenger dashboard idle branch (`!activeTag`) ~13301–13420.

```tsx
<GlassSurface variant="panel" style={[styles.roleUnifiedCockpitShell, styles.passengerMatchDecisionCockpit]}>
  {/* top bar: back + logout — dashLt?.matchBackBtn */}
  <View style={styles.passengerMatchGuardianSlot} pointerEvents="none" />  {/* LeylekEye anchor */}
  <View style={styles.passengerMatchPhaseBlock}>
    <PremiumText variant="step">Eşleşme kararı</PremiumText>
    <PremiumText variant="caption" muted>Hızlı otomatik eşleşme veya teklif pazarı yolunu seçin.</PremiumText>
  </View>
  <PassengerMatchModeCards ... />
</GlassSurface>
```

**Cards:** `frontend/components/superUx/PassengerMatchModeCards.tsx` exclusively.

**Theme hooks on host:**

- `usePassengerTheme()` → `dashLt` (match back/logout buttons, container), `paxUi` (icon colors)
- `CockpitBackground` → token gradients ✓
- `GlassSurface` → token panel ✓

**Theme hooks on cards:** **None.**

---

## B2. Why cards look visually confusing (white theme)

### 1. Dark shell overrides on light token base

`PremiumSelectionCard` reads `useTheme()` and applies light `selectionCard` presets when global theme is light.  
Then `PassengerMatchModeCards` **overrides** via `style={cardShellStyle}`:

| Card type | Override | Effect on light |
|-----------|----------|-----------------|
| `normalHeroCard` | `backgroundColor: 'rgba(4, 10, 20, 0.28)'` | Dark smear on white card |
| `quickHeroCard` | cyan borders + `rgba(34,211,238,0.04)` fill | OK-ish but competes with light tokens |
| `trustedHeroCard` | indigo tint `rgba(79,70,229,0.05)` | Muddy on white |
| `heroCardDisabledShell` | `opacity: 0.58` + slate border | “Grey fog” — hard to read as disabled vs enabled |

### 2. Typography hardcoded to dark-mode colors

```typescript
heroTitle: { color: PREMIUM_TEXT_SOFT }        // rgba(243,248,255,0.94) — LIGHT coloured text
heroSubtitle: { color: 'rgba(148, 168, 196, 0.72)' }
```

On a **light** card background, `PREMIUM_TEXT_SOFT` (near-white) is **low contrast** → titles wash out or appear invisible depending on stack order.

### 3. Weak hierarchy between primary and secondary rows

- Row 1: Hemen Eşleş (disabled/soon) + Normal Eşleşme (enabled)
- Row 2: Yerime Al (disabled) + Sürücülerim/Yolcularım (conditional)

Both rows use **identical** `primaryCardMinHeight`, same title weight (800), same shell pattern. Differentiation is only:

- Badge pills (`OTOMATİK`, `TEKLİF PAZARI`, `Yakında`)
- Border tint family (cyan vs indigo vs amber)

On white theme, badges are small (9px uppercase) and sit in **checkmark slot** (top-right) — easy to miss.

### 4. Dark-mode leftovers in host styles

| Style | Value | Light issue |
|-------|-------|-------------|
| `passengerMatchBackBtn` / `LogoutBtn` baseline | `PREMIUM_ROLE_CARD_BG` | Partially fixed by `dashLt?.matchBackBtn` |
| `roleUnifiedCockpitShell` (shared with role select) | dark rgba panel | Same wash as role screen |
| `passengerMatchPhaseStep` | inherits `PremiumText` step — OK | Caption uses `muted` — OK |

### 5. Guardian eye slot competes with title block

`passengerMatchGuardianSlot` reserves `minHeight: LDS_SPACING.xxxl + xxs` for `LeylekEye` (absolute anchor from `LeylekZekaWidget`). On light background, dark eye capsule + low opacity reads as **orphan dot** between header and “Eşleşme kararı” — breaks vertical hierarchy.

---

## B3. Illustration layer (match heroes)

Same as role screen — `NormalMatchOfferHero`, `QuickMatchHero`, `TrustedNetworkHero`, `ProxyPickupHero` all use `BlueprintIllustration` dark palette → faint on light hero wells.

---

## B4. Improvement plan (no redesign)

### Title / phase block

- Keep copy; add light-specific `passengerMatchPhaseStep` color via `paxUi` or `dashboardSurfaces` extension (uppercase step label in `accent.primary`, weight 800).
- Caption: ensure `tokens.text.muted` (#64748B) — already via `PremiumText muted`.

### Card hierarchy (styles only)

| Element | Normal Eşleşme (enabled primary) | Others |
|---------|----------------------------------|--------|
| Shell | White + `border.emphasis` 2px + light shadow | `glassMuted` fill, 1px border |
| Title | `text.primary` 17px | `text.primary` 15px or muted if disabled |
| Subtitle | `text.muted` 11px | Same |
| Badge | Move to **below title** or left pill — not only checkmark slot | Keep “Yakında” pill |
| Disabled | Desaturate illustration + `opacity 0.65` + “Yakında” — not full card grey fog | |

### Contrast / opacity

- Remove `PREMIUM_TEXT_SOFT` from match card titles; use theme text tokens.
- Remove dark `backgroundColor` overrides on light; use `tokens.selectionCard.*`.
- Reduce iOS shadowOpacity on light (ambient `rgba(15,23,42,0.08)`).

---

## B5. Minimal file list

| File | Change |
|------|--------|
| `PassengerMatchModeCards.tsx` | Add `usePassengerTheme()` or `useTheme()`; replace StyleSheet hardcodes |
| `lib/theme/usePassengerTheme.ts` | Optional `matchCardSurfaces` preset (mirrors `buildRoleLightSurfaces` pattern) |
| `app/index.tsx` | `passengerMatchPhaseBlock` light text overrides; shared cockpit shell tokenization |
| `BlueprintIllustration.tsx` | Shared light palette (same as role fix) |

**No changes:** match routing, `onNormalPress`, trusted driver bridge, Quick Match wiring.

---

## B6. Acceptance criteria (visual QA)

1. White theme: “Eşleşme kararı” title readable at arm’s length.
2. “Normal Eşleşme” card clearly primary (border, title weight, illustration contrast).
3. Disabled cards readable as “Yakında” without grey soup.
4. Dark theme: pixel-parity with current production (regression gate).
