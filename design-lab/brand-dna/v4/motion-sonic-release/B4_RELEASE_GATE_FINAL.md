# B4 — Release Gate (Final)

**Sprint:** B4 Motion + Sonic + Haptic — Complete  
**Date:** 2026-06-21  
**Prerequisite:** B3 White Theme G0 passed  
**Ship decision:** Merge with **all LSX flags OFF** — production behaviour unchanged

---

## Release gate summary

| Gate | Name | B4 status | LSX flags |
|------|------|-----------|-----------|
| G4-0 | Manifest only (B4-1) | ✅ SHIPPED | OFF |
| G4-1 | Sonic dedupe + production map (B4-2) | ✅ SHIPPED | OFF |
| G4-2 | Haptic registry (B4-3) | ✅ SHIPPED | OFF |
| G4-3 | Orchestrator (B4-4) | ✅ READY | OFF (internal TF optional) |
| G4-4 | QR/Payment/Trust wrappers (B4-5) | ✅ PREP ONLY | OFF |
| G4-5 | QA + release docs (B4-6) | ✅ COMPLETE | OFF |
| G4-GA | LSX production ON | ⏸ DEFERRED | Product decision |

---

## Feature flag matrix

### Production default (SHIP)

```env
EXPO_PUBLIC_FEATURE_LSX=false
EXPO_PUBLIC_FEATURE_LSX_ORCHESTRATOR=false
EXPO_PUBLIC_FEATURE_LSX_MOTION=false
EXPO_PUBLIC_FEATURE_LSX_SONIC=false
EXPO_PUBLIC_FEATURE_LSX_HAPTIC=false
```

| Config | Master | Orchestrator | Motion | Sonic | Haptic | Behaviour |
|--------|--------|--------------|--------|-------|--------|-----------|
| **Production** | false | * | * | * | * | Identical to pre-B4 |
| Internal TF full | true | true | true | true | true | Full triad test |
| Sonic only QA | true | true | false | true | false | Sonic + dedupe |
| Haptic only QA | true | true | false | false | true | Haptic patterns |
| Orchestrator off | true | false | * | * | * | All LSX no-op |

`*` = ignored when master false.

### Partial rollback (post-GA)

| Flag set | Effect |
|----------|--------|
| `LSX=false` | Full rollback — zero LSX side effects |
| `LSX_MOTION=false` | Disable motion only; sonic+haptic remain |
| `LSX_SONIC=false` | Disable registry sonic; production `play*` if still called directly |
| `LSX_HAPTIC=false` | Disable registry haptics; `touchHaptics.ts` unchanged |
| `LSX_ORCHESTRATOR=false` | Disable unified dispatch; direct paths unaffected |

---

## QR / Payment / Trust test matrix

**Scope:** Wrapper helpers exist; production still uses direct `sound.ts` calls. Tests below apply when flags ON during internal TF (B5 wiring).

### QR scan (passenger modals)

| ID | Surface | Trigger | Expected (flags ON) | Expected (flags OFF) |
|----|---------|---------|---------------------|----------------------|
| T-QR-01 | BoardingScanModal | Valid decode | `playQrSuccessLsx` → sonic+haptic once | Direct sonic only (today) |
| T-QR-02 | BoardingScanModal | Invalid decode | error sonic + warning haptic | Direct sonic only |
| T-QR-03 | QRTripEndModal | Valid trip-end QR | success triad | Direct sonic only |
| T-QR-04 | QRTripEndModal | Duplicate scan 500ms | Single fire (dedupe) | sonic dedupe only |
| T-QR-05 | MuhabbetTripQrScanModal | Valid/invalid | Same as T-QR-01/02 | Unchanged |
| T-QR-06 | DriverBoardingQRModal | Display QR | No sonic (display only) | Unchanged |
| T-QR-07 | Camera active + sonic | No camera freeze | Volume ≤0.5 | Unchanged |

### Payment

| ID | Surface | Trigger | Expected (flags ON) | Expected (flags OFF) |
|----|---------|---------|---------------------|----------------------|
| T-PAY-01 | index payment success | Contribution confirmed | payment.success triad | `playPaymentConfirmedSound` only |
| T-PAY-02 | Rapid double confirm | 1s cooldown | Single sonic+haptic | sonic cooldown only |
| T-PAY-03 | Payment error | API fail | error triad | `playFeedbackErrorSound` if wired |

### Trust

| ID | Surface | Trigger | Expected (flags ON) | Expected (flags OFF) |
|----|---------|---------|---------------------|----------------------|
| T-TR-01 | TrustedNetworkHub | Accept invite | haptic success; sonic null | No change (silent) |
| T-TR-02 | CallScreenV2 incoming | Ring loop | **No LSX haptic** | Vibration loop only |
| T-TR-03 | Active call + QR scan | Concurrent | LSX suspended (B5 guard) | Document collision risk |
| T-TR-04 | RatingModal submit | Rating sent | haptic tap; sonic null | No change |

### Rating

