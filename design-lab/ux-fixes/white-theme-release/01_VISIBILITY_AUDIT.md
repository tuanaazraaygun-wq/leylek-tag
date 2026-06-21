# WHITE-THEME-QA-1A — Visibility Audit

**Sprint:** WHITE-THEME-QA-1A  
**Mode:** Read-only analysis  
**Date:** 2026-06-21  
**Production code:** Untouched

---

## Executive summary

White Theme is **implemented in code** and **enabled in `eas.json` for all EAS profiles** (`simple`, `development`, `preview`, `production`). Visibility in an APK depends on **whether `EXPO_PUBLIC_*` flags were baked into the JS bundle at Metro build time**, the user’s **stored theme mode**, and **per-screen migration hooks**.

**Most common “APK’da görünmüyor” root cause:** Local Gradle release (`assembleRelease` / `expo run:android --variant release`) **without** EAS env → all theme flags compile to **`false`** → app behaves like pre-release dark-only build.

---

## Answers — 7 questions

### 1. White Theme EAS build’de aktif mi?

**Yes — configured ON** in `frontend/eas.json` for every profile:

| Profile | `LIGHT_THEME` | `SCREENS` | `THEME_CHOICE` | `THEME_SETTINGS` |
|---------|---------------|-----------|----------------|------------------|
| `simple` | `true` | `*` | `true` | `true` |
| `development` | `true` | `*` | `true` | `true` |
| `preview` | `true` | `*` | `true` | `true` |
| `production` | `true` | `*` | `true` | `true` |

EAS injects these before Metro bundles JS. **An APK from `eas build --profile preview|simple|production` should include enabled flags.**

---

### 2. Local Android release build’de env flags bake oluyor mu?

**Only if you set them before the JS bundle step.** Flags are read at **Metro compile time** in `frontend/lib/featureFlags.ts`:

```typescript
function readBoolEnv(name: string): boolean {
  const value = process.env[name];
  return value === 'true' || value === '1';
}
```

There is **no** committed `.env` with theme flags in repo (by design — B3-6h QA). Local `./gradlew :app:assembleRelease` or `expo run:android --variant release` **without** env exports → **all theme flags OFF**.

Additionally, `resolveThemeMode()` **forces dark** when `lightThemeEnabled` is false — even if AsyncStorage has `light` saved from an older dev session.

---

### 3. Tema seçimi hangi koşulda gösteriliyor?

**Gate:** `themeChoiceEnabled` (`EXPO_PUBLIC_FEATURE_THEME_CHOICE`) **and** AsyncStorage `lh_theme_choice_done_${userId}` ≠ `'true'`.

**Triggers** (`frontend/app/index.tsx`):

| Path | Condition |
|------|-----------|
| Post-login bootstrap | `!resumedMatch`, not admin-only shortcut, `legalWasAccepted`, then `maybeNavigateToThemeChoice` |
| Legal accept handler | After legal accepted, `maybeNavigateToThemeChoice` before role-select |

**Does NOT show when:**

- `EXPO_PUBLIC_FEATURE_THEME_CHOICE` not baked `true`
- User already completed choice (`markThemeChoiceDone`)
- Active match resume on login (`resumedMatch` — skips theme-choice branch)
- `themeChoiceEnabled` false

Screen: `ThemeChoiceScreen` → `screen === 'theme-choice'` → on complete → `role-select`.

---

### 4. Eski kullanıcıda tekrar çıkmaması normal mi?

**Yes — by design.**

Key: `lh_theme_choice_done_${userId}` = `'true'` after first completion (`themeChoiceGate.ts` / `themeStorage.ts`).

Returning user on same device/account → **no second theme-choice screen**. They change theme via **Ayarlar → Görünüm** (if settings flag on).

Clear app data / new user id / reinstall without backup → choice can appear again.

---

### 5. Ayarlar > Görünüm neden görünmeyebilir?

**Segment gated by** `themeSettingsEnabled` in `settings-hub.tsx`:

