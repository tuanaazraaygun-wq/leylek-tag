# V7.1b — Failure Analysis (B5.2 + Migration Chain)

**Team:** ALPHA  
**Scope:** Why B5.2 failed · why B6-2 shipped wrong identity · lessons for V7.1b  
**Mode:** Analysis only

---

## 1. Executive failure statement

LeylekTAG did not fail because the original logo was weak. It failed because the team **traced the wrong geometry**, **froze the wrong constitution**, **exported the wrong tier**, and **shipped before humans blinked**.

> *"You documented like Landor, spec'd like Apple, and shipped like a Series A startup rushing a rebrand nobody asked for."* — B5.6 Final Jury Decision

---

## 2. B5.2 technical failure (root cause tree)

```
1254 premium master PNG (correct SSOT)
        │
        ▼
B5.1 hand trace → leylek-symbol-master-v1.svg
        │
        ├── Arc stroke locked at 11px (constitution §3) ← WRONG vs master ~18–22px
        ├── Beak tip ~344 X ← WRONG vs master ~356 X (−12px)
        ├── Tucked leg merged into body blob
        ├── Wing sweep weakened
        └── Flat #F5F7FA — acceptable IF silhouette held (it did not)
        │
        ▼
Estimated IoU ~0.91–0.94 vs 1254 ← FAIL (<0.98 gate)
        │
        ▼
B6-2 export 512×512 ~16KB PNG → replaced 1254 hero in frontend
        │
        ▼
B6-7 Human brand QA: "Logo değişmiş" ← FAIL
        │
        ▼
B5.6 Jury composite 48/100 production · 41/100 B5.2 trace
```

### Measured drifts (evidence)

| Measurement | Master @512 | B5.2 | Delta | Source |
|-------------|-------------|------|-------|--------|
| Arc primary stroke | ~18–22 px visual | 11 px | −7 to −11 px | B5.3 §4 · Constitution v1 §3 |
| Beak tip X | ~356 | ~344 | −12 px | Overlay study |
| Eye center | (292, 166) | ✅ | 0 | Locked correctly |
| Eye radius | 5.5 | 5.5 | 0 | Locked correctly |
| Tucked leg | Visible V | Merged | Identity break | CANDIDATE_A |
| Silhouette IoU | 1.00 ref | ~0.91–0.94 | FAIL | GOLDEN_TEST §6 |

**Critical insight:** Eye position was correct; **beak, arc, and leg** broke recognition. Users recognize the **ensemble**, not the dot alone.

---

## 3. B5.2 emotional failure

| Dimension | B5.2 jury score | User mechanism |
|-----------|-----------------|----------------|
| Recognition | 3/10 | "Different logo" — not refinement |
| Premium | 2/10 | Jewelry → ClipArt; **downgrade** feeling |
| Emotional impact | ≤4/10 | Elegant stork → app template bird |
| Trust | ≤6/10 | Thin arc = tentative startup, not platform |
| Brand uniqueness | ≤4/10 | Generic Turkish startup bird cluster |

### Failure mode taxonomy (B5.6)

| Label | B5.2 manifestation |
|-------|-------------------|
| **ClipArt premium** | Flat white glyph + hairline arc |
| **AI feel** | Over-smooth Beziers, no material truth |
| **Startup** | Dark bg + centered flat bird |
| **Generic** | Lost beak authority + one-leg mnemonic |
| **Dead @24px** | Arc smudge, beak gone when exported from B5.2 ladder |

### Why users revolted emotionally

1. **Sacred asset treated as replaceable** — original premium was user memory anchor  
2. **Beak shortening** removed forward-journey metaphor — felt like "new brand direction"  
3. **Arc hairline** removed technology signature — arc read as loading spinner adjacent  
4. **Metallic loss** without silhouette compensation — "cheaper" not "cleaner"  
5. **No human blink** before B6-2 migration — process violation (CF-09)

---

## 4. Process failures (governance)

