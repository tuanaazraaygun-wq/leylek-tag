# 05 — Production Migration Plan

**Sprint:** B5 — Brand Identity Production  
**Status:** Plan only — **no production changes in B5**  
**Approval required:** Explicit sign-off before each phase  
**Source package:** `design-lab/brand-dna/v4/brand-identity-production/`

---

## 1. Migration principles

| Rule | Detail |
|------|--------|
| Evolve not replace | Same premium stork DNA — user recognition preserved |
| Single logo family | Retire B (pin/wireframe) and orphan assets |
| SVG master SSOT | PNG exported from design-lab SVG — not raster shrink |
| Markers after logo | Map markers depend on finalized color/stroke genom |
| Rollback ready | Keep previous assets in `_backup/` for one release cycle |
| No F1 | Meridian Wing remains design-lab reference only |

---

## 2. Pre-migration gates

| Gate | Criterion | Owner |
|------|-----------|-------|
| G-B6-01 | IoU silhouette ≥85% vs premium PNG | Design QA |
| G-B6-02 | `04_BRAND_IDENTITY_QA_REPORT.md` signed | Product |
| G-B6-03 | PNG export ladder complete | Design ops |
| G-B6-04 | Device matrix: iOS + Android + web | QA |
| G-B6-05 | DNA freeze document published | Brand |

**Do not start Phase 1 until all gates pass.**

---

## 3. Migration order

### Phase 1 — Website icon / logo (lowest app risk)

| Step | Action | Target files |
|------|--------|--------------|
| 1.1 | Export PNG ladder 16–512 from dark/white SVG | `website/public/store/leylektag-icon.png` (replace) |
| 1.2 | Update `website/lib/branding-assets.ts` paths | Point to new unified mark |
| 1.3 | Replace navbar mark | `BRANDING_PATHS.logoMark` |
| 1.4 | Update favicon, icon192, icon512, appleTouch | Same asset family |
| 1.5 | Retire `website/public/logo-leylek.svg` | Remove or archive |
| 1.6 | QA website dark + light pages | Manual + visual diff |

**Rollback:** Restore `leylektag-icon.png` from `_backup/`.

---

### Phase 2 — Splash logo (fix P0 dual-family)

| Step | Action | Target files |
|------|--------|--------------|
| 2.1 | Export splash symbol @512 from `leylek-symbol-dark.svg` | `frontend/assets/images/leylek-logo-premium.png` |
| 2.2 | Sync `website/public/store/leylek-logo-premium.png` | Store copy |
| 2.3 | Regenerate Android `splashscreen_logo.png` ×5 DPI | `frontend/android/.../drawable-*dpi/` |
| 2.4 | Verify `app.json` splash.image unchanged path | Same filename, new content |
| 2.5 | JS `SplashScreen.tsx` — no code change if path same | Visual verify only |

**Rollback:** Restore premium PNG from `_backup/`.

**Critical:** Native Android splash must match JS splash — same symbol family.

---

### Phase 3 — App icon / adaptive icon

| Step | Action | Target files |
|------|--------|--------------|
| 3.1 | Export 1024 app icon | `frontend/assets/ios.premium.logo.png` |
| 3.2 | Export adaptive foreground @432 | `frontend/assets/images/adaptive-icon-foreground.png` |
| 3.3 | Regenerate mipmap `ic_launcher_foreground.png` | Android res |
| 3.4 | Update `expo.icon` asset content | `leylek-logo-premium.png` or dedicated export |
| 3.5 | Squircle clip test iOS | TestFlight |
| 3.6 | Adaptive safe zone test Android | Pixel + Samsung |

**Rollback:** Restore ios.premium + adaptive-icon-foreground from `_backup/`.

**P0 fix:** iOS and Android home screen same family for first time.

---

### Phase 4 — Leylek Zeka

| Step | Action | Target |
|------|--------|--------|
| 4.1 | Align `LeylekEye.tsx` colors to `#00D4AA` | Component |
| 4.2 | Optional static fallback from `leylek-zeka-eye-v1.svg` | Widget |
| 4.3 | Chat header: eye @≤32px, full symbol @≥48px | LeylekZekaChat |
| 4.4 | QA animation performance | No regression |

**Rollback:** Revert LeylekEye color tokens only.

---

### Phase 5 — Watermark

