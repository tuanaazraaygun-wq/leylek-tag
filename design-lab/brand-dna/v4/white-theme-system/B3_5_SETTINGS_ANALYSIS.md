# B3-5 Settings Theme Integration — Master Analysis

**Sprint:** B3-5  
**Mode:** Read-only analysis  
**Date:** 2026-06-21  
**Prerequisites:** B3-2 ThemeProvider ✅ | B3-3 Theme Choice ✅ | B3-4 Primitives ✅

---

## Executive summary

Settings entegrasyonu, kullanıcının **Gece / Gündüz / Sistem** tercihini ilk giriş sonrası kalıcı olarak değiştirebileceği birincil yüzeydir. Production’da `settings-hub.tsx` tema satırı **yok**; tercih yalnızca `lh_theme_mode_v1` (device-level AsyncStorage) üzerinden ThemeProvider tarafından okunuyor.

**Önerilen yaklaşım:** `settings-hub.tsx` içine **Görünüm** kartı + inline 3-segment kontrol; `useTheme().setTheme()` ile anında uygulama; `themeSettingsEnabled` feature flag ile gate.

---

## Production scan — mevcut durum

### Settings yüzeyleri

| Route | Dosya | Tema? |
|-------|-------|-------|
| `/settings-hub` | `frontend/app/settings-hub.tsx` | **Yok** |
| `/driver-offer-sound-settings` | `driver-offer-sound-settings.tsx` | Per-user prefs pattern (driver) |
| `/delete-account` | `delete-account.tsx` | Hub pattern kopyası |
| `/profile` | `profile.tsx` → ProfileScreen | Profil foto; tema yok |

### Settings hub bölümleri (bugün)

1. **Profil** — Profilim → muhabbet-profile
2. **Sürücü** (driver only) — Teklif Sesi, IBAN
3. **Destek** — email, telefon
4. **Yasal** — privacy, terms, kvkk, delete info
5. **Hesap** — delete, logout

**Tema için en doğru konum:** Profil kartından hemen sonra, role-specific kartlardan önce — **Görünüm** bölümü. Tüm kullanıcılar (yolcu + sürücü) erişir; sürücüye özel değil.

### Theme altyapısı (B3-2–4)

| Katman | Konum | Durum |
|--------|-------|-------|
| ThemeProvider | `_layout.tsx` wrap | Aktif |
| useTheme | `hooks/useTheme.ts` | Aktif |
| Storage | `lh_theme_mode_v1`, `lh_theme_resolved_v1` | Device-level |
| Choice done | `lh_theme_choice_done_{userId}` | Per-user flag |
| Bridge stub | `themeSettingsBridge.ts` | Contract only |
| Feature flags | `themeChoiceEnabled`, `lightThemeEnabled` | Default OFF |
| **themeSettingsEnabled** | — | **Henüz yok — B3-5 ekle** |

### Navigation

- Settings: `router.push('/settings-hub')` from `index.tsx` (passenger/driver dashboard)
- Expo Router file-based; `_layout.tsx` ThemeProvider altında — settings route theme-aware primitives kullanabilir (B3-4)

### Login sonrası akış (tema ile)

```
Login → legal → [theme-choice if flag] → role-select → dashboard
                      ↓
              setTheme + markThemeChoiceDone
                      ↓
              lh_theme_mode_v1 (device)
```

Settings değişikliği aynı `setTheme()` yolunu kullanmalı — tek SSOT.

### Backend

- `ui_theme_mode` veya preferences API **yok** — cloud sync B3-5+ optional phase.

---

## Kritik bulgular

| # | Bulgu | Etki |
|---|-------|------|
| K1 | Tema storage **device-level**, choice-done **user-level** | Logout/login farklı hesap: mode cihazda kalır; choice-done hesap bazlı |
| K2 | `lightThemeEnabled=false` iken settings’te Gündüz seçilse bile UI dark kalır | Settings segment gösterilmeli ama flag OFF’ta gizlenmeli veya disabled + tooltip |
| K3 | `settings-hub.tsx` hâlâ `PREMIUM_*` hardcode (screen shell) | B3-5’te shell migrate edilmeden de segment eklenebilir; tam light için B3-6 screen migration |
| K4 | `themeSettingsBridge.ts` stub hazır | `createThemeSettingsBridge(useTheme())` pattern |
| K5 | Driver sound prefs **userId-scoped** iyi referans | Theme mode device-scoped today — B3-5’te bilinçli karar: device vs user |
| K6 | Theme Choice + Settings aynı `ThemeMode` enum | Senkron doğal — aynı storage key |

---

## Önerilen patch sırası (B3-5)

| Step | Patch | Flag |
|------|-------|------|
| B3-5a | `themeSettingsEnabled` flag + `ThemeSettingsSegment` component | OFF |
| B3-5b | `settings-hub.tsx` Görünüm kartı wiring | OFF |
| B3-5c | Settings shell `useTheme()` migrate (screen bg) | OFF veya light flag birlikte |
| B3-5d | Internal TestFlight: `lightThemeEnabled` + `themeSettingsEnabled` ON | Beta |
| B3-5e | Optional cloud sync spike (design only → B3-5f prod) | Later |

**Bağımlılık:** Settings’te Gündüz anlamlı olması için `lightThemeEnabled=true` gerekir (B3-4 primitives hazır).

---

## Document index

| File | Purpose |
|------|---------|
| `B3_5_SETTINGS_ANALYSIS.md` | This document |
| `SETTINGS_THEME_ARCHITECTURE.md` | Provider bridge, component graph |
| `SETTINGS_THEME_UI_SPEC.md` | LHIS UI spec |
| `SETTINGS_THEME_STORAGE.md` | AsyncStorage + user/device policy |
| `THEME_SYNC_FLOW.md` | Theme Choice ↔ Settings ↔ Provider |
| `THEME_SETTINGS_QA.md` | Test matrix |
| `THEME_SETTINGS_RELEASE_GATE.md` | Rollout gates |

---

## Production untouched

This sprint created **only** files under `design-lab/brand-dna/v4/white-theme-system/`. No `frontend/`, `backend/`, or `website/` changes.
