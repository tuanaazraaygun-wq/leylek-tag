# V7.1 — Team Alpha: Premium Logo

**Team:** ALPHA — Brand Core  
**Mode:** Read-only analysis  
**Scope:** Premium logo restoration → production export spec (future)

---

## 1. Mission

Orijinal LeylekTAG premium logosunu **evolve et, redesign etme**. LC-2 (Balance Meridian) vektör master + LC-3 micro ladder + 1254 raster hero tier — production'a geçmeden önce G0 kapılarını geçecek tek logo hattı.

**Golden rule:** "Logo değişmiş" = FAIL · "Logo aynı ama çok daha kaliteli" = PASS

---

## 2. Current premium logo (production — read-only)

| Field | Value |
|-------|-------|
| **Path** | `frontend/assets/images/leylek-logo-premium.png` |
| **Post-B6-2 state** | 512×512 · ~16 KB · flat B5.2 export |
| **Jury score** | 48/100 · **FAIL** |
| **Perceptual SSOT** | **NOT this file** |

### Production consumers (grep snapshot)

| Consumer | Path | Usage |
|----------|------|-------|
| Splash | `frontend/components/SplashScreen.tsx` | Hero logo |
| Login | `frontend/components/auth/LoginBrandHeader.tsx` | Brand header |
| Theme choice | `frontend/components/theme/ThemeChoiceScreen.tsx` | Logo |
| Leylek Zeka chat | `frontend/components/LeylekZekaChat.tsx` | Empty state |
| Logo (orphan) | `frontend/components/Logo.tsx` | No imports found |
| Expo config | `frontend/app.json` | `icon` field ⚠️ uses premium PNG |

**Not:** `app.json` `icon` → `leylek-logo-premium.png` — muhtemel yanlış tier (1024 app icon olmalı). V7.1 notu: Phase 1'de düzeltilecek, **V7.1'de dokunulmaz**.

### iOS parallel

| Path | Notes |
|------|-------|
| `frontend/assets/ios.premium.logo.png` | iOS icon slot |
| `frontend/app.json` → `ios.icon` | References above |

---

## 3. True perceptual master (pre-B6-2)

| Field | Value |
|-------|-------|
| **Backup path** | `frontend/assets/images/_backup-pre-b6-2/leylek-logo-premium.png` |
| **Design-lab copy** | `design-lab/brand-dna/v4/logo-restoration/reference/leylek-logo-premium-master-reference.png` |
| **Dimensions** | 1254×1254 · ~538 KB |
| **Identity** | Brushed silver stork · thick orbital arc · long beak · one-leg pose |

**V7.1 kuralı:** Tüm overlay, IoU ve human blink testleri **1254 master** referans alır — production 512 dosyası değil.

---

## 4. Failed B5.2 logo (do not ship)

| Artifact | Path |
|----------|------|
| Vector SSOT (failed) | `design-lab/brand-dna/v4/brand-identity-production/svg/leylek-symbol-master-v1.svg` |
| Overlay proof | `design-lab/brand-dna/v4/logo-restoration/overlay/b52-failed-trace-512.png` |
| Exported PNG | `design-lab/brand-dna/v4/brand-identity-production/png/leylek-symbol-master-512.png` |
| Jury composite | **41/100 FAIL** |

### Why B5.2 failed (human + jury)

| Drift | Original | B5.2 |
|-------|----------|------|
| Arc stroke mass | ~18–22 px visual | 11 px hairline |
| Beak tip X | ~356 @512 | ~344 |
| Tucked leg | Visible V | Merged blob |
| Material | Satin chrome memory | Flat `#F5F7FA` |
| User read | LeylekTAG | "Logo değişmiş" |

**B5.6 order:** Never resurrect B5.2 trace.

---

## 5. B5.3 restoration candidates

