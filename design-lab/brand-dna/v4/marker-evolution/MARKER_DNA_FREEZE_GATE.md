# Marker DNA Freeze Gate

**Sprint:** B-2 — Marker Evolution  
**Mode:** Governance  
**Date:** 2026-06-21  
**Parent:** `design-lab/brand-dna/v4/MARKER_DNA.md`, logo evolution DNA freeze

---

## Freeze edilecek kararlar

| ID | Karar | Değer |
|----|-------|-------|
| MFRZ-01 | Canonical entity markers | Passenger + car + motor PNG family from logo genom |
| MFRZ-02 | Renk genom | Meridian `#00D4AA`, Depth Slate `#1A2332`, Trust White `#F5F7FA` |
| MFRZ-03 | Pin teardrop yasak | Constitution + MARKER_DNA anti-pattern |
| MFRZ-04 | Tek marker dili | Trip + field map unify before production |
| MFRZ-05 | Glow max opacity | 0.7 |
| MFRZ-06 | Scale breathe max | ±2% |
| MFRZ-07 | Stroke min @48px | 2 px |
| MFRZ-08 | Form birincil ayırıcı | Car / motor / human |
| MFRZ-09 | Logo evolution dependency | Marker exports after logo vector master P2 |
| MFRZ-10 | F1 wing form marker'da yasak | Logo evolution `ban.f1Ship` extends |
| MFRZ-11 | Cluster spec | MARKER_DNA §4.7 badge rules |
| MFRZ-12 | White theme | Form same, token swap only |

---

## Production'a kadar değişebilecek

| ID | Karar | Limit |
|----|-------|-------|
| MVAR-01 | Exact PNG px sizes 30–36 | B-3 export |
| MVAR-02 | Heat disk amber vs cyan-only | B-4 decision |
| MVAR-03 | Cluster library choice | B-7 spike |
| MVAR-04 | Offline marker show/hide policy | Product |
| MVAR-05 | QM ring stroke dash pattern | B-3 design |
| MVAR-06 | Destination stem height ±4px | B-3 design |

---

## Kimlik kırılımı engeli

| Mekanizma | Açıklama |
|-----------|----------|
| Shared genom tokens | Logo + marker same JSON manifest |
| Unify trip/field | P0 before any new feature markers |
| Retire green/orange seeking | Brand split removal |
| Export ladder | 24/32/48 from one SVG |
| QA blind test | LeylekTAG map recognition |
| No generic pin | Uber/Google red team |

---

## Logo DNA dependency

Marker evolution **logo evolution vector master sonrası** export alır:

```
Logo P2 vector master freeze
    → Marker B-3 trace (human/car/motor from shared stroke language)
    → Marker DNA freeze sign-off
    → B-8 production swap
```

Shared elements: accent dot, horizon hint, corner radius 2–4px, orbital arc as **state ring** not entity body.

---

## Freeze checklist

| ID | Check | B-2 status |
|----|-------|------------|
| MF-01 | 12 marker analyses complete | ✅ |
| MF-02 | Map/perf/white/QA docs | ✅ |
| MF-03 | Production untouched | ✅ |
| MF-04 | Stakeholder MFRZ sign-off | ☐ |
| MF-05 | Logo P2 vector master | ☐ blocker for export |
| MF-06 | design-lab exports empty acknowledged | ✅ |

**Exit:** MF-04 + MF-05 → B-3 export sprint.

---

## Freeze sonrası migration kurall

1. B-8 only production PNG/path swap.
2. No DriverOfferScreen logic refactor in marker patch — chrome + assets only.
3. Backup `_backup-pre-marker-evolution/`.
4. Staged: internal TestFlight → production.
5. Amendment to MFRZ → MARKER_DNA v4.1 + re-QA.

---

**İlişkili:** `MARKER_EVOLUTION_MASTER_ANALYSIS.md`
