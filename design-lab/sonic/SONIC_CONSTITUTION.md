# Leylek Sonic Design System — Constitution

**Version:** LSDS v1.0  
**Scope:** Design-lab reference only. Does not modify production app assets until explicitly promoted.

---

## 1. Brand feeling

LeylekTAG sounds must communicate **premium mobility infrastructure**: calm authority, operational clarity, and quiet confidence. The listener should feel guided by a competent system—not chased by an alarm, entertained by a game, or startled by a taxi dispatch horn.

| Attribute | Target | Avoid |
|-----------|--------|-------|
| Premium | Clean transients, controlled decay, harmonic richness without clutter | Cheap beeps, noisy distortion, cartoon swooshes |
| Trustworthy | Predictable structure, consistent family timbre | Random pitches, chaotic layering |
| Futuristic | Slight glass/sheen via upper partials, precise timing | Retro 8-bit, sci-fi sirens |
| Calm | Headroom, soft attack, no sustained shrill | Continuous loops, piercing highs |
| Operational | Two-phase cues where action is required | Celebration overload on routine events |

---

## 2. Duration rules

All sounds are **one-shot** (no looping in spec).

| Tier | Duration | Use |
|------|----------|-----|
| Micro | 0.05–0.12 s | UI tap, micro-affordance |
| Short | 0.25–0.55 s | QR scan result, error blip |
| Standard | 0.60–1.00 s | Offer classic, payment confirmed |
| Extended | 0.90–1.30 s | Offer urgent, Quick Match ops call |
| Resolving | 1.00–1.50 s | Match success (emotional closure) |

**Hard limits:** nothing exceeds **1.6 s** in v1. Silence tail may extend to **80 ms** after audible content for clean file endings.

---

## 3. Loudness rules

- **Target peak:** −6 dBFS to −3 dBFS after normalization pass (never clip).
- **Perceived balance:** match success may sit **+1 dB** vs offer classic; UI tap sits **−4 dB** vs offer classic.
- **Urgent ≠ louder:** urgency comes from **interval width, rhythm density, and brighter partials**—not raw gain.
- **Mobile context:** assume phone speaker + silent mode bypass on iOS for critical driver cues only (production decision); design-lab masters remain moderate.

---

## 4. Urgency levels

| Level | Name | Sonic behavior | Haptic pairing (production idea) |
|-------|------|----------------|----------------------------------|
| L0 | Ambient | Single soft note, long decay | None or selection |
| L1 | Inform | Two-note ascending, calm | Light impact |
| L2 | Action | Two-phase operational cue | Medium impact |
| L3 | Attention | Faster rhythm, wider interval, brighter 2nd partial | Medium → rigid (Android fallback vibrate) |
| L4 | Resolve | Warm downward resolution (success) | Success notification |
| L5 | Caution | Soft descending minor color, short | Warning notification |

**Never use L5 for driver offers.** Quick Match ops is **L2**, not L3 alarm.

---

## 5. Haptic pairing ideas

| Token | Haptic | Rationale |
|-------|--------|-----------|
| `sonic.ui.tap` | `selectionAsync` or Light | Micro-sync with finger release |
| `sonic.driver.offer.classic` | Medium impact | Notice without panic |
| `sonic.driver.offer.urgent` | Medium → Light double-tap (80 ms gap) | Attention, not punishment |
| `sonic.quickMatch.driver.opsCall` | Medium single | Operational pager feel |
| `sonic.match.success` | Success notification | Emotional closure |
| `sonic.qr.success` | Light | Quick confirm |
| `sonic.qr.error` | Warning | Soft fail |
| `sonic.payment.confirmed` | Success (low priority) | Trust moment |
| `sonic.feedback.error` | Error notification | Clear but not harsh |

Haptics must **never fire without user-visible state change** and should respect dedupe/cooldown in production.

---

## 6. What must never happen

1. **No looping alarms** for offers, Quick Match, or match events.
2. **No taxi horn, sirens, or klaxon** metaphors.
3. **No childish** xylophone bounces, slide whistles, or arcade coins.
4. **No game UI** level-up fanfares for routine actions.
5. **No identical token** for unrelated events (offer ≠ match ≠ payment).
6. **No internet-sourced** or licensed third-party SFX in the LSDS pipeline.
7. **No full-volume square waves** or unfiltered sawtooth as primary timbre.
8. **No stacking** more than **three simultaneous partials** in v1 synthesis.
9. **No duration creep** across releases without constitution amendment.
10. **No production promotion** without listening review on **real device speakers** (phone + car Bluetooth sample).

---

## 7. Promotion path (out of scope for design-lab)

Assets in `design-lab/sonic/output/wav/` are **candidates**. Promotion to `frontend/assets/sounds/` requires:

- Token mapping in `SONIC_TOKENS.md` approved
- A/B listen vs current production WAV
- Dedupe/cooldown compatibility check with `utils/sound.ts` behavior

---

## 8. Governance

- **Chief Sonic Designer** owns genome and token naming.
- **v1 variations** (`_v1`, `_v2`, `_v3`) are exploration; one winner per token is selected for production.
- Changes to intervals or base pitch require `SONIC_GENOME.md` version bump.
