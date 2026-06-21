# V7.1 — Production Migration Sequence

**Mode:** Read-only timeline  
**Prerequisite:** V7.1 analysis sign-off + G0 PASS  
**Source:** V6 `13_RELEASE_SEQUENCE.md` · amended for asset lab

---

## Phase 0 — Emergency (ops · no full asset lab)

| Step | Action | Touches production? |
|------|--------|---------------------|
| 0.1 | Restore premium PNG from `_backup-pre-b6-2` | Yes — **ops waiver** |
| 0.2 | Human LC-2 panel | No |
| 0.3 | IoU script run | No |
| 0.4 | Document G0 PASS | No |

**Duration:** 3–5 days  
**RC:** Optional hotfix RC for user-facing logo only

---

## Phase 1 — V7.1b Alpha assets

| Step | Asset swap | Production paths |
|------|------------|------------------|
| 1.1 | Freeze `leylek-symbol-master-v2.svg` | design-lab only first |
| 1.2 | Export PNG ladder | design-lab/png |
| 1.3 | Replace premium PNG 512+1254 | `frontend/assets/images/` |
| 1.4 | Replace ios.premium.logo | `frontend/assets/` |
| 1.5 | Replace app icon + adaptive + favicon | `frontend/assets/images/` |
| 1.6 | Android mipmap ×15 | `android/app/src/main/res/` |
| 1.7 | Splash ×5 DPI + iOS | native res |
| 1.8 | Fix `app.json` icon → proper 1024 path | **Phase 1 only** |
| 1.9 | G1 test suite | — |

**Gate:** G1 PASS → **RC1 internal QA**

**Duration:** 5–7 days post-G0

---

## Phase 2 — V7.2 Bravo assets

| Step | Action |
|------|--------|
| 2.1 | Marker SVG freeze ×12 |
| 2.2 | PNG export @48 → markers/ |
| 2.3 | `mapNavMarkers.ts` hash verify only if paths change |
| 2.4 | `mapMarkerChrome.tsx` glow `#00D4AA` |
| 2.5 | Remove Ionicons pickup/dest in field maps |
| 2.6 | QM lock ring implementation |
| 2.7 | G2 test suite |

**Gate:** G2 PASS → **RC2 driver map focus**

**Duration:** 7–10 days

---

## Phase 3 — V7.3 Charlie triad

| Step | Action |
|------|--------|
| 3.1 | sonic.trust.link WAV |
| 3.2 | Offer sonic polish |
| 3.3 | Motion token ESLint |
| 3.4 | Splash presence.pulse native |
| 3.5 | Marker breathe / search Lottie |
| 3.6 | G3 test suite |

**Gate:** G3 PASS → **RC3 full journey**

**Duration:** 5–7 days

---

## Phase 4 — V7.4 Delta ecosystem

| Step | Action |
|------|--------|
| 4.1 | Zeka eye v2 PNG |
| 4.2 | Watermark mono swap |
| 4.3 | Widget + store screenshots |
| 4.4 | Website header mark |
| 4.5 | G4 full scorecard |

**Gate:** G4 PASS → **RC4 stakeholder**

**Duration:** 5 days

---

## Phase 5 — V7b + release

| Step | Action |
|------|--------|
| 5.1 | Field tests T1–T9 |
| 5.2 | B5.7 re-jury |
| 5.3 | B6-8 DNA Freeze EXECUTED |
| 5.4 | Store RC Play + App Store |
| 5.5 | Production release |

**Duration:** 7–10 days

---

## Total timeline (from G0 PASS)

| Milestone | Week |
|-----------|------|
| G0 | W0 |
| RC1 | W1–2 |
| RC2 | W3–4 |
| RC3 | W5 |
| RC4 | W6 |
| Store | W7–9 |

**~8–9 weeks** — matches V6 estimate

---

## Rollback triggers

| After | Rollback |
|-------|----------|
| RC1 fail G1 | `_backup-pre-b6-2` logo + pre-B6-3 icons |
| RC2 fail G2 | `_backup-pre-b6-5` markers |
| RC3 fail G3 | Feature flag mute new sonic |

---

## What V7.1 does NOT schedule

- Backend changes  
- LSX white theme enable  
- Muhabbet legacy art removal (parallel track)  
- Website full redesign  

---

## Production entry criterion (single sentence)

> **No production asset swap until G0 PASS and V7.1 analysis signed.**
