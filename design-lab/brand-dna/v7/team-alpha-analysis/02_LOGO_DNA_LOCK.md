# V7.1b — Logo DNA Lock

**Team:** ALPHA  
**Version:** DNA Lock v1.0 (analysis)  
**Supersedes for production:** `06_LOGO_GEOMETRY_CONSTITUTION.md` v1.0 (B5.2 — conflicts with 1254 SSOT)  
**Perceptual SSOT:** 1254 master PNG (`_backup-pre-b6-2` / `logo-restoration/reference/`)

---

## Lock authority

| Rule | Detail |
|------|--------|
| Golden human test | ≥70% *"same logo, higher quality"* |
| Golden metric | Silhouette IoU ≥ **0.98** vs 1254 master |
| Amendment | Brand council + golden re-pass only |
| Vector master (future) | LC-2 → `leylek-symbol-master-v2.svg` after G0 PASS |

**If human says *"logo değişmiş"* → DNA LOCK VIOLATED — stop export.**

---

## 1. IMMUTABLE — never change

These 13 tokens define LeylekTAG across 10 years. Violation = not LeylekTAG.

| ID | Token | Definition | Verification |
|----|-------|------------|--------------|
| I-01 | `genus.stork` | Vertical stork profile — not owl, crane, phoenix, abstract pin | Blink + silhouette |
| I-02 | `pose.one_leg` | Standing leg + tucked leg @≥48px | Human panel element checklist |
| I-03 | `beak.horizontal_dominant` | Beak longest element; extends right; ~0° ±2° | Beak tip ~356 X @512 |
| I-04 | `beak.tip_sharp` | Pointed terminus — not blunt/duck | Overlay inspect |
| I-05 | `head.scale_modest` | Head smaller than beak span; not chibi | R.headToBody ~1:2.6 |
| I-06 | `eye.single_cyan_dot` | One dot; `#00D4AA` family; non-cartoon | No sclera, no wink |
| I-07 | `eye.position` | Upper cranium (292, 166) @512 | ±0.5 px |
| I-08 | `arc.open_swoosh` | Open orbital arc — not closed ring/badge | Gap top-right |
| I-09 | `arc.bottom_mass` | Thickest stroke at bottom center | Visual side-by-side vs master |
| I-10 | `arc.gap_top_right` | Arc does not close; beak breathes | Overlay |
| I-11 | `silhouette.contour` | Recognizable pre/post overlay @512 | IoU ≥0.98 |
| I-12 | `emotion.premium_calm` | Not playful mascot; not predator | Jury emotional dimension |
| I-13 | `name.metaphor` | Stork + orbit + forward journey | Brand constitution |

### Immutable forbidden list (permanent)

- F1 Meridian Wing direction  
- Separate crown polygon  
- Pin-drop / teardrop map pin as logo  
- Auto-trace from PNG as production path  
- B5.2 `leylek-symbol-master-v1.svg` as master  
- Mascot eye (large white sclera)  
- Abstract geometry (bird → triangle only)  
- Ship without human blink + IoU  

Source: `brand-studio/02_LOGO_GENOME.md` · B5.6 orders · V7.1 `07_FORBIDDEN_LIST.md`

---

## 2. SEMI-FLEXIBLE — evolve with human + IoU gate

May improve **without breaking recognition**. Each change requires overlay review.

| ID | Token | Current @512 | Evolution bounds | Gate |
|----|-------|--------------|------------------|------|
| S-01 | `arc.stroke_width` | ~18–22 px visual (master) | ±4 px; **floor 14 px** @512 master | Side-by-side + IoU |
| S-02 | `arc.terminal_radius` | Rounded caps | Cap radius ±2 px | Visual |
| S-03 | `arc.color` | `#00D4AA` flat vector | Gradient **raster hero only** | Tier doc |
| S-04 | `body.fill` | Silver memory / `#F0F4F8` vector | Flat OK if silhouette holds | Blink |
| S-05 | `neck.curvature` | Subtle S | ±5% path length; kink ≤8° | Overlay |
| S-06 | `wing.stroke` | 3–4 px | 2–5 px; **no merge @ master** | Layer QA |
| S-07 | `leg.standing.width` | Hairline | ±1 px | @64px inspect |
| S-08 | `leg.tucked.detail` | Full @512 | Simplify @≤32px tiers only | LC-3 ladder |
| S-09 | `optical.center` | (268, 278) | Nudge ±6 px for masks | LC-2 translate(4,6) |
| S-10 | `crest.tuft` | Integrated profile bump | Soften — **not remove @ master** | Human Q1 |
| S-11 | `canvas.safe_zone` | 512 artboard | 1024/1254/432 export ladders | OEM matrix |

