# 11 — Brand Freeze Checklist

**Version:** Brand Freeze Checklist v1.0  
**Sprint:** B5.2 — Brand Geometry Freeze  
**Status:** Geometry **FROZEN** in design-lab — production migration separate  
**Master:** `frontend/assets/images/leylek-logo-premium.png`

---

## 1. Freeze declaration

| Domain | Frozen? | Document |
|--------|---------|----------|
| Logo geometry | ✅ **YES** | `06_LOGO_GEOMETRY_CONSTITUTION.md` |
| Marker geometry | ✅ **YES** | `07_MARKER_GEOMETRY_CONSTITUTION.md` |
| Shared icon system | ✅ **YES** | `08_SHARED_ICON_SYSTEM.md` |
| Export system | ✅ **YES** | `09_EXPORT_SYSTEM.md` |
| Drift rules | ✅ **YES** | `10_BRAND_DRIFT_RULES.md` |
| Master SVG v1.1 | ✅ **YES** | `svg/leylek-symbol-master-v1.svg` |
| Production mobile | ⏸ Not migrated | B6-2+ |
| DNA EXECUTED sign-off | ⏸ Pending | B6-8 |

**B5.2 verdict:** **Brand Geometry Frozen** — ready for B6-2 Splash + Premium Logo Sync.

---

## 2. Logo geometry checklist

| ID | Criterion | Status |
|----|-----------|--------|
| LG-01 | Master PNG declared immutable SSOT | ✅ |
| LG-02 | Grid 8 px locked | ✅ |
| LG-03 | Safe area 10% / 80% live zone defined | ✅ |
| LG-04 | Optical center (268, 278) documented | ✅ |
| LG-05 | Stroke philosophy locked | ✅ |
| LG-06 | Curve / Bézier rules locked | ✅ |
| LG-07 | Head / neck / beak ratios locked | ✅ |
| LG-08 | Beak angle 0° ±2° locked | ✅ |
| LG-09 | Orbital arc path locked | ✅ |
| LG-10 | Eye position (292, 166) r=5.5 locked | ✅ |
| LG-11 | Wing sweep path locked | ✅ |
| LG-12 | Min size tiers M0–XL defined | ✅ |
| LG-13 | Favicon rules (small SVG only) | ✅ |
| LG-14 | Layer IDs mandatory | ✅ |
| LG-15 | Crown / mascot explicitly forbidden | ✅ |

---

## 3. Marker geometry checklist

| ID | Criterion | Status |
|----|-----------|--------|
| MK-01 | 12 types geometry specified | ✅ |
| MK-02 | 48×48 canvas locked | ✅ |
| MK-03 | Passenger gender-neutral locked | ✅ |
| MK-04 | Driver car/motor vehicle-only locked | ✅ |
| MK-05 | Pickup / destination non-pin locked | ✅ |
| MK-06 | Trust / QM inherit arc DNA | ✅ |
| MK-07 | Anchor matrix documented | ✅ |
| MK-08 | Zoom readability tiers | ✅ |
| MK-09 | Dark / white theme deltas | ✅ |
| MK-10 | SVG files exist per registry | ✅ |
| MK-11 | No taxi / luxury / pin forbidden | ✅ |

---

## 4. Shared system checklist

| ID | Criterion | Status |
|----|-----------|--------|
| SH-01 | Corner radius scale logo↔marker | ✅ |
| SH-02 | Stroke width scale table | ✅ |
| SH-03 | Glow flat opacity (no blur) | ✅ |
| SH-04 | Shadow rules | ✅ |
| SH-05 | Accent ratio locked | ✅ |
| SH-06 | Negative space minimums | ✅ |
| SH-07 | Padding tokens | ✅ |
| SH-08 | Optical balance rules | ✅ |
| SH-09 | Color tokens unified | ✅ |

---

## 5. Export system checklist

| ID | Criterion | Status |
|----|-----------|--------|
| EX-01 | SVG hierarchy defined | ✅ |
| EX-02 | PNG ladder M0–XL | ✅ |
| EX-03 | Marker PNG sizes 24–64 | ✅ |
| EX-04 | Android pack spec | ✅ |
| EX-05 | iOS pack spec | ✅ |
| EX-06 | Website pack spec | ✅ |
| EX-07 | Splash artboard spec | ✅ |
| EX-08 | Watermark spec | ✅ |
| EX-09 | QR no-logo-center rule | ✅ |
| EX-10 | Pre-export QA gates | ✅ |
| EX-11 | resvg command documented | ✅ |

---

## 6. Drift rules checklist

| ID | Criterion | Status |
|----|-----------|--------|
| DR-01 | NEVER list complete (logo + marker + process) | ✅ |
| DR-02 | ALWAYS list complete | ✅ |
| DR-03 | Drift detection signals | ✅ |
| DR-04 | Amendment process DR-2 | ✅ |
| DR-05 | AI/vendor brief template | ✅ |

---

## 7. Golden test (human — pending)

| ID | Test | Status |
|----|------|--------|
| GT-01 | Side-by-side master PNG vs SVG @512 | ⏸ Designer sign-off |
| GT-02 | IoU ≥95% measured | ⏸ Pending |
| GT-03 | 200 ms "same LeylekTAG" recall | ⏸ Pending |
| GT-04 | 16 px favicon readable | ⏸ Pending device |

**Note:** Geometry is frozen in spec; golden test gates **production migration** (B6-2), not B5.2 doc freeze.

---

## 8. Production migration readiness

| Patch | Geometry ready? | Blocker |
|-------|-----------------|---------|
| B6-1 Website | ✅ Spec ready | Done (PNG deployed) |
| B6-2 Splash + premium PNG | ✅ Spec ready | GT-01 optional |
| B6-3 App icon + adaptive | ✅ Spec ready | GT-04 squircle |
| B6-5 Marker PNG | ✅ Spec ready | Light theme bundle |
| B6-8 DNA EXECUTED | ⏸ | B6-7 QA pass |

---

## 9. Sign-off

| Role | B5.2 Geometry Freeze | Date |
|------|----------------------|------|
| Design system | ✅ FROZEN | 2026-06-21 |
| Design QA (human) | ⏸ Golden test | — |
| Product | ⏸ | — |
| Engineering | ⏸ Migration B6-2+ | — |

---

## 10. Document index (B5.2 complete)

| # | File |
|---|------|
| 06 | `06_LOGO_GEOMETRY_CONSTITUTION.md` |
| 07 | `07_MARKER_GEOMETRY_CONSTITUTION.md` |
| 08 | `08_SHARED_ICON_SYSTEM.md` |
| 09 | `09_EXPORT_SYSTEM.md` |
| 10 | `10_BRAND_DRIFT_RULES.md` |
| 11 | `11_BRAND_FREEZE_CHECKLIST.md` |

---

**Parent:** `B5_1_BRAND_CORRECTION.md`, `design-freeze/B6_DNA_FREEZE_CONSTITUTION.md`  
**Next sprint:** **B6-2 Splash + Premium Logo Sync**
