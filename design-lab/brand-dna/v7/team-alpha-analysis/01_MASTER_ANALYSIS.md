# V7.1b — Team Alpha: Master Analysis

**Team:** ALPHA — Brand Core  
**Mode:** Analysis only · no production changes  
**Date:** 2026-06-21  
**Perceptual SSOT:** `frontend/assets/images/_backup-pre-b6-2/leylek-logo-premium.png` · `design-lab/brand-dna/v4/logo-restoration/reference/leylek-logo-premium-master-reference.png` (1254×1254)

---

## Executive summary

The LeylekTAG premium logo is a **vertical stork in an open orbital arc** — not a mascot, not a generic bird icon. Users emotionally recognize it because the mark encodes the brand name (*leylek*), premium instrument material memory, and a signature one-leg pose inside a thick cyan swoosh. B5.2/B6-2 vector migration broke that contract; production has since been **restored to the 1254 raster master** (per project status). Evolution must preserve silhouette and mnemonic pose while exporting a dual-ladder vector system (LC-2 master + LC-3 micro). No redesign. No B5.2 resurrection.

**Evidence base:** B5.4 Brand Studio · B5.3 Restoration · B5.5 Sketch Lab · B5.6 Global Jury · V6 MEX · V7.1 Experience Asset Lab · visual inspection of master reference PNG and B5.2 overlay.

---

## A — Why users emotionally recognize the original logo

| Driver | Evidence | Emotional read |
|--------|----------|----------------|
| **Name–symbol alignment** | Brand is *LeylekTAG*; mark is unmistakably a stork (*leylek*) | Instant cultural recognition in Turkey — the bird is the brand name |
| **One-leg stance** | Signature pose documented in `brand-studio/01_BRAND_DNA_ANALYSIS.md` §11 | Subconscious mnemonic: real storks stand on one leg; users who know the app feel "that's our leylek" |
| **Long horizontal beak** | Dominant linear element; forward-pointing | Direction, journey, intent — ride platform metaphor without text |
| **Thick orbital arc** | Bottom-weighted swoosh; open gap top-right | Technology shell, coverage, GPS orbit — separates LeylekTAG from wildlife logos and pin-drop maps |
| **Premium material memory** | Brushed silver/chrome body + cyan glow on 1254 PNG | "Jewelry / automotive trim" — users feel upgrade, not clipart (`B5.6` CF-15) |
| **Calm premium posture** | Small head, modest crest, non-cartoon eye | Trust at night on a highway — not playful mascot energy |
| **Cyan eye dot** | Single `#00D4AA` family dot linking bird to arc | "System alive" — intelligence without face character |

**B6-7 human QA quote target (PASS):** *"Logo aynı ama çok daha kaliteli olmuş."*  
**Failure quote (B5.2/B6-2):** *"Logo değişmiş."* (`logo-restoration/MASTER_RESTORATION_ANALYSIS.md` §1)

Users do not recognize the logo from geometry alone — they recognize the **bundle**: stork pose + beak authority + arc mass + metallic premium read.

---

## B — Exact visual elements creating LeylekTAG identity (ranked)

Ranked by recognition impact when removed or drifted (highest first):

| Rank | Element | Lock token | Why it ranks here |
|------|---------|------------|-------------------|
| 1 | **Silhouette contour** | `silhouette.contour` | Blink-test primary — overlay IoU gate ≥0.98 |
| 2 | **Long horizontal beak** | `beak.horizontal_dominant` | B5.2 beak shorten (~344 vs ~356 X @512) = top recognition break |
| 3 | **Orbital arc bottom mass** | `arc.bottom_mass` | B5.2 arc 11px vs ~18–22px visual = "spinner / different app" |
| 4 | **One-leg + tucked leg pose** | `pose.one_leg` | Merged leg in B5.2 = generic bird blob |
| 5 | **Open arc gap (top-right)** | `arc.gap_top_right` | Prevents badge/seal; preserves beak breathing room |
| 6 | **Vertical stork genus** | `genus.stork` | Not owl/phoenix/pin — brand name anchor |
| 7 | **Single cyan eye dot** | `eye.single_cyan_dot` | Links bird to arc DNA; Zeka atom |
| 8 | **Neck S-curve personality** | `neck.curvature` | Too straight = corporate; too curved = mascot |
| 9 | **Optical bottom weight** | `optical.center` (268, 278) | Stability / premium calm |
| 10 | **Wing sweep stroke** | `wing.stroke` | Kinetic memory; without it body = static teardrop |
| 11 | **Small modest head + crest tuft** | `head.scale_modest` | Anti-mascot; biological truth |
| 12 | **Material memory (raster hero)** | `material.brushed_silver` | Decorative at vector tiers; critical at splash/login hero |