### LC-2 optical nudge (semi-flexible, not immutable)

Candidate B applies `translate(4, 6)` — **engineering correction**, not redesign. Requires purist fallback to LC-1 if panel splits (`V7.1` RA-1).

---

## 3. FLEXIBLE — surface and tier specific

May change per export tier or surface **without brand council** if dual-ladder documented.

| ID | Token | Policy |
|----|-------|--------|
| F-01 | `export.tier.source` | M0/M1 from LC-3 small SVG; L/XL from LC-2 |
| F-02 | `background.ground` | `#0D1117` dark · `#FFFFFF` light variant |
| F-03 | `monochrome.watermark` | Stroke-only; no full-color PNG |
| F-04 | `splash.scale` | 1.35× optical center — SP-08/SP-10 pairing |
| F-05 | `app_icon.safe_padding` | 80% iOS · 66% Android adaptive |
| F-06 | `notification.glyph` | Eye + arc tick only @24px |
| F-07 | `raster.hero.tier` | 1254 PNG for splash/login — optional for UI chrome |
| F-08 | `beak.highlight_line` | Omit @≤512 vector |
| F-09 | `eye.glow_halo` | Splash/login raster only |
| F-10 | `marker.genom.atoms` | Arc fragment + eye dot — not full bird on pins |

---

## 4. EXPERIMENTAL — design-lab only

**Never ship to production** without G0 PASS and manifest filename gate.

| ID | Experiment | Risk | Allowed outcome |
|----|------------|------|-----------------|
| E-01 | LC-1 vs LC-2 human A/B | Purist rejection of optical nudge | Pick one as v2 master |
| E-02 | LC-3 as 512 master | **Brand disaster** if silhouette diverges | Reject — micro only |
| E-03 | LS-01…LS-30 sketch variants | Exploration noise | Feed LC-1/2/3 only |
| E-04 | Metallic vector gradients | Constitution forbids in master SVG | Raster hero only |
| E-05 | F1 Meridian Wing | **Forbidden** | Never |
| E-06 | Auto-trace pipeline | IoU ~0.91 — caused B5.2 fail | Never |
| E-07 | Crown / mascot head | B5 v1 failure mode | Never |
| E-08 | LC-3 eye r=6 @512 master | Reads as different bird | Micro tiers only |

---

## 5. Dual-ladder lock (production pattern)

```
1254 RASTER HERO (splash · login · marketing)
        │
        ▼
LC-2 VECTOR MASTER @512/1024/1254/432 adaptive
        │
        ├── App icon · splash SVG · website header
        │
        └── LC-3 MICRO @16/24/32/48
                ├── Favicon
                ├── Notification icon
                └── Zeka eye small tiers
```

**Manifest rule (future):** Filename gate prevents `leylek-symbol-small.svg` replacing master in 512 export path (`V7.1` R-P0-06).

---

## 6. Rejection triggers (automatic)

| Violation | Example | Action |
|-----------|---------|--------|
| Silhouette IoU <0.98 | B5.2 ~0.91–0.94 | Block export |
| Human "logo changed" | B6-7 fail | Stop iteration → path tune only |
| Arc <14px @512 master | B5.2 11px | Reject |
| Beak tip Δ >2px | B5.2 −12px | Extend tip X only |
| LC-3 shipped as master | Wrong file in ladder | Rollback + CI gate |
| Constitution v1 arc 11px | Conflicts with 1254 | Amend v2 before freeze |

---

## 7. Amendment path (post-G0)

1. Freeze winning SVG → `leylek-symbol-master-v2.svg`  
2. Publish `06_LOGO_GEOMETRY_CONSTITUTION v2` (20px arc, 1254 SSOT)  
3. Update `brand-identity-manifest.json` → B5.3-v1.0  
4. Regenerate export ladder from v2 only  
5. B6-7 second pass → B6-8 EXECUTED  

---

## 8. Genome hash

```
LEYLEKTAG_LOGO_DNA_LOCK_v7.1b
├── IMMUTABLE     (13) — block release
├── SEMI-FLEXIBLE (11) — human + IoU
├── FLEXIBLE      (10) — tier/surface
└── EXPERIMENTAL  (8)  — lab only
```

---

**DNA Lock status:** DEFINED · **NOT EXECUTED** · awaits G0 human + IoU  
**Parent:** `01_MASTER_ANALYSIS.md` · `brand-studio/02_LOGO_GENOME.md`
