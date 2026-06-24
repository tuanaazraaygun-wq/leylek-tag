# Micro Logo Rules — LC-3 Simplification Specification

**Sprint:** RC-BRAND-V10  
**Parent:** [MASTER_V2_SPEC.md](./MASTER_V2_SPEC.md)  
**Status:** Design rules only — **no drawing, no assets**

---

## 1. Purpose

LC-3 (Micro) is a **separate authoritative artboard** for display sizes **≤ 48 px**. It preserves brand recognition when Hero (LC-2) geometry collapses.

**Design principle:** Bold silhouette over faithful detail.

---

## 2. When to use Micro

| Condition | Use Micro |
|-----------|-----------|
| Display edge ≤ 48 px | **Required** |
| Monochrome notification tray | **Required** |
| Favicon 32 px | **Required** |
| Glow strip would fail S-04 | **Required** |
| Display edge ≥ 64 px | Use Hero LC-2 |
| Marketing / splash / login | **Never** Micro |

---

## 3. Minimum dimensions (@512 artboard → scales linearly)

All minimums defined on **512 × 512 LC-3 artboard**. At display size `d` px:

```
scaled = round(minimum_512 × d / 512)
minimum_rendered = max(scaled, floor_px)
```

### 3.1 Ring (orbital arc)

| Rule | @512 artboard | @48 display | @24 display |
|------|---------------|-------------|-------------|
| **Minimum arc stroke width** (bottom mass) | **22 px** | **2 px** | **1 px** (rendered) |
| **Minimum arc stroke width** (terminals) | **14 px** | **1 px** | **1 px** |
| **Minimum visible arc sweep** | **180°** | — | — |
| **Minimum gap angular width** | **28°** | Must remain open | Arc fragment OK |
| **Minimum gap** (beak-to-arc clearance) | **14 px** | **1 px** | N/A |

**Rules:**

- Arc must read as **curved band**, not straight line or dot
- Bottom mass station must be **≥ 1.5× terminal thickness**
- Gap may collapse to **implied break** @24 but **must not close** into full circle/badge

### 3.2 Eye (accent dot)

| Rule | @512 artboard | @48 display | @24 display |
|------|---------------|-------------|-------------|
| **Minimum eye radius** | **6.0 px** | **1 px** rendered (boosted) | **1 px** |
| **Minimum eye rendered diameter** | — | **2 px** | **2 px** |
| Color | `#00D4AA` | Same | Mono: white |
| Highlight sub-dot | Optional @512 | **Omit** @≤48 | **Omit** |
| Glow halo | **Forbidden** | — | — |

**Rule:** Eye is **mandatory** @24 — primary cyan anchor when arc fragments.

### 3.3 Beak

| Rule | @512 artboard | @48 display | @24 display |
|------|---------------|-------------|-------------|
| **Minimum beak length** (eye X → tip X) | **48 px** | **4.5 px** | **2 px** |
| **Minimum beak rendered length** | — | **3 px** | **2 px** |
| Beak angle vs horizontal | **0° ± 2°** | Same | Horizontal tick OK |
| Tip style | Sharp point | 1 px wide max | Single pixel column |

**Rule:** Beak must extend **farther right** than body blob — horizontal authority preserved.

### 3.4 Leg

| Rule | @512 artboard | @48 display | @24 display |
|------|---------------|-------------|-------------|
| **Minimum standing leg thickness** | **5 px** | **1 px** | **Omit** |
| **Minimum standing leg rendered width** | — | **1 px** | — |
| Tucked leg | Merged into body | Merged | Merged |
| Foot flare | Minimal | **Omit** @≤32 | **Omit** |

**Rules @48:**

- Standing leg **may** appear as single-pixel column
- If leg competes with arc @24, **omit leg** — arc + eye + beak win

### 3.5 Neck & body

| Rule | @512 | @≤48 |
|------|------|-------|
| Neck | S-curve implied | 2–3 px wide blob bridge |
| Crest tuft | **Omit** | **Omit** |
| Wing sweep | **Omit** | **Omit** |
| Body width (max) | ~90 px @512 | ≥ 6 px @48 |

### 3.6 Negative space

| Rule | Value |
|------|-------|
| Minimum cavity inside arc | **≥ 22%** of symbol live zone @512 |
| Bird must sit inside arc cavity | Yes — no overlap beak/arc |

---

## 4. LC-3 vs LC-2 path policy

| Element | LC-2 Hero | LC-3 Micro |
|---------|-----------|------------|
| Silhouette IoU vs Hero | 100% | **≥ 96%** |
| Beak tip position delta | — | **≤ 3 px** @512 |
| Eye center delta | — | **≤ 0.5 px** @512 |
| Arc topology | Full swoosh | Bold fragment — same gap bearing |
| Crest | Present | **Removed** |
| Wing | Present | **Removed** |
| Tucked leg path | Separate | **Merged** |
| Variable arc taper | 22→6 px | **Flattened** 22→14 px |

---

## 5. Monochrome micro (notification)

| Property | Spec |
|----------|------|
| Variant | `logo.mono.white` |
| Color | `#FFFFFF` on transparent |
| Arc + body | **Single combined silhouette** acceptable @24 |
| Eye | **Must survive** as 2 px dot or cutout |
| Background | Transparent — OS tints |
| Glow | **Forbidden** |

---

## 6. Fail conditions (@ arm's length test)

Micro export **fails** if any:

| ID | Fail |
|----|------|
| M-01 | Reads as generic bird blob — no arc hint |
| M-02 | Reads as pin / teardrop / map marker |
| M-03 | Eye invisible @24 |
| M-04 | Beak indistinguishable from head @48 |
| M-05 | Arc closes into badge/circle |
| M-06 | Gray smear from glow (must be glow-free) |
| M-07 | IoU vs Hero < 96% |

---

## 7. Size-specific pass matrix

| Size | Arc | Eye | Beak | Leg | Overall |
|------|-----|-----|------|-----|---------|
| 48 | Required band | Required | Required tick | Optional 1 px | Must pass M-01–M-07 |
| 32 | Required fragment | Required | Required | Omit OK | Must pass |
| 24 | Fragment OK | **Required** | Tick OK | Omit | Eye + arc minimum |

---

## 8. Relationship to Hero exports

```
LC-2 Hero (512 paths)
        │
        ├─ IoU gate ≥ 96%
        ▼
LC-3 Micro (simplified paths — NOT auto-trace shrink)
        │
        ├─ export @48, @32, @24
        ▼
Notification / favicon surfaces
```

**Forbidden:** `transform: scale(24/512)` on LC-2 SVG as production micro path.

---

**Cross-reference:** [EXPORT_LADDER.md](./EXPORT_LADDER.md) · [QA_CHECKLIST.md](./QA_CHECKLIST.md)
