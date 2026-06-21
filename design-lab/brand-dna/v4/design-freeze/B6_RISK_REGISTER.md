# B6 — Consolidated Risk Register

**Sprint:** B6 — Final Design QA + DNA Freeze  
**Date:** 2026-06-21  
**Sources:** B3 `WHITE_THEME_RISK_REGISTER.md`, B4 `B4_RISK_REGISTER.md`, B5 QA, B6 analysis  
**Severity:** P0 blocker · P1 high · P2 medium · P3 low

---

## P0 — Blockers

### R-B6-01 — Three logo families in production

| Field | Value |
|-------|-------|
| Area | Logo / splash / icon |
| Scenario | User sees premium kuş → pin splash → wireframe Android icon |
| Evidence | `PRODUCTION_LOGO_AUDIT.md`, `app.json`, `BRANDING_PATHS` |
| Mitigation | B6-1…B6-3 unified A-family migration |
| Rollback | Per-patch backup restore |

### R-B6-02 — Android native splash ≠ JS splash

| Field | Value |
|-------|-------|
| Area | Splash |
| Scenario | First 200ms pin, then premium kuş — dual identity |
| Evidence | `drawable-*/splashscreen_logo.png` vs `SplashScreen.tsx` |
| Mitigation | B6-2 drawable regen from evolved SVG |
| Rollback | Restore drawable backup |

### R-B6-03 — iOS icon ≠ Android adaptive

| Field | Value |
|-------|-------|
| Area | App icon |
| Scenario | Home screen brand differs by platform |
| Evidence | ios.premium (A) vs adaptive-icon-foreground (B) |
| Mitigation | B6-3 |
| Rollback | Restore icon backups |

### R-B6-04 — Driver QR remote ack silence

| Field | Value |
|-------|-------|
| Area | Sonic / LSX |
| Scenario | Passenger scans boarding QR; driver hears/feels nothing |
| Evidence | R-B4-03; no remote ack asset |
| Mitigation | B7 journey sync + socket triad |
| Rollback | Haptic-only fallback |

### R-B6-05 — Trust call + LSX haptic collision

| Field | Value |
|-------|-------|
| Area | Haptic |
| Scenario | CallScreenV2 loop vibrate + LSX lock haptic overlap |
| Evidence | R-B4-08; `CallScreenV2.tsx` Vibration loop |
| Mitigation | LsxSessionGuard before LSX haptic ON |
| Rollback | LSX haptic flag OFF |

---

## P1 — High

### R-B6-06 — Logo SVG IoU not human-verified

| Mitigation | Designer overlay QA before B6-2 |
| Rollback | Keep production PNG until pass |

### R-B6-07 — PNG export ladder not executed

| Mitigation | Run Inkscape/Figma export from B5 SVG |
| Rollback | N/A — blocks migration start |

### R-B6-08 — Gendered passenger marker filename

| Mitigation | B6-5 rename + neutral PNG |
| Rollback | Restore marker backup |

### R-B6-09 — LSX double-fire on call-site migration

| Mitigation | Replace direct `play*` — never duplicate |
| Rollback | LSX orchestrator OFF |

### R-B6-10 — White theme manual QA not run

| Mitigation | TestFlight matrix before S2 |
| Rollback | Theme flags OFF |

### R-B6-11 — DriverOfferScreen dual marker language

| Mitigation | B6-5 unify to PNG genom |
| Rollback | Revert marker imports |

### R-B6-12 — Notification channel ducks sonic

| Mitigation | B4-2 audio session review on Samsung/Pixel |
| Rollback | shouldDuckAndroid tuning |

---

## P2 — Medium

### R-B6-13 — Light marker PNG bundle missing

| Mitigation | B6-5 light exports before theme map S5 |
| Source | B3 GAP-05 |

### R-B6-14 — `#22D3EE` vs `#00D4AA` genom drift

| Mitigation | B6-4 color alignment; migration checklist |
| Surfaces | notification tint, map glow, LeylekEye |

### R-B6-15 — StyleSheet hex baselines (white incomplete)

| Mitigation | Post-freeze token sweep |
| Source | B3 GAP-01 |

### R-B6-16 — Motion channel placeholder only

| Mitigation | B7 LDS wiring |
| Impact | No user impact while OFF |

### R-B6-17 — trust/rating sonic assets missing

| Mitigation | B7 micro asset production |

### R-B6-18 — Website header light variant missing

| Mitigation | B6-1 follow-up light SVG |

---

## P3 — Low

### R-B6-19 — useRoleTheme naming drift

### R-B6-20 — Legal routes dual ui/legalUi channel

### R-B6-21 — Out-of-scope screens not themed

### R-B6-22 — Mixkit dead exports in sound.ts

### R-B6-23 — Orphan Logo.tsx dead code

---

## Risk heatmap

| ID | Area | P | Open |
|----|------|---|------|
| R-B6-01 | Logo unity | P0 | ✅ |
| R-B6-02 | Splash | P0 | ✅ |
| R-B6-03 | App icon | P0 | ✅ |
| R-B6-04 | QR remote | P0 | ✅ |
| R-B6-05 | Trust call haptic | P0 | ✅ |
| R-B6-06 | IoU QA | P1 | ✅ |
| R-B6-08 | Passenger marker | P1 | ✅ |
| R-B6-09 | LSX double-fire | P1 | ✅ |
| R-B6-13 | Light markers | P2 | ✅ |

---

## Abort criteria (migration)

| Trigger | Action |
|---------|--------|
| Recognition test <70% "same LeylekTAG" | Stop B6-2/3; refine SVG |
| Crash +0.3% after icon swap | Rollback B6-3 |
| Gendered marker report | Immediate B6-5 rollback |
| Splash flash regression reports | Rollback B6-2 |

---

**Parent:** `B6_RELEASE_GATE.md`, `B6_PRODUCTION_MIGRATION_PLAN.md`
