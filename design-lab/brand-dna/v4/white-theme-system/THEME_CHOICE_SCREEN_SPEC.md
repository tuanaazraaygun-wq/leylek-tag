# Theme Choice Screen Spec

**Sprint:** B-3  
**Mode:** UX/UI specification — no implementation  
**Route (proposed):** `screen === 'theme-choice'` in index.tsx OR `/theme-choice` modal

---

## Purpose

İlk authenticated login sonrası (legal sonrası) kullanıcıya **Gece / Gündüz / Sistem** seçtirir. Live preview — arka plan anında değişir. Seçim persist edilir; bir daha otomatik gösterilmez.

---

## Layout structure

```
┌─────────────────────────────────────┐
│         [LeylekTAG logo ~80px]      │
│                                     │
│   LeylekTAG görünümünü seç          │  ← PremiumText title
│   İstersen daha sonra ayarlardan    │  ← muted caption
│   değiştirebilirsin.                │
│                                     │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐│
│  │  GECE   │ │ GÜNDÜZ  │ │ SİSTEM  ││  ← preview cards
│  │ preview │ │ preview │ │ preview ││
│  └─────────┘ └─────────┘ └─────────┘│
│                                     │
│  ┌───────────────────────────────┐  │
│  │   Bu temayla devam et         │  │  ← primary CTA
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

**Background:** Live `CockpitBackground` — switches with selection.

---

## Preview cards (3)

| Card | mode value | Preview content |
|------|------------|-----------------|
| Gece | `dark` | Mini dark glass panel + cyan dot + "Kokpit" label |
| Gündüz | `light` | Mini white glass + meridian dot |
| Sistem | `system` | Split preview OR device icon + "Cihazınla aynı" |

**Interaction:**

- Tap card → `setPreviewMode(mode)` — **instant** background + card chrome update
- Selected card: meridian border 2px + glow 12% + scale 1.02 (LSX selection 120ms)
- Unselected: slate border 10%

**Accessibility:**

- `accessibilityRole="radio"` in group
- `accessibilityState={{ selected }}`
- Labels: "Gece teması", "Gündüz teması", "Sistem teması"

---

## CTA

| Element | Spec |
|---------|------|
| Label | "Bu temayla devam et" |
| Enabled | Always (one card always selected — default pre-select) |
| Action | `completeThemeChoice(selectedMode)` → persist → navigate role-select |
| Disabled state | None — skip yok |

---

## Default pre-selection

| Condition | Default card |
|-----------|--------------|
| Device `colorScheme === 'light'` | **Sistem** or **Gündüz** — product pick: **Sistem** (recommended) |
| Device dark | **Gece** |
| Unknown | **Gece** (brand safe) |

---

## Skip analizi

| Option | Recommendation |
|--------|----------------|
| Skip link | **Hayır** — bilinçli seçim |
| Back button | **Hayır** — blocking first-run |
| Android back | Confirm dialog veya ignore (stay on screen) |

One-tap with smart default satisfies speed without skip.

---

## Small screen (SE, 320px)

- Cards: horizontal scroll OR vertical stack (preferred **vertical stack** 3 rows — bigger touch targets)
- Logo: 64px
- Padding: 16px
- CTA sticky bottom safe area

---

## Haptic / sonic

| Event | Feedback |
|-------|----------|
| Card tap | `lsx.haptic.selection` |
| CTA confirm | `lsx.haptic.light` + optional `ui_tap` sonic at low volume |
| No sound on preview switch | Avoid fatigue |

---

## Logo

- Asset: `leylek-logo-premium.png` (dark bg) — light bg may need alternate export (logo evolution) — B3-4 verify contrast

---

## Feature flag

`FEATURE_THEME_CHOICE=false` → screen never mounted; `theme_choice_done` auto-set on first login? **No** — flag off = skip entirely, dark default, no done flag until flag on.

---

## Integration snippet (spec)

```typescript
// After handleLegalAccept success path:
if (FEATURE_THEME_CHOICE && user?.id && !(await isThemeChoiceDone(user.id))) {
  setScreen('theme-choice');
} else {
  setScreen('role-select');
}
```

---

## QA hooks

- `testID="theme-choice-screen"`
- `testID="theme-card-dark"` etc.
- Screenshot tests dark/light/system previews

---

**Sonraki:** `SETTINGS_THEME_INTEGRATION_SPEC.md`
