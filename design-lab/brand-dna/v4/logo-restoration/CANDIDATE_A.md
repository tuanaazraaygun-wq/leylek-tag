# B5.3 — Candidate A (Ultra-Faithful Restoration)

**ID:** `candidate-a-ultra-faithful`  
**File:** `candidates/candidate-a-ultra-faithful.svg`  
**Overlay exports:** `overlay/candidate-a-ultra-faithful-{512,1254,48,24}.png`

---

## Intent

Maximum fidelity to `reference/leylek-logo-premium-master-reference.png`.

The original designer redraws the logo today with perfect curves — **nothing added, nothing reinterpreted**.

---

## Changes vs B5.2 trace

| Layer | B5.2 | Candidate A |
|-------|------|-------------|
| `arc.primary` stroke | 11 px | **20 px** — restores bottom mass of orbital swoosh |
| Beak extension | tip ~344 X | tip **~356 X** — longer horizontal mandible |
| Head crest | integrated but weak | crest points preserved in profile start |
| `stork.leg.tucked` | small blob | **explicit tucked leg path** restored |
| Body fill | `#F5F7FA` | `#F0F4F8` — closer to silver read on dark |
| Optical transform | none | none — pure fidelity |

---

## Locked anchors (unchanged from constitution)

| Token | Value |
|-------|-------|
| Eye | (292, 166) r=5.5 |
| Beak angle | 0° ±2° |
| Canvas | 512×512 |
| Arc type | Open swoosh — not closed ring |

---

## Path philosophy

- Cubic Bézier only  
- No separate crown polygon  
- No mascot eye scaling  
- No F1 / pin / abstract geometry  

---

## Expected human read

> “Bu bizim logo — sadece daha net çizilmiş.”

If user says logo changed → **FAIL** — iterate A paths only, do not jump to B/C brand variants.

---

## When to select A

Choose **A** if overlay review shows **best silhouette match** at 512 and 1254, and B/C optical/small-size tweaks are unnecessary.

---

**Next:** Side-by-side in `OVERLAY_VALIDATION.md`
