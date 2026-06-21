# B5.3 — Overlay Validation Protocol

**Sprint:** B5.3 — Human validation gate  
**Status:** ⏸ **PENDING HUMAN REVIEW**  
**Production:** ❌ Do not replace until signed

---

## 1. Side-by-side panel (required)

Display in order — full screen, dark `#0D1117` background:

| Panel | Asset |
|-------|-------|
| **0 — SSOT** | `reference/leylek-logo-premium-master-reference.png` (1254) |
| **1 — Failed** | `overlay/b52-failed-trace-512.png` (B5.2 export — why humans rejected) |
| **2 — A** | `overlay/candidate-a-ultra-faithful-1254.png` |
| **3 — B** | `overlay/candidate-b-optical-balance-1254.png` |
| **4 — C** | `overlay/candidate-c-small-size-1254.png` |

Optional blink test: alternate Panel 0 ↔ Panel 2 @ 500ms — silhouette should **not jump**.

---

## 2. Overlay mode (designer tool)

In Figma / Illustrator / Photoshop:

1. Place master PNG as bottom layer @ 50% opacity  
2. Place candidate export on top @ 50% opacity  
3. Toggle top layer — difference should be **edge refinement only**

**Target:** ≤2% perceptual silhouette delta (see `GOLDEN_TEST.md`)

---

## 3. Review questions (each reviewer, independent)

| # | Question | PASS answer |
|---|----------|-------------|
| Q1 | “Bu bizim LeylekTAG logosu mu?” | Evet — aynı logo |
| Q2 | “Logo değişmiş mi?” | Hayır |
| Q3 | “Sadece daha kaliteli / net mi?” | Evet |
| Q4 | “Başka bir marka gibi mi?” | Hayır |
| Q5 | “Maskot / startup ikonu gibi mi?” | Hayır |

**Gate:** ≥70% reviewers PASS Q1–Q4 on **one** candidate.

---

## 4. Element-level checklist

| Element | Must match master |
|---------|-------------------|
| Head character | ✅ same personality |
| Neck S-curve | ✅ same flow |
| Beak direction | ✅ horizontal right |
| Beak length dominance | ✅ long vs head |
| Eye position | ✅ head center-right |
| Wing curve | ✅ single back sweep |
| Standing leg thinness | ✅ vertical read |
| Tucked leg pose | ✅ visible or acceptably simplified (C) |
| Arc open gap | ✅ top-right breathing room |
| Arc bottom thickness | ✅ thickest at bottom |
| Emotional feeling | ✅ premium, not playful |

---

## 5. Files for reviewers

```
design-lab/brand-dna/v4/logo-restoration/
  reference/leylek-logo-premium-master-reference.png
  overlay/candidate-a-ultra-faithful-1254.png
  overlay/candidate-b-optical-balance-1254.png
  overlay/candidate-c-small-size-1254.png
  overlay/b52-failed-trace-512.png
```

---

## 6. Record results

| Reviewer | Date | A | B | C | Notes |
|----------|------|---|---|---|-------|
| | | ☐ | ☐ | ☐ | |
| | | ☐ | ☐ | ☐ | |

Fill results in `RESTORATION_DECISION.md` after panel completes.

---

**Do NOT merge to production until this document is signed PASS.**
