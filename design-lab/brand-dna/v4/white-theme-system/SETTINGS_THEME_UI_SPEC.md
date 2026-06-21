# Settings Theme UI Spec

**Sprint:** B3-5  
**Target:** `frontend/app/settings-hub.tsx`  
**Design language:** LHIS premium cockpit

---

## Placement

```
┌─ Ayarlar header (GlassSurface header) ─┐
└────────────────────────────────────────┘

┌─ Profil ───────────────────────────────┐
│  Profilim                          >   │
└────────────────────────────────────────┘

┌─ Görünüm ──────────────────────────────┐  ← NEW (after Profil)
│  [  Gece  ] [ Gündüz ] [ Sistem ]      │
│  caption: anında uygulanır             │
└────────────────────────────────────────┘

┌─ Sürücü (driver only) ─────────────────┐
...
```

**Position rationale:**
- Universal (passenger + driver)
- Above role-specific settings
- Below identity (Profil) — user context first, appearance second

---

## Section: Görünüm

| Element | Spec |
|---------|------|
| Card title | `Görünüm` |
| Control | Inline 3-segment (recommended over navigation row) |
| Labels | **Gece** · **Gündüz** · **Sistem** |
| Caption | `Seçimin anında uygulanır.` (muted PremiumText caption) |
| Save button | **None** — instant apply |

---

## Segment control (LHIS)

```
┌──────────┬──────────┬──────────┐
│   Gece   │  Gündüz  │  Sistem  │
└──────────┴──────────┴──────────┘
     ▲ selected: meridian border 2px + fill 12% + subtle glow
```

| State | Visual |
|-------|--------|
| Selected | `tokens.borderColors.selected`, bg `accent.glowLow`, scale 1.0 |
| Unselected | `tokens.border.default`, bg transparent |
| Pressed | opacity 0.88 + selection haptic |
| Disabled (hydrating) | opacity 0.5, no press |

**Dimensions:**
- Min height 44pt per segment (accessibility)
- Border radius `LDS_RADIUS.md` outer track; inner segments `LDS_RADIUS.sm`
- Track: `GlassSurface variant="plain"` inset veya `tokens.bg.glassMuted` fill

---

## Premium LHIS details

| Token use | Application |
|-----------|-------------|
| `PremiumText` | Title + caption — theme-aware (B3-4) |
| `GlassSurface plain` | Görünüm card container |
| `tokens.accent.primary` | Selected segment accent |
| `CockpitBackground` | Screen backdrop — from theme context |

**Avoid:** Modal/bottom sheet for primary flow — adds friction; Theme Choice zaten first-run’da preview-heavy.

**Optional P2:** Compact preview swatch (8px dot) per segment — like ThemeChoiceScreen mini swatch.

---

## Flag OFF behavior

| Flag | UI |
|------|-----|
| `themeSettingsEnabled=false` | Entire Görünüm card **not rendered** |
| `lightThemeEnabled=false`, settings ON | All segments visible; Gündüz persists mode but app stays dark until light flag ON |

**Copy when light OFF (internal beta only):**

> Gündüz teması yakında — şu an Gece modu aktif.

Production default: hide Görünüm until both flags staged ON.

---

## Accessibility

| Requirement | Implementation |
|-------------|----------------|
| Role | `radiogroup` on container; each segment `radio` |
| Labels | "Gece teması", "Gündüz teması", "Sistem teması" |
| Selected state | `accessibilityState={{ selected: true }}` |
| Reduce motion | No scale animation on select |

---

## Haptic / sonic

| Event | Feedback |
|-------|----------|
| Segment change | `Haptics.selectionAsync()` |
| Sonic | None (avoid fatigue in settings) |

---

## Component proposal

**New file:** `frontend/components/settings/ThemeSettingsSegment.tsx`

**Props:**
```typescript
type ThemeSettingsSegmentProps = {
  disabled?: boolean;
};
```

**Internal:** `useTheme()` → `themeMode`, `setTheme`, `hydrated`

---

## Not in scope B3-5

- Profile screen theme row
- Website settings
- Separate `/theme-settings` route
- Theme Choice re-open row (P3)

---

**Related:** `SETTINGS_THEME_ARCHITECTURE.md`, `THEME_SYNC_FLOW.md`
