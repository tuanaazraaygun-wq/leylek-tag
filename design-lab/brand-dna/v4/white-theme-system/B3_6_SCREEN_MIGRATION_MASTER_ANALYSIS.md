# B3-6 Screen Migration — Master Analysis

**Sprint:** B3-6 — White Theme Screen Migration  
**Mode:** Read-only analysis  
**Date:** 2026-06-21  
**Prerequisites:** B3-2 ✅ B3-3 ✅ B3-4 ✅ B3-5 ✅

---

## Executive summary

White Theme ekran migrasyonu, **layout/spacing/navigation değiştirmeden** hardcoded `PREMIUM_*` / inline hex değerlerini `useTheme().tokens` ile değiştirmektir. B3-4 primitive katmanı theme-aware; **çoğu ekran hâlâ shell + inline renk taşır**.

**En büyük borç:** `frontend/app/index.tsx` (~27k satır, ~144 `PREMIUM_*` referansı) — auth/register/OTP/PIN inline dalları.

**En yüksek risk:** `LiveMapView.tsx` (~118 renk ref), `DriverOfferScreen.tsx` (~102), harita marker PNG sistemi.

**En güvenli ilk patch:** **B3-6a** — auth chrome + `LoginScreen` shell; `lightThemeEnabled` TestFlight-only; production flag OFF.

---

## Migration philosophy

| Kural | Açıklama |
|-------|----------|
| W6-01 | White = dark LHIS'in beyaz karşılığı — yeni layout yok |
| W6-02 | Önce shell (bg, card, text) — sonra map/markers |
| W6-03 | Primitive tüketen ekranlar otomatik kısmen kazanır (B3-4) |
| W6-04 | Inline `StyleSheet` hex → token alias; spacing dokunulmaz |
| W6-05 | Splash brand anı — **dark kalabilir** (ayrı karar) |
| W6-06 | Logo/marker light asset — logo-evolution + marker-evolution bağımlılığı |

---

## Screen group summary

| Group | LHIS primitive use | Color debt | Risk | Patch |
|-------|-------------------|------------|------|-------|
| Auth / Login | Partial (chrome) | Medium–High | P1 | B3-6a |
| Role Select | Strong | Low–Med | P1 | B3-6b |
| Passenger dashboard | Mixed | High | P1 | B3-6d |
| Driver cockpit | Mixed | High | P1 | B3-6e |
| Map / Journey | Weak | **Very High** | **P0** | B3-6g |
| QR / Payment / Trust | Partial | Medium | P1 | B3-6f |
| Settings / Profile / Legal | Partial / Legacy | Medium | P2 | B3-6c |
| Admin | Legacy | Low | P3 | B3-6h |

---

## Feature flag strategy (B3-6)

| Flag | Purpose |
|------|---------|
| `EXPO_PUBLIC_FEATURE_LIGHT_THEME` | Global light resolve |
| `EXPO_PUBLIC_FEATURE_LIGHT_THEME_SCREENS` | Comma list: `auth,role,settings,...` |
| Per-patch | Enable one group on TestFlight |

**Default production:** all OFF → dark identical.

---

## Cross-program dependencies

| Dependency | Blocks |
|------------|--------|
| Logo light variant (logo-evolution) | Login/settings white logo contrast |
| Marker light PNG (marker-evolution) | Map screens B3-6g |
| `mapNavMarkers.ts` theme prop | Entity markers on light map |

---

## Document index

| File | Scope |
|------|-------|
| `B3_6_SCREEN_INVENTORY.md` | File-level inventory |
| `B3_6_AUTH_LOGIN_ANALYSIS.md` | Group 1 |
| `B3_6_ROLE_SELECT_ANALYSIS.md` | Group 2 |
| `B3_6_PASSENGER_DASHBOARD_ANALYSIS.md` | Group 3 |
| `B3_6_DRIVER_COCKPIT_ANALYSIS.md` | Group 4 |
| `B3_6_MAP_JOURNEY_ANALYSIS.md` | Group 5 |
| `B3_6_QR_PAYMENT_TRUST_ANALYSIS.md` | Group 6 |
| `B3_6_SETTINGS_PROFILE_LEGAL_ANALYSIS.md` | Group 7 |
| `B3_6_MIGRATION_ORDER.md` | Patch sequence |
| `B3_6_RISK_REGISTER.md` | Risks |
| `B3_6_QA_PLAN.md` | QA matrix |
| `B3_6_PATCH_PLAN.md` | Implementation patches |
| `B3_6_RELEASE_GATE.md` | Rollout gates |

---

## Production untouched

Analysis only — no `frontend/`, `backend/`, `website/` changes.

---

**Recommended first patch:** B3-6a — see `B3_6_PATCH_PLAN.md`
