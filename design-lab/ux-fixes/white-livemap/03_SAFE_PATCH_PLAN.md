# WHITE-LIVEMAP-1A — Safe Patch Plan

**Sprint:** WHITE-LIVEMAP-1A  
**Mode:** Read-only recommendation (implementation = future sprint)  
**Constraints:** Styles only — no map logic, socket, QR/chat/trust handlers, navigation camera, or backend.

---

## Design answers (safest production-aligned choices)

### Map style — should it be light?

**Yes.** When `isScopeLight === true`:

| Option | Recommendation | Rationale |
|--------|----------------|-----------|
| A. New `LIGHT_MAP_STYLE` JSON | **Preferred** | Matches LHIS light canvas (`#F4F7FB`, `#EEF2F7` roads); keeps brand control; polylines stay teal `#00D4AA` / `#22D3EE` |
| B. `customMapStyle={undefined}` | Acceptable fallback | Google default light; zero maintenance; less brand-aligned |
| C. Keep dark map | **Reject** | Root of clash + transparent-card illusion |

Implementation sketch (no code change now):

```typescript
const { isScopeLight, ui, chromeSurfaces: jLt } = useLiveMapChromeTheme();
const activeMapStyle = isScopeLight ? LIGHT_MAP_STYLE : DARK_MAP_STYLE;
// ...
customMapStyle={activeMapStyle}
```

Extract existing array to `DARK_MAP_STYLE`; add ~25-rule light palette (invert landscape/water/road fills to light grays, dark label text). Consider `frontend/lib/theme/mapStyles.ts` to avoid 11k-line file growth.

**Polyline note:** Cyan strokes remain readable on light basemap; optionally bump `strokeColor` to `tokens.accent.primary` when light.

---

### Cards — opaque white?

**Yes, for matched journey chrome.** Target:

| Token | Light value | Use |
|-------|-------------|-----|
| `tokens.bg.elevated` | `#FFFFFF` | Top route shell, bottom deck fill |
| `tokens.bg.glass` at ≥0.94 | or solid white | Inner chips — avoid 0.55 dark rgba baselines |
| Border | `tokens.border.default` | Replace `LDS_BORDER_COLOR.cardTopCyan` stacks on light |

**Not** full glass blur over dark map:

- Change `jLt` builders to use `elevated` / opaque white for `topRouteShell`, `paxBottomDeckShell`, `drvBottomDeckShell`.
- Keep subtle top accent border (`borderTopColor: tokens.borderColors.cardTopCyan`).

`GlassSurface` variants on light already near-opaque (`header` 0.94, `plain` `#FFFFFF`) — ensure StyleSheet baselines **stop re-introducing** `rgba(5,11,24,0.55)` when `jLt` present (either remove baseline bg on light path or override completely).

---

### CTA — black-on-white?

**Tiered (match role/passenger B3-7B pattern):**

| Tier | Light treatment |
|------|-----------------|
| Primary (QR scan / trip end) | Filled `tokens.accent.primary` bg + `tokens.text.inverse` label **OR** white bg + dark text + accent border — pick one; current bug is mixed |
| Secondary (chat, güven) | White/`elevated` bg + `tokens.text.primary` + `tokens.border.default` |
| Call FAB | Accent ring + white fill + accent icon (or filled accent circle + inverse icon) |
| Driver nav chip | Keep gradient CTA but fix **label** to use `ui.textSoft` / `tokens.text.primary` on light gradient ends |

**Fix `ui.ctaIcon` split in `buildJourneyUi`:**

- `ctaIconOnDark`: `tokens.text.inverse` (for filled accent / gradient CTAs)
- `ctaIconOnLight`: `tokens.text.primary` (for outline/white buttons)

LiveMap icon rows should use `ctaIconOnLight` for comm + QR when button bg is light.

---

### Danger button — how should it look?

Light semantic tokens already define:

- `status.error`: `#DC2626`
- Light danger pattern (from `useRoleTheme` / B3-7B): bg `rgba(220,38,38,0.08–0.10)`, border `rgba(220,38,38,0.28–0.35)`, text `#DC2626`

Apply to `paxBottomEndBtn`, `driverRideForceBtn`, force-end in deck:

- Add `jLt.paxBottomEndBtn` / `jLt.drvBottomEndBtn` in `useJourneyTheme.ts`
- Replace pastel-on-dark `rgba(252,165,165,0.92)` text with `tokens.status.error`
- Do **not** change `onPress` / `onForceEnd` / Safer FE branching

---

## Minimal patch file list

| Priority | File | Changes |
|----------|------|---------|
| P0 | `frontend/components/LiveMapView.tsx` | Map style gate; light typography overrides for matched-journey styles; comm button light surfaces; conditional text colors via `ui` or `isScopeLight`; keep all handlers identical |
| P0 | `frontend/lib/theme/useJourneyTheme.ts` | Opaque card surfaces; comm/danger `jLt` keys; split `ctaIcon`; optional `typography` helper colors for route line text |
| P1 | `frontend/lib/theme/mapStyles.ts` (new) | `DARK_MAP_STYLE` (move from LiveMapView), `LIGHT_MAP_STYLE` |
| P2 | `frontend/app/index.tsx` | Trip banner text styles if audit finds hardcoded light colors on `passengerTripBanner*` / `driverTripBanner*` — banner shells already have `jLt` |
| — | `GlassSurface.tsx` | **No change** — already theme-aware |
| — | QR modals / `useQrPaymentTrustTheme.ts` | **No change** for LiveMap sprint — modals already migrated |
| — | Chat components | Out of scope unless opening chat from map still acceptable dark |

**Estimated touch surface:** 2 required files + 1 new constants file; ~200–400 lines style diff in `LiveMapView` (mostly StyleSheet splits or runtime style arrays), not logic.

---

## Suggested implementation phases

### Phase 1 — Map + deck substrate (highest visual impact)

1. Light map style when `isScopeLight`
2. Opaque white bottom deck + top route shell via `jLt`
3. Fix QR button icon/label contrast

### Phase 2 — Typography sweep (matched journey subset)

Replace hardcoded colors in:

- `matchedTopRouteLineText`, `paxTopLiveChipText`, `matchedTopPriceChipText`, `paxTopNearChipText`
- `driverYolcuyaGitChipLabel`
- `trustedAddCompactChipText` → `tokens.accent.primary` on light

Pattern: `style={[styles.foo, isScopeLight && { color: ui.textSoft }]}` or extend `ui` with `routeLineText`, `chipText`.

### Phase 3 — Comm row parity

Add `jLt.paxBottomCallBtn`, `paxBottomChatBtn`, `paxBottomGuvenBtn` (+ driver mirrors).

### Phase 4 — QA matrix

| Case | Passenger | Driver |
|------|-----------|--------|
| Pre-boarding matched | light map + cards + QR boarding CTA | Yolcuya Git chip |
| Boarding confirmed | dimmed comm opacity still readable | Hedefe Git |
| Trip end QR | trip-end border accent | drv QR buttons |
| Force end | danger btn contrast | force end |
| Trusted chip | cyan readable on white | same |

---

## Explicit non-goals

- Marker PNG redesign
- Nav immersive driver UI full light pass (can follow Phase 2 subset)
- Chat/Muhabbet screen theme
- Changing `boardingConfirmed` opacity rules
- Backend or feature flags (already ON by default)

**SAFE PATCH PLAN COMPLETE.**
