# Phase 4 Handoff — Asset Creation Checklist

**From:** Phase 3 `logo-production-lab/`  
**To:** Phase 4 `design-lab/brand-dna/v4/exports/`  
**Status:** Ready spec — execution not started

---

## 1. Ship candidate

| Priority | Asset root | Spec file |
|----------|------------|-----------|
| **P0** | `f1-meridian-wing` | `FINALIST_F1_MERIDIAN_WING_ASSET_SPEC.md` |
| P1 | `f1-meridian-wing-marketing` | `COMPARISON_AND_SHIP_RECOMMENDATION.md` §6 hibrit |
| P2 | f2/f3 reference only | stakeholder request |

---

## 2. SVG deliverables (Phase 4)

| File | Content |
|------|---------|
| `svg/f1-meridian-wing-master.svg` | Layers: horizon, wing, ring, accent |
| `svg/f1-meridian-wing-filled.svg` | M0/M1 small tier |
| `svg/f1-meridian-wing-marketing.svg` | F1 + gap @128+ optional |
| `svg/genom.tokens.css` | From `GENOM_TOKENS_SPEC.md` |

**Rules:**

- No `linearGradient` in SVG
- No `filter` / `feGaussianBlur`
- CSS variables for dark/light
- Path count ≤12 per variant

---

## 3. PNG ladder (Phase 4)

From F1 spec §2:

```
exports/png/f1/24.png
exports/png/f1/32.png
exports/png/f1/48.png
exports/png/f1/64.png
exports/png/f1/96.png
exports/png/f1/128.png
exports/png/f1/256.png
exports/png/f1/512.png
exports/png/f1/1024.png
exports/png/f1/icon-foreground-432.png
exports/png/f1/icon-background-1080.png
```

---

## 4. Lottie (Phase 4)

| File | Duration | Token |
|------|----------|-------|
| `lottie/f1-boot-presence.json` | 550 ms | presence.pulse |
| `lottie/f1-lock-ring.json` | 320 ms | lock.ringClose |
| `lottie/shared-ring-close.json` | 320 ms | marker share |

Source paths = F1 SVG `logo.layer.ring`.

---

## 5. QA matrix (must pass before Phase 5)

| Test | Target |
|------|--------|
| 16 px favicon | M0 pass |
| 29 px iOS settings | M1 pass |
| Squircle mask iOS | no clip |
| Android adaptive 80% safe | pass |
| Monochrome print 15mm | pass |
| Hex cyan `#00D4AA` | 0 drift |
| Ring close ±16ms vs sonic mock | pass |
| Uber pin red team | fail similarity |
| Google pin red team | fail similarity |
| Blind "LeylekTAG" n≥8 | ≥80% |
| Blind "yenilenmiş" vs "değişmiş" | ≥70% yenilenmiş |
| `prefers-reduced-motion` | static export exists |
| `prefers-color-scheme` | light+dark SVG |

---

## 6. Surface wiring map (Phase 5 — not Phase 4)

Reference only — do not touch `frontend/` in Phase 4:

| Production path | Phase 4 export |
|-----------------|----------------|
| `frontend/assets/images/icon.png` | f1/1024.png |
| `website/public/logo-leylek.svg` | f1-master.svg |
| Android splash | f1/256.png |
| favicon | f1/32 + ico |

---

## 7. Documentation outputs (Phase 4)

| File | Content |
|------|---------|
| `exports/LOGO_QA_REPORT.md` | QA results |
| `exports/EXPORT_MANIFEST.json` | paths + tiers |
| `exports/CHANGELOG.md` | v4 logo birth |

---

## 8. Dependencies

| Dependency | Status |
|------------|--------|
| GENOM_TOKENS_SPEC | ✅ Phase 3 |
| F1 full spec | ✅ |
| BOOT_MULTIMODAL_TIMELINE | ✅ logo-production |
| Marker ring shared | ✅ LOGO_MARKER_SHARED_GENOM |
| Sonic v2/v3 boot WAV | design-lab/sonic (listen before Lottie sync) |

---

## 9. Phase 4 non-goals

- `frontend/`, `backend/` commit
- App Store upload
- Production splash swap

---

**Phase 3 complete when:** This handoff + comparison doc reviewed → Phase 4 execution authorized.