```tsx
{themeSettingsEnabled ? <ThemeSettingsSegment /> : null}
```

| Cause | Effect |
|-------|--------|
| `EXPO_PUBLIC_FEATURE_THEME_SETTINGS` not `true` in bundle | **Görünüm card hidden entirely** |
| User never opens `/settings-hub` | Segment not visible (expected) |
| `themeSettingsEnabled` true but `LIGHT_THEME` false | Segment **visible** but selecting Gündüz has **no visual effect** (`resolveThemeMode` forces dark) |

Settings hub route: `router.push('/settings-hub')` from dashboard menus in `index.tsx`.

---

### 6. Hangi ekranlar hâlâ dark kalıyor?

Even with **`SCREENS=*`** and **`resolvedTheme=light`**, these areas **stay dark or partially dark**:

| Category | Examples | Why |
|----------|----------|-----|
| **No screen hook** | `SplashScreen.tsx`, `AnimatedClouds`, large `index.tsx` StyleSheet baselines | Not wired to scoped light overlays |
| **Map substrate** | Map tiles, polylines, marker PNGs (`mapNavMarkers.ts`) | Theme-agnostic assets |
| **QR camera viewport** | Boarding scan camera area | Intentionally dark (B3-6 QA) |
| **Admin** | `AdminPanel`, `admin.tsx` | Not in B3-6 scope |
| **Chat / Muhabbet** | No `chat` screen id in flag matrix | No `use*Theme('chat')` hook |
| **Inline PREMIUM_* debt** | `DriverOfferScreen`, `LiveMapView` baselines | Light = overlay on dark StyleSheet; many literals remain |
| **User chose Gece** | Any migrated screen | `resolvedTheme === 'dark'` → hooks return dark UI |
| **Flags OFF** | Entire app | Forced dark at `resolveThemeMode` |

**Migrated scopes** (can go light when flags + user mode allow): `auth`, `role`, `settings`, `profile`, `legal`, `passenger`, `driver`, `qr`, `payment`, `trust`, `journey`, `map`, or `*`.

---

### 7. APK test için doğru build komutu?

**Recommended (matches EAS env):**

```bash
cd frontend
eas build --profile preview --platform android
# or
eas build --profile simple --platform android
```

**Local release with theme flags (PowerShell):**

```powershell
cd frontend
$env:EXPO_PUBLIC_FEATURE_LIGHT_THEME = "true"
$env:EXPO_PUBLIC_FEATURE_THEME_CHOICE = "true"
$env:EXPO_PUBLIC_FEATURE_THEME_SETTINGS = "true"
$env:EXPO_PUBLIC_FEATURE_LIGHT_THEME_SCREENS = "*"
npx expo run:android --variant release
```

**Wrong for theme QA:** `./gradlew assembleRelease` alone without env above → **dark-only bundle**.

---

## Visibility decision tree

```
APK installed
  └─ Bundle has LIGHT_THEME=true?
        NO → entire app dark; no theme choice; no Görünüm
        YES → User resolvedTheme light?
              NO (Gece / system dark) → migrated hooks use dark UI
              YES → Screen in SCREENS list (or *)?
                    NO → that screen stays dark baseline
                    YES → hook applies light surfaces (chrome overlays)
```

---

## Related code map

| Concern | File |
|---------|------|
| Flags | `frontend/lib/featureFlags.ts` |
| EAS env | `frontend/eas.json` |
| Resolve mode | `frontend/lib/theme/buildTheme.ts` |
| Provider | `frontend/contexts/ThemeContext.tsx` |
| First-run gate | `frontend/lib/theme/themeChoiceGate.ts` |
| Persistence | `frontend/lib/theme/themeStorage.ts` |
| Choice UI | `frontend/components/theme/ThemeChoiceScreen.tsx` |
| Settings UI | `frontend/components/theme/ThemeSettingsSegment.tsx` |
| Settings gate | `frontend/app/settings-hub.tsx` |

**WHITE-THEME-QA-1A visibility audit complete.**
