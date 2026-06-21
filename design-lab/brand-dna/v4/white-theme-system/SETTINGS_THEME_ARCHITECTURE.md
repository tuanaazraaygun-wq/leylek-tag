# Settings Theme Architecture

**Sprint:** B3-5 — Technical design (analysis only)

---

## Component graph

```
┌─────────────────────────────────────────────────────────┐
│ RootLayout                                              │
│   ThemeProvider                                         │
│     ├─ hydrate → lh_theme_mode_v1                       │
│     ├─ useColorScheme() → system resolve                │
│     ├─ lightThemeEnabled gate → resolvedTheme           │
│     └─ tokens → buildThemeTokens(resolved)              │
│           │                                             │
│           ├── settings-hub.tsx (B3-5)                   │
│           │     ThemeSettingsSegment                    │
│           │       └─ useTheme().setTheme(mode)            │
│           │                                             │
│           ├── index.tsx theme-choice (B3-3)             │
│           │     completeThemeChoice → setTheme + done   │
│           │                                             │
│           └── primitives (B3-4)                         │
│                 CockpitBackground, GlassSurface, …       │
└─────────────────────────────────────────────────────────┘
```

---

## Bridge pattern

**Existing stub:** `frontend/lib/theme/themeSettingsBridge.ts`

```typescript
// Target wiring (B3-5 production — spec only)
export function useThemeSettingsBridge(): ThemeSettingsBridge {
  const { themeMode, setTheme, hydrated } = useTheme();
  return createThemeSettingsBridge({
    getThemeMode: () => themeMode,
    setThemeMode: setTheme,
    isHydrated: () => hydrated,
  });
}
```

**Recommended location:** `frontend/hooks/useThemeSettingsBridge.ts` (thin wrapper — B3-5 patch)

**Why bridge:** Settings UI test edilebilir; mock bridge ile unit test. ThemeProvider API değişirse tek nokta.

---

## Settings integration points

| File | Change (B3-5) |
|------|----------------|
| `settings-hub.tsx` | Import `useTheme`, `ThemeSettingsSegment`; new card after Profil |
| `lib/featureFlags.ts` | `themeSettingsEnabled = readBoolEnv('EXPO_PUBLIC_FEATURE_THEME_SETTINGS')` |
| `components/settings/ThemeSettingsSegment.tsx` | **New** — 3-segment control |
| `themeSettingsBridge.ts` | Optional `useThemeSettingsBridge` export |

**No change:** ThemeContext core, themeStorage keys, navigation routes.

---

## setTheme() contract (already in ThemeProvider)

On settings segment change:

1. `await setTheme(mode)` — updates state + `lh_theme_mode_v1` + `lh_theme_resolved_v1`
2. Primitives re-render via context (B3-4)
3. **Do not** reset `lh_theme_choice_done_*` — user already completed first-run
4. Optional analytics: `theme_changed_settings` (future)

---

## Feature flag matrix

| Flag | Settings UI | Light render |
|------|-------------|--------------|
| all OFF | Hidden | Dark only |
| settings ON, light OFF | Show segments; Gündüz selects but resolves dark | Dark |
| settings ON, light ON | Full behavior | Light when mode=light |
| choice ON, settings ON | Both use same storage | Consistent |

**Gate UI:**

```typescript
if (!themeSettingsEnabled) return null; // no Görünüm card
```

---

## System theme subscription

Already in ThemeProvider:

- `useColorScheme()` from React Native
- `themeMode === 'system'` → `resolveThemeMode(mode, deviceScheme)`
- Settings segment "Sistem" seçiliyken OS dark/light toggle → `resolvedTheme` otomatik güncellenir

**No extra Settings code** — provider handles subscription.

---

## StatusBar / native chrome (B3-5 optional)

When `lightThemeEnabled` ON, consider central effect in ThemeProvider:

```typescript
// Future B3-5b — not in initial patch
StatusBar.setStyle(resolvedTheme === 'dark' ? 'light' : 'dark');
```

Settings change triggers same path as theme choice.

---

## Error handling

| Case | Behavior |
|------|----------|
| AsyncStorage write fail | Keep in-memory state; toast "Kaydedilemedi" |
| setTheme before hydrated | Disable segment until `hydrated === true` |
| useTheme outside provider | throw (existing) |

---

## Rollback

1. `EXPO_PUBLIC_FEATURE_THEME_SETTINGS=false` → hide Görünüm card
2. Revert `settings-hub.tsx` section only
3. Storage keys ignored — last mode still in AsyncStorage harmlessly

---

**Related:** `SETTINGS_THEME_STORAGE.md`, `THEME_SYNC_FLOW.md`
