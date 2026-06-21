# V7.1 — Test Gate Matrix

**Threshold:** ≥95 composite for store · per V6  
**Mode:** Read-only — gates defined, not executed

---

## Gate overview

```
G0 ──► G1 ──► G2 ──► G3 ──► G4 ──► G5 (B5.7 jury)
 │      │      │      │      │
Alpha  Alpha  Bravo  Charlie  All
```

---

## G0 — Logo restoration (pre-asset-production)

| ID | Test | Method | Pass | Team |
|----|------|--------|------|------|
| G0-1 | Human blink | 1254 vs LC-2 overlay 500ms ×10 | ≥70% same logo | Alpha + Echo |
| G0-2 | Silhouette IoU | Alpha mask @512 vs 1254 | ≥0.98 | Echo |
| G0-3 | Beak tip delta | Manual anchor | ≤2 px | Alpha |
| G0-4 | Arc mass visual | Side-by-side | Jury OK | Brand council |
| G0-5 | Rollback decision | Ops if user-facing RC | Documented | Product |

**Blocks:** All asset production

---

## G1 — Brand surfaces (post Alpha export)

| ID | Test | Pass | Team |
|----|------|------|------|
| G1-1 | App Store grid blind | 20 users name LeylekTAG | Echo |
| G1-2 | iOS squircle OEM ×6 | No clip | Echo |
| G1-3 | Android adaptive ×6 | Center mass | Echo |
| G1-4 | Notification @24px | Eye+arc read | Echo |
| G1-5 | Splash arc visible | Brand sign | Alpha |
| G1-6 | Favicon @16px | Recognizable fragment | Echo |

**Blocks:** RC1 public · marker production

---

## G2 — Map @ speed

| ID | Test | Pass | Team |
|----|------|------|------|
| G2-1 | z16 car vs motor | 90% drivers correct @0.4s | Echo |
| G2-2 | z18 pickup vs dest | 90% | Echo |
| G2-3 | Sunlight 1000 nit | Form not glow-only | Echo |
| G2-4 | Deuteranopia sim | Form discriminates | Echo |
| G2-5 | QM lock visible | On map 480ms | Bravo |

**Blocks:** RC2 · store marker marketing

---

## G3 — Triad sync

| ID | Test | Pass | Team |
|----|------|------|------|
| G3-1 | Offer frame sync | ±16ms motion/haptic/sonic | Charlie + Echo |
| G3-2 | QR lock triad | Same | Charlie |
| G3-3 | QM ≠ offer feel | Driver blind distinguish | Echo |
| G3-4 | Traffic sonic A/B | Offer audible @80km/h | Charlie |

**Blocks:** RC3

---

## G4 — Full ecosystem score

| ID | Test | Pass | Team |
|----|------|------|------|
| G4-1 | 16-dimension scorecard | ≥95 measured | Echo |
| G4-2 | T1–T9 user battery | V6 `10_USER_TEST_RESULTS` filled | Echo |
| G4-3 | No Ionicons field pins | grep verify | Eng + Echo |
| G4-4 | Glow `#00D4AA` only | grep verify | Eng + Echo |

**Blocks:** Store RC

---

## G5 — Re-jury

| ID | Test | Pass |
|----|------|------|
| G5-1 | B5.7 jury document | PASS all lanes |
| G5-2 | B6-8 DNA Freeze | EXECUTED sign-off |

**Blocks:** Production release

---

## User test battery (V7b — maps to gates)

| Test | Maps to |
|------|---------|
| 3-meter recognition | G1-1 |
| 24px visibility | G1-4 |
| Night / day mode | G2-3 |
| Driving @ speed | G2-1 |
| One-hand | Offer UX review (G3) |
| Color blindness | G2-4 |
| Outdoor sunlight | G2-3 |
| Low brightness | G2-3 |

---

## Fail actions

| Gate fail | Action |
|-----------|--------|
| G0 | Iterate LC paths · no export |
| G1 | Alpha rework icon/splash |
| G2 | Bravo rework markers |
| G3 | Charlie tune sonic/haptic |
| G4 | Hold store · partial RC OK internal |
| G5 | Return to failed lane only |

---

## V7.1 status

All gates **DEFINED** · **NOT RUN** · production **BLOCKED**
