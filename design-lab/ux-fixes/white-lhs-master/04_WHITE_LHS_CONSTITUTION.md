# WHITE-LHS-MASTER-1A — White LHS Design Constitution

**Sprint:** WHITE-LHS-MASTER-1A  
**Purpose:** Single source of truth for **LHS Premium daylight mode** — not dark-theme inversion.

Canonical token sources:

- `frontend/lib/theme/semanticTokens.ts` → `LIGHT_SEMANTIC_TOKENS`
- `frontend/lib/theme/lhisPresets.ts` → `LIGHT_*_PRESETS`
- `frontend/design-system/tokens/*` → spacing, radius, motion (theme-agnostic)

---

## 1. Background

| Token | Value | Usage |
|-------|-------|-------|
| `bg.canvas` | `#F4F7FB` | Screen root, modal backdrop behind map |
| `bg.canvasMid` | `#EEF2F7` | Phase chips, secondary wells |
| `gradients.cockpitBase` | `#F8FAFC` → `#F4F7FB` → `#EEF2F7` | `CockpitBackground` |
| `gradients.cockpitTopHaze` | `rgba(0,212,170,0.04)` | Subtle teal wash — never navy vignette |
| `gradients.cockpitSideVignette` | `rgba(15,23,42,0.03)` | Edge depth — not `rgba(0,0,0,0.35)` |

**Rule:** No full-screen `#08111F` / `#0F172A` gradients when `resolvedTheme === 'light'`. Map fallback uses canvas gradient only.

---

## 2. Surface

| Token | Value | Usage |
|-------|-------|-------|
| `bg.card` / `bg.elevated` | `#FFFFFF` | Primary cards, modals |
| `bg.glassMuted` | `rgba(238,242,247,0.88)` | Nested wells, nav pills, disabled-adjacent areas |
| `glassSurface.plain` | `#FFFFFF` + sheen | Inline cards |
| `glassSurface.panel` | `rgba(255,255,255,0.72)` | Cockpit shells — **must not be overridden by `rgba(5,11,24,*)`** |

**Rule:** Surfaces are **opaque or frosted white**, not translucent navy stacked on white canvas.

---

## 3. Elevated card

| Property | Light spec |
|----------|------------|
| Background | `#FFFFFF` or `selectionCard.cardBackground` |
| Border | `1px` `rgba(15,23,42,0.08)`; top rim `rgba(0,212,170,0.12)` |
| Shadow | `rgba(15,23,42,0.08–0.10)` — ambient, not `#01050c` 42% |
| Selected | `selectionCard.cardSelectedBackground` + `borderColors.selected` 2px |
| Elevation preset | `LIGHT_ELEVATION_PRESETS.panel` / `.cockpit` |

**Rule:** Match decision “Normal Eşleşme” primary card = white + emphasis border — not cyan fill at dark-mode opacity.

---

## 4. Text

| Role | Token | Value | Never use on light |
|------|-------|-------|-------------------|
| Primary | `text.primary` | `rgba(13,17,23,0.92)` | `PREMIUM_TEXT_SOFT`, `#F8FAFC` on white |
| Secondary | `text.muted` | `#64748B` | `rgba(186,201,222,*)` |
| Inverse | `text.inverse` | `#F5F7FA` | On **filled** accent/danger CTAs only |
| Step label | accent primary | `#00D4AA` | Uppercase phase labels (“Eşleşme kararı”) |

**Rule:** If background luminance > 0.85, primary text must be slate-near-black.

---

## 5. Accent usage

| Token | Value | Usage |
|-------|-------|-------|
| `accent.primary` | `#00D4AA` | Icons, live dots, price emphasis |
| `accent.secondary` | `#0EA5E9` | Map pick secondary, links |
| `accent.glowLow/Mid/High` | teal alphas 0.10–0.22 | Badges, rims, selected wells — not full card fill |
| CTA gradient | `['#00D4AA', '#22D3EE', '#0EA5E9']` | Primary buttons (“Tam burası”, QR) |

**Rule:** Teal is **signal**, not atmosphere. Dark mode cyan glow at 0.04 on entire hero → reduce to glowLow on light.

