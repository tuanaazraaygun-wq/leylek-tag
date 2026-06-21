# B4 — Sonic Event Matrix

**Sprint:** B4 Analysis  
**Spec source:** `SONIC_DNA.md`, `LSX_EVENT_MATRIX.md`, `sound.ts`  
**LSDS v2:** `design-lab/sonic/v2/SONIC_TOKENS_V2.md`

---

## Tier A — Journey critical

| LSX event ID | LSDS token | Production fn | Trigger source | Dedupe | FG only | Wired |
|--------------|------------|---------------|----------------|--------|---------|-------|
| `driver.offer.new` | `sonic.driver.offer.classic/urgent` | `notifyDriverNewOfferSoundFromRealtimeOffer` | Socket, poll, FCM foreground | tagId Set + 1s | ✅ | ✅ |
| `qm.invite.new` | `sonic.quickMatch.driver.opsCall` | `notifyQuickMatchDriverOpsSoundFromInvite` | QM socket invite | inviteId Set + 2s | ✅ | ✅ |
| `match.confirmed` | `sonic.match.success` | `playMatchChimeSound` | Socket match, local accept (pax/drv) | 2.8s global | ✅ | ✅ |
| `qr.verify.lock` | `sonic.qr.success` | `playQrScanSuccessSound` | Scanner decode valid | 500ms | ✅ | ✅ |
| `qr.scan.fail` | `sonic.qr.error` | `playQrScanErrorSound` | Invalid QR / API fail | 500ms | ✅ | ✅ |
| `qr.remote.ack` | `sonic.qr.remoteAck` | — | Driver on passenger scan | — | — | ❌ |
| `payment.confirmed` | `sonic.payment.confirmed` | `playPaymentConfirmedSound` | Rating/payment submit success | 1s | ✅ | ✅ |
| `feedback.error` | `sonic.feedback.error` | `playFeedbackErrorSound` | API/form fail | 1.2s | ✅ | ✅ |

---

## Tier B — Primary affordance

| LSX event ID | LSDS token | Production fn | Trigger | Wired |
|--------------|------------|---------------|---------|-------|
| `ui.cta.press` | `sonic.ui.tap` | `playUiTapSound` | Role continue, offer send, driver CTAs | ⚠️ partial |
| `role.continue` | `sonic.ui.tap` | same + haptic | Role select continue | ✅ |
| `offer.send` | `sonic.ui.tap` | partial | Price offer submit | ⚠️ |
| `login.submit` | — | — | Login success | ❌ |
| `trust.accept` | *(new)* | — | Trust invite accept | ❌ |

---

## Tier C — Ambient / optional

| Event | Token | Wired |
|-------|-------|-------|
| `boot.ready` | `sonic.brand.boot` | ❌ |
| `waiting.search` | — (silent) | ✅ intentional |
| `driver.online` | — | ✅ intentional |
| `leylek.open` | — | ❌ optional brand micro |

---

## Tier D — Silent by design

Poll refresh, map tiles, location tick, chat typing, socket heartbeat — **no sonic**.

---

## Dead / legacy exports

| Function | Asset | Call sites |
|----------|-------|------------|
| `playDigitClickSound` | Mixkit URI | **0** |
| `playButtonSound` | Mixkit URI | **0** |
| `playRoleScreenSound` | Mixkit URI | **0** |

---

## iOS silent mode

| Setting | Behaviour |
|---------|-----------|
| `playsInSilentModeIOS: true` | All bundled SFX audible with mute switch on |
| User expectation | Tier A journey sounds intentional; may surprise in quiet environments |
| LSX rule | Haptic must carry confirm when user disables SFX via future pref |

**B4-2:** Add user-facing “Uygulama sesleri” toggle (separate from OS mute).

---

## Android channel risk

| Channel | Importance | Conflict |
|---------|------------|----------|
| `offers_v2`, `match_v2` | MAX | System notification sound + in-app offer tone |
| `sound.ts` interruptionMode | DoNotMix | Trust call / media ducking |

---

## Foreground vs background

| Function | Background behaviour |
|----------|---------------------|
| `playDriverNewOfferLuxuryTone` | no-op if not active |
| `playMatchChimeSound` | no AppState check — **may play if called** |
| Push handler | `tryPlayDriverOfferSoundFromPushData` checks active |

**Gap:** Match chime callers should verify AppState in B4-2.

---

## v2 promotion checklist (listen pass)

| Token | Action before swap |
|-------|-------------------|
| match.success | Re-test at vol 0.48 (v2 body louder) |
| driver.offer.* | A/B classic vs urgent in cab noise |
| qr.success | Verify scanner mic bleed |
| ui.tap | Keep 0.40 vol |

---

## Trigger file index

| File | Sounds used |
|------|-------------|
| `index.tsx` | match, payment, feedback, ui tap, QR success, offer notify, QM ops |
| `BoardingScanModal.tsx` | QR success/error |
| `MuhabbetTripQrScanModal.tsx` | QR success/error |
| `QRTripEndModal.tsx` | QR success/error |
| `DriverOfferScreen.tsx` | ui tap, feedback error |
| `NotificationContext.tsx` | driver offer from push |
| `SoundButton.tsx` | legacy Mixkit (off-brand) |

---

**Parent:** `B4_EXISTING_SOUND_INVENTORY.md`, `B4_LSX_BINDING_MATRIX.md`
