# Marker QA Plan

**Sprint:** B-2 — Marker Evolution  
**Execution:** Post design-lab export, pre production migration  
**Date:** 2026-06-21

---

## QA organization

| Phase | Scope |
|-------|-------|
| B-3 | design-lab SVG/PNG export QA |
| B-6 | Integration staging QA |
| B-8 | Production smoke |

**Devices:** iPhone SE, Pixel 6, Samsung mid-range, iPad (tablet map).

---

## Size matrix

| Size | Test |
|------|------|
| 24 px | Min MARKER_DNA — passenger/driver export |
| 32 px | Production passenger default |
| 34 px | Production car |
| 48 px | Max entity before detail tier |

---

## Marker type tests

| ID | Test | Pass |
|----|------|------|
| QA-PAX-01 | Passenger trip vs field same siluet | Match |
| QA-CAR-01 | Car vs motor instant distinguish | ≥95% |
| QA-DST-01 | Destination unified all screens | Same glyph |
| QA-PU-01 | Pickup ≠ destination form | Pass |
| QA-SRCH-01 | Seeking listed/near without off-brand green/orange | Pass |
| QA-QM-01 | QM ring vs trust ring | Distinct |
| QA-CLU-01 | 10 pins → cluster or LOD | No unreadable stack |
| QA-OFF-01 | Offline opacity 0.4 | If enabled |

---

## Map behavior tests

| ID | Scenario | Pass |
|----|----------|------|
| QA-MAP-01 | Ankara dense — 30 seeking pins | FPS ≥55 |
| QA-MAP-02 | Rural far zoom — heat only | No crash |
| QA-MAP-03 | Zoom near→far seeking hide | LOD works |
| QA-MAP-04 | Overlap pickup=passenger | Single marker policy |

---

## Theme tests

| ID | Test |
|----|------|
| QA-TH-01 | Google dark map all markers |
| QA-TH-02 | Google light map light tokens |
| QA-TH-03 | Night OLED no glow bloom |

---

## Multimodal sync tests

| ID | Event | Pass |
|----|-------|------|
| QA-MM-01 | Match — marker pulse + sonic ±20ms | |
| QA-MM-02 | QR lock — ring + haptic | |
| QA-MM-03 | QM ops — relay ring + sound | |
| QA-MM-04 | Trust accept — warm ring once | |

---

## Logo DNA continuity

| ID | Test | Pass |
|----|------|------|
| QA-LOGO-01 | Accent `#00D4AA` all glows | |
| QA-LOGO-02 | No teardrop pin form | |
| QA-LOGO-03 | Stroke radius 2–4 px language | |
| QA-LOGO-04 | Side-by-side logo M1 + passenger marker | Same family |

---

## Performance tests

| ID | Test | Pass |
|----|------|------|
| QA-PERF-01 | 50 Markers mount < 500ms | |
| QA-PERF-02 | tracksViewChanges false after init | |
| QA-PERF-03 | Animated markers ≤15 | |
| QA-PERF-04 | Bundle marker PNG total < 200KB | |

---

## Accessibility

| ID | Test |
|----|------|
| QA-A11Y-01 | Seeking marker title/description TR |
| QA-A11Y-02 | Pickup/destination labels |
| QA-A11Y-03 | Color not sole state differentiator |

---

## Regression (post migration)

| ID | Check |
|----|-------|
| QA-REG-01 | Android PNG first frame |
| QA-REG-02 | Nav rotation bearing |
| QA-REG-03 | DriverOfferScreen = LiveMapView driver |
| QA-REG-04 | Website marketing CSS unchanged (unless scoped) |

---

## Blind recognition

n≥15 drivers: marker set "LeylekTAG haritası" ≥80% vs generic Uber/Google.

---

## Gate

Zero P0 open → B-8 production asset swap allowed.

---

**İlişkili:** `MARKER_DNA_FREEZE_GATE.md`
