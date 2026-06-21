# B4 — Risk Register

**Sprint:** B4 Analysis  
**Date:** 2026-06-21  
**Severity:** P0 blocker · P1 high · P2 medium · P3 low

---

## R-B4-01 — Double sound (offer + push)

| Field | Value |
|-------|-------|
| Severity | **P1** |
| Scenario | Foreground FCM plays system notification sound while `playDriverNewOfferLuxuryTone` also fires |
| Evidence | `_layout.tsx` shouldPlaySound:true + `NotificationContext` tryPlayDriverOfferSoundFromPushData |
| Mitigation | B4-2: suppress system sound for offer type when app active; rely on in-app token |
| Rollback | Flag off in-app sonic; keep push sound |

---

## R-B4-02 — Double sound (match)

| Field | Value |
|-------|-------|
| Severity | **P1** |
| Scenario | Push notification chime + `playMatchChimeSound` on same match event |
| Evidence | 5 match chime call sites in index.tsx; push handler may overlap |
| Mitigation | B4-4: single `fireLsxEvent('match.confirmed')` with tagId dedupe across socket+local |
| Rollback | Disable in-app chime; keep push |

---

## R-B4-03 — QR remote ack silence (driver)

| Field | Value |
|-------|-------|
| Severity | **P0** |
| Scenario | Passenger scans boarding QR; driver hears/feels nothing until UI poll |
| Evidence | LSX_SILENCE_REPORT Critical; no `sonic.qr.remoteAck` in bundle |
| Mitigation | B4-5: socket-triggered triad on driver LiveMap |
| Rollback | Haptic-only remote pattern |

---

## R-B4-04 — Haptic spam (dashboard taps)

| Field | Value |
|-------|-------|
| Severity | **P2** |
| Scenario | Wiring tapButtonHaptic globally → fatigue |
| Evidence | Hundreds of TouchableOpacity in index.tsx |
| Mitigation | B4-4: Tier B only on primary CTAs; not global |
| Rollback | Revert to current partial wiring |

---

## R-B4-05 — Haptic spam (match + payment stack)

| Field | Value |
|-------|-------|
| Severity | **P2** |
| Scenario | Match chime + success haptic + overlay + payment confirm in quick succession |
| Mitigation | Orchestrator queue; min 800ms between success haptics |
| Rollback | Per-event flags |

---

## R-B4-06 — Notification channel conflict (Android)

| Field | Value |
|-------|-------|
| Severity | **P1** |
| Scenario | MAX importance channels duck expo-av playback mid-token |
| Evidence | offers_v2/match_v2 + interruptionModeAndroid DoNotMix |
| Mitigation | B4-2 audio session category review; test on Samsung/Pixel |
| Rollback | shouldDuckAndroid false for UI SFX |

---

## R-B4-07 — QR scanner interference

| Field | Value |
|-------|-------|
| Severity | **P1** |
| Scenario | QR success sound overlaps camera focus / scan loop |
| Evidence | playQrScanToneOnce creates new Sound each fire |
| Mitigation | Preload QR tones; keep volume ≤0.5; optional scanTick instead of full success on decode |
| Rollback | Haptic-only on scan |

---

## R-B4-08 — Trust call vibration collision

| Field | Value |
|-------|-------|
| Severity | **P0** |
| Scenario | CallScreenV2 looping vibrate + LSX lock haptic during active call |
| Evidence | `Vibration.vibrate([0,650,300,650], true)` in CallScreenV2 |
| Mitigation | B4-5: `LsxSessionGuard` suspends LSX haptics while trust/call active |
| Rollback | LSX haptics disabled during call (default) |

---

## R-B4-09 — iOS silent mode surprise

| Field | Value |
|-------|-------|
| Severity | **P2** |
| Scenario | User mute switch on; journey sounds still play (playsInSilentModeIOS) |
| Evidence | sound.ts loadSounds config |
| Mitigation | Product decision documented; add in-app mute pref; haptic mandatory |
| Rollback | playsInSilentModeIOS false for Tier B only |

---

## R-B4-10 — Low-end Android performance

| Field | Value |
|-------|-------|
| Severity | **P2** |
| Scenario | Splash + LiveMap loops + simultaneous Sound.createAsync → jank |
| Evidence | SplashScreen 10+ Animated loops; sound creates async per QR tap |
| Mitigation | B4-2 sound pooling; B4 motion reduce parallel loops on low memory |
| Rollback | Disable non-critical motion loops |

---

## R-B4-11 — Mixkit legacy accidental wire

| Field | Value |
|-------|-------|
| Severity | **P2** |
| Scenario | Future dev calls playButtonSound → off-brand URI |
| Evidence | Dead exports in sound.ts; SoundButton.tsx still Mixkit |
| Mitigation | B4-2 remove dead exports; deprecate SoundButton |
| Rollback | — |

---

## R-B4-12 — Dead UI (playTapSound no-op)

| Field | Value |
|-------|-------|
| Severity | **P3** (UX quality) |
| Scenario | User taps dashboard controls; zero sensory feedback |
| Evidence | index.tsx playTapSound = async () => {} |
| Mitigation | B4-4 selective Tier B binding; not full sonic |
| Rollback | Keep silent taps |

---

## R-B4-13 — Theme regression via motion

| Field | Value |
|-------|-------|
| Severity | **P2** |
| Scenario | Motion patch reads theme colors incorrectly on white |
| Mitigation | B4 rule: motion layer never imports useTheme |
| Rollback | — |

---

## R-B4-14 — Reduce motion ignored

| Field | Value |
|-------|-------|
| Severity | **P2** |
| Scenario | Accessibility reduce motion; Splash 3s loops continue |
| Mitigation | B4-6 QA gate; AccessibilityInfo gate on loops |
| Rollback | — |

---

## Risk heatmap summary

| ID | Area | P |
|----|------|---|
| R-B4-03 | QR remote | P0 |
| R-B4-08 | Trust call | P0 |
| R-B4-01 | Double sound offer | P1 |
| R-B4-02 | Double sound match | P1 |
| R-B4-06 | Android channels | P1 |
| R-B4-07 | QR scanner | P1 |

---

**Parent:** `B4_PATCH_PLAN.md`, `B4_QA_PLAN.md`
