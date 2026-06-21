# B5.3 — Golden Test Protocol

**Target:** **Less than 2% silhouette difference** vs master PNG  
**SSOT:** `reference/leylek-logo-premium-master-reference.png` (1254×1254)

---

## 1. Golden rule (human)

| User says | Result |
|-----------|--------|
| “Logo değişmiş.” | **FAIL** — do not ship |
| “Logo aynı ama çok daha kaliteli olmuş.” | **PASS** — eligible for approval |

Automated metrics support human judgment — **never override human FAIL**.

---

## 2. Test pipeline

```
Master PNG (1254, alpha or black bg)
        ↓ normalize to 512 canvas
Candidate SVG
        ↓ resvg export @512
Candidate PNG
        ↓ align optical center (268,278)
Difference map (multiply / xor silhouette)
        ↓
Metric + human review
```

---

## 3. Automated metrics (recommended tools)

| Metric | Target | Tool suggestion |
|--------|--------|-----------------|
| Silhouette IoU | **≥ 0.98** (≤2% area delta) | Python PIL + alpha threshold |
| Hausdorff distance | ≤ 3 px @512 | opencv |
| Beak tip delta | ≤ 2 px | manual anchor check |
| Eye center delta | ≤ 0.5 px | manual |
| Arc mass centroid delta | ≤ 4 px | centroid compare |

**Note:** Metallic PNG interior gradients will inflate pixel diff — use **alpha silhouette mask** only (threshold bird + arc strokes).

---

## 4. Manual golden steps

1. Export candidate @512 on `#000000` background  
2. Overlay master resized to 512 @ 50% opacity  
3. Inspect: beak tip, crest, leg gap, arc terminals  
4. Score 1–5 on “same logo recognition”  
5. **Pass threshold:** average ≥ **4.5** across 3+ reviewers

---

## 5. Comparison set

| Asset | Purpose |
|-------|---------|
| Master reference | Ground truth |
| B5.2 `b52-failed-trace-512.png` | Document regression that caused B6-7 human fail |
| Candidate A @512 | Primary golden subject |
| Candidate B @512 | Optical variant |
| Candidate C @512 | Must score ≥4.5 if claiming same logo |

---

## 6. Preliminary automated estimate (design-lab)

| Pair | Estimated IoU | Status |
|------|---------------|--------|
| B5.2 trace vs master | ~0.91–0.94 (est.) | **FAIL** — explains human QA |
| Candidate A vs master | **Pending pixel script** | ⏸ Human gate |
| Candidate B vs master | **Pending** | ⏸ |
| Candidate C vs master @512 | **Pending** | ⏸ |

*Run pixel script in B5.3b if reviewers need numeric sign-off.*

---

## 7. Fail actions

| Fail type | Action |
|-----------|--------|
| Silhouette drift | Adjust Bézier handles — **no new design elements** |
| Beak too short | Extend tip X only |
| Arc too thin | Increase stroke width — not new path family |
| Leg wrong | Fix paths — do not remove one-leg stance |
| Human “logo changed” | **Stop** — iterate restoration, do not ship B6 exports |

---

## 8. Pass actions (post-approval only)

1. Freeze winning SVG as `leylek-symbol-master-v2.svg`  
2. Bump manifest to **B5.3-v1.0**  
3. Regenerate all surfaces (website, splash, icon, markers, watermark, zeka)  
4. Re-run B6-7 device QA on **new** internal RC

---

**Golden test status:** ⏸ **PENDING HUMAN + METRIC RUN**
