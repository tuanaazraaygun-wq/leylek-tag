# B4 — QA Plan

**Sprint:** B4 Analysis  
**Execution:** Per patch (B4-1…B4-6) + full matrix at B4-6  
**Baseline:** B3 flags OFF; production dark unchanged unless LSX flag ON

---

## QA phases

| Phase | Patch | Focus |
|-------|-------|-------|
| Q4-1 | B4-1 | Manifest compile; zero runtime delta |
| Q4-2 | B4-2 | Sonic dedupe, volumes, no Mixkit |
| Q4-3 | B4-3 | Haptic patterns iOS/Android |
| Q4-4 | B4-4 | Orchestrator; match/role paths |
| Q4-5 | B4-5 | QR remote, trust call, payment |
| Q4-6 | Full | Release matrix + regression |

---

## Flag matrix

| Config | Purpose |
|--------|---------|
| `EXPO_PUBLIC_FEATURE_LSX=false` (default) | Production parity |
| `EXPO_PUBLIC_FEATURE_LSX=true` | Full orchestrator |
| `EXPO_PUBLIC_FEATURE_LSX_SOUNDS=false` | Haptic+motion only test |
| `EXPO_PUBLIC_FEATURE_LSX_HAPTICS=false` | Sonic+motion only test |

---

## Sonic QA

| ID | Test | Pass criteria |
|----|------|---------------|
| QA-S-01 | Match chime once per tag | Single sound within 3s despite socket+local |
| QA-S-02 | Driver offer once per tag | chimedIds blocks poll+push+socket |
| QA-S-03 | QM ops once per invite | invite Set |
| QA-S-04 | QR success/error cooldown | 500ms; no overlap |
| QA-S-05 | Payment confirmed cooldown | 1s |
| QA-S-06 | UI tap anti-double | 70ms |
| QA-S-07 | Background no offer sound | AppState inactive |
| QA-S-08 | Background match | No unexpected chime |
| QA-S-09 | iOS silent switch | Documented behaviour; haptic still fires (B4-5+) |
| QA-S-10 | Driver offer prefs | classic/urgent/volume from settings |
| QA-S-11 | v2 asset swap | Peak ≤ −1.4 dBFS; no clip |
| QA-S-12 | Foreground push + in-app | No double offer tone |

---

## Haptic QA

| ID | Test | Pass criteria |
|----|------|---------------|
| QA-H-01 | tapButtonHaptic | Felt on primary CTA |
| QA-H-02 | keyCharHaptic | OTP/PIN each char |
| QA-H-03 | success pattern | Distinct from tap |
| QA-H-04 | lock pattern | Distinct from success |
| QA-H-05 | error pattern | Pairs with feedback.error sonic |
| QA-H-06 | Android API 35 | Fallback vibrate works |
| QA-H-07 | No spam | 10 rapid taps ≤10 haptics (Tier B) |
| QA-H-08 | Trust call active | No LSX haptic during call loop |
| QA-H-09 | Silent mode | Haptic on Tier A when sonic muted |

---

## Motion QA

| ID | Test | Pass criteria |
|----|------|---------------|
| QA-M-01 | Role card press | scale 0.98 recover <150ms |
| QA-M-02 | Match overlay | fade+spring; no layout jump |
| QA-M-03 | QR flash | ≤120ms; no camera freeze |
| QA-M-04 | Reduce motion | Splash loops disabled/reduced |
| QA-M-05 | LiveMap markers | Unchanged position (no motion on map layer) |
| QA-M-06 | White theme | Same motion timings as dark |

---

## LSX triad QA (Tier A)

| ID | Event | ≥2 channels in 200ms |
|----|-------|----------------------|
| QA-L-01 | match.confirmed | motion+sound or motion+haptic |
| QA-L-02 | qr.verify.lock | sound+haptic |
| QA-L-03 | qr.remote.ack | sound+haptic on driver |
| QA-L-04 | payment.confirmed | sound+haptic |
| QA-L-05 | driver.offer.new | sound+haptic (B4-5+) |
| QA-L-06 | feedback.error | sound+haptic |

---

## Journey flow QA

| ID | Flow |
|----|------|
| QA-F-01 | Splash → login → role → passenger search |
| QA-F-02 | Driver online → offer → accept → match overlay → LiveMap |
| QA-F-03 | Boarding QR passenger scan → driver ack |
| QA-F-04 | Trip end QR → payment → rating |
| QA-F-05 | Quick match invite → ops sound |
| QA-F-06 | Trust invite accept (B4-5+) |
| QA-F-07 | Active trust call + incoming QR scan |

---

## Dark / B3 regression

| ID | Test |
|----|------|
| QA-DR-01 | LSX flag OFF → pixel match pre-B4 |
| QA-DR-02 | B3 white theme + LSX OFF → unchanged sensory |
| QA-DR-03 | No new hardcoded hex in motion patches |

---

## Platform matrix

| Device class | iOS | Android |
|--------------|-----|---------|
| Silent switch | QA-S-09 | — |
| API 33–34 | — | expo-haptics path |
| API 35+ | — | vibrate fallback |
| Low-end (2GB) | QA-M-04 | QA-S-07 |

---

## Abort criteria

| Trigger | Action |
|---------|--------|
| Double match sound reported | Rollback B4-4 |
| Driver QR ack missing | Block B4-5 release |
| Call vibration collision | Rollback haptic registry |
| Crash in sound.ts | Rollback B4-2 |

---

**Parent:** `B4_RELEASE_GATE.md`, `B4_RISK_REGISTER.md`
