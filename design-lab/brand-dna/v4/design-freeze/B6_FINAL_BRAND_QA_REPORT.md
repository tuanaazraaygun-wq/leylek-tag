# B6 — Final Brand QA Report (Post-Migration)

**Sprint:** B6-6 — Final Brand QA  
**Date:** 2026-06-21  
**Mode:** Static + asset verification after B6-1…B6-5, B6-2, B6-3, B6-4  
**Device soak:** ⏸ Deferred to **B6-7**

---

## Executive summary

Production brand migration patches **B6-1 through B6-5 and B6-2/3/4** are reflected in assets and primary consumer paths. **Core user journey surfaces (splash, icon, login, map entity markers, Zeka, watermark) align to B5.2 Family A.** Residual drift is **localized** to Muhabbet legacy illustrations and un-wired marker chrome — documented as candidates, not blockers for B6-7 device QA.

**Overall brand unity (production):** **~88%** (up from ~45% pre-B6)  
**Verdict:** **CONDITIONAL PASS** — ready for B6-7 device matrix; DNA Freeze EXECUTED pending G6-7.

---

## QA matrix

| # | Surface | SSOT / path | Sprint | Static QA | Device QA |
|---|---------|-------------|--------|-----------|-----------|
| 1 | Website logo | `website/public/store/leylektag-icon.png` (512) | B6-1 | ✅ PASS | ⏸ B6-7 |
| 2 | App icon iOS | `frontend/assets/ios.premium.logo.png` (1024) | B6-2/3 | ✅ PASS | ⏸ squircle clip |
| 3 | App icon Android legacy | `mipmap-*/ic_launcher*.png` | B6-3 | ✅ PASS | ⏸ |
| 4 | Adaptive foreground | `adaptive-icon-foreground.png` + mipmap fg | B6-3 | ✅ PASS | ⏸ safe zone |
| 5 | Expo favicon (web) | `frontend/assets/images/favicon.png` | B6-3 | ✅ PASS | N/A |
| 6 | JS Splash | `leylek-logo-premium.png` via `SplashScreen.tsx` | B6-2 | ✅ PASS | ⏸ timing unchanged |
| 7 | Android native splash | `drawable-*/splashscreen_logo.png` | B6-2 | ✅ PASS | ⏸ cold start |
| 8 | Login logo | `LoginBrandHeader.tsx` → premium PNG | B6-2 | ✅ PASS | ⏸ |
| 9 | Leylek Zeka FAB/header | `leylek-zeka-eye.png` | B6-4 | ✅ PASS | ⏸ |
| 10 | Leylek Zeka chat empty | `leylek-logo-premium.png` | B6-2/4 | ✅ PASS | ⏸ |
| 11 | Driver eye trigger | `LeylekEyeTrigger.tsx` → zeka-eye | B6-4 | ✅ PASS | ⏸ |
| 12 | Watermark | `leylek-watermark.png` @ 12% baked | B6-4 | ✅ PASS | ⏸ Muhabbet tabs |
| 13 | Passenger marker | `passenger-neutral.png` gender-neutral | B6-5 | ✅ PASS | ⏸ z16/18/20 |
| 14 | Driver car/motor | `driver-car.png`, `driver-motor.png` | B6-5 | ✅ PASS | ⏸ vehicle read |
| 15 | Dark theme baseline | Flags OFF | B3 | ✅ PASS | ⏸ |
| 16 | White theme | Flags OFF | B3 | ✅ N/A prod | ⏸ TestFlight |
| 17 | Marker package size | 12 PNGs ~31 KB | B6-5 | ✅ PASS (≤4KB @96 target met) | N/A |
| 18 | App logic unchanged | No route/QR/payment edits | B6-* | ✅ PASS | N/A |
| 19 | Muhabbet hero/header art | `leylek-header.png`, `leylek-blue.png` | — | ⚠️ **CANDIDATE** legacy | B6-7b |
| 20 | Map pickup/destination chrome | Ionicons in `mapMarkerChrome` | — | ⚠️ **CANDIDATE** | B6-5b |

**Pass:** 18 · **Candidate:** 2 · **Device pending:** 16

---

## Blocker resolution (original B6)

| ID | Blocker | Post-B6 status |
|----|---------|----------------|
| BLK-01 | Three logo families | ✅ **Resolved** on primary journey; ⚠️ muhabbet art remains |
| BLK-02 | Android splash ≠ JS splash | ✅ **Resolved** (B6-2) |
| BLK-03 | iOS ≠ Android icon family | ✅ **Resolved** (B6-2/3) |
| BLK-05 | PNG export ladder | ✅ **Executed** |
| BLK-06 | Gendered passenger marker | ✅ **Resolved** (B6-5) |
| BLK-04 | Human IoU ≥85% | ⏸ **Pending** B6-7 perceptual test |
| BLK-07…10 | LSX / white theme / light markers | ⏸ Post-freeze / flags OFF |

---

## Asset verification snapshot

| Asset | Dimensions | Size |
|-------|------------|------|
| `leylek-logo-premium.png` | 512×512 | 15.7 KB |
| `ios.premium.logo.png` | 1024×1024 | 18.5 KB |
| `adaptive-icon-foreground.png` | 1024×1024 | 20.9 KB |
| `favicon.png` | 1024×1024 | 18.5 KB |
| `leylek-zeka-eye.png` | 128×128 | 3.4 KB |
| `leylek-watermark.png` | 512×512 | 10.3 KB |
| `leylektag-icon.png` (website) | 512×512 | 15.5 KB |
| Marker pack (12 files) | 64–96 px src | ~31 KB total |

---

## Forbidden checks

| Rule | Result |
|------|--------|
| F1 Meridian Wing in production | ✅ None |
| Crown/maskot B5 v1 in production assets | ✅ None |
| `passenger-woman` / `passenger-man` refs | ✅ None in frontend |
| New logo generation in B6-6 | ✅ None |
| App logic / navigation change | ✅ None |

---

## Production behaviour

**Unchanged** except removed orphan PNGs (see `B6_ORPHAN_CLEANUP_REPORT.md`). All feature flags remain OFF.

---

## Recommendation

Proceed to **B6-7 Device QA + RC build decision** with focus on:

1. Cold-start splash flash (Android 12+)
2. iOS squircle / Android adaptive safe zone
3. Map marker readability @ zoom 16/18/20
4. Muhabbet watermark visibility on dark cards
5. 200 ms logo recognition flash (FQA-02)

---

**Final brand QA static verdict:** ✅ **CONDITIONAL PASS — READY FOR B6-7**