---

## 6. Disabled cards

| State | Spec |
|-------|------|
| Shell | `bg.glassMuted`, `border.default`, no heavy shadow |
| Opacity | Illustration + badge only (~0.65) — **not** whole-card 0.58 grey fog |
| Copy | `text.muted` title; “Yakında” pill mandatory |
| Touch | `accessibilityState.disabled` unchanged |

---

## 7. Danger

| Token | Value | Usage |
|-------|-------|-------|
| `status.error` | `#DC2626` | Cancel, force-end copy |
| Danger surface | `rgba(220,38,38,0.08)` bg + `0.28` border | Cancel tag, end trip |
| Icons | `status.error` or `rgba(248,113,113,0.92)` | Close/cancel on light pills |

**Rule:** Do not use dark-mode `rgba(127,29,29,0.22)` panels without light equivalent (already in `jLt` danger keys).

---

## 8. Map overlay

| Layer | Light spec |
|-------|------------|
| Tiles | Google default (`customMapStyle` undefined) |
| Top fade | `rgba(244,247,251,0.92)` → transparent — not `rgba(8,17,31,0.38)` |
| Pin labels | `text.primary` on `bg.elevated` pill |
| Route polyline | `#00D4AA` / `#0EA5E9` — token-driven, 4px |
| Loading overlay | `shadow.modal` scrim + `text.muted` |

---

## 9. Input / search

| Element | Spec |
|---------|------|
| Field bg | `#FFFFFF` or `bg.elevated` |
| Border | `rgba(15,23,42,0.10)` default; focus `accent.glowMid` |
| Text | `text.primary` 16–17px semibold |
| Placeholder | `text.muted` |
| Suggestion row | White / `glassMuted` hover; **no** `rgba(15,23,42,0.88)` rows |
| Variant name | `lhs-daylight` (new) — replaces forced `tech` in route picker |

---

## 10. CTA hierarchy

| Tier | Visual |
|------|--------|
| Primary | Filled accent gradient or `accent.primary` solid; label `text.inverse` |
| Secondary | `glassMuted` + `border.default`; label `text.primary` |
| Tertiary | Text-only `accent.primary` |
| Destructive | Danger surface + `status.error` label |

Pickup flow: “Konumumu kullan” = secondary; “Haritadan seç” = secondary; search = primary field focus — not all cyan-bordered dark glass.

---

## 11. Icon contrast

| Context | Icon color |
|---------|------------|
| On white / glass | `accent.primary` or `text.primary` |
| On accent fill | `text.inverse` |
| Muted actions | `text.muted` |
| **Forbidden** | `ctaIcon: text.inverse` on `bg.elevated` comm buttons |

Minimum contrast target: WCAG AA for primary controls (4.5:1 body, 3:1 large).

---

## 12. Glass opacity rules

| Variant | Background | When |
|---------|------------|------|
| `panel` | `rgba(255,255,255,0.72)` | Cockpit outer |
| `stage` | `rgba(255,255,255,0.82)` | Map inset |
| `header` | `rgba(255,255,255,0.94)` | LiveMap top bar |
| `plain` | `#FFFFFF` | Cards, list rows |

**Rules:**

1. On light map, prefer **header/plain** (higher opacity) for bottom deck.
2. Sheen gradients stay; swap navy sheen for white/teal sheen (already in `LIGHT_GRADIENT_PRESETS`).
3. Never stack >1 translucent navy layer.

---

## Implementation checklist (for patch authors)

- [ ] Replace `PREMIUM_TEXT_SOFT` with `tokens.text.primary` on light paths
- [ ] Every `GlassSurface` + shared shell style must merge scope `*Lt` cockpit override
- [ ] `PlacesAutocomplete` must respect theme or explicit daylight variant
- [ ] Style arrays: **`[darkBaseline, lightOverride]`** — override must include `backgroundColor` + `color`
- [ ] Dark theme: keep `DARK_*` paths byte-identical when `resolvedTheme === 'dark'`

**WHITE LHS CONSTITUTION COMPLETE.**
