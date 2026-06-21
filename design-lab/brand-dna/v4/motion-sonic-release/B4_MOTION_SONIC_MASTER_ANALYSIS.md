# B4 — Motion + Sonic + Haptic Master Analysis

**Sprint:** B4 Analysis (read-only)  
**Date:** 2026-06-21  
**Prerequisite:** B3 White Theme complete (flags OFF, chrome token-ready)  
**Scope:** Unify LeylekTAG sensory layers under LSX DNA — analysis only, no production changes

---

## 1. Executive summary

LeylekTAG has **strong sonic foundations** (`frontend/utils/sound.ts` + 10 bundled WAVs) and **partial haptic utilities** (`touchHaptics.ts`), but **no unified LSX orchestration layer**. Motion exists in three silos:

| Silo | Location | Maturity |
|------|----------|----------|
| **LDS motion tokens** | `frontend/design-system/tokens/motion.ts` | Role select, PremiumSelectionCard, TagMatchTransition |
| **Ad-hoc Animated** | `SplashScreen`, `LiveMapView`, `index.tsx`, `DriverOfferScreen` | High volume, inconsistent easing |
| **LSX / v4 DNA spec** | `design-lab/brand-dna/v4/MOTION_DNA.md` | Complete spec, ~15% wired |

**Sonic:** Tier A journey events mostly wired; **Mixkit URI legacy** remains for digit/button fallback; **LSDS v2 candidates** exist in design-lab but not promoted to bundle.

**Haptic:** `tapButtonHaptic` / `keyCharHaptic` used widely; **semantic patterns** (success/lock/warning) only on QR trip-end vibration and scattered CreateListing paths — not LSX-aligned.

**Theme (B3):** Motion/sonic/haptic are **theme-agnostic by design** — same tokens in dark and white; only visual chrome changes. B4 must not re-couple to theme flags.

---

## 2. Architecture today

