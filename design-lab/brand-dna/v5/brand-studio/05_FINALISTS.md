# B5.4 — Phase 5: Finalists

**Sprint:** B5.4 — LeylekTAG Brand Studio  
**Count:** 3  
**Rule:** Same logo · three implementation ladders — not three brands

---

## Finalist F1 — Meridian Faithful

**Sketches:** S01 + S02 + S07  
**B5.3 asset:** `logo-restoration/candidates/candidate-a-ultra-faithful.svg`  
**One-line:** The original designer redraws the premium PNG with perfect curves today.

### Wireframe
```
        >──────────
       #·
       #
      ~#
       |
      ═════
```

### Scores (1–5)

| R | P | T | Tr | S | AI | MM | F | Mo | **Total** |
|---|---|---|---|---|---|---|---|---|----------|
| 5 | 5 | 4 | 5 | 4 | 4 | 4 | 4 | 4 | **48** |

### Strengths
- Best silhouette fidelity to master PNG
- Beak extension + arc mass restore B6-7 failure modes
- Tucked one-leg pose preserved @512

### Risks
- Slightly soft @24 px favicon without companion ladder
- Optical center may feel +2 px high in iOS squircle

### Select F1 when
Human panel says: *“Bu bizim logo — sadece daha net.”*

---

## Finalist F2 — Meridian Balance

**Sketches:** S03 + S26  
**B5.3 asset:** `logo-restoration/candidates/candidate-b-optical-balance.svg`  
**One-line:** F1 + optical center nudge for 10-year surface consistency.

### Wireframe
```
         >──────────
        #·
        #
       ~#
        |
       ═════
```
*(+4,+6 optical translate vs F1)*

### Scores

| R | P | T | Tr | S | AI | MM | F | Mo | **Total** |
|---|---|---|---|---|---|---|---|---|----------|
| 5 | 5 | 4 | 5 | 4 | **5** | 4 | 4 | 5 | **49** |

### Strengths
- Highest app icon / adaptive mask score
- Timeless curve polish (S26) without silhouette drift
- Splash + login crop stability

### Risks
- Pixel purists may detect nudge vs raw PNG overlay
- Must document transform so engineering does not double-apply

### Select F2 when
Human panel prioritizes **launcher + splash** over raw overlay pixel match.

---

## Finalist F3 — Meridian Horizon

**Sketches:** S05 + small-tier ladder  
**B5.3 asset:** `logo-restoration/candidates/candidate-c-small-size.svg`  
**One-line:** F1 silhouette @512 · bold arc/eye/wing @≤48 px for map and favicon.

### Wireframe
```
        >──────
       #·
       #
      ~#
       |
      ═════
```
*(merged tucked leg @24 · arc 22px · eye r=6)*

### Scores

| R | P | T | Tr | S | AI | MM | F | Mo | **Total** |
|---|---|---|---|---|---|---|---|---|----------|
| 5 | 4 | 4 | 5 | **5** | 4 | **5** | **5** | 4 | **47** |

### Strengths
- Best map marker + favicon readability
- Dual-ladder strategy: F1/F2 @ master · F3 @ micro tiers
- Fixes “generic blob at zoom 16–18” without changing brand

### Risks
- Must not ship F3 as 512 master if blink test fails vs F1
- Tucked leg simplification needs human sign-off @24 px

### Select F3 when
Human panel confirms **same logo @512** AND superior **16–20 zoom** marker/icon read.

---

## Recommended studio decision (pre-human)

| Role | Recommendation |
|------|----------------|
| **Master SVG @512/1254** | **F2** (Balance) — highest ecosystem score |
| **Micro PNG ladder** | **F3** exports @24/48 |
| **Fallback if overlay purist** | **F1** |

**Dual-ladder (likely winner):** F2 master + F3 small-tier derivatives — single brand, two export tables.

---

## Comparison matrix

| Criterion | F1 | F2 | F3 |
|-----------|----|----|-----|
| Same logo @512 blink | ★★★★★ | ★★★★☆ | ★★★★☆ |
| Premium feeling | ★★★★★ | ★★★★★ | ★★★★☆ |
| App icon | ★★★★☆ | ★★★★★ | ★★★★☆ |
| Map @ zoom 16–18 | ★★★☆☆ | ★★★★☆ | ★★★★★ |
| 10-year timeless | ★★★★★ | ★★★★★ | ★★★★☆ |
| Implementation complexity | Low | Low | Medium (dual ladder) |

---

## Not finalists (documented)

| ID | Why not top 3 |
|----|---------------|
| S11 Orbit Cradle | Arc-only — bird unchanged but no restoration fix |
| S04 Micro-Bold | Absorbed into F3 |
| B5.2 trace | **Failed** B6-7 human QA |

---

**Next:** `06_MARKER_STUDIO.md`
