# B6 — Production Migration Plan

**Sprint:** B6 — Final Design QA + DNA Freeze  
**Status:** Plan only — **no B6 analysis migration performed**  
**Supersedes:** `brand-identity-production/05_PRODUCTION_MIGRATION_PLAN.md` (expanded B6-1…B6-8)  
**First recommended patch:** **B6-1 Website logo/favicon**

---

## Principles

1. **One patch at a time** — explicit approval per B6-n  
2. **Evolve not replace** — premium stork DNA preserved  
3. **Backup before replace** — `_backup-pre-migration/` per phase  
4. **Native rebuild** required for B6-2, B6-3 (Android res / iOS icon)  
5. **Flags stay OFF** until post-freeze gated rollout  
6. **No F1 Meridian Wing** — ever

---

## Pre-migration gates (all patches)

| Gate | Criterion |
|------|-----------|
| G-PRE-01 | Logo IoU ≥85% human sign-off |
| G-PRE-02 | PNG export ladder from B5 SVG complete |
| G-PRE-03 | `B6_DNA_FREEZE_CONSTITUTION.md` reviewed |
| G-PRE-04 | Rollback runbook tested on staging |

---

## B6-1 — Website logo / favicon

**Risk:** Low · **Native rebuild:** No · **Priority:** **FIRST**

| Step | Action | Target |
|------|--------|--------|
| 1.1 | Export PNG 16, 32, 48, 192, 512 from `leylek-symbol-dark.svg` | `website/public/store/` |
| 1.2 | Replace `leylektag-icon.png` with unified A-family mark | store + branding |
| 1.3 | Update `website/lib/branding-assets.ts` if paths change | config only |
| 1.4 | Verify navbar, footer, favicon, PWA manifest, OG unchanged paths | visual QA |
| 1.5 | Archive `logo-leylek.svg` to design-lab | retire B family |

**Rollback:** Restore `leylektag-icon.png` from backup.

**Success:** Website single logo family (A evolved).

---

## B6-2 — Splash + premium logo sync

**Risk:** Medium · **Native rebuild:** Yes (Android drawable)

| Step | Action | Target |
|------|--------|--------|
| 2.1 | Export @512 from evolved SVG | `frontend/assets/images/leylek-logo-premium.png` |
| 2.2 | Sync store copy | `website/public/store/leylek-logo-premium.png` |
| 2.3 | Regenerate `splashscreen_logo.png` ×5 DPI | Android `res/drawable-*dpi/` |
| 2.4 | Verify `app.json` splash.image path unchanged | content swap only |
| 2.5 | JS + native splash same symbol | visual QA |

**Rollback:** Restore premium PNG + drawable backups.

**Fixes:** BLK-02 (dual-family splash).

---

## B6-3 — App icon + adaptive icon

**Risk:** Medium · **Native rebuild:** Yes

| Step | Action | Target |
|------|--------|--------|
| 3.1 | Export 1024 app icon | `frontend/assets/ios.premium.logo.png` |
| 3.2 | Export adaptive foreground @432 | `adaptive-icon-foreground.png` |
| 3.3 | Regenerate mipmap foregrounds | Android res |
| 3.4 | Squircle clip test (iOS) | TestFlight |
| 3.5 | Adaptive safe zone test (Android) | Pixel + Samsung |

**Rollback:** Restore ios.premium + adaptive backups.

**Fixes:** BLK-03 (iOS ≠ Android).

---

## B6-4 — Leylek Zeka + watermark

**Risk:** Low · **Native rebuild:** No

| Step | Action | Target |
|------|--------|--------|
| 4.1 | Align `LeylekEye.tsx` to `#00D4AA` | design-system |
| 4.2 | Chat header: eye @≤32px rule | LeylekZekaChat |
| 4.3 | Watermark opacity 12% per spec | MuhabbetWatermark |
| 4.4 | Optional static eye from `leylek-zeka-eye-v1.svg` | widget fallback |

**Rollback:** Revert color tokens only.

---

## B6-5 — Marker PNG migration

**Risk:** Medium · **Native rebuild:** No (asset swap)

| Step | Action | Target |
|------|--------|--------|
| 5.1 | Export marker PNGs @24/32/34/48 | `frontend/assets/markers/` |
| 5.2 | Rename `passenger-woman.png` → `passenger-neutral.png` | file + mapNavMarkers.ts |
| 5.3 | Replace driver-car, driver-motor | same paths |
| 5.4 | Unify DriverOfferScreen field markers to PNG genom | DriverOfferScreen.tsx |
| 5.5 | Update glow to `#00D4AA` | mapMarkerChrome.tsx |
| 5.6 | Light theme marker exports | B3 GAP-05 |

**Rollback:** Restore markers backup folder.

**Fixes:** BLK-06, light map scope.

---

## B6-6 — Orphan cleanup

**Risk:** Low

| Asset | Action |
|-------|--------|
| `icon.png`, `adaptive-icon.png` | Delete |
| `login-brand.png` | Delete |
| `frontend/assets/images/favicon.png` | Replace with B6-1 export |
| `components/Logo.tsx` | Delete or wire |
| `website/public/logo-leylek.svg` | Archive |
| `website/public/app-icon.png` | Update or retire |

---

## B6-7 — Final QA

| ID | Test |
|----|------|
| FQA-01 | Full logo surface matrix — all consumers |
| FQA-02 | 200ms recognition flash test |
| FQA-03 | iOS + Android icon match |
| FQA-04 | Splash JS + native match |
| FQA-05 | Map markers all zoom levels |
| FQA-06 | Dark + white theme spot check |
| FQA-07 | No gendered passenger marker |
| FQA-08 | LSX flags OFF — sensory unchanged |
| FQA-09 | Theme flags OFF — dark unchanged |
| FQA-10 | Website + app brand unity walkthrough |

**Device matrix:** iPhone 15+, Pixel 8, Samsung A-series, Expo web.

---

## B6-8 — DNA Freeze EXECUTED

| Step | Action |
|------|--------|
| 8.1 | Sign `B6_DNA_FREEZE_CONSTITUTION.md` |
| 8.2 | Bump freeze version in manifest |
| 8.3 | Tag design-lab freeze date |
| 8.4 | Publish internal brand handbook pointer |
| 8.5 | Lock B5 SVG paths as SSOT |

**Post-freeze allowed:** LSX call-site wiring (flags ON scoped), white theme S2→S6 rollout, motion LDS wiring.

**Post-freeze forbidden without constitution amendment:** New logo family, F1 ship, pin return, gendered markers.

---

## Patch dependency graph

```
B6-1 Website ──► can start immediately after PNG export
B6-2 Splash ───► after IoU sign-off
B6-3 App icon ─► after B6-2 (same PNG pipeline)
B6-4 Zeka ─────► parallel to B6-2/3
B6-5 Markers ──► after B6-3 or parallel
B6-6 Cleanup ──► after B6-1…5
B6-7 QA ───────► after B6-6
B6-8 Freeze ───► after B6-7 pass
```

---

## Files NOT in scope without separate approval

- `backend/**`
- `package.json` / lockfiles
- Feature flag env changes
- LSX call-site wiring (post-freeze)
- Muhabbet illustrations (`leylek-blue.png`)

---

**Parent:** `B6_FINAL_DESIGN_QA_MASTER_REPORT.md`, `B6_DNA_FREEZE_CONSTITUTION.md`
