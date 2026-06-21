# B5.5 — Human Review

**Status:** ⏸ **OPEN — human decision required**  
**No recommendation · no automatic winner**

---

## Board A — Logo

Open in parallel (browser tabs or Figma):

| Panel | Label | Asset |
|-------|-------|-------|
| 0 | **Current production** | Reference: `frontend/assets/images/leylek-logo-premium.png` |
| 1 | **Candidate 1** | `logo/ls-01.svg` + `logo/ls-07.svg` (LC-1 lane) |
| 2 | **Candidate 2** | `logo/ls-29.svg` (LC-2 lane) |
| 3 | **Candidate 3** | `logo/ls-30.svg` (LC-3 lane) |

**Sheet:** `sheets/logo-human-review-sheet.svg`

### Questions (each reviewer)

| # | Question |
|---|----------|
| L1 | Bu bizim LeylekTAG logosu mu? |
| L2 | Logo değişmiş mi? |
| L3 | Sadece daha kaliteli / premium mi? |
| L4 | 10 yıl dayanır mı? |

---

## Board B — App Icon

| Panel | Assets |
|-------|--------|
| Production | Current launcher icon (reference only — do not replace) |
| IC-1 | `app-icon/ai-03.svg` |
| IC-2 | `app-icon/ai-04.svg`, `app-icon/ai-06.svg` |
| IC-3 | `app-icon/ai-10.svg` |

**Ladder:** `sheets/app-icon-size-ladder.svg` @ 24 · 32 · 48 · 64 px

### Questions

| # | Question |
|---|----------|
| I1 | Ana ekranda LeylekTAG olarak tanınıyor mu? |
| I2 | 24px bildirimde okunuyor mu? |
| I3 | iOS/Android mask içinde kesiliyor mu? (bad) |

---

## Board C — Markers

| Panel | Assets |
|-------|--------|
| Old | Current production markers (reference) |
| MC-1 | `mk-03.svg`, `mk-05.svg` |
| MC-2 | `mk-01.svg`, `mk-07.svg`, `mk-09.svg` |
| MC-3 | `mk-19.svg`, `mk-20.svg`, `mk-15.svg` |

**Zoom sheet:** `sheets/marker-zoom-sheet.svg`

### Questions @ zoom 16 · 18 · 20

| # | Question |
|---|----------|
| M1 | LeylekTAG haritası gibi mi? |
| M2 | Generic pin / Uber gibi mi? |
| M3 | Hareket halindeyken ayırt edilebilir mi? |

---

## Board D — Splash (optional)

Compare `splash/sp-01.svg`, `sp-08.svg`, `sp-10.svg` full viewport.

| # | Question |
|---|----------|
| S1 | Premium his veriyor mu? |
| S2 | Logo aynı mı? |

---

## Scorecard (fill manually)

### Logo pick
| Reviewer | LC-1 | LC-2 | LC-3 | Notes |
|----------|------|------|------|-------|
| | ☐ | ☐ | ☐ | |
| | ☐ | ☐ | ☐ | |

### Marker pick
| Reviewer | MC-1 | MC-2 | MC-3 | Notes |
|----------|------|------|------|-------|
| | ☐ | ☐ | ☐ | |

### App icon pick
| Reviewer | IC-1 | IC-2 | IC-3 | Notes |
|----------|------|------|------|-------|
| | ☐ | ☐ | ☐ | |

---

## Outcomes

| Result | Action |
|--------|--------|
| PASS | Record picks → `08_IMPLEMENTATION_AFTER_APPROVAL.md` |
| FAIL | Iterate sketches in design-lab · re-run review |
| PARTIAL | Lane-by-lane approval OK (e.g. logo only) |

---

## Prohibitions

- ❌ Production asset replacement
- ❌ PNG export to frontend
- ❌ Automatic winner selection by agent

---

**After approval only:** `08_IMPLEMENTATION_AFTER_APPROVAL.md`