```
┌─────────────────────────────────────────────────────────────┐
│  UI Components (index.tsx, modals, LiveMap, auth, …)        │
│    ├─ direct Animated.* (scattered)                         │
│    ├─ LDS_MOTION_* (role select, match overlay)             │
│    ├─ sound.ts exports (play*Sound, notify*)                │
│    └─ touchHaptics (tapButtonHaptic, keyCharHaptic)         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  sound.ts — monolithic controller (~660 lines)              │
│    Audio mode, dedupe gates, bundle requires, Mixkit URIs   │
└─────────────────────────────────────────────────────────────┘

Missing layer (B4 target):
┌─────────────────────────────────────────────────────────────┐
│  LSX Manifest + Event Router (lsx.*)                        │
│    motion token + sonic token + haptic token + timing       │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. System-by-system status

### 3.1 Motion

| Journey phase | Primary file(s) | LDS/LSX wired | Gap |
|---------------|-----------------|---------------|-----|
| Splash | `SplashScreen.tsx` | Custom loops (logo pulse, shimmer) | No `v4.motion.presence.pulse`; no boot sound |
| Login / OTP | `LoginScreen`, `index.tsx` auth | AnimatedClouds; form static | No submit crossfade triad |
| Role select | `RoleSelectScreen`, `useSelectionMotion` | ✅ LDS tokens | Sound: haptic only (`roleScreenHaptic`); `playRoleScreenSound` **unused** |
| Match | `TagMatchTransitionOverlay`, `index.tsx` | Partial (eye + spring) | No `pulse.journey` on map chrome; chime without motion sync |
| Quick match | `DriverQuickMatchInviteCard`, index QM | Card static | No `relay.ingress` |
| QR | Modals + scanner | Scanner beat animation partial | No viewfinder flash token; remote ack motion missing |
| Payment | `RatingModal`, transfer modals | Minimal | No `lock.ringClose` + checkDraw |
| Trust | `TrustedNetworkHub`, LiveMap chip | Pulse in LiveMap (trust add) | No trust-specific sonic/haptic registry |
| Loading | ActivityIndicator everywhere | Spinner default | No `loading.indeterminate` meridian sweep |
| Success/error | `appAlert`, banners | Static | No `error.nudge` / `success.checkDraw` |
| Transitions | Screen changes in index | Hard cuts | No shared transition router |

### 3.2 Sonic

See `B4_EXISTING_SOUND_INVENTORY.md`. Summary:

- **10 bundled WAVs** in `frontend/assets/sounds/`
- **Tier A wired:** driver offer, QM ops, match chime, QR scan, payment, feedback error, UI tap
- **Legacy:** Mixkit URIs for `playDigitClickSound`, `playButtonSound`, `playRoleScreenSound` — **zero call sites**
- **Missing tokens:** `sonic.brand.boot`, `sonic.qr.remoteAck`, `sonic.trust.*`, rating sonic
- **v2 lab assets:** 22 WAV candidates; promotion path documented in `SONIC_TOKENS_V2.md`

### 3.3 Haptic

See `B4_HAPTIC_EVENT_MATRIX.md`. Summary:

- **Central API:** `touchHaptics.ts` — generic tap/key only
- **Semantic gaps:** match, payment, offer, trust lack `notificationAsync(Success/Warning/Error)` at event time
- **QR trip-end:** raw `Vibration.vibrate([0,100,50,100])` in `QRTripEndModal` — not LSX P4 lock pattern
- **Trust call:** `CallScreenV2` looping vibration — **must not collide** with LSX Tier A patterns

---

## 4. LSX binding readiness

Full event binding spec: `B4_LSX_BINDING_MATRIX.md`.

**Triad coverage (Tier A events):**

| Event | Motion | Sound | Haptic | Score |
|-------|--------|-------|--------|-------|
| driver.offer.new | ❌ | ✅ | ❌ | 1/3 |
| match.confirmed | ⚠️ partial | ✅ | ❌ | 1.5/3 |
| qr.verify.lock | ❌ | ✅ | ⚠️ vibration only | 1.5/3 |
| qr.remote.ack | ❌ | ❌ | ❌ | 0/3 |
| payment.confirmed | ❌ | ✅ | ❌ | 1/3 |
| feedback.error | ❌ | ✅ | ❌ | 1/3 |

**Reference “alive” pattern:** Role continue CTA — `playUiTapSound` + `roleScreenHaptic` + `useSelectionMotion` press scale.

**Reference “dead” pattern:** `playTapSound = async () => {}` in PassengerDashboard and DriverDashboard — **intentional silence** on most taps (LSX_SILENCE_REPORT Critical).

---

## 5. Theme relation (B3)

| Layer | Dark | White | B4 rule |
|-------|------|-------|---------|
| Motion transforms | Same ms/easing | Same | Never branch on `resolvedTheme` |
| Sonic tokens | Same WAV | Same | Volume prefs user-scoped only |
| Haptic patterns | Same | Same | Silent mode = sound off, haptic on Tier A |
| Visual chrome | LHIS dark | B3 overlays | Motion targets chrome surfaces, not map tiles |

---

## 6. Production files touched in B4 (planned)

| Area | Files (future patches) |
|------|------------------------|
| Manifest | `frontend/lib/lsx/` (new) |
| Sound | `frontend/utils/sound.ts` → split controller |
| Haptic | `frontend/utils/touchHaptics.ts` → registry |
| Motion | `frontend/design-system/tokens/motion.ts` → v4 alias map |
| Bindings | `index.tsx`, modals — **event router calls only** |

**Out of scope B4:** Map tiles, markers, polyline, QR camera viewport, trust WebRTC, backend push payloads.

---

## 7. Recommended north star

> Within **200 ms** of a Tier A event, user receives **≥2 channels** (motion+haptic or motion+sound). Sound never alone on journey confirm.

B4 delivers **manifest + router + QA gate** before wide motion rewrites.

---

**Child docs:** `B4_EXISTING_SOUND_INVENTORY.md`, `B4_MOTION_EVENT_MATRIX.md`, `B4_SONIC_EVENT_MATRIX.md`, `B4_HAPTIC_EVENT_MATRIX.md`, `B4_LSX_BINDING_MATRIX.md`, `B4_RISK_REGISTER.md`, `B4_PATCH_PLAN.md`, `B4_QA_PLAN.md`, `B4_RELEASE_GATE.md`

**Sources:** `design-lab/lsx/*`, `design-lab/sonic/v2/*`, `design-lab/brand-dna/v4/{MOTION,SONIC,HAPTIC}_DNA.md`, `frontend/utils/sound.ts`, production component scan
