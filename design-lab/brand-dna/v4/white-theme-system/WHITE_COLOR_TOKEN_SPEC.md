# White Color Token Spec

**Sprint:** B-3  
**Mode:** Specification only  
**Date:** 2026-06-21

---

## Token architecture

```
lh_theme/
├── mode: dark | light | system
├── resolved: dark | light
├── dark/   (maps to existing PREMIUM_* where possible)
└── light/  (new LDS_LIGHT_*)
```

**SSOT target file (B3-1):** `design-lab/brand-dna/v4/white-theme-system/tokens/lh-theme-tokens.json`

---

## Semantic tokens — dark (existing → alias)

| Token ID | Current | Role |
|----------|---------|------|
| `bg.canvas` | `#08111F` | Root background |
| `bg.canvasMid` | `#0B1220` | Gradient mid |
| `bg.card` | `#101A2B` | Card fill |
| `bg.glass` | `rgba(16,26,43,0.76)` | Glass fill |
| `text.primary` | `rgba(243,248,255,0.94)` | Body |
| `text.muted` | `rgba(186,201,222,0.9)` | Secondary |
| `border.default` | `#1E3A5F` | Slate border |
| `accent.primary` | `#22D3EE` → **`#00D4AA`** migration | CTA, links |
| `accent.glow` | `rgba(34,211,238,0.12–0.45)` | Halos |
| `status.error` | `#F87171` | Error |
| `status.warning` | `#FBBF24` | Warning |
| `shadow.ambient` | `rgba(0,0,0,0.25)` | Elevation |

---

## Semantic tokens — light (new)

| Token ID | Value | Role |
|----------|-------|------|
| `bg.canvas` | `#F4F7FB` | Root — not pure white |
| `bg.canvasMid` | `#EEF2F7` | Gradient mid |
| `bg.card` | `#FFFFFF` | Card @ 100% |
| `bg.glass` | `rgba(255,255,255,0.72)` | Frost glass |
| `bg.glassMuted` | `rgba(238,242,247,0.88)` | Plain variant |
| `bg.elevated` | `#FFFFFF` | Modal/sheet |
| `text.primary` | `rgba(13,17,23,0.92)` | Void ink |
| `text.muted` | `#64748B` | Secondary |
| `text.inverse` | `#F5F7FA` | On accent buttons |
| `border.default` | `rgba(15,23,42,0.10)` | Hairline |
| `border.emphasis` | `rgba(0,212,170,0.28)` | Selected |
| `border.card` | `rgba(15,23,42,0.08)` | Card edge |
| `accent.primary` | `#00D4AA` | Meridian |
| `accent.primaryHover` | `#00BF9A` | Pressed |
| `accent.secondary` | `#0EA5E9` | Map/links only — sparing |
| `accent.glow` | `rgba(0,212,170,0.10–0.22)` | Reduced vs dark |
| `accent.ctaGradient` | `['#00D4AA','#22D3EE','#0EA5E9']` | CTA — contrast verify |
| `status.error` | `#DC2626` | Error on white |
| `status.warning` | `#D97706` | Warning |
| `status.success` | `#059669` | Success chip |
| `shadow.ambient` | `rgba(15,23,42,0.08)` | Card shadow |
| `shadow.modal` | `rgba(15,23,42,0.14)` | Modal |
| `map.overlay` | `rgba(255,255,255,0.92)` | Map bottom sheet |
| `map.chrome` | `rgba(244,247,251,0.94)` | Floating HUD |

---

## Gradient tokens — light cockpit

| Token | Stops |
|-------|-------|
| `gradient.cockpitBase` | `#F8FAFC` → `#F4F7FB` → `#EEF2F7` |
| `gradient.cockpitTopHaze` | `rgba(0,212,170,0.04)` → transparent |
| `gradient.cockpitSideVignette` | `rgba(15,23,42,0.03)` edges |
| `gradient.glassSheen` | white 8% → transparent |

---

## Component token mapping (quick ref)

| Component | Dark key | Light key |
|-----------|----------|-----------|
| CockpitBackground | `gradient.cockpitBase` dark | `gradient.cockpitBase` light |
| GlassSurface.panel | `bg.glass` + cyan border 14% | white 72% + border 10% |
| PremiumText | `text.primary` / muted | same IDs |
| Input fill | `rgba(16,26,43,0.87)` | `#FFFFFF` border |
| Button primary | CTA gradient | Same + shadow.ambient |

---

## Contrast targets (WCAG AA)

| Pair | Min ratio |
|------|-----------|
| text.primary on bg.canvas | 4.5:1 |
| text.muted on bg.canvas | 3:1 (large text only for muted body — prefer 4.5) |
| accent.primary on bg.canvas | 3:1 UI components |
| text.inverse on accent CTA | 4.5:1 |

---

## Migration mapping (premiumAuthStyles)

| Old constant | Dark token | Light token |
|--------------|------------|-------------|
| `PREMIUM_NAVY_DEEP` | bg.canvas | bg.canvas |
| `PREMIUM_AUTH_CYAN` | accent.primary | accent.primary |
| `PREMIUM_TEXT_SOFT` | text.primary | text.primary |
| `PREMIUM_GLASS_FILL` | bg.glass | bg.glass |

**B3-4:** Components consume `useTheme().colors.*` — not direct imports.

---

## Versioning

| Field | Value |
|-------|-------|
| Schema | `lh-theme-tokens@1.0.0` |
| Breaking | New token ID only — no rename post B3 freeze |

---

**Sonraki:** `WHITE_COMPONENT_SPEC.md`, `THEME_PROVIDER_ARCHITECTURE.md`