| ID | Failure | Evidence |
|----|---------|----------|
| CF-09 | B5.2 shipped before human sign-off | B6-2 production sync without overlay PASS |
| CF-02 | Wrong tier in production | 512 export replaced 1254 hero |
| CF-03 | Golden IoU never executed | GOLDEN_TEST status PENDING |
| CF-01 | B6-7 human brand QA FAILED | Trigger for B5.3 restoration |
| — | Constitution v1 frozen from failed trace | 11px arc contradicts 1254 SSOT |
| — | Manifest still references B5.2-v1.0 SVG | `brand-identity-manifest.json` |
| — | Similarity target lowered to ≥85% in B5 spec | Should be ≥98% for perception |

### Timeline of mistakes

| Sprint | Action | Mistake |
|--------|--------|---------|
| B5.1 | Correct crown/mascot drift | Good — but trace geometry still weak |
| B5.2 | Freeze constitution + export system | Froze **wrong** measurements |
| B6-2 | Replace `leylek-logo-premium.png` | 512 flat export over 1254 chrome |
| B6-7 | Device QA | Technical PASS · **Human brand FAIL** |
| B5.3 | Restoration candidates A/B/C | Correct response — **unsigned** |
| B5.6 | Jury DENIED production | Rollback ordered |
| Current | Production restored to master | Per project status — correct ops |

---

## 5. B5.3 / B5.5 / V6 — not failures, but blocked

| Stage | Status | Why not production yet |
|-------|--------|------------------------|
| B5.3 A/B/C | Lab complete | `RESTORATION_DECISION.md` PENDING |
| B5.5 LC-1/2/3 | Finalists defined | No human selection (B5.6 refuses auto-pick) |
| V6 MEX | Design 96/100 | **Not implemented** — spec only |
| LC-2 composite | 80/100 COND | Below 95 gate · unsigned |

These are **correct restoration direction** — failure was shipping B5.2, not exploring LC-2.

---

## 6. Secondary failures (ecosystem amplified logo fail)

Logo failure cascaded:

| System | Production score | Logo coupling |
|--------|------------------|---------------|
| App icon | 49 FAIL | Derived from B5.2 — no arc mass pop |
| Splash | 46 FAIL | Flat 512 on hero |
| Watermark | 44 FAIL | Full-color premium PNG muddy |
| Notification | 45 FAIL | Wrong tier — not eye-only |
| Visual ecosystem | 47 FAIL | Multiple logo dialects |

**Jury:** *"Fix the logo perception first — everything else is rearranging deck chairs."*

---

## 7. What must never repeat

| # | Rule |
|---|------|
| 1 | Never ship vector export without ≥70% human blink vs **1254** master |
| 2 | Never use 512 export as splash/login hero |
| 3 | Never auto-trace PNG as production path |
| 4 | Never freeze constitution from unvalidated trace |
| 5 | Never resurrect B5.2 `leylek-symbol-master-v1.svg` |
| 6 | Never treat "technical QA pass" as brand pass |
| 7 | Never ship LC-3 as 512 master without blink proof |
| 8 | Never run B6-8 DNA Freeze while G0 open |

---

## 8. Corrective path (ordered)

1. ✅ **Rollback** production PNG to 1254 master (project status: done)  
2. ⏸ **Human panel** LC-2 vs 1254 — 5 reviewers minimum  
3. ⏸ **IoU script** ≥0.98  
4. ⏸ Freeze `leylek-symbol-master-v2.svg` from LC-2 (or LC-1 fallback)  
5. ⏸ Dual ladder LC-2 + LC-3 in manifest  
6. ⏸ Regenerate surfaces (icon, splash, markers from genom)  
7. ⏸ B5.7 re-jury ≥95  
8. ⏸ B6-8 EXECUTED  

---

## 9. Lessons for Team Alpha V7.1b

| Lesson | Implementation |
|--------|----------------|
| Perceptual SSOT = 1254 PNG | All gates reference backup, not 512 prod |
| Silhouette is the contract | Metal is raster-only memory |
| Dual ladder is mandatory | LC-2 master · LC-3 micro — documented |
| Constitution v2 before export | Fix 11px arc error |
| Filename CI gate | Prevent small SVG in master path |
| Comms: "restoration" not "rebrand" | R-P2-06 |

---

**Failure analysis complete.**  
Evidence: B5.3 · B5.6 · B6-7 trigger · overlay `b52-failed-trace-512.png` · jury scorecards.
