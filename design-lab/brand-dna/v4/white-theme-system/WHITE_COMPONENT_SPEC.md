# White Component Spec

**Sprint:** B-3  
**Rule:** White ≠ invert dark. Each surface redesigned for light readability.

---

## Background

| Surface | Dark | White |
|---------|------|-------|
| Root | Navy gradient stack | Mist `#F4F7FB` + subtle top cyan haze 4% |
| Safe area | Transparent on navy | Same |
| Scroll | — | Slight bottom fade `#EEF2F7` |

---

## CockpitBackground White

| Layer | Spec |
|-------|------|
| Base gradient | `gradient.cockpitBase` light |
| Grid | **Optional** — slate 6% opacity, lower contrast than dark |
| Horizon | Slate line 8% @ 66% height |
| Side vignette | 3% slate — lighter than dark 28% |
| Top haze | Meridian 4% — not 6.5% cyan neon |

**Prop:** `<CockpitBackground theme={resolved} showGrid />`

---

## GlassSurface White

| Variant | Background | Border | Sheen |
|---------|------------|--------|-------|
| panel | white 72% | 10% slate | top frost 12% |
| header | white 94% | 12% slate | diagonal sheen |
| stage | white 80% | meridian 18% | panel sheen |
| plain | `#EEF2F7` 88% | 8% slate | minimal |
| selected | + meridian border 28% | emphasis ring |

**No** dark rgba fills on white theme.

---

## Card

- Fill: `bg.card` white
- Shadow: `shadow.ambient`
- Radius: unchanged `LDS_RADIUS`
- Inner rim: slate 6% hairline (replaces cyan inner rim)

---

## Button

| Type | White spec |
|------|------------|
| Primary CTA | Meridian gradient + shadow 8% + text inverse |
| Secondary | White fill + slate border + primary text |
| Ghost | Transparent + accent text |
| Disabled | `#E2E8F0` fill + muted text — not dark navy block |

---

## Input

- Fill: white
- Border: `rgba(15,23,42,0.12)` default; meridian focus
- Placeholder: `#94A3B8`
- No inner glow — 1px focus ring

---

## Search Bar

- Glass plain variant
- Icon slate 500
- Clear button muted
- Map search (destination modal): white chrome bar + shadow

---

## Modal

- Scrim: `rgba(15,23,42,0.35)` — lighter than dark 60%
- Sheet: white elevated + `shadow.modal`
- Handle: slate 200 pill

---

## Bottom Sheet

- Same as modal sheet
- Top edge highlight 1px white 80%
- Map sheets: `map.overlay` token

---

## Alert / Toast

| Type | White |
|------|-------|
| AppAlert | White card + icon color semantic |
| Toast | Frost white 92% + left accent stripe |
| Error | Red 50 background tint optional |

---

## Status Chip

- Fill: semantic 10% tint background
- Text: semantic 700-level
- Border: hairline matching

---

## Map Overlay

- Floating HUD: `map.chrome`
- Leylek Zeka FAB: white tile border meridian 28%
- Google logo area: unchanged
- Polylines: meridian — saturation same, width +0.5px on light tiles

---

## Offer Card / Quick Match / Trust

- Same GlassSurface panel white rules
- QM dashed ring: meridian stroke
- Trust warm resolve: `#C8E6D0` 25% ring
- **Retire** orange/green hardcoded seeking squares on white

---

## QR Modal / Payment Modal

- Camera area: unchanged (dark viewfinder OK)
- Chrome frame: white glass
- Lock ring animation: meridian peak 22% opacity (not 50%)

---

## Driver / Passenger Cockpit

- Instrument panels: white glass
- Online strip: success tint 8% background when online
- Map stage: white border meridian 14%

---

## Role Selection

- Illustration: dim overlay 12% or light-specific PNG export (B3-6)
- Role cards: white glass + meridian selected edge
- Ambient shadow: slate not navy

---

## Login

- `PremiumAuthScreenShell` white cockpit
- Logo: premium PNG OK on light — verify contrast
- KVKK links: accent primary underline

---

## Splash

- **Phase 1:** Always dark (brand) — no white splash
- **Phase 2 optional:** Light splash variant if user chose light before restart

---

## Leylek Zeka paneli

- Tile: white 88% + meridian border
- Chat bubbles: white / mist alternating
- LeylekEye: increase socket shade contrast

---

## Implementation note

All specs via `useTheme().components.*` presets in B3-4 — not per-screen hex.

---

**Sonraki:** `THEME_PROVIDER_ARCHITECTURE.md`
