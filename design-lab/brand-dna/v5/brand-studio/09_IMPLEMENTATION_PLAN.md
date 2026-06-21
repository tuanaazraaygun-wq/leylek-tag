# B5.4 — Phase 9: Implementation Plan

**Sprint:** B5.4 — Brand Studio  
**Prerequisite:** `10_BRAND_MASTER_DECISION.md` signed PASS  
**Mode:** Post-approval execution roadmap — **not started**

---

## Phase map

```
B5.4 Human PASS
    ↓
B5.4b Logo Master Freeze (SVG v2)
    ↓
B5.4c Marker Master Freeze (12 SVG)
    ↓
B6-2r Surface Regeneration (logo)
    ↓
B6-5r Marker Migration
    ↓
B6-7r Device QA (second pass)
    ↓
B6-8 DNA Freeze EXECUTED
```

---

## Stage 1 — Logo master freeze (B5.4b)

| Task | Output | Owner |
|------|--------|-------|
| Select F1/F2/F3 or dual-ladder | Decision doc signed | Brand |
| Promote winning SVG | `brand-identity-production/svg/leylek-symbol-master-v2.svg` | Design |
| Bump constitution | `06_LOGO_GEOMETRY_CONSTITUTION.md` → v2 amendment | Design |
| Golden test | IoU ≥ 0.98 vs backup master 1254 | QA |
| Export ladder table | 16/24/48/512/1024/1254/432 adaptive | Design |

**Dual-ladder default (recommended):**
- Master paths: **F2**
- Micro exports @24/48: **F3** derived tables

---

## Stage 2 — Marker master freeze (B5.4c)

| Task | Output |
|------|--------|
| SVG per type (12) | `design-lab/.../markers/svg/MARKER_*.svg` |
| Shared chassis component | `marker-chassis-v2.svg` |
| Glow hue fix spec | `#00D4AA` in `mapMarkerChrome.tsx` |
| Zoom 16/18/20 test pack | PNG proof set |
| Gender-neutral passenger verify | App Store 5.1.1 sign-off |

**Do not migrate until logo v2 frozen** — markers inherit arc/eye tokens.

---

## Stage 3 — Surface regeneration (B6-2r … B6-4r)

Content swaps only — no map logic · no navigation · no backend.

| Sprint | Surfaces | Source |
|--------|----------|--------|
| B6-2r | `leylek-logo-premium.png`, splash, ios premium | F2 @1254 + F2 @512 |
| B6-3r | App icon, adaptive, favicon, mipmaps | F2 @1024 · F3 @16/32 |
| B6-4r | Leylek Zeka eye, watermark | Eye atom + F2 mono |
| Website | Header, OG, favicon | F2 + F3 tiers |

**Rollback:** Keep `_backup-pre-b6-*` until B6-7r PASS.

---

## Stage 4 — Marker migration (B6-5r)

| Task | Detail |
|------|--------|
| Export 12 PNGs | @48 master → display sizes in `MARKER_PIXEL` |
| Swap `frontend/assets/markers/` | Hash verify |
| Update `mapNavMarkers.ts` | Paths only if filenames change |
| Fix `#22D3EE` → `#00D4AA` | `mapMarkerChrome.tsx` glow |
| Pickup/destination | Replace Ionicons with PNG family **if** in scope |

---

## Stage 5 — QA (B6-7r)

| Gate | Criteria |
|------|----------|
| Technical | Build · cold start · marker render · no regression |
| Human brand | ≥70% “same logo, better quality” |
| Human markers | ≥70% “LeylekTAG map” @ zoom 16–18 |
| Golden test | Logo IoU ≥ 0.98 |

---

## Stage 6 — DNA freeze (B6-8)

Execute only after B6-7r dual PASS.

---

## Interim ops (optional · pre-approval)

| Action | When |
|--------|------|
| Restore premium PNG from `_backup-pre-b6-2/` | Immediate user-facing RC if “logo değişmiş” reports continue |
| Pause store RC | Until B5.4 human PASS |
| Keep B5.2 markers | Until B5.4c frozen |

---

## Risk register

| ID | Risk | Mitigation |
|----|------|------------|
| R1 | F3 ships as 512 master | Dual-ladder doc + automated IoU gate |
| R2 | Marker glow hue drift | Single `MERIDIAN_CYAN` token |
| R3 | Adaptive mask clip | F2 optical center locked in SVG |
| R4 | Human fail again | Rollback + iterate design-lab only |

---

## File touch matrix (post-approval only)

| Path | Action |
|------|--------|
| `frontend/assets/images/leylek-logo-premium.png` | Replace |
| `frontend/assets/markers/*.png` | Replace |
| `frontend/assets/*icon*` | Replace |
| `frontend/lib/mapMarkerChrome.tsx` | Glow token |
| `design-lab/**` | Manifest bump |
| `backend/**` | ❌ Never |
| Map logic | ❌ Never |

---

## Timeline estimate (after approval)

| Stage | Duration |
|-------|----------|
| B5.4b logo freeze | 2–3 days |
| B5.4c markers | 4–5 days |
| B6-2r–4r surfaces | 2 days |
| B6-5r markers | 1 day |
| B6-7r QA | 3–5 days |

---

**Blocked until:** `10_BRAND_MASTER_DECISION.md` → APPROVED
