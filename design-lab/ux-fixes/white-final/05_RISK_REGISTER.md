# 05 — Risk Register

**Sprint:** WHITE-FINAL-1A (read-only)

---

| ID | Risk | L | I | Mitigation |
|----|------|---|---|------------|
| R1 | Match card centering regression when proxy re-enabled | Low | Med | Keep filter + solo styles; feature flag documents two-up restore |
| R2 | FAB → LeylekEye swap increases render cost on old Android | Med | Low | Memo + same size bounds; test low-end APK |
| R3 | Marker scale 1.2 causes overlap / collision on dense maps | Med | Med | Cap scale 1.18; test cluster + nav |
| R4 | Light glow reduction makes markers invisible on satellite | Low | Med | Phase C map-style coupling later |
| R5 | `peerMapPinScale` theme split desyncs passenger vs driver | Low | Low | Single hook shared both index branches |
| R6 | LeylekZeka hint light text illegible on map busy areas | Low | Low | White elevated pill + border per LHS |
| R7 | Chat voice row token change breaks dark | Low | Med | Dual styles; dark paths unchanged |
| R8 | New light PNG assets drift from DNA | Med | High | design-lab export + hash QA before prod |
| R9 | Overwriting marker PNG breaks dark theme | High | High | **Policy: no overwrite** — sibling assets only |
| R10 | Guardian eye z-index vs match cards | Low | Med | Existing zIndex 4/9999 — do not raise FAB above modals |

---

## Open product decisions

1. Solo secondary card width: keep 48% or widen to 52%?
2. FAB: keep 68dp or compact 56dp for light-only?
3. Markers: token scale first or wait for light PNG pair?
4. Yerime Al re-enable timeline?

---

## Analysis deliverables

| Doc | Content |
|-----|---------|
| `01_MATCH_CARD_SIMPLIFICATION.md` | Hide + center status (mostly done) |
| `02_LEYLEK_ZEKA_COMPACT_UI.md` | FAB/hint gaps vs guardian/chat |
| `03_MARKER_PREMIUM_WHITE_PLAN.md` | Scale + chrome + asset phases |
| `04_SAFE_PATCH_PLAN.md` | P0–P3 sprint split |
| `05_RISK_REGISTER.md` | This file |

**Production code:** untouched in WHITE-FINAL-1A.
