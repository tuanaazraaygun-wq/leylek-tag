# 04 — Driver Cockpit White Readability Plan

**Finding:** Sürücü panelinde yazılar yeterince net değil; “Teklif bekleniyor” / saha operasyonu alanı White’a göre profesyonel değil; en alt field intelligence bar okunmuyor.

**Primary files:**
- `frontend/components/DriverOfferScreen.tsx`
- `frontend/app/index.tsx` (driver waiting shell ~19043–19122)
- `frontend/lib/theme/useDriverTheme.ts`
- `frontend/components/driver/driverWaitingShellStyles.ts`

---

## Architecture

```
index.tsx — driver idle (!driverInActiveTrip)
└─ waitingRoot + CockpitBackground
   ├─ Header glass (LeylekTAG · Kokpit)
   ├─ DriverDashboardPanel (online strip, stats)
   └─ DriverOfferScreen (embedded)
      ├─ Dispatch deck / request list OR empty state
      │  └─ “Teklif bekleniyor” + chips
      └─ mapCardShell (bottom)
         └─ fieldOpHud — Field Intelligence bar
```

---

## Light theme coverage today

### Wired via `osLt` (`buildDriverOfferScreenLightSurfaces`)

- `container`, `dispatchDeck`, `emptyStateCard`, `emptyChip`
- `mapChromeShell`, `fieldOpHudBrand` (accent color only)
- Request cards (`reqCard`, price, meta, accept/dismiss)

### **Not wired** — still dark HUD baselines

| UI block | Style issue | File:lines |
|----------|-------------|------------|
| **Teklif bekleniyor title** | Uses default `PremiumText` — no `osLt` text override | `DriverOfferScreen.tsx:2322–2327` |
| **emptyStatusText** | Hardcoded `rgba(186,235,245,0.95)` — light blue on white | `:3487–3490` |
| **emptyStatusPill** | Cyan dark pill `rgba(34,211,238,0.1)` | `:3457–3468` |
| **emptyOrb rings** | Dark navy rings | `:2284–2306` |
| **fieldOpHudTitle** | `PREMIUM_TEXT_SOFT` (#F0F9FF class) | `:2716–2721` |
| **fieldOpHudCaption** | Muted but no light branch | `:2723–2727` |
| **fieldOpMetricCell** | `backgroundColor: rgba(8,17,31,0.52)` | `:2737–2746` |
| **fieldOpMetricValue** | `PREMIUM_TEXT_SOFT` | `:2754–2759` |
| **fieldOpInsightLine** | `PREMIUM_TEXT_MUTED` 9px | `:2761–2766` |
| **fieldOpHud collapsed maxHeight** | 60dp — metrics clipped on some fonts | `:2687–2691` |
| **cockpitHeaderBrand** | No `dwsLt` text color — relies on PremiumText default | `driverWaitingShellStyles.ts:64–70` |
| **LeylekEyeTrigger** | Always dark navy capsule | `index.tsx:19088` |

### Waiting shell light surfaces (minimal)

```117:124:frontend/lib/theme/useDriverTheme.ts
function buildDriverWaitingShellLightSurfaces(tokens: LhThemeTokens) {
  return {
    waitingRoot: { backgroundColor: tokens.bg.canvas },
    cockpitHeaderBtnShell: { ... },
  };
}
```

Header title, glass surface, panel text — **no light overrides**.

---

## Root cause summary

1. **Partial token migration** — shells lightened; inner instrument HUD blocks retain dark cockpit palette.
2. **Micro typography** — field intel uses **8–11px** labels on light glass; insufficient contrast vs white `tokens.bg.glassMuted`.
3. **Metric cells are dark chips on light panel** — inverted contrast (dark boxes on white) looks unprofessional and hurts legibility.
4. **Empty state copy tuned for dark** — cyan/live-dot palette invisible or washed on white.

---

## Recommended patch plan

### P1 — Field intelligence bar (bottom)

1. Extend `DriverOfferScreenLightSurfaces` with:
   - `fieldOpHudTitle`, `fieldOpHudCaption`, `fieldOpMetricCell`, `fieldOpMetricLabel`, `fieldOpMetricValue`, `fieldOpInsightLine`
2. Light metric cells: white/elevated surface + slate border + teal accent value (mirror passenger match cards).
3. Increase collapsed `maxHeight` to **72–76dp** or allow 2-line insight without clip.
4. Apply `[styles.fieldOpMetricCell, osLt?.fieldOpMetricCell]` pattern.

### P1 — “Teklif bekleniyor” empty state

5. Add `osLt.emptyTitle`, `emptySubtitle`, `emptyStatusPill`, `emptyStatusText`.
6. Light pill: white surface + teal border + slate text (not `rgba(186,235,245)`).
7. Light orb: teal/slate rings instead of navy HUD.

### P2 — Header readability

8. Extend `DriverWaitingShellLightSurfaces` with `cockpitHeaderBrand: { color: tokens.text.primary }`.
9. Ensure `GlassSurface variant="header"` uses light header token when `isScopeLight`.

### P2 — Request cards (polish)

10. Verify `reqRouteText` muted contrast on light — may need `tokens.text.secondary` bump.

**Out of scope:** offer polling, map expand logic, accept/dismiss handlers, field intel metrics computation.

---

## Verification checklist

- [ ] White theme: “Teklif bekleniyor” title readable at arm’s length
- [ ] Empty status pill contrast WCAG-ish on white glass
- [ ] Field intel metrics — all 5 cells readable collapsed + expanded
- [ ] Insight line not truncated on Turkish copy
- [ ] Dark theme regression — unchanged dark HUD
- [ ] Motor vs car accent paths still distinct

---

## Key references

| Topic | Location |
|-------|----------|
| Empty state render | `DriverOfferScreen.tsx:2264–2350` |
| Field op HUD | `DriverOfferScreen.tsx:2394–2489` |
| Dark metric cell | `DriverOfferScreen.tsx:2737–2766` |
| Light surface builder | `useDriverTheme.ts:251–299` |
| Driver waiting shell | `index.tsx:19057–19122` |
