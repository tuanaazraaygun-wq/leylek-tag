# Current Theme Inventory

**Sprint:** B-3 — White Theme + Theme Choice Analysis  
**Mode:** Read-only production scan  
**Date:** 2026-06-21

---

## Executive summary

LeylekTAG mobil uygulaması **tek tema (dark premium navy)** ile çalışır. Merkezi `ThemeProvider` yok. Renk SSOT kısmen `premiumAuthStyles.ts` + `design-system/tokens/` — white varyant yok. `app.json` `userInterfaceStyle: "automatic"` Expo seviyesinde tanımlı ama UI dark hardcode.

---

## Theme provider

| Soru | Cevap |
|------|-------|
| React ThemeProvider? | **Yok** |
| useTheme hook? | **Yok** |
| Context theme? | **Yok** — 5 context: Socket, Notification, AppAlert, LeylekZekaChrome, Trust |
| Expo color scheme? | `app.json` → `"userInterfaceStyle": "automatic"` — **UI takip etmiyor** |
| StatusBar | `_layout.tsx` → `<StatusBar style="dark" />` (sabit) |

---

## Color token sistemi

| Katman | Konum | White? |
|--------|-------|--------|
| **SSOT (de facto)** | `frontend/components/auth/premiumAuthStyles.ts` | ❌ dark only |
| **LDS re-export** | `frontend/design-system/tokens/color.ts` | Re-exports premiumAuthStyles |
| Gradient | `design-system/tokens/gradient.ts` | Dark cockpit only |
| Border | `design-system/tokens/border.ts` | Dark |
| Typography | `design-system/tokens/typography.ts` | Theme-agnostic sizes |
| Semantic | `LDS_COLOR_URGENT`, `LDS_COLOR_ERROR` | Shared |

**Key dark tokens:**

| Token | Value |
|-------|-------|
| `PREMIUM_NAVY_DEEP` | `#08111F` |
| `PREMIUM_AUTH_CYAN` | `#22D3EE` |
| `PREMIUM_TEXT_SOFT` | `rgba(243,248,255,0.94)` |
| `PREMIUM_GLASS_FILL` | `rgba(16,26,43,0.76)` |

**Brand genom hedef (v4):** `#00D4AA` Meridian — henüz LDS'te yok.

---

## LHIS primitives

| Primitive | Dosya | Theme-aware? |
|-----------|-------|--------------|
| `CockpitBackground` | `design-system/primitives/CockpitBackground.tsx` | ❌ dark gradients only |
| `GlassSurface` | `design-system/primitives/GlassSurface.tsx` | ❌ hardcoded rgba |
| `PremiumText` | `design-system/primitives/PremiumText.tsx` | ❌ PREMIUM_TEXT_* only |
| `PremiumSelectionCard` | `design-system/primitives/PremiumSelectionCard.tsx` | ❌ |
| `RoleSelectAmbienceBackground` | `design-system/role-select/` | ❌ grid dark |

**Export barrel:** `design-system/primitives/index.ts`

---

## Dark hardcoded renkler — yaygınlık

| Alan | Pattern | Tahmini kapsam |
|------|---------|----------------|
| `app/index.tsx` | `#0F172A`, `#3FA9F5`, inline styles | **Massive** (~27k lines) |
| `premiumAuthStyles.ts` | Full palette | Auth, role, login |
| `GlassSurface` VARIANT_DEFAULTS | rgba fills | All LDS surfaces |
| Map components | `#22D3EE`, `#08111F` | LiveMapView, markers |
| Legacy `styles.container` | Mixed | index.tsx screens |
| `DriverOfferScreen` | COLORS + premium mix | Field map |
| Settings hub | PREMIUM_* imports | Single route |

**Migration debt:** Binlerce inline hex — gradual screen migration şart (B3-6).

---

## AsyncStorage kullanımı (theme-relevant pattern)

| Key | Amaç | Dosya |
|-----|------|-------|
| `user` / `access_token` | Session | `sessionToken.ts` |
| `legal_accepted` | Legal modal gate | `index.tsx` |
| `kvkk_accepted_phone` | Login KVKK checkbox | `index.tsx` |
| `last_role_${userId}` | Role restore | `index.tsx` |
| `device_id` | Device fingerprint | `index.tsx` |
| `driver_offer_sound_*` | Prefs pattern örneği | `driverOfferSoundPrefs.ts` |

**Theme key:** **Yok** — `driverOfferSoundPrefs.ts` iyi pattern modeli (per-user key).

---

## Supabase / backend profile

| Soru | Cevap |
|------|-------|
| `users` table theme field? | **Repo taramasında yok** |
| Preferences API? | **Yok** |
| Supabase client storage | AsyncStorage (`lib/supabase.ts`) |

**Sonuç:** Theme persistence **local-first**; backend sync B3-5+ optional migration.

---

## Boot / auth flow (index.tsx)

```
App mount
  → initializeApp() → loadUser() + device_id + kvkk phone restore
  → showSplash=true → SplashScreen (~2.5s)
  → showSplash=false
  → loading? (loadUser spinner)
  → screen state machine:
       login | otp | register | pin | role-select | dashboard | ...
```

### Splash sonrası

- Oturum yok → `screen='login'`
- Oturum var → `loadUser` → resume veya `role-select`
- `legal_accepted !== 'true'` → `showLegalConsent=true` (modal overlay)

### Legal consent

- **Login KVKK:** checkbox `kvkkAccepted` + `kvkk_accepted_phone` (OTP öncesi)
- **Post-login legal:** `LegalConsentModal` + AsyncStorage `legal_accepted`
- Accept → `handleLegalAccept` → resume/tag restore → role-select veya dashboard

### Role select

- `screen='role-select'` — ana hub after login
- `last_role_${id}` restore on loadUser

### Onboarding klasörü

- `frontend/components/onboarding/` — **yok**
- Driver KYC: `DriverKYCScreen` — ayrı flow
- Website: `user-onboarding-modal.tsx` — web only

---

## Website

| Öğe | Durum |
|-----|-------|
| `globals.css` | `color-scheme: dark` |
| Tailwind | Dark marketing site |
| Theme toggle | **Yok** |
| Mobile app theme sync | **Yok** |

---

## Design-lab referanslar

| Belge | İçerik |
|-------|--------|
| `LIGHT_DNA.md` | Glow tokens; dark/light opacity table §10 |
| `MARKER_DNA.md` | Marker white theme §9 markers constitution |
| `marker-evolution/WHITE_THEME_STRATEGY.md` | Map marker light tokens |
| `BRAND_CONSTITUTION_V4.md` | Premium restraint |

---

## Gap özeti

| # | Gap |
|---|-----|
| G-01 | No ThemeProvider |
| G-02 | No theme persistence |
| G-03 | No theme choice UI |
| G-04 | No white token set |
| G-05 | Primitives dark-only |
| G-06 | index.tsx inline colors |
| G-07 | Settings'te tema yok |
| G-08 | Backend profile sync yok |
| G-09 | app.json automatic ≠ app UI |

---

**Sonraki:** `THEME_CHOICE_FLOW_ANALYSIS.md`
