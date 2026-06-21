# V7 — Haptic System (MEX Haptic)

**Codename:** Tactile Meridian  
**Parent:** v4 HAPTIC_DNA · semantic tiers

---

## Rule

**No random vibration.** Every haptic = named event token. Silent mode = Tier A haptics continue.

---

## Product event map

| Event | Pattern | iOS | Android | Sync |
|-------|---------|-----|---------|------|
| **Tap** | P1 selection | Light | Light | 0ms |
| **Offer** | P2 confirm | Medium | Medium | sonic frame 0 |
| Offer urgent | P3 double | Medium+Light | Pattern | 0ms |
| **Match** | P6 success delayed | Success @+16ms | Success | match.resolve |
| **QR scan** | P1 light | Light | Light | scan tick |
| **QR lock** | P4 lock | Rigid+Light | Medium pattern | +8ms |
| **Payment** | P6 @+24ms | Success | Success | payment.resolve |
| **Journey start** | P1 @+16ms | Light | Light | journey.start |
| Journey end | P1 | Light | Light | journey.end |
| **Trust** | P6 @+16ms | Success | Success | trust.link |
| **Rating** | P1 per star | Light | Light | 40ms stagger |
| Boot | T0 none | — | — | — |

---

## Offer vs Quick Match discrimination

| | Offer | Quick Match |
|---|-------|-------------|
| Haptic | P2 single | P2 + 80ms + P1 |
| Sonic | A3→E4 | C♯4 |
| Visual | relay.ingress card | map lock ring |

Driver must **feel** difference without looking — B5.6 collision risk **closed in V7**.

---

## Target score

| Composite haptic | **96** |

---

**Triad reference:** `05_SONIC_SYSTEM.md` · `06_MOTION_SYSTEM.md`