| ID | File | Role | Jury |
|----|------|------|------|
| **A** | `logo-restoration/candidates/candidate-a-ultra-faithful.svg` | Ultra-faithful | LC-1 · 78 COND |
| **B** | `logo-restoration/candidates/candidate-b-optical-balance.svg` | Optical nudge +4,+6 | **LC-2 · 80 COND** |
| **C** | `logo-restoration/candidates/candidate-c-small-size.svg` | Micro ladder | LC-3 · 76 COND |

### B5.3 anchors (locked @512)

| Token | Value |
|-------|-------|
| Eye | (292, 166) r=5.5 (C: r=6 @micro) |
| Optical center | (268, 278) — B applies translate(4,6) |
| Arc stroke | A/B: 20px · C: 22px @micro |
| Beak extend | +8–12 px X vs B5.2 |

**Human sign-off:** `logo-restoration/RESTORATION_DECISION.md` — **PENDING**

---

## 6. B5.5 sketch finalists (monochrome lab)

| Finalist | Sketches | SVG | Maps to |
|----------|----------|-----|---------|
| **LC-1** | LS-01, LS-07, LS-14 | `visual-sketch-lab/logo/ls-01.svg` | B5.3 A |
| **LC-2** | LS-21, LS-29 | `visual-sketch-lab/logo/ls-29.svg` | B5.3 B |
| **LC-3** | LS-30 | `visual-sketch-lab/logo/ls-30.svg` | B5.3 C |

B5.5 wireframes **in-product mockup** ile V6'da doğrulandı — ayrı marka değil, aynı kuş.

---

## 7. LC-2 recommendation (V6 + jury consensus)

| Decision | Value |
|----------|-------|
| **Vector master @512/1024/1254** | **LC-2** — Candidate B |
| **Micro @16/24/48** | **LC-3** — dual ladder |
| **Raster hero** | 1254 from approved master OR restored backup until export ready |
| **Fallback purist** | LC-1 if optical nudge rejected in human panel |

### Why LC-2 over LC-1

| Criterion | LC-1 | LC-2 |
|-----------|------|------|
| Silhouette fidelity | ★★★★★ | ★★★★☆ |
| iOS squircle / adaptive | ★★★★☆ | ★★★★★ |
| Splash crop stability | ★★★★☆ | ★★★★★ |
| Store visibility | ★★★★☆ | ★★★★★ |
| Jury composite | 78 | **80** |

### Why LC-3 exists (not as 512 master)

LC-3 bold eye/arc wins @24px notification/favicon — **must not ship as full master** unless blink test proves sameness (B5.6 warning).

---

## 8. What must be restored

| # | Element | Action | Verify |
|---|---------|--------|--------|
| R1 | **Silhouette** | LC-2 paths frozen → v2 SVG | IoU ≥0.98 vs 1254 |
| R2 | **Beak length** | Tip ~356 X @512 | Overlay |
| R3 | **Arc bottom mass** | 20px stroke (not 11px) | Side-by-side |
| R4 | **One-leg pose** | Standing + tucked leg @512 | Human panel |
| R5 | **Neck S-curve** | Personality bridge preserved | Blink test |
| R6 | **Wing stroke** | Separate path @ master | Not merged |
| R7 | **Eye anchor** | (292,166) cyan dot | Lock |
| R8 | **Optical center** | translate(4,6) for masks | OEM matrix |
| R9 | **1254 raster tier** | Splash/login hero chrome | Premium feel |
| R10 | **Export ladder** | 16/24/48/512/1024/1254/432 | `09_EXPORT_SYSTEM` amend |

### Interim ops (pre-asset-production)

Restore `leylek-logo-premium.png` from `_backup-pre-b6-2` for user-facing RC — **ops decision**, not V7.1 execution.

---

## 9. What must NEVER change (CORE DNA)

From `brand-studio/02_LOGO_GENOME.md` + constitution:

| Lock | Definition |
|------|------------|
| `genus.stork` | Vertical stork — not owl/phoenix/pin |
| `pose.one_leg` | Standing + tucked @≥48px |
| `beak.horizontal_dominant` | Longest element · ~0° ±2° |
| `beak.tip_sharp` | Pointed — not duck |
| `head.scale_modest` | Not chibi |
| `eye.single_cyan_dot` | One dot `#00D4AA` family |
| `arc.open_swoosh` | Not closed badge |
| `arc.bottom_mass` | Thickest at bottom |
| `arc.gap_top_right` | Open breathing gap |
| `silhouette.contour` | Recognizable overlay |
| `emotion.premium_calm` | Not mascot/playful |

### Forbidden forever

- F1 Meridian Wing  
- New abstract icon  
- Auto-trace from PNG  
- Crown / mascot / pin-drop logo  
- B5.2 v1 trace as master  
- Ship without human + IoU  

---

## 10. Team Alpha deliverables (future V7.1b production sprint)

| Output | Format | Destination (future) |
|--------|--------|----------------------|
| `leylek-symbol-master-v2.svg` | SVG | design-lab → brand-identity-production |
| PNG ladder | 16…1254 | design-lab/png/ |
| `leylek-app-icon-1024.svg` | SVG | from LC-2 |
| `leylek-adaptive-foreground-432.svg` | SVG | LC-2 @66% safe |
| `leylek-symbol-small.svg` | SVG | LC-3 micro |
| `leylek-logo-premium-1254.png` | PNG raster hero | frontend/assets/images/ |
| `leylek-logo-premium-512.png` | PNG | UI tiers |
| Notification / favicon exports | PNG | LC-3 derived |
| Constitution amend | MD | `06_LOGO_GEOMETRY_CONSTITUTION v2` |

**V7.1:** Spec only — **zero files produced**.

---

## 11. Team Alpha tests (before production swap)

| ID | Test | Owner | Pass |
|----|------|-------|------|
| T-A1 | Human blink 1254 vs LC-2 | Brand | ≥70% |
| T-A2 | IoU silhouette mask | ECHO/QA | ≥0.98 |
| T-A3 | iOS squircle clip | ECHO | No arc clip |
| T-A4 | Android adaptive circle | ECHO | Center mass OK |
| T-A5 | 24px notification | ECHO | LC-3 eye+arc |
| T-A6 | 3-meter print test | Brand | Named LeylekTAG |
| T-A7 | Splash 38% width | Design | Arc visible |
| T-A8 | Login hero premium read | Brand | Not flat cheap |

---

## 12. Team Alpha risks

| ID | Risk | Mitigation |
|----|------|------------|
| RA-1 | Human rejects optical nudge | Fall back LC-1 |
| RA-2 | LC-3 shipped as master | Dual ladder doc + CI filename gate |
| RA-3 | Flat vector feels cheap on splash | Raster 1254 hero tier |
| RA-4 | Constitution v1 vs 1254 SSOT conflict | Amend v2 — perceptual master = 1254 backup |
| RA-5 | app.json wrong icon path | Fix in Phase 1 migration only |

---

## 13. Dependencies

| Blocker | Status |
|---------|--------|
| B5.3 human panel | PENDING |
| G0 IoU script | Not run |
| V6 MEX sign-off | Design approved · impl not |
| B6-8 DNA freeze | BLOCKED |

**Team Alpha asset production starts:** After G0 PASS + V7.1 analysis sign-off.

---

## 14. Cross-reference map

| Concept | B5.3 | B5.5 | V6 | Production today |
|---------|------|------|-----|------------------|
| Faithful | Candidate A | LS-01 | LC-1 | — |
| Balance | Candidate B | LS-29 | **LC-2 ★** | — |
| Micro | Candidate C | LS-30 | LC-3 | — |
| Failed | — | — | — | B5.2 v1 + B6-2 PNG |
| True master | reference/1254 | — | rollback source | backup pre-b6-2 |

---

**Team Alpha analysis complete.** Asset üretimi V7.1b'ye kadar **YASAK**.