| ID | Surface | Trigger | Expected (flags ON) | Expected (flags OFF) |
|----|---------|---------|---------------------|----------------------|
| T-RAT-01 | RatingModal | Submit complete | `playRatingCompleteLsx` haptic | Unchanged |

---

## Haptic spam risk

| Risk | Severity | Mitigation (B4) | B5 action |
|------|----------|-----------------|-----------|
| Global tap haptic on all TouchableOpacity | P2 | Not wired; flags OFF | Tier B CTAs only |
| Match + payment success stack | P2 | 800ms success cooldown | Orchestrator queue |
| QR rapid invalid scans | P1 | 500ms qr dedupe gate | Keep shared gate |
| Offer new + urgent double | P1 | 1000ms offer gate | tagId session dedupe |
| Trust call + LSX lock | **P0** | Documented; LSX OFF | `LsxSessionGuard` |

**QA helper:**

```typescript
import { listActiveLsxChannels } from '@/lib/lsx';
// Production: [] — confirms haptic channel inactive
```

---

## Sound double-fire risk

| Risk | Severity | Current state | B5 rule |
|------|----------|---------------|---------|
| Match socket + local chime | P1 | Production dedupe 2800ms | Single orchestrator path |
| Driver offer push + in-app | P1 | chimedIds + cooldown | Do not duplicate with LSX |
| QR success + orchestrator + direct | P1 | **Not wired yet** | Replace, never add |
| Foreground FCM + expo-av | P1 | Unchanged | Channel review deferred |

**Critical B5 rule:** When migrating a call site to `playLsxEvent` or wrapper, **remove** the existing `play*` call in the same code path.

---

## Rollback plan

### Full rollback (< 5 min)

1. Set `EXPO_PUBLIC_FEATURE_LSX=false` in EAS env / `.env`
2. OTA or rebuild
3. Verify: no `[LSX]` dev warnings in production build
4. Smoke: match chime, driver offer, QR scan, payment confirm — same as pre-B4

### Partial rollback

| Symptom | Action |
|---------|--------|
| Haptic fatigue | `LSX_HAPTIC=false` |
| Sonic overlap | `LSX_SONIC=false` + verify no dual call sites |
| Motion jank (B5+) | `LSX_MOTION=false` |
| Orchestrator bug | `LSX_ORCHESTRATOR=false` |

### Code rollback (if flags insufficient)

1. Revert B5 call-site wiring only (keep `lib/lsx/` registry)
2. B4-2 sonic: revert bundle swap if peak clip regression
3. Never revert `touchHaptics.ts` without QA-H matrix

---

## Release gate checklist (B4 ship)

| ID | Criterion | Required | Status |
|----|-----------|----------|--------|
| RG-01 | `assertLsxRuntimeSafe()` passes | ✅ | ✅ |
| RG-02 | `assertLsxManifestSafe()` passes | ✅ | ✅ |
| RG-03 | All LSX flags default OFF | ✅ | ✅ |
| RG-04 | Zero LSX call sites in production UI | ✅ | ✅ |
| RG-05 | QR/payment/trust business logic diff = 0 | ✅ | ✅ |
| RG-06 | Socket / notification channel diff = 0 | ✅ | ✅ |
| RG-07 | CallScreenV2 functional diff = 0 | ✅ | ✅ (comment only) |
| RG-08 | No new wav/mp3/lottie assets | ✅ | ✅ |
| RG-09 | Backend / website untouched | ✅ | ✅ |
| RG-10 | B4_COMPLETE_QA_REPORT.md published | ✅ | ✅ |
| RG-11 | Open P0 risks documented with B5 plan | ✅ | ✅ R-B4-03, R-B4-08 |

---

## Abort criteria (post flag-ON beta)

| Trigger | Action |
|---------|--------|
| Crash rate +0.3% after LSX ON | Master flag OFF |
| Haptic motor stuck (Android) | Haptic flag OFF |
| Audio ducking failure on Samsung | Sonic flag OFF |
| Trust call + QR collision reported | Orchestrator OFF + guard fix |

---

## QA helpers reference

```typescript
import {
  assertLsxRuntimeSafe,
  assertLsxManifestSafe,
  listEnabledLsxChannels,
  listActiveLsxChannels,
  isLsxProductionDefault,
} from '@/lib/lsx';

assertLsxRuntimeSafe();     // registry integrity
assertLsxManifestSafe();    // token/event cross-check
listEnabledLsxChannels();   // raw env flags
listActiveLsxChannels();    // effective gates (master AND sub)
isLsxProductionDefault();   // true when all OFF
```

---

## Post-B4 roadmap

| Sprint | Focus |
|--------|-------|
| **B5** | Logo + Marker + LSX call-site wiring + `LsxSessionGuard` |
| B5-LSX | Driver `qr.remote.ack` triad |
| B5-SONIC | `trust.connected`, `rating.complete` micro assets |
| GA | Product decision to set `EXPO_PUBLIC_FEATURE_LSX=true` |

---

**Parent:** `B4_RELEASE_GATE.md`, `B4_QA_PLAN.md`, `B4_COMPLETE_QA_REPORT.md`, `B4_RISK_REGISTER.md`
