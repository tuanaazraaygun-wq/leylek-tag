# V7 — Experience Master Plan

**Sprint:** V7 — LeylekTAG Master Experience Studio  
**Status:** Brand design reset → **product experience design**  
**Date:** 2026-06-21  
**Mode:** Design-lab only · **no production changes**

---

## Reset statement

Documentation (B5.4), sketches (B5.5), and jury (B5.6) are **complete**.  
**Production brand scored 48/100 — DENIED.**

V7 stops judging white artboards. V7 designs **LeylekTAG as a living product** — real screens, real maps, real phones, real speed.

---

## Absolute goal

> People instantly recognize **LeylekTAG** — not from a logo alone, but from **one unified experience** across every touchpoint in under 200 ms.

---

## The MEX system (Master Experience)

One grammar · seven channels · zero dialects

```
                    ┌─────────────────────┐
                    │   PRODUCT LANGUAGE   │  ← 09_PRODUCT_LANGUAGE.md
                    │   (Meridian Operative)│
                    └──────────┬──────────┘
         ┌──────────┬──────────┼──────────┬──────────┐
         ▼          ▼          ▼          ▼          ▼
      BRAND       MAP        NAV      MOTION     SONIC
         │          │          │          │          │
         └──────────┴──────────┴──── HAPTIC ────────┘
                              │
                         LEYLEK ZEKA
```

**Meridian Operative** = Cyan orbit + premium calm + instrument clarity + forward intent.

---

## Experience domains (V7 scope)

| # | Domain | Document | Mockups |
|---|--------|----------|---------|
| 1 | Brand surfaces | This plan + mockups | `mockups/*-home.svg`, splash, store |
| 2 | Map experience | `03_MAP_SYSTEM.md` | `google-maps-journey.svg` |
| 3 | Navigation system | `04_NAVIGATION_SYSTEM.md` | journey, car-dashboard |
| 4 | Motion language | `06_MOTION_SYSTEM.md` | offer-screen |
| 5 | Sonic language | `05_SONIC_SYSTEM.md` | — |
| 6 | Haptic language | `07_HAPTIC_SYSTEM.md` | — |
| 7 | Leylek Zeka | `08_LEYLEK_ZEKA_SYSTEM.md` | widget, journey |

---

## Frozen inputs (from prior sprints)

| Input | Decision |
|-------|----------|
| Logo master | **LC-2** Balance Meridian (pending human IoU) |
| Logo micro | **LC-3** @24/48 only |
| Premium raster | 1254 hero for splash/login |
| Marker chassis | Arc foot + eye dot + `#00D4AA` |
| Vehicle pair | MC-1 wedge car + narrow motor |
| State markers | MC-3 orbit pulse/search/cluster/trust |
| Offer sound | **Brand signature anchor** |
| Glow token | `#00D4AA` only — retire `#22D3EE` |

---

## Real-world evaluation rule

| Old way | V7 way |
|---------|--------|
| SVG on black | Phone frame + map tiles + UI chrome |
| Designer says "nice" | 3-meter · 0.4s · 24px · sunlight tests |
| Logo-only QA | Offer + journey + notification triad |

**Mockup index:** `02_REAL_WORLD_MOCKUPS.md`

---

## User test battery (mandatory before ship)

| Test | Pass criteria |
|------|---------------|
| 3-meter recognition | Named "LeylekTAG" without logo text |
| 24 px visibility | Eye+arc or vehicle wedge discriminates |
| Night mode | Contrast ≥4.5:1 on map chrome |
| Day mode / sunlight | No glow-only readability |
| Driving @ speed | Map marker @0.4s |
| One-hand usage | Offer accept ≥48pt target |
| Color blindness | Form beats hue |
| Low brightness | OLED off — silhouette holds |

**Results template:** `10_USER_TEST_RESULTS.md`

---

## Scoring gate

16 dimensions · 0–100 composite · **≥95 to ship**  
**V7 designed system target:** 96 (when implemented)  
**Current production:** 48 (B5.6 jury — do not ship)

---

## V7 deliverables

| # | File |
|---|------|
| 01 | `01_EXPERIENCE_MASTER_PLAN.md` (this) |
| 02 | `02_REAL_WORLD_MOCKUPS.md` |
| 03–08 | Domain systems |
| 09 | Product language |
| 10 | User tests |
| 11 | Scorecard |
| 12 | Implementation plan |
| 13 | Release sequence |
| 14 | Master approval |

---

## Explicit prohibitions (V7 sprint)

- ❌ Production / frontend / website changes  
- ❌ Asset regeneration to `frontend/assets/`  
- ❌ Commits · push  

---

**Next:** Open `mockups/` in browser — judge **in product**, not in isolation.
