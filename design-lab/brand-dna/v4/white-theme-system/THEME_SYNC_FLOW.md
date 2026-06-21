# Theme Sync Flow

**Sprint:** B3-5 — Theme Choice ↔ Settings ↔ ThemeProvider

---

## Unified SSOT

```
                    lh_theme_mode_v1
                           ▲
           ┌───────────────┼───────────────┐
           │               │               │
    Theme Choice      Settings         (future cloud)
    completeTheme     setTheme()
    Choice()          segment
           │               │
           └─────── ThemeProvider.setTheme()
                           │
                    lh_theme_resolved_v1
                           │
                    buildThemeTokens(resolved)
                           │
                    LHIS primitives + screens
```

**Single write API:** `ThemeProvider.setTheme(mode)` — never write AsyncStorage from Settings UI directly.

---

## First login flow (flags ON)

```
Splash (dark)
  ↓
Login / OTP
  ↓
Legal consent
  ↓
Theme Choice (if !lh_theme_choice_done_{userId})
  │  User picks Gece/Gündüz/Sistem
  │  completeThemeChoice(userId, mode, setTheme)
  │    → lh_theme_mode_v1 = mode
  │    → lh_theme_choice_done_{userId} = true
  ↓
Role select (renders with resolved theme)
  ↓
Dashboard
```

---

## Settings change flow (B3-5)

```
Dashboard → Settings hub
  ↓
Görünüm segment tap
  ↓
setTheme(newMode)
  ↓
Instant UI update (primitives + hub shell if migrated)
  ↓
User back → dashboard retains theme
```

**No theme choice re-show** — `choice_done` stays true.

---

## Cross-surface consistency

| User action | themeMode | choice_done | resolvedTheme |
|-------------|-----------|-------------|---------------|
| Choice: Gece | dark | true | dark |
| Settings: Gündüz | light | true | light (if light flag ON) |
| Settings: Sistem | system | true | follows device |
| Choice then Settings | last write wins | true | per mode |

---

## System theme dynamic sync

```
themeMode = 'system'
deviceScheme = useColorScheme()  // 'light' | 'dark'
resolvedTheme = resolveThemeMode('system', deviceScheme)
```

| OS event | App behavior |
|----------|--------------|
| User toggles iOS Dark Mode | `useColorScheme` updates → provider re-resolves → UI updates |
| Android system theme change | Same |
| Settings shows "Sistem" selected | Segment stays Sistem; resolved flips |

**Debounce (optional P2):** 100ms on Appearance listener if flicker reported — not required for B3-5 MVP.

---

## Flag interaction matrix

| themeChoice | themeSettings | lightTheme | User experience |
|-------------|---------------|------------|-----------------|
| OFF | OFF | OFF | Today — dark only, no UI |
| ON | OFF | OFF | First-run choice; no settings row |
| OFF | ON | OFF | Settings row; Gündüz stored but dark render |
| ON | ON | ON | Full product |

**Recommended rollout:** light ON → settings ON → choice ON (TestFlight).

---

## Logout / multi-account

```
User A: mode=light, choice_done=true
Logout
User B login: mode still light (device key)
User B choice_done=false → Theme Choice shows (if flag ON)
User B picks dark → mode=dark
```

**Product decision:** Accept device carry-over phase 1; document in support FAQ.

---

## Provider hydration vs Settings mount

```
App cold start
  ↓
ThemeProvider hydrate (≤120ms)
  ↓
hydrated=true, themeMode from storage
  ↓
Settings hub opens
  ↓
ThemeSettingsSegment reads themeMode — must match storage
```

**Guard:** Disable segments until `hydrated === true` to avoid flash of wrong selection.

---

## Future cloud sync hook (design)

On login after token refresh:

```typescript
async function syncThemeOnLogin(userId: string) {
  const remote = await fetchUserThemePreference(userId);
  if (remote && remote.updatedAt > localUpdatedAt) {
    await setTheme(remote.mode);
  } else if (localMode) {
    await pushUserThemePreference(userId, localMode);
  }
}
```

Local `lh_theme_updated_at_v1` key optional for merge — B3-5f.

---

**Related:** `SETTINGS_THEME_STORAGE.md`, `SETTINGS_THEME_ARCHITECTURE.md`
