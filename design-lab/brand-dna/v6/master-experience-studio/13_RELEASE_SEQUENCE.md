# V7 — Release Sequence

**Rule:** No store release until **overall composite ≥95 measured**

---

## Sequence

```
G0  Rollback + human logo sign-off
 ↓
V7.1  Brand surfaces (icon, splash, notif, favicon)
 ↓     Internal RC #1 — brand only
V7.2  Map + navigation unification
 ↓     Internal RC #2 — driver map focus
V7.3  Sonic + motion + haptic triad
 ↓     Internal RC #3 — offer/journey/QM
V7.4  Zeka + widget + website + store assets
 ↓     Internal RC #4 — full ecosystem
V7b  Field tests T1–T9
 ↓
B5.7 Re-jury
 ↓
B6-8 DNA Freeze EXECUTED
 ↓
Store RC → Production
```

---

## RC contents by milestone

| RC | Includes | Excludes |
|----|----------|----------|
| RC1 | Icon, splash, premium PNG, login logo | Markers, sonic |
| RC2 | All markers, nav chips, glow fix, Ionicons removed | LSX white theme |
| RC3 | Offer/match/QR/payment triad | Widget |
| RC4 | Zeka, watermark, widget, store screenshots | — |
| Store | All above + legal unchanged review | — |

---

## Rollback points

| After | Rollback to |
|-------|-------------|
| RC1 fail | `_backup-pre-b6-2` logo + pre-B6-3 icons |
| RC2 fail | `_backup-pre-b6-5` markers |
| RC3 fail | Prior RC + sonic mute flag |

---

## Communication

| Milestone | Audience | Message |
|-----------|----------|---------|
| RC1 | Internal QA | "Logo restoration — same bird, sharper" |
| RC2 | Drivers beta | "Map pins clearer at speed" |
| Store | Public | Only after V7b PASS — **never "new logo"** |

---

## Forbidden release patterns

- ❌ Store release on RC1 alone  
- ❌ Marketing "rebrand" language  
- ❌ Partial marker migration (dual language)  
- ❌ DNA freeze before V7b  

---

**Store release authorized only after `14_MASTER_APPROVAL.md` + V7b + B5.7 jury PASS.**
