# V7.2 — Risk Register (Team Bravo)

**Team:** BRAVO — Map Instrument  
**Scale:** P0 ship blocker · P1 brand/readability · P2 execution  
**Sources:** V7.1 `06_RISK_REGISTER.md` · B5.6 CF-* · V6 map tests · production grep

---

## Risk heat map

| Area | Current | Post-V7.2b (if G2 pass) |
|------|---------|-------------------------|
| z16 discrimination | 🔴 Critical | 🟡 Medium |
| Dialect fragmentation | 🔴 Critical | 🟢 Low |
| Glow token | 🔴 Critical | 🟢 Low |
| QM map absence | 🔴 Critical | 🟡 Medium |
| Light theme | 🔴 Critical | 🟡 Medium |
| Orphan assets | 🟡 Medium | 🟢 Low |

---

## P0 — Ship blockers

| ID | Risk | L | I | Evidence | Mitigation | Owner |
|----|------|---|---|----------|------------|-------|
| **RB-P0-01** | Car/motor merge @ z16 @0.4s | H | C | B5.6 map FAIL · T5 FAIL | MK-03 wedge · width ≥1.35× · G2 video | Bravo + Echo |
| **RB-P0-02** | Triple marker dialect | H | C | PNG + Ionicons + pointer | Single MEX family · grep G4-3 | Bravo + Eng |
| **RB-P0-03** | `#22D3EE` vs `#00D4AA` split | H | C | mapMarkerChrome · LiveMapView routes | Token migration · G4-4 | Eng |
| **RB-P0-04** | QM invisible on map | M | C | Jury 38 · strategic gap | Lock ring 480ms spec | Bravo |
| **RB-P0-05** | Marker export before G2 proof | M | C | B6-5 shipped early | **No frontend swap without video** | Product |
| **RB-P0-06** | Alpha G0 fail blocks genom | M | C | Arc/eye atoms from logo | Wait G0 · no stork on pins | Alpha |
| **RB-P0-07** | Pickup/dest hue-only discrimination | H | C | DriverOffer orange/green | Form MK-07 vs MK-09 | Bravo |

---

## P1 — Brand / readability

| ID | Risk | Mitigation |
|----|------|------------|
| **RB-P1-01** | Glow-only @ sunlight | Stroke-first MEX · V-B4 test |
| **RB-P1-02** | Light theme marker wash | 2.5px edge · glow −30% |
| **RB-P1-03** | Satellite edge loss | +1px `#0D1117` halo |
| **RB-P1-04** | Trust only in UI chip | MK-15 map overlay |
| **RB-P1-05** | Searching heat blob dialect | MK-19 orbit replaces Ionicons pulse |
| **RB-P1-06** | 7 orphan PNGs confuse engineers | Manifest v2 · delete or wire list |
| **RB-P1-07** | Cluster absent @ density | MK-20 implementation plan |
| **RB-P1-08** | Nav pointer ≠ car wedge | Unified SVG derivation |
| **RB-P1-09** | MC finalist never picked | B5.5 human panel |

---

## P2 — Execution

| ID | Risk | Mitigation |
|----|------|------------|
| **RB-P2-01** | PNG DPI ladder manual error | Scripted export |
| **RB-P2-02** | tracksViewChanges Android blank | B6-7 matrix extend to markers |
| **RB-P2-03** | Price tag clutter SearchingMapView | zIndex + zoom hide rules |
| **RB-P2-04** | maxZoom 18 caps proof | Document or raise cap |
| **RB-P2-05** | Eng route color refactor scope creep | Separate sprint from marker PNG |
| **RB-P2-06** | Lottie perf MK-19 low-end | Static PNG fallback tier |

---

## Contingency playbooks

### G2-1 fail (car/motor)

1. Block all marker production swap  
2. Widen car wedge · narrow motor ellipse  
3. Re-test **z15.5 only** before full ladder re-export  
4. Do not increase glow to compensate  

### G2-2 fail (pickup/dest)

1. Reject Ionicons beacons definitively  
2. A/B MK-07 vs MK-08 · MK-09 vs MK-10  
3. Re-test z18 only  

### Partial migration (worst case)

1. **Never** ship PNG entities without field Ionicons retirement  
2. Rollback `_backup-pre-b6-5` markers if brand QA fails  

---

## Open questions

| # | Question | Decision by |
|---|----------|-------------|
| Q1 | Retire Ionicons before or with PNG swap? | Product — jury says same release |
| Q2 | QM lock ring — SVG or Lottie? | Bravo + Charlie |
| Q3 | Cluster scope for v1? | Product — P2 acceptable |
| Q4 | Light theme marker ladder mandatory? | Brand — jury says yes |

---

## Risk → gate mapping

| Risk | Gate |
|------|------|
| RB-P0-01 | G2-1 |
| RB-P0-07 | G2-2 |
| RB-P0-04 | G2-5 |
| RB-P0-03 | G4-4 |
| RB-P0-02 | G4-3 |
| All P0 | Blocks RC2 store markers |

---

**Review cadence:** Weekly during V7.2b · mandatory G2 before frontend touch