Source: `brand-studio/01_BRAND_DNA_ANALYSIS.md` · `brand-studio/02_LOGO_GENOME.md` · B5.3 measurement table.

---

## C — Safe evolution vs never change

### Must NEVER change (CORE DNA)

| Token | Rule |
|-------|------|
| `genus.stork` | Vertical stork profile — reject owl, crane, phoenix, pin, abstract icon |
| `pose.one_leg` | Standing + tucked leg readable @≥48px |
| `beak.horizontal_dominant` | Longest element; ~0° ±2° |
| `beak.tip_sharp` | Pointed — not duck bill |
| `head.scale_modest` | Not chibi |
| `eye.single_cyan_dot` | One dot `#00D4AA` family |
| `eye.position` | Anchor ~(292, 166) @512 |
| `arc.open_swoosh` | Not closed badge/ring |
| `arc.bottom_mass` | Thickest at bottom center |
| `arc.gap_top_right` | Open breathing gap |
| `silhouette.contour` | IoU ≥0.98 vs 1254 master |
| `emotion.premium_calm` | Not mascot/playful |
| **Forbidden directions** | F1 Meridian Wing · crown · auto-trace · B5.2 v1 trace as master |

### May evolve SAFELY (within bounds)

| Token | Bounds | Notes |
|-------|--------|-------|
| `arc.stroke_width` | ±4 px @512; never <14 @512 master | B5.3: 19–22px restoration band |
| `optical.center` | Nudge ±6 px | LC-2: translate(4,6) for mask/splash |
| `body.fill` | Flat `#F0F4F8`–`#F5F7FA` vector | Silhouette must hold |
| `leg.tucked.detail` | Full @512; simplify @≤32px | LC-3 merges @24px only |
| `wing.stroke` | 2–5 px | Never merge into body @ master |
| `neck.curvature` | ±5% path tuning | No kink >8° |
| `crest.tuft` | May soften — not remove @ master | |
| `material.brushed_silver` | Raster-only hero tier | Vector flat OK if blink passes |
| `arc.color` | Flat vector; gradient raster hero only | |
| Export ladder | Dual LC-2 + LC-3 | Document in manifest |

Source: `02_LOGO_GENOME.md` · B5.3 candidates A/B/C · `06_LOGO_GEOMETRY_CONSTITUTION.md` (v2 amendment pending).

---

## D — Why B5.2 failed

### Technical failures (measured / documented)

| Drift | Original master @512 | B5.2 trace | Source |
|-------|----------------------|------------|--------|
| Arc stroke mass | ~18–22 px visual | **11 px** hairline | `06_LOGO_GEOMETRY_CONSTITUTION.md` §3 · B5.3 §4 |
| Beak tip X | ~356 | **~344** (−12 px) | B5.3 overlay study |
| Tucked leg | Visible V path | **Merged blob** | `CANDIDATE_A.md` |
| Wing | Separate sweep stroke | Weak / merged | B5.3 master analysis |
| Material | Satin chrome highlights | Flat `#F5F7FA` | Intended vector policy — OK only if silhouette holds; it did not |
| IoU vs master | — | **~0.91–0.94 est.** FAIL | `GOLDEN_TEST.md` §6 |
| Constitution conflict | B5.3 targets 20px arc | v1 frozen at 11px | Constitution written from failed trace |
| Process | Human panel unsigned | Shipped B6-2 PNG export | B5.6 CF-09 |

**Vector SSOT (failed):** `brand-identity-production/svg/leylek-symbol-master-v1.svg`  
**Overlay proof:** `logo-restoration/overlay/b52-failed-trace-512.png`  
**Jury composite:** **41/100 FAIL** (`02_LOGO_JURY.md`)

### Emotional failures

| User perception | Mechanism |
|-----------------|-----------|
| *"Logo değişmiş"* | Silhouette + beak + arc mass drift read as **new app icon**, not refinement |
| Premium collapse | Metallic "jewelry" memory → flat startup glyph = **downgrade** not upgrade |
| Generic bird | Short beak + thin arc + blob leg = interchangeable with ~40 Turkish startup birds |
| Trust erosion | Bottom-weight lost; mark feels tentative, not platform-stable |
| ClipArt premium | Jury dimension Premium **2/10** on B5.2 trace |

**Root cause (B5.3):** B5.2 flat vector + B6-2 raster replacement **lost original premium identity** — not a rendering bug, a **DNA contract break**.

---

## E — Comparison chain: every difference

### Legend

