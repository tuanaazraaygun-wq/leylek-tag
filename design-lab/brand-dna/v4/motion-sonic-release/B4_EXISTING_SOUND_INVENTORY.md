# B4 — Existing Sound Inventory

**Sprint:** B4 Analysis  
**Date:** 2026-06-21  
**Controller:** `frontend/utils/sound.ts`  
**Bundle:** `frontend/assets/sounds/` (10 files)

---

## 1. Production bundle files

| File | Size class | LSDS token | `sound.ts` export | Volume | Cooldown |
|------|------------|------------|-------------------|--------|----------|
| `driver-offer-classic.wav` | ~0.9s | `sonic.driver.offer.classic` | `playDriverNewOfferLuxuryTone` | user pref (default 0.65) | 1000 ms |
| `driver-offer-urgent.wav` | ~0.9s | `sonic.driver.offer.urgent` | same (pref switch) | user pref | 1000 ms |
| `leylektag-luxury-tone.wav` | ~1s | `sonic.brand.signature` (fallback) | offer fallback | 0.65 | — |
| `quick-match-driver-ops.wav` | ~1s | `sonic.quickMatch.driver.opsCall` | `notifyQuickMatchDriverOpsSoundFromInvite` | 0.62 | 2000 ms |
| `match-chime.wav` | ~1.2s | `sonic.match.success` | `playMatchChimeSound` | 0.46 | 2800 ms |
| `qr-scan-success.wav` | ~0.3s | `sonic.qr.success` | `playQrScanSuccessSound` | 0.50 | 500 ms |
| `qr-scan-error.wav` | ~0.5s | `sonic.qr.error` | `playQrScanErrorSound` | 0.48 | 500 ms |
| `payment-confirmed.wav` | ~0.75s | `sonic.payment.confirmed` | `playPaymentConfirmedSound` | 0.52 | 1000 ms |
| `feedback-error.wav` | ~0.5s | `sonic.feedback.error` | `playFeedbackErrorSound` | 0.50 | 1200 ms |
| `ui-tap.wav` | ~0.08s | `sonic.ui.tap` | `playUiTapSound` | 0.40 | 70 ms |

---

## 2. Remote URI legacy (Mixkit)

| Key | URI purpose | Export | Call sites |
|-----|-------------|--------|------------|
| `SOUND_URLS.tap` | Digit click | `playDigitClickSound` | **0** |
| `SOUND_URLS.button` | Generic button | `playButtonSound`, `playRoleScreenSound` | **0** |
| `SOUND_URLS.matchChime` | Match fallback if bundle fails | internal | fallback only |

**Risk:** Off-brand SFX if accidentally wired. **B4-2:** remove or gate behind dev flag.

---

## 3. Trigger map (production)

| Trigger | Source file(s) | Gate / dedupe |
|---------|----------------|---------------|
| Match chime | `index.tsx` (passenger accept, socket match, driver match) ×5 paths | 2800 ms debounce |
| Driver offer | Socket `notifyDriverNewOfferSoundFromRealtimeOffer`, poll `finalizeDriverOfferPollSound`, push `tryPlayDriverOfferSoundFromPushData` | Per-tag `chimedIds` Set + 1000 ms cooldown |
| QM ops | `notifyQuickMatchDriverOpsSoundFromInvite` | Per-invite Set + 2000 ms |
| QR success/error | `BoardingScanModal`, `MuhabbetTripQrScanModal`, `QRTripEndModal`, `index.tsx` driver scan | 500 ms cross-kind guard |
| Payment confirmed | `index.tsx` (rating/payment flow) | 1000 ms |
| Feedback error | `index.tsx`, `DriverOfferScreen` | 1200 ms |
| UI tap | `index.tsx` role/offer CTAs, `DriverOfferScreen` | 70 ms anti-double |
| Stop offer alarm | `stopDriverOfferAlarmPlayback`, dashboard unmount | Clears cached offer sound |

---

## 4. Audio session config

From `loadSounds()`:

| Setting | Value | Implication |
|---------|-------|-------------|
| `playsInSilentModeIOS` | **true** | UI SFX play when hardware mute switch on |
| `shouldDuckAndroid` | true | Ducks other audio |
| `staysActiveInBackground` | false | Foreground-only by AppState checks |
| `interruptionModeAndroid` | 1 (DoNotMix) | May conflict with trust call / music |

**Foreground guard:** All Tier A play functions check `AppState.currentState === 'active'`.

---

## 5. Notification sound overlap

| Channel | Location | System sound | In-app sound |
|---------|----------|--------------|--------------|
| Expo handler | `_layout.tsx` | `shouldPlaySound: true` | — |
| Foreground push | `NotificationContext` | OS may play | `tryPlayDriverOfferSoundFromPushData` |
| Driver offer | `sound.ts` dedupe | Possible double with push | chimedIds mitigates in-app duplicate |

**Gap:** Match push notification may play system sound **and** `playMatchChimeSound` if both fire — verify in B4-5 QA.

---

## 6. Design-lab v2 candidates (not in bundle)

Path: `design-lab/sonic/v2/output/wav/` — 22 files, manifest `manifest.json`.

| Token | v2 candidates | Production status |
|-------|---------------|-------------------|
| All Tier A | v2a/b/c variants | v1 WAV in bundle |
| `sonic.brand.signature` | v2a, v2b | Partial (offer fallback only) |
| `sonic.qr.remoteAck` | — | **Not generated in v2** — B4 asset sprint |
| `sonic.brand.boot` | — | **Missing** — splash silent |

Promotion path: `design-lab/sonic/v2/SONIC_TOKENS_V2.md` §Production mapping.

---

## 7. Missing sonic tokens (LSX spec vs production)

| Token | Priority | Notes |
|-------|----------|-------|
| `sonic.brand.boot` | P1 | Splash handoff |
| `sonic.qr.remoteAck` | P0 | Driver device when passenger scans |
| `sonic.trust.accept` | P2 | Trust network confirm |
| `sonic.rating.submit` | P3 | Optional micro confirm |
| `sonic.journey.start` / `.end` | P2 | Boarding / trip complete |

---

## 8. Architecture notes for B4-2

Current `sound.ts` responsibilities (should split):

1. **Audio mode** — session singleton
2. **Asset registry** — token → require() map
3. **Dedupe gates** — per-event Sets + cooldowns
4. **Playback engine** — createAsync, unload, cache
5. **Push/socket adapters** — notify* functions

Target: `frontend/lib/lsx/sonicController.ts` + thin `sound.ts` re-exports for backward compat.

---

**Production unchanged in B4 analysis sprint.**
