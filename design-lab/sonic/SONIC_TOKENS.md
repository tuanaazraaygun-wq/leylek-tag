# Leylek Sonic Design System — Tokens

**Version:** LSDS v1.0  
**Status:** Design-lab candidates (`output/wav/`)

---

## Token registry

| Token | Purpose | Urgency | Duration spec | v1 candidate file |
|-------|---------|---------|---------------|-------------------|
| `sonic.brand.signature` | Leylek identity sting; splash, settings preview | L1 | 0.8–1.2 s | `brand_signature_v1.wav` |
| `sonic.driver.offer.classic` | Normal dispatch offer (foreground) | L1 | 0.7–1.0 s | `driver_offer_classic_v1.wav` |
| `sonic.driver.offer.urgent` | Driver-selected attention offer | L3 | 0.9–1.2 s | `driver_offer_urgent_v1.wav` |
| `sonic.quickMatch.driver.opsCall` | Sequential QM invite — operational, not alarm | L2 | 1.0–1.3 s | `quick_match_ops_v1.wav` |
| `sonic.match.success` | Match confirmed (both roles) | L4 | 1.0–1.5 s | `match_success_v1.wav` |
| `sonic.qr.success` | QR scan valid | L1 | 0.25–0.45 s | `qr_success_v1.wav` |
| `sonic.qr.error` | QR invalid / wrong tag | L5 | 0.35–0.55 s | `qr_error_v1.wav` |
| `sonic.payment.confirmed` | Payment / contribution confirmed | L4 | 0.6–0.9 s | `payment_confirmed_v1.wav` |
| `sonic.feedback.error` | Generic recoverable error | L5 | 0.35–0.60 s | `feedback_error_v1.wav` |
| `sonic.ui.tap` | Premium micro tap | L0 | 0.05–0.12 s | `ui_tap_v1.wav` |

---

## Variation files (listening review)

| Token | v2 | v3 |
|-------|----|----|
| `sonic.brand.signature` | `brand_signature_v2.wav` | `brand_signature_v3.wav` |
| `sonic.driver.offer.classic` | `driver_offer_classic_v2.wav` | `driver_offer_classic_v3.wav` |
| `sonic.driver.offer.urgent` | `driver_offer_urgent_v2.wav` | `driver_offer_urgent_v3.wav` |
| `sonic.quickMatch.driver.opsCall` | `quick_match_ops_v2.wav` | `quick_match_ops_v3.wav` |
| `sonic.match.success` | `match_success_v2.wav` | `match_success_v3.wav` |

Single-variation tokens (v1 only in this batch): QR, payment, feedback error, UI tap.

---

## Token specifications

### `sonic.brand.signature`

- **Structure:** A3 (220) → P5 E4 (330), soft envelope.
- **Feel:** Opening logo, “Leylek is here.”
- **Production mapping (future):** replaces / aligns with `leylektag-luxury-tone.wav`.

### `sonic.driver.offer.classic`

- **Structure:** Two-note ascending P5, calm stagger 240 ms.
- **Feel:** “New request available.”
- **Production mapping:** `driver-offer-classic.wav`.

### `sonic.driver.offer.urgent`

- **Structure:** Faster stagger (180 ms), phase 2 at F4 with subtle 3rd partial.
- **Feel:** More present, never harsh.
- **Production mapping:** `driver-offer-urgent.wav`.

### `sonic.quickMatch.driver.opsCall`

- **Structure:** Two-phase operational: C♯4 (277) → A4 (440) with comms sheen on v2/v3.
- **Feel:** Futuristic dispatch desk ping—not taxi horn.
- **Production mapping:** new asset (no production file today).

### `sonic.match.success`

- **Structure:** Warm M3 rise then P5 resolution; longest decay in family.
- **Feel:** Shared journey begins.
- **Production mapping:** `match-chime.mp3` (currently missing in repo).

### `sonic.qr.success`

- **Structure:** Single A4 blip, micro envelope.
- **Feel:** Scan lock confirmed.

### `sonic.qr.error`

- **Structure:** Short descending m3 color A3 → G♯3.
- **Feel:** Try again, no blame.

### `sonic.payment.confirmed`

- **Structure:** M3 → P5 trustworthy closure.
- **Feel:** Money/handshake moment.

### `sonic.feedback.error`

- **Structure:** Similar to QR error, slightly longer tail.
- **Feel:** System could not complete action.

### `sonic.ui.tap`

- **Structure:** High sine burst 880 Hz, 2 ms attack.
- **Feel:** Glass tap on premium UI.

---

## Cooldown & dedupe (production guidance)

| Token | Suggested cooldown | Dedupe key |
|-------|-------------------|------------|
| `sonic.driver.offer.*` | 1000 ms | `tag_id` |
| `sonic.quickMatch.driver.opsCall` | 2000 ms | `invite_id` |
| `sonic.match.success` | 2800 ms | `tag_id` |
| `sonic.qr.*` | 400 ms | scan session |
| `sonic.ui.tap` | none | — |

---

## Haptic cross-reference

See `SONIC_CONSTITUTION.md` §5 for pairing matrix.

---

## Promotion checklist

- [ ] Device listen: iPhone speaker, Android speaker, car Bluetooth
- [ ] Silent mode behavior confirmed with product
- [ ] Token wired in `utils/sound.ts` behind feature flag
- [ ] Old asset fallback documented
