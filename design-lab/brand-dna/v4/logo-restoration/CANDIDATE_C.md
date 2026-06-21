# B5.3 — Candidate C (Small-Size Optimized Restoration)

**ID:** `candidate-c-small-size`  
**File:** `candidates/candidate-c-small-size.svg`  
**Overlay exports:** `overlay/candidate-c-small-size-{512,1254,48,24}.png`

---

## Intent

Same logo identity as A — tuned for **favicon / notification / marker DNA echo** tiers (16–48 px).

**Not a different logo.** At 512 px overlay, C must still pass “same logo” recognition vs master PNG.

---

## Changes vs Candidate A

| Property | A | C | Rationale |
|----------|---|---|-----------|
| Arc primary stroke | 20 px | **22 px** | Arc survives @24px |
| Eye radius | 5.5 | **6.0** | Cyan dot readable @16px |
| Wing stroke | 4 px | **5 px** | Back curve visible @32px |
| Tucked leg path | separate | **merged into silhouette** | Leg noise removed @24px |
| Body fill | `#F0F4F8` | `#F5F7FA` | Slightly higher contrast on dark |

---

## Small-size test targets

| Tier | px | Pass criterion |
|------|-----|----------------|
| M0 | 16 | Arc fragment + dot visible |
| M1 | 24 | Stork profile readable |
| S | 48 | Full symbol recognizable |
| L | 512 | Must match A silhouette ≥98% |

See `SMALL_SIZE_TEST.md`.

---

## Expected human read

At app icon size:  
> “Aynı leylek — küçükte de kaybolmuyor.”

At full size:  
> Must still match A/B — if C looks like a **different** logo at 512 → **reject C**.

---

## When to select C

Choose **C** only if:

- A or B wins golden test at 512/1254, AND  
- C clearly wins 24/48 px readability matrix, AND  
- Human panel confirms 512 px still reads as **same logo**

**Recommended pattern:** Approve **A or B** as master SVG; use **C export ladder** for 16–48 px PNG tiers only (dual-ladder strategy).

---

**Next:** `SMALL_SIZE_TEST.md`