| Step | Action | Target |
|------|--------|--------|
| 5.1 | Export watermark PNG or use SVG opacity spec | `MuhabbetWatermark.tsx` |
| 5.2 | Set opacity 12% per spec | Style constant |
| 5.3 | QA readability on photo backgrounds | Manual |

---

### Phase 6 — Marker assets

| Step | Action | Target |
|------|--------|--------|
| 6.1 | Export marker PNGs @24/32/34/48 | `frontend/assets/markers/` |
| 6.2 | Rename `passenger-woman.png` → `passenger-neutral.png` | File + `mapNavMarkers.ts` |
| 6.3 | Replace driver-car, driver-motor PNGs | Same paths |
| 6.4 | Unify DriverOfferScreen field markers to PNG genom | `DriverOfferScreen.tsx` |
| 6.5 | Add new markers (QM, cluster, offline) as needed | `mapNavMarkers.ts` |
| 6.6 | Update `MapEntityMarkerImage` glow to `#00D4AA` | `mapMarkerChrome.tsx` |
| 6.7 | Website CSS markers optional sync | `globals.css` |

**Rollback:** Restore marker PNGs from `_backup/markers/`.

---

### Phase 7 — Cleanup orphan logos

| Asset | Action |
|-------|--------|
| `frontend/assets/images/icon.png` | Delete |
| `frontend/assets/images/adaptive-icon.png` | Delete |
| `frontend/assets/images/login-brand.png` | Delete |
| `frontend/assets/images/favicon.png` | Replace with new export |
| `website/public/logo-leylek.svg` | Archive to design-lab |
| `website/public/app-icon.png` | Update or retire |
| `components/Logo.tsx` | Delete dead code or wire to new asset |

---

### Phase 8 — QA

| ID | Test |
|----|------|
| M-QA-01 | Full logo surface matrix — all consumers |
| M-QA-02 | 200ms recognition test |
| M-QA-03 | iOS + Android icon match |
| M-QA-04 | Splash native + JS match |
| M-QA-05 | Map markers all zoom levels |
| M-QA-06 | White theme map + logo |
| M-QA-07 | No gendered passenger marker |
| M-QA-08 | Store screenshot refresh (optional) |

---

### Phase 9 — Rollback runbook

| Trigger | Action |
|---------|--------|
| Icon recognition drop | Restore Phase 3 backup |
| Splash flash regression | Restore Phase 2 backup |
| Map marker unreadable | Restore Phase 6 backup; keep logo if OK |
| Website favicon broken | Restore Phase 1 backup only |

**Backup location:** `design-lab/brand-dna/v4/brand-identity-production/_backup-pre-migration/` (create at migration start).

**OTA note:** Logo/marker changes require **native rebuild** for Android res + iOS icon — OTA alone insufficient for Phase 2–3.

---

## 4. Patch recommendation (B6)

| Patch | Scope | Risk |
|-------|-------|------|
| **B6-1** | Website favicon + navbar only | Low |
| **B6-2** | Splash + premium PNG sync | Medium |
| **B6-3** | App icon + adaptive (native rebuild) | Medium |
| **B6-4** | Leylek Zeka + watermark | Low |
| **B6-5** | Marker PNG migration + field map unify | Medium |
| **B6-6** | Orphan cleanup + DNA freeze doc | Low |

Execute B6-1 → B6-3 before B6-5. DNA freeze after B6-6.

---

## 5. Files NOT to change without approval

| Path | Reason |
|------|--------|
| `backend/**` | Out of scope |
| `frontend/app.json` | Phase 3 only, explicit approval |
| `package.json` / lockfiles | Out of scope |
| Muhabbet illustrations | Not master logo |
| F1 Meridian Wing assets | Ship forbidden |

---

## 6. Success criteria

| Criterion | Measure |
|-----------|---------|
| Single logo family | Zero B-family consumers in production |
| User recognition | ≥85% "same LeylekTAG" in flash test |
| Platform parity | iOS icon = Android adaptive = favicon tier |
| Marker genom | 12 types spec'd; core 3 migrated min |
| Gender neutral | No gendered marker filename or silhouette |

---

**Parent:** `04_BRAND_IDENTITY_QA_REPORT.md`  
**Next sprint:** B6 — Design QA + DNA Freeze