| Stage | Artifact | Status |
|-------|----------|--------|
| **Original Master** | 1254 PNG `_backup-pre-b6-2` | Perceptual SSOT |
| **B5.2** | `leylek-symbol-master-v1.svg` + B6-2 512 PNG export | FAILED · do not ship |
| **B5.3** | Candidates A / B / C SVG | Lab · human unsigned |
| **B5.5** | LC-1 / LC-2 / LC-3 sketches (LS-01, LS-29, LS-30) | Lab finalists |
| **V6** | MEX design system — LC-2 master + LC-3 micro | Design approved · not implemented |
| **Current production** | `frontend/assets/images/leylek-logo-premium.png` | **Restored to Original Master** (project status) |

### Element-by-element diff matrix

| Element | Original Master | B5.2 | B5.3 A | B5.3 B | B5.3 C | B5.5 LC-2 | V6 | Current production |
|---------|-----------------|------|--------|--------|--------|-----------|-----|-------------------|
| **Dimensions** | 1254×1254 ~538KB | 512 vector/PNG | 512 SVG | 512 SVG | 512 SVG | 512 sketch | Spec | **1254 restored** |
| **Material** | Brushed silver chrome | Flat white | Flat `#F0F4F8` | Same as A | `#F5F7FA` | Monochrome lab | Raster hero + flat vector | **Chrome raster** |
| **Arc stroke @512** | Thick bottom mass | **11 px** | **20 px** | **19 px** | **22 px** | 20–22px band | LC-2 19px | Thick (raster) |
| **Beak tip X** | ~356 | **~344** | ~356 restored | ~356 + nudge | ~356 | +8px extend | LC-2 | Long sharp beak |
| **Eye** | Cyan glow dot r≈5.5 | Flat dot OK pos | (292,166) r=5.5 | Same | **r=6.0** micro | Lock | LC-3 @micro | Cyan glow |
| **Tucked leg** | Visible V | Merged blob | Restored path | Same as A | **Merged @micro** | Signature | LC-2 full / LC-3 simplify | Visible |
| **Optical center** | Beak-right, leg-down | Not applied | None | **translate(4,6)** | None | LS-21/29 | (268,278) | Natural in PNG |
| **Wing sweep** | Subtle back curve | Weak | 4 px stroke | Same | **5 px** | LS-11–13 explorations | Preserved | Visible |
| **Neck S-curve** | Personality bridge | Drift/narrow | Restored | Same | Same | LS-02–05 variants | Preserved | Present |
| **Arc gradient** | Blue→cyan metallic | Flat `#00D4AA` | Flat | Flat | Flat | N/A mono | Flat vector | Gradient raster |
| **Human read** | LeylekTAG sacred | **"Logo değişmiş"** | Same logo (target) | Same + balanced icon | Same @512; wins @24 | Wireframe validated | MEX 97 design | **Original identity** |
| **Jury score** | N/A (reference) | **41 FAIL** | 78 COND | **80 COND** | 76 COND micro | Pending human | 96 design | N/A (restored) |
| **Production shipped?** | Yes (pre-B6-2) | **Yes (B6-2 mistake)** | No | No | No | No | No | **Rollback complete** |

### Pipeline differences (process)

| Stage | What changed in process |
|-------|-------------------------|
| Original → B5.2 | Hand trace from PNG; constitution frozen at wrong geometry; export ladder from v1 SVG |
| B5.2 → B5.3 | Manual Bézier rebuild from **1254 PNG only** — rejects B5.2 as source |
| B5.3 → B5.5 | 30 monochrome sketches; three finalists LC-1/2/3 — no auto-winner |
| B5.5 → V6 | In-product mockups; Meridian Operative grammar; LC-2 + LC-3 dual ladder locked |
| V6 → Current | Jury denied production (48/100); **rollback** restored 1254 master per ops |

---

## F — Brand DNA Lock (summary)

Full lock document: `02_LOGO_DNA_LOCK.md`

| Tier | Policy | Count |
|------|--------|-------|
| **Immutable** | Block release if violated | 13 CORE tokens |
| **Semi-flexible** | Human review + IoU gate | 11 SECONDARY tokens |
| **Flexible** | Surface/tier specific | Export ladder, mono variants |
| **Experimental** | Design-lab only · never ship without G0 | LS sketches, optical A/B, LC-3 as 512 master test |

---

## G — Small-size behaviour (summary)

Full analysis: `04_SMALL_SIZE_ANALYSIS.md`

