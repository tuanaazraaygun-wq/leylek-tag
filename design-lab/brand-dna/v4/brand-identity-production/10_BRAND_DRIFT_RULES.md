# 10 — Brand Drift Rules

**Version:** Brand Drift Rules v1.0 — **FROZEN**  
**Sprint:** B5.2 — Brand Geometry Freeze  
**Authority:** `06_LOGO_GEOMETRY_CONSTITUTION.md` + master PNG

---

## 1. Purpose

Define what constitutes **forbidden drift** vs **allowed evolution** so any contributor, AI tool, or vendor can be rejected without brand council when rules are violated.

---

## 2. NEVER (automatic rejection)

### 2.1 Logo silhouette

| ID | Never |
|----|-------|
| N-01 | Redesign stork silhouette |
| N-02 | Change head shape or proportions |
| N-03 | Change neck S-curve |
| N-04 | Change beak angle beyond ±2° |
| N-05 | Move eye position outside ±3 px @512 |
| N-06 | Add crown, separate crest polygon, decorative head elements |
| N-07 | Remove or close orbital arc gap (full circle) |
| N-08 | Replace stork with abstract icon, letter, or F1 wing |
| N-09 | Return to pin / teardrop / wireframe B family |
| N-10 | Mascot, cartoon, cute big-eye treatment |
| N-11 | New bird species or generic bird |
| N-12 | 3D metal shader as master vector requirement |

### 2.2 Marker language

| ID | Never |
|----|-------|
| N-13 | Invent new marker visual language unrelated to logo DNA |
| N-14 | Female or male human silhouette |
| N-15 | Google Maps teardrop pin |
| N-16 | Taxi yellow / checker / light |
| N-17 | Luxury vehicle silhouette |
| N-18 | Mini leylek logo as map pin |
| N-19 | Gamification badges, stars, rosettes |
| N-20 | Emoji-style markers |

### 2.3 Process

| ID | Never |
|----|-------|
| N-21 | Use SVG as master over PNG |
| N-22 | Export PNG by shrinking L tier without small-tier SVG |
| N-23 | Ship asset without golden test |
| N-24 | Change geometry numbers in constitution without amendment |
| N-25 | AI "creative reinterpretation" without master overlay QA |

---

## 3. ALWAYS (mandatory)

| ID | Always |
|----|--------|
| A-01 | Derive all vectors from `leylek-logo-premium.png` |
| A-02 | Preserve DNA: stork profile + orbital arc + cyan eye |
| A-03 | Preserve locked geometry from `06` and `07` |
| A-04 | Use shared tokens from `08` |
| A-05 | Export via ladder in `09` |
| A-06 | Run golden test (95–98% similarity) before production migration |
| A-07 | Keep markers gender-neutral and vehicle-abstract |
| A-08 | Document export batch in manifest |
| A-09 | Maintain rollback backup per migration phase |
| A-10 | Reject PR that introduces second logo family |

---

## 4. Drift detection signals

| Signal | Severity | Action |
|--------|----------|--------|
| New logo PNG not from design-lab export | P0 | Block merge |
| `passenger-woman.png` filename | P1 | Rename + replace |
| Hardcoded `#22D3EE` in new brand surface | P2 | Migrate to `#00D4AA` |
| Separate head/crown SVG layer added | P0 | Revert |
| Marker without cyan accent or arc DNA | P2 | Redesign per `07` |
| IoU <95% vs master | P0 | Block ship |
| Mixkit / stock icon in brand path | P1 | Remove |
| Pin SVG referenced in app/website | P0 | Retire |

---

## 5. Allowed without amendment

| Change | Condition |
|--------|-----------|
| PNG re-export same SVG | Golden test still passes |
| Compression optimization | Visual diff imperceptible |
| Path node reduction | IoU ≥95% |
| Export to new surface size | Follow `09` ladder |
| Marker state variant (offline) | Uses locked type geometry |
| Documentation typos | design-lab only |

---

## 6. Requires amendment (DR-2)

| Change | Process |
|--------|---------|
| Any `06` locked number change | Brand council + golden test |
| New marker type #13+ | `07` amendment |
| New logo tier below 16 px | `06` §10 amendment |
| Color hue shift | All DNA docs + migration |
| Master PNG replacement | **Forbidden** unless product rebrand |

---

## 7. AI / vendor brief (copy-paste)

```
MASTER: frontend/assets/images/leylek-logo-premium.png — immutable.
TASK: vector reconstruction or export only.
DO NOT: redesign, mascot, crown, pin, F1, abstract icon, new bird.
TARGET: 95-98% silhouette match. First glance = same logo.
MARKERS: inherit arc + cyan dot DNA. No gender. No taxi. No luxury car.
OUTPUT: design-lab/brand-dna/v4/brand-identity-production/ only.
```

---

## 8. Enforcement

| Stage | Enforcer |
|-------|----------|
| Design-lab | `11_BRAND_FREEZE_CHECKLIST.md` |
| PR review | Drift table §4 |
| Pre-migration | `09` EXP gates |
| Post-ship | User recognition monitoring |

---

## 9. Amendment log

| Version | Date | Change |
|---------|------|--------|
| v1.0 FROZEN | 2026-06-21 | B5.2 initial lock |

---

**Parent:** `06`, `07`, `08`, `09`  
**Next:** `11_BRAND_FREEZE_CHECKLIST.md`
