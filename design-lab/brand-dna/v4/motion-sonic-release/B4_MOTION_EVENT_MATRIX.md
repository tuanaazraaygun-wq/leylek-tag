# B4 — Motion Event Matrix

**Sprint:** B4 Analysis  
**Spec source:** `MOTION_DNA.md`, `LSX_MOTION_LANGUAGE.md`, `LDS_MOTION_*`  
**Production scan:** `frontend/components/`, `frontend/app/`, `frontend/design-system/`

---

## Legend

| Status | Meaning |
|--------|---------|
| ✅ | Token/pattern implemented |
| ⚠️ | Partial / ad-hoc similar |
| ❌ | Spec exists, not wired |
| — | Intentionally none (Tier D) |

---

## 1. Journey phases

### Splash / boot

| Event | v4 token | Duration | Production | File | Theme |
|-------|----------|----------|------------|------|-------|
| Logo presence | `v4.motion.presence.pulse` | 220 ms | ⚠️ custom scale/fade | `SplashScreen.tsx` | Agnostic |
| Ambient breathe | `v4.motion.waiting.breathe` | 2000 loop | ✅ shimmer, dots, ring | `SplashScreen.tsx` | Agnostic |
| Handoff to app | `v4.motion.splash.handoff` | 150 ms | ⚠️ fade only | `SplashScreen.tsx` | Agnostic |
| Boot sound pair | — | — | ❌ | — | — |

### Login / auth

| Event | v4 token | Production | File |
|-------|----------|------------|------|
| Cloud drift | ambient | ✅ | `AnimatedClouds.tsx` |
| Form submit | crossfade | ❌ | `LoginScreen.tsx` |
| OTP digit | micro | ❌ (haptic only) | `index.tsx` + `keyCharHaptic` |
| Error nudge | `v4.motion.error.nudge` | ❌ | alerts static |

### Role select

| Event | v4 token | Production | File |
|-------|----------|------------|------|
| Card press | `v4.motion.click.press` | ✅ 90 ms scale | `useSelectionMotion.ts` |
| Card select | selection glow | ✅ | `PremiumSelectionCard.tsx` |
| Hero reveal | `LDS_MOTION_ORIGIN_REVEAL` | ✅ | `RoleSelectScreen.tsx` |
| Continue CTA | click.press | ⚠️ haptic+sound, motion via card | `index.tsx` |

### Match

| Event | v4 token | Production | File |
|-------|----------|------------|------|
| Match overlay | enter + spring | ✅ | `TagMatchTransitionOverlay.tsx` |
| Map chrome pulse | `v4.motion.pulse.journey` | ⚠️ breathe anims in LiveMap | `LiveMapView.tsx` |
| Offer card ingress | `v4.motion.relay.ingress` | ❌ | `DriverOfferScreen.tsx` |
| Transition to map | sheet dismiss | ❌ hard cut | `index.tsx` |

### Quick match

| Event | v4 token | Production | File |
|-------|----------|------------|------|
| Invite banner in | relay.ingress | ❌ | QM cards |
| Ops strip pulse | online.glow | ⚠️ | `DriverCockpitQuickStrip.tsx` |

### QR

| Event | v4 token | Production | File |
|-------|----------|------------|------|
| Viewfinder flash | `v4.motion.scan.viewfinderFlash` | ❌ | scanner modals |
| Lock ring close | `v4.motion.lock.ringClose` | ❌ | — |
| Remote ack chip | `v4.motion.remote.ack` | ❌ | — |
| Success hold | 350 ms | ⚠️ `scanSuccessBeat` state | `QRTripEndModal.tsx` |

### Payment / rating

| Event | v4 token | Production | File |
|-------|----------|------------|------|
| Payment lock | lock.ringClose | ❌ | transfer/rating modals |
| Check draw | `v4.motion.success.checkDraw` | ❌ | `RatingModal.tsx` |
| Star tap | `v4.motion.rating.star` | ❌ | `RatingModal.tsx` |

### Trust

| Event | v4 token | Production | File |
|-------|----------|------------|------|
| Invite chip pulse | breathe | ⚠️ `trustedAddPulse` | `LiveMapView.tsx` |
| Accept success | checkDraw | ❌ | `TrustedNetworkHub.tsx` |
| Video session | — | — (call UI separate) | `TrustVideoSessionScreen` |

### Loading / waiting

| Event | v4 token | Production | File |
|-------|----------|------------|------|
| Search waiting | waiting.breathe | ⚠️ opacity loops | `PassengerWaitingScreen.tsx` |
| Route calculating | loading.indeterminate | ❌ spinner only | `LiveMapView.tsx` |
| Spinner default | — | ✅ ActivityIndicator | global |

### Success / error

| Event | v4 token | Production | File |
|-------|----------|------------|------|
| API error | error.nudge | ❌ | `appAlert` |
| Toast enter | toast.rise | ❌ | — |
| Match success hold | 480 ms | ⚠️ overlay 3000 ms hold | `TagMatchTransitionOverlay` |

### Transitions

| Event | v4 token | Production | File |
|-------|----------|------------|------|
| Modal open | scale 0.96→1 | ⚠️ RN Modal default | various |
| Sheet close | dismiss.sheet | ❌ | bottom sheets |
| Screen push | — | Expo Router default | — |

---

## 2. LDS token mapping (implemented subset)

| LDS constant | Value | Used in |
|--------------|-------|---------|
| `LDS_MOTION_DURATION.instant` | 120 ms | `useSelectionMotion` press |
| `LDS_MOTION_DURATION.standard` | 280 ms | selection, sheets |
| `LDS_MOTION_DURATION.enter` | 420 ms | TagMatchTransition fade-in |
| `LDS_MOTION_TRANSFORM.pressScale` | 0.98 | PremiumSelectionCard |
| `LDS_MOTION_TRANSFORM.selectionScale` | 1.015 | role cards |
| `LDS_MOTION_ORIGIN_REVEAL` | 360 ms | RoleSelectScreen deck |

**Gap:** LDS tokens ≠ v4 DNA names — B4-1 manifest should alias `v4.motion.*` → LDS constants.

---

## 3. Reduce motion

| Location | Handling |
|----------|----------|
| `LDS_MOTION_ORIGIN_REVEAL.reduceMotionFadeMs` | 120 ms fade defined |
| Global `AccessibilityInfo.isReduceMotionEnabled` | **Not wired** in production scan |

**B4 risk:** Idle loops (Splash, waiting) must respect reduce-motion.

---

## 4. Theme behaviour

All motion transforms are **opacity/scale/translate** on chrome — independent of B3 light/dark. No motion token should read `useTheme()` except surface color interpolation (future, optional).

---

## 5. B4 patch targets (motion)

| Priority | Event | Token to wire first |
|----------|-------|---------------------|
| P0 | QR remote ack | `remote.ack` + chip |
| P0 | Match confirm | `pulse.journey` sync with chime |
| P1 | Driver offer card | `relay.ingress` |
| P1 | QR scan flash | `viewfinderFlash` |
| P2 | Payment/rating | `lock.ringClose` + `checkDraw` |
| P3 | Global reduce-motion | Accessibility gate |

---

**Parent:** `B4_MOTION_SONIC_MASTER_ANALYSIS.md`
