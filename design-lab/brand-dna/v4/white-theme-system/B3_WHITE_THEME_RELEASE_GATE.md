# B3 White Theme Release Gate

**Sprint:** B3 complete — B3-6h final gate  
**Date:** 2026-06-21  
**Default production:** All flags OFF

---

## Gate summary

| Gate | Name | Status | Audience |
|------|------|--------|----------|
| **G0** | Repo default | ✅ PASS | Production |
| **G1** | Infra soak (B3-2) | ✅ PASS | Production invisible |
| **G2** | Scoped TestFlight | 📋 Ready | Internal QA |
| **G3** | Multi-scope beta | 📋 Ready | Beta cohort |
| **G4** | Global light GA | ⏸ Blocked | Product decision |
| **G5** | Default light | ⏸ Future | Post-B4 |

---

## G0 — Production default (SHIPPED)

**Required env (repo + production builds):**

```env
EXPO_PUBLIC_FEATURE_LIGHT_THEME=false
EXPO_PUBLIC_FEATURE_LIGHT_THEME_SCREENS=
EXPO_PUBLIC_FEATURE_THEME_CHOICE=false
EXPO_PUBLIC_FEATURE_THEME_SETTINGS=false
```

| ID | Criterion | Required | B3-6h |
|----|-----------|----------|-------|
| G0-01 | All flags false in repo | ✅ | ✅ |
| G0-02 | Dark visual = pre-B3 baseline | ✅ | ✅ static |
| G0-03 | No ThemeProvider crash | ✅ | ✅ |
| G0-04 | No business logic diff | ✅ | ✅ |
| G0-05 | Map/marker/polyline unchanged | ✅ | ✅ |
| G0-06 | QR camera overlay unchanged | ✅ | ✅ |

**Abort:** Any G0 failure → revert last B3 patch, disable flags.

---

## G1 — Theme infrastructure (B3-2 → B3-5)

| ID | Criterion | Status |
|----|-----------|--------|
| G1-01 | ThemeProvider in `_layout.tsx` | ✅ |
| G1-02 | Hydrate timeout 120ms → dark default | ✅ |
| G1-03 | `lightThemeEnabled=false` forces dark resolve | ✅ |
| G1-04 | Primitives read `useTheme().tokens` | ✅ |
| G1-05 | Settings bridge wired (flag OFF = segment hidden) | ✅ |

---

## G2 — Scoped TestFlight rollout

Enable **one scope at a time**. Each row requires 48h soak before next.

| Phase | `LIGHT_THEME_SCREENS` | Extra flags | Sign-off |
|-------|----------------------|-------------|----------|
| G2-a | `auth` | — | QA auth checklist |
| G2-b | `role` | — | QA role cards |
| G2-c | `settings,profile,legal` | `THEME_SETTINGS=true` | QA settings persist |
| G2-d | `passenger` | — | QA passenger E2E |
| G2-e | `driver` | — | QA driver cockpit |
| G2-f | `qr,payment,trust` | — | QA modals; camera dark |
| G2-g | `journey,map` | — | QA LiveMap; markers OK |

**G2 entry criteria (each phase):**

- [ ] Prior phase QA sign-off
- [ ] ESLint/TS clean on scope files
- [ ] Dark regression with flags OFF re-verified
- [ ] Rollback tested (flag off → instant dark)

**G2 exit criteria:**

- [ ] All 7 scope phases pass
- [ ] `B3-6H_WHITE_THEME_QA_REPORT.md` manual matrix executed on device

---

## G3 — Beta (multi-scope)

```env
EXPO_PUBLIC_FEATURE_LIGHT_THEME=true
EXPO_PUBLIC_FEATURE_LIGHT_THEME_SCREENS=*
EXPO_PUBLIC_FEATURE_THEME_SETTINGS=true
EXPO_PUBLIC_FEATURE_THEME_CHOICE=true
```

| ID | Criterion | Required |
|----|-----------|----------|
| G3-01 | Full QA matrix (10 combinations) | ✅ |
| G3-02 | Active journey recovery unchanged | ✅ |
| G3-03 | Socket/map/QR/payment/trust logic unchanged | ✅ |
| G3-04 | WCAG AA spot check (login, settings, map chrome) | ✅ |
| G3-05 | Light marker assets in bundle | ⚠️ Before map GA |
| G3-06 | Crash-free rate neutral vs baseline | ✅ |

---

## G4 — Production light theme GA

**Prerequisites:**

- G2 + G3 complete
- Design sign-off LHIS white parity
- Support FAQ (tema / görünüm)
- Rollback runbook tested in production config

```env
EXPO_PUBLIC_FEATURE_LIGHT_THEME=true
EXPO_PUBLIC_FEATURE_LIGHT_THEME_SCREENS=*
EXPO_PUBLIC_FEATURE_THEME_SETTINGS=true
EXPO_PUBLIC_FEATURE_THEME_CHOICE=true   # optional post-first-run
```

| ID | Criterion |
|----|-----------|
| G4-01 | Stakeholder UX sign-off |
| G4-02 | Zero open P0 in `WHITE_THEME_RISK_REGISTER.md` |
| G4-03 | Analytics baseline: theme mode distribution |

---

## Rollback runbook

| Step | Action |
|------|--------|
| 1 | Set `EXPO_PUBLIC_FEATURE_LIGHT_THEME=false` |
| 2 | Clear `EXPO_PUBLIC_FEATURE_LIGHT_THEME_SCREENS` |
| 3 | Set `THEME_CHOICE=false`, `THEME_SETTINGS=false` |
| 4 | Ship OTA / store build |
| 5 | Verify: all screens dark, no overlay leaks |

**Expected:** Immediate dark — hooks return `null` surfaces + dark `ui` constants.

---

## Abort criteria

| Trigger | Action |
|---------|--------|
| Crash rate +0.5% after flag ON | Rollback G2+ |
| Journey recovery regression | Rollback `journey,map` scope |
| QR scan failure | Rollback `qr` scope; verify camera overlay |
| Contrast P0 on light | Block G3/G4 |
| Flicker on cold start | Hotfix hydrate; keep flags OFF |

---

## Screen scope reference

```
auth | role | settings | profile | legal | passenger | driver |
qr | payment | trust | journey | map | *
```

**Hooks:**

| Scope | Hook |
|-------|------|
| auth | `premiumAuthChrome` inline gate |
| role | `useRoleTheme()` |
| settings/profile/legal | `useSettingsTheme(scope)` |
| passenger | `usePassengerTheme()` |
| driver | `useDriverTheme()` |
| qr/payment/trust | `useQrPaymentTrustTheme(scope)` |
| journey/map (LiveMap) | `useLiveMapChromeTheme()` |
| journey/map (banners) | `useJourneyBannerTheme()` |

---

## Sign-off (B3 close)

| Role | B3-6h |
|------|-------|
| Engineering | ✅ Code complete, flags OFF |
| QA | ✅ Static PASS; device matrix documented |
| Design | 📋 White parity review on TestFlight |
| Product | ✅ B3 scope closed → B4 Motion + Sonic |

---

## Post-B3 monitoring (when flags enabled)

- Theme mode distribution (dark / light / system)
- Theme choice completion rate
- Settings theme change events
- Crash-free sessions by flag cohort
- Reviews mentioning brightness / theme

---

**Parent docs:** `WHITE_THEME_MASTER_ANALYSIS.md`, `B3-6H_WHITE_THEME_QA_REPORT.md`, `B3_6_RELEASE_GATE.md`
