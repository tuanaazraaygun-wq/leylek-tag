# Leylek Sonic Design System — Tokens v2

**Version:** LSDS v2.0  
**Status:** Design-lab candidates (`output/wav/`)  
**Generator:** `generate_sonic_v2.py`

---

## Token registry

| Token | Urgency | Duration spec | Candidates |
|-------|---------|---------------|------------|
| `sonic.driver.offer.classic` | L1 | 0.85–1.05 s | v2a, v2b, v2c |
| `sonic.driver.offer.urgent` | L3 | 0.95–1.20 s | v2a, v2b, v2c |
| `sonic.quickMatch.driver.opsCall` | L2 | 1.05–1.30 s | v2a, v2b, v2c |
| `sonic.match.success` | L4 | 1.15–1.45 s | v2a, v2b, v2c |
| `sonic.qr.success` | L1 | 0.28–0.38 s | v2a, v2b |
| `sonic.qr.error` | L5 | 0.40–0.55 s | v2a |
| `sonic.payment.confirmed` | L4 | 0.70–0.95 s | v2a, v2b |
| `sonic.feedback.error` | L5 | 0.45–0.65 s | v2a |
| `sonic.ui.tap` | L0 | 0.06–0.10 s | v2a, v2b |
| `sonic.brand.signature` | L1 | 0.90–1.20 s | v2a, v2b |

---

## Production mapping (future promotion)

| v2 winner | Production path |
|-----------|-----------------|
| `driver_offer_classic_v2*.wav` | `frontend/assets/sounds/driver-offer-classic.wav` |
| `driver_offer_urgent_v2*.wav` | `frontend/assets/sounds/driver-offer-urgent.wav` |
| `quick_match_ops_v2*.wav` | `frontend/assets/sounds/quick-match-driver-ops.wav` |
| `match_success_v2*.wav` | `frontend/assets/sounds/match-chime.wav` |
| `qr_success_v2*.wav` | `frontend/assets/sounds/qr-scan-success.wav` |
| `qr_error_v2a.wav` | `frontend/assets/sounds/qr-scan-error.wav` |
| `payment_confirmed_v2*.wav` | `frontend/assets/sounds/payment-confirmed.wav` |
| `feedback_error_v2a.wav` | `frontend/assets/sounds/feedback-error.wav` |
| `ui_tap_v2*.wav` | `frontend/assets/sounds/ui-tap.wav` |
| `brand_signature_v2*.wav` | `frontend/assets/sounds/leylektag-luxury-tone.wav` |

---

## Runtime volume guidance (unchanged until listen pass)

| Token | Current `sound.ts` volume |
|-------|---------------------------|
| Driver offer | 0.65 (user prefs) |
| Quick Match ops | 0.62 |
| Match chime | 0.46 |
| QR success / error | 0.50 / 0.48 |
| Payment confirmed | 0.52 |
| Feedback error | 0.50 |
| UI tap | 0.40 |

v2 body adds perceived loudness — evaluate match at 0.48–0.50 after A/B.

---

## Haptic pairing (production wiring — separate patch)

See `SONIC_CONSTITUTION_V2.md` §5.
