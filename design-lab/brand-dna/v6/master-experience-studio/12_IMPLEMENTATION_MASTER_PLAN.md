# V7 — Implementation Master Plan

**Prerequisite:** `14_MASTER_APPROVAL.md` signed  
**Mode:** Post-approval execution roadmap · **not started in V7 sprint**

---

## Phase 0 — Emergency (pre-MEX)

| Task | Owner | Output |
|------|-------|--------|
| Rollback premium PNG | Ops | `_backup-pre-b6-2` live |
| Human LC-2 overlay | Brand | Signed panel |
| IoU ≥0.98 | QA | Pixel report |

**Gate G0:** Human "same logo, better quality" ≥70%

---

## Phase 1 — Brand core (V7.1)

| Task | Output |
|------|--------|
| Freeze LC-2 SVG v2 | `leylek-symbol-master-v2.svg` |
| Export ladder | 16/24/48/512/1024/1254/432 |
| Raster premium tier | splash/login hero PNG |
| Rebuild app icon + notification | from LC-2/LC-3 |
| Splash motion | presence.pulse + handoff |

**Gate G1:** Icon grid blind test PASS

---

## Phase 2 — Map & nav (V7.2)

| Task | Output |
|------|--------|
| MEX-M marker SVG ×12 | design-lab → production PNG |
| Replace Ionicons field pins | pickup/destination/offer maps |
| `#00D4AA` glow unification | `mapMarkerChrome.tsx` |
| Nav chips + route style | ETA/distance components |
| QM map lock ring | 480ms ephemeral |

**Gate G2:** T5 driving @0.4s video PASS

---

## Phase 3 — Triad (V7.3)

| Task | Output |
|------|--------|
| Motion token CI lint | ESLint + snapshot |
| Offer sonic signature polish | traffic A/B |
| `sonic.trust.link` | new WAV |
| Haptic QM discrimination | P2+P1 pattern |
| Marker breathe + search pulse | Lottie or RN anim |

**Gate G3:** Triad sync frame-accurate ±16ms

---

## Phase 4 — Zeka & ecosystem (V7.4)

| Task | Output |
|------|--------|
| Zeka eye states | 5-state anim |
| Watermark mono | stroke-only asset |
| Widget | glance layout |
| Website marker CSS | MEX genom |
| Store listings | new captures |

**Gate G4:** Full scorecard ≥95 measured (not projected)

---

## Phase 5 — V7b validation

| Task | Output |
|------|--------|
| Field user tests T1–T9 | `10_USER_TEST_RESULTS.md` filled |
| B5.7 re-jury | Pass / fail |
| B6-8 DNA freeze | EXECUTED if pass |

---

## File touch matrix

| Path | Phases |
|------|--------|
| `frontend/assets/images/*` | 1 |
| `frontend/assets/markers/*` | 2 |
| `frontend/lib/mapMarkerChrome.tsx` | 2 |
| `frontend/lib/mapNavMarkers.ts` | 2 |
| `frontend/components/*Offer*` | 2, 3 |
| `frontend/components/LeylekZeka*` | 4 |
| Sonic WAV | 3 |
| `backend/**` | ❌ Never |

---

## Timeline estimate

| Phase | Duration |
|-------|----------|
| 0 | 3–5 days |
| 1 | 5–7 days |
| 2 | 7–10 days |
| 3 | 5–7 days |
| 4 | 5 days |
| 5 | 7–10 days |
| **Total** | **~8–9 weeks** |

---

**Blocked until master approval.**
