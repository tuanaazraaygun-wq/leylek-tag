# B5.5 — Marker Board

**Assets:** `markers/mk-01.svg` … `markers/mk-20.svg`  
**Zoom sheet:** `sheets/marker-zoom-sheet.svg`  
**Family board:** `sheets/marker-family-board.svg`  
**Format:** 48×48 monochrome wireframe · shared **arc foot** DNA

---

## Marker family (20 concepts)

| ID | File | Type | Variant |
|----|------|------|---------|
| MK-01 | `markers/mk-01.svg` | Passenger | Neutral standing A |
| MK-02 | `markers/mk-02.svg` | Passenger | Active cyan-core dot |
| MK-03 | `markers/mk-03.svg` | Driver Car | Front wedge top-down |
| MK-04 | `markers/mk-04.svg` | Driver Car | Wide body + cutout wedge |
| MK-05 | `markers/mk-05.svg` | Motorcycle | Lean ellipse + wheels |
| MK-06 | `markers/mk-06.svg` | Motorcycle | Narrow stroke frame |
| MK-07 | `markers/mk-07.svg` | Pickup | Arc-cap diamond pin |
| MK-08 | `markers/mk-08.svg` | Pickup | Lift dot + stem |
| MK-09 | `markers/mk-09.svg` | Destination | Pennant on stem |
| MK-10 | `markers/mk-10.svg` | Destination | Minimal flag stroke |
| MK-11 | `markers/mk-11.svg` | Journey | Arc path + arrow |
| MK-12 | `markers/mk-12.svg` | Journey | Dual endpoint dots |
| MK-13 | `markers/mk-13.svg` | Quick Match | Two nodes + lock dot |
| MK-14 | `markers/mk-14.svg` | Quick Match | Bridge + center lock |
| MK-15 | `markers/mk-15.svg` | Trusted | Double ring + car block |
| MK-16 | `markers/mk-16.svg` | Trusted | Halo ellipse + car |
| MK-17 | `markers/mk-17.svg` | Offline | Desaturated + strike |
| MK-18 | `markers/mk-18.svg` | Offline | Dashed deprioritize ring |
| MK-19 | `markers/mk-19.svg` | Searching | Orbit pulse rings |
| MK-20 | `markers/mk-20.svg` | Cluster | Count badge on arc base |

---

## Zoom evaluation matrix

Test each finalist at display scales simulating map zoom:

| Zoom | ~Display px | Test |
|------|-------------|------|
| **16** | ~16–18 | Car vs motor vs passenger discriminable |
| **18** | ~20–22 | Pickup vs destination distinct |
| **20** | ~24–28 | Trust ring · offline fade · search pulse readable |

**Sheet:** `sheets/marker-zoom-sheet.svg` — MK-03, MK-05, MK-09, MK-19 @ z16/z18/z20

---

## Evaluation criteria (score 1–5 each)

| Criterion | Definition |
|-----------|------------|
| **Recognition** | Reads as LeylekTAG family not generic pin |
| **Contrast** | Visible on `#0D1117` dark map |
| **Readability** | Form clear at glance |
| **Speed perception** | Identifiable from moving vehicle @ ≤2s |

---

## Shared chassis (all types)

```
     [entity silhouette]
    ╭─────────────────╮   ← orbital arc foot (logo DNA)
```

---

## Type → production mapping (future)

| Production type | Sketch candidates |
|-----------------|-------------------|
| passenger-neutral | MK-01, MK-02 |
| driver-car | MK-03, MK-04 |
| driver-motor | MK-05, MK-06 |
| pickup | MK-07, MK-08 |
| destination | MK-09, MK-10 |
| journey-active | MK-11, MK-12 |
| quick-match | MK-13, MK-14 |
| trusted-driver | MK-15, MK-16 |
| offline-driver | MK-17, MK-18 |
| searching-pulse | MK-19 |
| cluster | MK-20 |

---

**Elimination:** Marker 20 → 10 → 5 → 3 in `05_ELIMINATION_MATRIX.md`
