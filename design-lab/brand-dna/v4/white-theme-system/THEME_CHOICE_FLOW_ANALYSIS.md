# Theme Choice Flow Analysis

**Sprint:** B-3  
**Date:** 2026-06-21

---

## Recommended flow (LHIS)

```
Splash (brand dark — unchanged)
    ↓
Login / OTP / PIN (dark default — no theme choice yet)
    ↓
First saveUser success (authenticated)
    ↓
Legal consent modal (if !legal_accepted) — BLOCKING
    ↓
★ Theme Choice screen (if !theme_choice_completed for userId) ★
    ↓
Role select
    ↓
Dashboard / resume
```

---

## 10 soru — cevaplar

### 1. Login öncesi mi, sonrası mı?

**Sonrası.** Login öncesi tema seçimi:
- Oturumsuz kullanıcı için persistence belirsiz
- KVKK/legal önceliği karışır
- Splash/login marka anı dark kalmalı (logo evolution)

**İstisna:** Sistem teması cihazdan **sessizce** okunabilir (default resolved mode) — UI göstermeden, theme choice ekranında pre-select.

---

### 2. Legal/KVKK öncesi mi sonrası mı?

**Legal consent sonrası, role select öncesi.**

| Sıra | Gerekçe |
|------|---------|
| KVKK checkbox (login) | OTP gate — kalır |
| Legal modal (`legal_accepted`) | Yasal zorunluluk önce |
| Theme choice | Tercih UX — yasal değil |
| Role select | Operasyonel devam |

Theme choice legal metin içermez — consent flow bozulmaz.

---

### 3. Role select öncesi mi sonrası mı?

**Öncesi.** Role select zengin görsel (illustrations, cockpit). Kullanıcı seçtiği temayla role ekranını görmeli — tutarlı ilk izlenim.

Resume path (active tag): **Theme choice skip** if already completed; if first login mid-resume edge case → show after legal, before dashboard.

---

### 4. Guest / anonymous?

**Mevcut:** Guest flow yok — tüm akış login zorunlu.

**Policy:** Theme choice yalnızca `user.id` mevcutken. Logout → login başka hesap → o hesabın theme'i yüklenir.

Device-level fallback (logout state): `theme_mode_device` optional — splash/login dark.

---

### 5. Kullanıcı nerede değiştirir?

| Yüzey | Öncelik |
|-------|---------|
| `settings-hub.tsx` | **Primary** — "Görünüm" row |
| Theme choice re-open | Settings'ten "Tema seçimini tekrar göster" — opsiyonel B3-5 |
| Profile | Secondary — gerekmez |

---

### 6. Local vs backend vs hybrid?

**Phase 1 (B3-2–B3-5): Local authoritative**

| Store | Key | Value |
|-------|-----|-------|
| AsyncStorage | `lh_theme_mode_v1` | `dark` \| `light` \| `system` |
| AsyncStorage | `lh_theme_choice_done_${userId}` | `true` |
| AsyncStorage | `lh_theme_resolved_v1` | `dark` \| `light` (computed cache) |

**Phase 2 (B3-5+): Hybrid optional**

- Backend `users.ui_theme_mode` column veya JSON preferences
- Login sync: server wins if newer `updated_at`
- Offline: local wins

**Mevcut:** Backend field yok — B3-2 sadece local.

---

### 7. Offline?

- Theme choice tamamen client-side — **offline OK**
- Save AsyncStorage immediate
- Backend sync queue (future) — flush when online
- No blocking network on "Bu temayla devam et"

---

### 8. Android / iOS farkı?

| Konu | iOS | Android |
|------|-----|---------|
| System theme | `useColorScheme()` | `useColorScheme()` |
| StatusBar | `expo-status-bar` style per resolved theme | Same |
| Navigation bar | Auto with edge-to-edge | `androidNavigationBar` color B3-4 |
| Splash native | Dark until JS hydrate | pin/kuş splash — theme independent |
| Reduce transparency | iOS accessibility | — |

**Kural:** Resolved theme drives StatusBar: light theme → `style="dark"`, dark → `style="light"`.

---

### 9. Sistem teması takibi

```typescript
// Spec only
resolvedTheme =
  mode === 'system'
    ? (deviceColorScheme ?? 'dark')
    : mode;
```

- Subscribe `Appearance.addChangeListener` (RN) when mode === `system`
- Re-resolve without re-showing theme choice
- Debounce 100ms — avoid rapid toggle flicker

**Default for new users on theme choice screen:** Pre-highlight `system` if device is light, else `dark` (LeylekTAG brand default dark).

---

### 10. Flicker / hydrate

**Problem:** AsyncStorage async → first paint dark, then flash white.

**Mitigation stack:**

1. **Default render:** `dark` (matches 100% current users — zero regression)
2. **Blocking hydrate gate (B3-2):** Root layout shows neutral splash/blank until `themeHydrated === true` (max 120ms timeout)
3. **Persist resolved cache:** `lh_theme_resolved_v1` written on every change — read sync path first
4. **MMKV optional (future):** faster sync read — not B3-1
5. **Theme choice screen:** Live preview intentional — not flicker bug
6. **Do NOT** flash theme choice on every cold start — only `theme_choice_done` false

```
Cold start:
  read lh_theme_resolved_v1 (sync if cached in memory from prior session)
  if miss → await lh_theme_mode_v1 (async)
  if timeout → dark fallback
  setThemeHydrated(true)
  render app
```

---

## Skip policy analizi

| Seçenek | Öneri |
|---------|-------|
| Skip yok | **Önerilen** — kullanıcı bilinçli seçim; default pre-selected `dark` or `system` |
| "Sonra" skip | Risk: never chosen → debt; **hayır** |
| Implicit skip (timeout) | **Hayır** — accessibility + trust |

**Compromise:** "Bu temayla devam et" with **pre-selected** kart (dark veya system) — one tap, not skip.

---

## Screen state integration (index.tsx)

Proposed new `AppScreen`:

```typescript
| 'theme-choice'  // first login only
```

Insert after legal accept, before role-select:

```typescript
if (!themeChoiceDone) setScreen('theme-choice');
else setScreen('role-select');
```

**Feature flag:** `FEATURE_THEME_CHOICE=false` → bypass to role-select (B3-3).

---

## Edge cases

| Case | Behavior |
|------|----------|
| Returning user | Skip theme choice |
| Admin main phone | Same flow (or force dark — product decision) |
| Active tag resume | Skip theme choice if done; if first login + resume rare → show once |
| Logout | Keep per-user keys; clear in-memory only |
| Reinstall | Re-show theme choice (no keys) |
| Multi-device | Local per device; backend sync later |

---

**Sonraki:** `THEME_CHOICE_SCREEN_SPEC.md`, `THEME_PROVIDER_ARCHITECTURE.md`
