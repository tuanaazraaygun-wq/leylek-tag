# Theme Provider Architecture

**Sprint:** B-3 — Technical design (spec only)  
**Date:** 2026-06-21

---

## Overview

```
┌─────────────────────────────────────────────────┐
│ RootLayout (_layout.tsx)                        │
│   ThemeProvider                                 │
│     ├─ hydrate theme from storage               │
│     ├─ resolve system → dark|light              │
│     └─ children                                 │
│         Stack / index / settings-hub            │
└─────────────────────────────────────────────────┘
```

---

## ThemeProvider

**Target path (B3-2):** `frontend/contexts/ThemeContext.tsx`

```typescript
// Spec types — not production code
type ThemeMode = 'dark' | 'light' | 'system';
type ResolvedTheme = 'dark' | 'light';

type ThemeContextValue = {
  mode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  colors: LhThemeColors;
  components: LhComponentPresets;
  hydrated: boolean;
  setMode: (mode: ThemeMode) => Promise<void>;
  completeThemeChoice: (mode: ThemeMode) => Promise<void>;
};
```

**Provider responsibilities:**

1. Load persistence on mount
2. Subscribe `useColorScheme()` when mode === `system'
3. Expose token object per resolved theme
4. Persist on `setMode`
5. Emit optional analytics event (future)

**Placement:** Wrap inside `SafeAreaProvider`, above `Stack` — sibling or parent to SocketProvider (theme independent of socket).

---

## useThemeMode hook

```typescript
// frontend/hooks/useThemeMode.ts
export function useThemeMode() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemeMode outside ThemeProvider');
  return ctx;
}

// Sugar
export function useResolvedTheme(): ResolvedTheme {
  return useThemeMode().resolvedTheme;
}

export function useThemeColors(): LhThemeColors {
  return useThemeMode().colors;
}
```

---

## Theme tokens

| Layer | Source |
|-------|--------|
| JSON SSOT | `design-lab/.../lh-theme-tokens.json` (B3-1) |
| Runtime builder | `frontend/lib/theme/buildTheme.ts` (B3-2) |
| Types | `frontend/lib/theme/types.ts` |

**Dark builder:** Map existing `PREMIUM_*` → semantic IDs (no visual change B3-2).

**Light builder:** `WHITE_COLOR_TOKEN_SPEC.md` values.

---

## Persisted storage

| Key | Type | Scope |
|-----|------|-------|
| `lh_theme_mode_v1` | `dark\|light\|system` | Device |
| `lh_theme_resolved_v1` | `dark\|light` | Device cache |
| `lh_theme_choice_done_${userId}` | `true` | Per user |

**Module:** `frontend/lib/theme/themeStorage.ts`

```typescript
// Spec API
getThemeMode(): Promise<ThemeMode | null>
setThemeMode(mode: ThemeMode, resolved: ResolvedTheme): Promise<void>
isThemeChoiceDone(userId: string): Promise<boolean>
markThemeChoiceDone(userId: string, mode: ThemeMode): Promise<void>
```

**Pattern reference:** `driverOfferSoundPrefs.ts` (per-user AsyncStorage).

---

## Hydration

```typescript
// Pseudocode flow
async function hydrateTheme(): Promise<void> {
  const cachedResolved = await AsyncStorage.getItem('lh_theme_resolved_v1');
  if (cachedResolved === 'dark' || cachedResolved === 'light') {
    applyResolved(cachedResolved);
    setHydrated(true);
  }
  const mode = (await getThemeMode()) ?? 'dark';
  const resolved = resolveTheme(mode, Appearance.getColorScheme());
  apply(mode, resolved);
  setHydrated(true);
}
```

**Gate (optional B3-2):**

```typescript
if (!hydrated) return <ThemeHydrationFallback />; // matches splash navy — no white flash
```

**Timeout:** 120ms → default dark.

---

## Fallback & migration default

| Scenario | Default |
|----------|---------|
| No keys | `mode: dark`, `resolved: dark` |
| Corrupt value | dark |
| Existing users (B3-2 deploy) | dark — **zero visual change** |
| theme_choice_done missing | Show theme choice on first post-legal login (B3-3 flag) |

**Migration:** No migration script — absent key = dark.

---

## User profile sync (optional B3-5)

| Phase | Behavior |
|-------|----------|
| B3-2–B3-4 | Local only |
| B3-5 | `PATCH /user/preferences` `{ ui_theme_mode }` |
| Conflict | `updated_at` newer wins; merge on login |

**Backend addition (future):** `users.ui_theme_mode text`, `users.ui_theme_updated_at`.

---

## Settings integration

See `SETTINGS_THEME_INTEGRATION_SPEC.md` — `settings-hub.tsx` consumes `setMode`.

---

## Feature flags

| Flag | Default | Purpose |
|------|---------|---------|
| `EXPO_PUBLIC_FEATURE_THEME_CHOICE` | `false` | B3-3 screen |
| `EXPO_PUBLIC_FEATURE_LIGHT_THEME` | `false` | B3-4 primitives |
| `EXPO_PUBLIC_FEATURE_THEME_SETTINGS` | `false` | B3-5 settings row |

**Implementation:** `frontend/lib/featureFlags.ts` — env or remote config later.

---

## StatusBar / native chrome

```typescript
// In ThemeProvider or layout effect
StatusBar.setStyle(resolvedTheme === 'dark' ? 'light' : 'dark');
```

Android navigation bar color from `colors.bg.canvas` (B3-4).

---

## Rollback plan

1. Feature flags all `false` → dark only code path
2. Remove ThemeProvider wrapper — one file revert `_layout.tsx`
3. AsyncStorage keys ignored — dark hardcode returns
4. No backend column until B3-5 — no DB rollback

---

## File map (future patches)

| Patch | Files |
|-------|-------|
| B3-1 | design-lab tokens JSON only |
| B3-2 | `ThemeContext.tsx`, `themeStorage.ts`, `buildTheme.ts`, `_layout.tsx` wrap |
| B3-3 | `ThemeChoiceScreen.tsx`, `index.tsx` gate |
| B3-4 | `CockpitBackground`, `GlassSurface`, `PremiumText` |
| B3-5 | `settings-hub.tsx` |

---

**Sonraki:** `THEME_CHOICE_SCREEN_SPEC.md`