| Size | Original master raster | LC-2 vector target | LC-3 micro target |
|------|------------------------|--------------------|-------------------|
| **24 px** | Leg/beak risk; arc mass survives as color block | Needs LC-3 ladder — not master shrink | Eye r=6 + arc 22px; tucked merged |
| **32 px** | Crest/beak tip soften | Profile + arc + eye | Bold arc fragment |
| **48 px** | One-leg readable | Full pose restored | Same read as A with simplifications |
| **64 px** | Wing sweep visible | Full master detail | Transition to master |
| **96 px** | Near-full detail | Master paths | Use master tier |
| **512 px** | Golden reference | LC-2 export | Must match A/B silhouette |
| **1024 px** | App icon scale | LC-2 + safe zone | Squircle/circle OEM test |

**Rule:** Never shrink L-tier master to favicon — use `leylek-symbol-small.svg` / LC-3 (`09_EXPORT_SYSTEM.md` §10).

---

## H — Future compatibility (summary)

| Surface | Original master | LC-2 + dual ladder | Blocker |
|---------|-----------------|----------------------|---------|
| Website | ✅ Hero raster; needs mono header mark | SVG dark/white variants | Watermark must be stroke-only |
| Splash | ✅ Premium chrome @1254 | LC-2 + SP-10; raster hero mandatory | Flat vector alone = cheap read |
| Navigation | ⚠️ Logo not on map; genom must match | Unified SVG family | Ionicons dialect FAIL |
| Markers | ⚠️ PNG genom drift | Arc foot + eye dot chassis | MC-1 device proof pending |
| Watermark | ❌ Full-color PNG muddy | Mono stroke export | CF-12 |
| Leylek Zeka | ⚠️ Eye from logo atom | 28px/64px LC-3 ladder | No blink; `#00D4AA` only |
| Watch | ⚠️ Leg/beak at tiny sizes | LC-3 eye+arc minimum | Untested on device |
| Vehicle display | N/A logo | Marker wedge language | z16 proof |
| Dark theme | ✅ Native design | `#0D1117` ground | — |
| Light theme | ⚠️ Needs white/inverted variant | `leylek-symbol-white.svg` | Contrast audit pending |
| Print | ⚠️ Gradient-heavy | 512 vector + spot cyan | 3-meter test T-A6 |
| Embroidery | ❌ 3D gradients fail | Flat mono simplified | Separate mono lockup |
| Laser engraving | ⚠️ Fine leg/beak | Single-stroke simplification | Physical spec missing |
| Monochrome | ⚠️ Partial | White + cyan → black mono watermark | Delta D-03 not produced |

---

## I — International quality (summary)

Full comparison: `05_GLOBAL_BRAND_COMPARISON.md`

The **original master** at hero scale competes on **premium material** and distinctive stork-orbit silhouette — closer to automotive jewelry than Uber's wordmark minimalism. At **B5.2 flat tier**, the mark **does not** compete — jury International **5/10** production, generic startup bird.

Restored master + LC-2 vector path (with 1254 raster hero) targets **8/10 international** on logo lane — still below 95 gate until full ecosystem (markers, icon, motion) ships.

---

## J — Production readiness (summary)

Full checklist: `06_PRODUCTION_READINESS.md`

**Blockers before any asset production:**

1. G0 human blink panel — **PENDING** (`RESTORATION_DECISION.md`)
2. G0 IoU ≥0.98 — **NOT RUN**
3. LC-2 frozen as `leylek-symbol-master-v2.svg` — **NOT CREATED**
4. Constitution v2 amendment (1254 SSOT, 20px arc) — **NOT DONE**
5. Dual-ladder manifest (LC-2 + LC-3) — **NOT DONE**
6. Export ladder PNG generation — **NOT DONE**
7. OEM squircle/circle matrix — **EMPTY** (CF-22)
8. B5.7 re-jury — **NOT RUN**
9. B6-8 DNA Freeze EXECUTED — **BLOCKED**

---

## Cross-references

| Doc | Purpose |
|-----|---------|
| `02_LOGO_DNA_LOCK.md` | Immutable / semi / flex / experimental tiers |
| `03_FAILURE_ANALYSIS.md` | B5.2 deep failure + B6 migration post-mortem |
| `04_SMALL_SIZE_ANALYSIS.md` | 24–1024 px tier behaviour |
| `05_GLOBAL_BRAND_COMPARISON.md` | Uber · Bolt · Apple · etc. |
| `06_PRODUCTION_READINESS.md` | Pre-production gate checklist |
| `07_RISK_REGISTER.md` | P0–P2 risks |
| `08_TEAM_ALPHA_MASTER_REPORT.md` | Sprint sign-off summary |

---

**Team Alpha Master Analysis — COMPLETE**  
Production untouched · evidence-only · no guesses on unsigned human panels.
