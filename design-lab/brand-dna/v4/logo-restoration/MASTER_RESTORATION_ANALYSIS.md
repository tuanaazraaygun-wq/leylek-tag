# B5.3 — Master Restoration Analysis

**Sprint:** B5.3 — LeylekTAG Premium Logo Remaster  
**Date:** 2026-06-21  
**Status:** Design-lab only — **awaiting human approval**  
**Supersedes:** B5.2 vector trace as restoration process (not production SSOT until approved)

---

## 1. Trigger

| Event | Detail |
|-------|--------|
| B6-7 Device QA | **Technical PASS** · **Human brand perception FAIL** |
| User quote target | “Logo aynı ama çok daha kaliteli olmuş.” = PASS |
| Failure mode | “Logo değişmiş.” = FAIL |
| Root cause | B5.2 flat vector + B6-2 raster replacement **lost original premium identity** |

---

## 2. Single source of truth

| Asset | Role | Dimensions | Notes |
|-------|------|------------|-------|
| **`reference/leylek-logo-premium-master-reference.png`** | **Perceptual SSOT** | 1254×1254 · ~538 KB | Pre-B6-2 original premium (from `_backup-pre-b6-2/`) |
| `reference/leylek-logo-premium-b62-export-reference.png` | Failed export reference | 512×512 · ~16 KB | Current production file post-B6-2 — **not identity SSOT** |
| `brand-identity-production/svg/leylek-symbol-master-v1.svg` | B5.2 failed trace | 512 artboard | Flat simplification — caused perception drift |

**Rule:** Every Bézier curve in B5.3 candidates must originate from the **1254 master PNG**, not from B5.2 SVG.

---

## 3. What the original master contains (identity locks)

| Element | Original premium (1254 PNG) | B5.2/B6-2 drift |
|---------|----------------------------|-----------------|
| Stork material | Brushed silver / satin chrome with highlights | Flat `#F5F7FA` fill — **acceptable in vector** if silhouette matches |
| Head | Small, rounded, subtle crest tuft integrated in profile | Over-simplified blob; crest personality weakened |
| Beak | Long, horizontal, sharp tip — dominant line | Present but proportionally short vs master |
| Eye | Small cyan glow dot — non-expressive | Position OK @ (292,166) but lost glow context in flat export |
| Neck | Slender S-curve, narrow mid-neck | Neck width drift in trace |
| Body | Teardrop, premium vertical balance | Mass center shifted |
| Wing | Single shadow curve on back contour | Stroke present but light |
| Legs | **Thin standing leg** + **tucked bent leg** — signature pose | Tucked leg blob; standing leg merged into fill |
| Arc | **Thick** cobalt→cyan swoosh; hottest at bottom; tapered terminals | Stroke too thin (11px vs ~20px visual mass); flat `#00D4AA` |
| Emotional read | Premium, elegant, metallic, recognizable LeylekTAG | Reads as generic flat app icon / “different logo” |

---

## 4. Measurement baseline @512 (from master overlay study)

| Anchor | Target | B5.2 trace | B5.3 target |
|--------|--------|------------|-------------|
| Eye center | (292, 166) | ✅ | Lock |
| Eye radius | 5.5 px | ✅ | Lock (C: 6.0 for small tiers only) |
| Beak tip region | ~(356, 158) | ~(344, 166) | Extend +8–12 px X |
| Arc stroke visual mass | ~18–22 px | 11 px | **20 px (A), 19 px (B), 22 px (C)** |
| Optical center | (268, 278) | Not applied | B: +4,+6 transform |
| Beak angle | 0° ±2° | ~OK | Lock |
| Tucked leg | Visible V on body left | Separate path weak | Reinstate in A/B |

---

## 5. Restoration workflow (executed in design-lab)

```
Study 1254 master PNG
    ↓
Measure anchors + proportions (Section 4)
    ↓
Manual Bézier rebuild (no auto-trace)
    ↓
3 candidates A / B / C
    ↓
Export PNG overlay @512 + @1254
    ↓
Human side-by-side validation  ← BLOCKED HERE
    ↓
Golden test <2% delta
    ↓
Approve ONE candidate → regenerate all surfaces
```

---

## 6. Candidate summary

| ID | File | Intent |
|----|------|--------|
| **A** | `candidates/candidate-a-ultra-faithful.svg` | Maximum silhouette fidelity; thicker arc; longer beak; tucked leg |
| **B** | `candidates/candidate-b-optical-balance.svg` | A + optical center nudge translate(4,6) per constitution |
| **C** | `candidates/candidate-c-small-size.svg` | A silhouette + bolder arc/eye/wing for 24–48 px tiers; tucked leg merged for micro clarity |

**All three must read as the SAME logo** — not three brands.

---

## 7. Known vector limits (documented, not failures)

| Master PNG feature | Vector policy |
|--------------------|---------------|
| Metallic gradients | **Not reproduced** — flat `#F0F4F8` / `#F5F7FA` fill |
| Arc blue gradient | Flat `#00D4AA` + secondary stroke — **silhouette weight** restored via stroke width |
| Beak highlight line | Omitted — optional micro-stroke in future pass |
| 3D leg shading | Single-fill + tucked path |

Users must say “same logo, sharper” — not “missing the metal.” Metal is raster-only memory; **silhouette is the contract**.

---

## 8. Production impact

| Area | B5.3 action |
|------|-------------|
| Production assets | ❌ **None** — blocked until approval |
| B6-1…B6-6 migrations | ⏸ **Do not re-run** on B5.2 exports until approved master |
| Rollback recommendation | Restore `leylek-logo-premium.png` from `_backup-pre-b6-2/` for user-facing RC until B5.3 ships |

---

## 9. Human validation required

See `OVERLAY_VALIDATION.md` and `GOLDEN_TEST.md`.

**Decision:** `RESTORATION_DECISION.md` — status **PENDING**.

---

**Parent:** `design-lab/brand-dna/v4/design-freeze/B6-7_RC_BUILD_DECISION.md` (human QA fail trigger)
