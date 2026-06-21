# WHITE-THEME-QA-1A — Build & Environment Analysis

**Sprint:** WHITE-THEME-QA-1A  
**Mode:** Read-only analysis  

---

## How theme flags enter the APK

```
eas.json profile.env  (or shell EXPO_PUBLIC_*)
        │
        ▼
Metro bundler (expo export / embed bundle)
        │
        ▼
process.env.EXPO_PUBLIC_* inlined in JS bundle
        │
        ▼
featureFlags.ts module init (compile-time constants)
        │
        ▼
ThemeProvider + scoped hooks at runtime
```

**Not Gradle-native.** Android `assembleRelease` does not read `eas.json`. Gradle only packages the **already-built** JS bundle unless Metro runs with env set.

---

## EAS profiles (current repo state)

All four build profiles include identical theme env:

```json
"EXPO_PUBLIC_FEATURE_LIGHT_THEME": "true",
"EXPO_PUBLIC_FEATURE_LIGHT_THEME_SCREENS": "*",
"EXPO_PUBLIC_FEATURE_THEME_CHOICE": "true",
"EXPO_PUBLIC_FEATURE_THEME_SETTINGS": "true"
```

| Profile | Android output | Theme env |
|---------|----------------|-----------|
| `simple` | APK (`assembleRelease`) | ✅ all true |
| `development` | Debug APK | ✅ all true |
| `preview` | APK | ✅ all true |
| `production` | AAB | ✅ all true |

**Note:** B3-6h design docs describe production default **OFF**; **`eas.json` currently overrides that for release builds.** Code default when env **unset** remains OFF (`featureFlags.ts`).

---

## Local build vs EAS build

| Aspect | EAS build | Local Gradle / `expo run:android` |
|--------|-----------|-----------------------------------|
| Theme env source | `eas.json` profile `env` | Shell / `.env` (none committed) |
| Default if unset | N/A (EAS sets true) | **All flags false** |
| `lightThemeEnabled` | `true` | `false` |
| `themeChoiceEnabled` | `true` | `false` |
| `themeSettingsEnabled` | `true` | `false` |
| `lightThemeScreens` | `Set('*')` | `Set()` empty |
| User picks Gündüz in storage | Works if LIGHT true | **Ignored** — forced dark |

---

## Flag interaction matrix

| Flag | When false | When true |
|------|------------|-----------|
| `EXPO_PUBLIC_FEATURE_LIGHT_THEME` | `resolveThemeMode()` → always `'dark'` | Respects user mode + system |
| `EXPO_PUBLIC_FEATURE_LIGHT_THEME_SCREENS` | Empty → `isLightThemeScreenEnabled()` false for all ids | `*` → all scoped hooks eligible |
| `EXPO_PUBLIC_FEATURE_THEME_CHOICE` | No first-run `ThemeChoiceScreen` | Shows once per user id |
| `EXPO_PUBLIC_FEATURE_THEME_SETTINGS` | No **Görünüm** segment in settings hub | Segment visible |

**All four should be true** for full release UX (choice + settings + light surfaces).

---

## Edge case: partial flag config

| Config | Symptom |
|--------|---------|
| `LIGHT=true`, `SCREENS=` empty | User can pick light in settings but **no screen goes light** |
| `LIGHT=false`, others true | Theme choice/settings UI may appear but **app stays dark** |
| `SCREENS=auth` only | Only login/OTP chrome light; dashboard/map dark |
| `THEME_CHOICE=false`, rest true | No first-run picker; change only via settings |

---

## Storage keys (survive rebuilds)

| Key | Purpose |
|-----|---------|
| `lh_theme_mode_v1` | User preference: `dark` \| `light` \| `system` |
| `lh_theme_resolved_v1` | Cached resolved theme |
| `lh_theme_choice_done_${userId}` | First-run gate |

Reinstall / clear data resets choice gate → theme picker can reappear (if flag on).

---

## Verification without git diff

**On device / emulator after install:**

1. Enable TestFlight debug panel if preview build (`EXPO_PUBLIC_ENABLE_TESTFLIGHT_DEBUG_PANEL=1` on preview only).
2. Or add temporary dev log of `lightThemeEnabled` — **not done in this audit** (read-only).
3. Practical QA: fresh install → expect theme choice → pick Gündüz → login chrome / role / settings should lighten.

**Static check in built bundle (advanced):** search release bundle for string `EXPO_PUBLIC_FEATURE_LIGHT_THEME` — should **not** appear literally; inlined as dead code paths. Grep minified bundle for behavior via theme choice screen copy `"LeylekTAG görünümünü seç"`.

---

## Recommended CI / QA discipline

| Build type | Use for white-theme QA? |
|------------|-------------------------|
| `eas build --profile preview` | **Yes — primary** |
| `eas build --profile simple` | Yes |
| Local release without env | **No — false negative** |
| Expo Go | Unreliable — env differs |
| Metro dev (`expo start`) | Only if `.env.local` sets flags |

---

## Rollback (env-only)

Set in `eas.json` (future hotfix, not executed here):

```json
"EXPO_PUBLIC_FEATURE_LIGHT_THEME": "false",
"EXPO_PUBLIC_FEATURE_LIGHT_THEME_SCREENS": "",
"EXPO_PUBLIC_FEATURE_THEME_CHOICE": "false",
"EXPO_PUBLIC_FEATURE_THEME_SETTINGS": "false"
```

Rebuild → instant dark-only behavior without code revert.

**BUILD ENV ANALYSIS COMPLETE.**
