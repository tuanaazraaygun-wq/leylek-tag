# B5.3 — Candidate B (Optical Balance Restoration)

**ID:** `candidate-b-optical-balance`  
**File:** `candidates/candidate-b-optical-balance.svg`  
**Overlay exports:** `overlay/candidate-b-optical-balance-{512,1254,48,24}.png`

---

## Intent

Same logo as Candidate A — with **optical center correction** per `06_LOGO_GEOMETRY_CONSTITUTION.md`:

| Token | Value |
|-------|-------|
| Math center | (256, 256) |
| Optical center | **(268, 278)** |
| Applied nudge | `translate(4, 6)` on bird + arc groups |

---

## Changes vs Candidate A

| Property | A | B |
|----------|---|---|
| Silhouette paths | Base | **Identical** |
| Arc stroke | 20 px | 19 px (compensate shift) |
| Group transform | none | **translate(4, 6)** |
| Identity | Same | Same |

---

## Why B exists

The 1254 master PNG is slightly **beak-right and leg-down weighted**. Centering by math center alone can feel “off” in app icon squircles and splash. B applies the constitution optical shift **without redesigning**.

---

## Expected human read

> “Logo aynı — app icon’da daha dengeli duruyor.”

Must **not** read as a different stork or new brand mark.

---

## When to select B

Choose **B** if:

- A passes silhouette golden test, BUT  
- Icon/splash centering feels heavy-bottom or beak-clipped in device QA, AND  
- Human reviewers prefer B in blind A/B overlay at 1024 app-icon safe zone

---

**Next:** Compare with A in `OVERLAY_VALIDATION.md`
