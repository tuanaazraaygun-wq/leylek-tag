# Settings Theme Integration Spec

**Sprint:** B-3  
**Target:** `frontend/app/settings-hub.tsx`

---

## Current settings hub

| Section | Rows |
|---------|------|
| Account | Profile info |
| Legal | KVKK, privacy, terms routes |
| Support | Links |
| Danger | Logout |

**Theme row:** **Yok**

---

## Proposed addition (B3-5)

### Section: "Görünüm"

| Row | Icon | Label | Behavior |
|-----|------|-------|----------|
| Theme | `contrast-outline` | Görünüm | Opens theme picker sheet |

**Alternative inline:** Segmented control on same screen (3 segments) — better for discoverability.

---

## Segmented control design (recommended)

```
Görünüm
┌────────┬────────┬────────┐
│  Gece  │ Gündüz │ Sistem │
└────────┴────────┴────────┘
```

- Immediate apply on segment change (no separate save button)
- Haptic selection on change
- Matches theme choice semantics

---

## Modal alternative

Tap row → bottom sheet:

- Same 3 preview cards as theme choice (compact)
- "Kaydet" — or instant apply

---

## Persistence

On change:

```typescript
await setThemeMode(mode); // ThemeProvider
// Optional B3-5:
await syncThemeToBackend(userId, mode);
```

Update `lh_theme_resolved_v1` cache immediately.

---

## Relationship to first-run theme choice

| Scenario | Behavior |
|----------|----------|
| User changed in settings | `theme_choice_done` stays true |
| Re-open theme choice from settings | **Not required** — settings is sufficient |
| Optional advanced row | "Tema seçim ekranını tekrar göster" — debug/education — **P3 skip** |

---

## Styling

- Use `GlassSurface` + `PremiumText` — theme-aware after B3-4
- Selected segment: meridian fill 12% + border
- Hub background: `CockpitBackground` from theme context

---

## Website

**Out of scope B3** — website stays dark. Mobile-only settings.

---

## Rollback

Hide section when `FEATURE_THEME_SETTINGS=false`.

---

## QA

- [ ] Change dark→light in settings — instant apply
- [ ] Kill app — theme persists
- [ ] Logout/login same user — theme restored
- [ ] System mode follows device toggle (manual test)

---

**Sonraki:** `WHITE_THEME_RISK_REGISTER.md`
