# B5.5 — App Icon Board

**Assets:** `app-icon/ai-01.svg` … `app-icon/ai-10.svg`  
**Ladder sheet:** `sheets/app-icon-size-ladder.svg`  
**Artboard:** 1024×1024 · `#000000` field · dashed mask guides on concepts 01–04, 06–10

---

## Concept index (10)

| ID | File | Surface intent |
|----|------|----------------|
| AI-01 | `app-icon/ai-01.svg` | Home screen · 72% safe scale |
| AI-02 | `app-icon/ai-02.svg` | Home compact · 68% |
| AI-03 | `app-icon/ai-03.svg` | **iOS squircle** mask fit |
| AI-04 | `app-icon/ai-04.svg` | **Android adaptive** circle mask |
| AI-05 | `app-icon/ai-05.svg` | **Notification** · 24px simulation |
| AI-06 | `app-icon/ai-06.svg` | **Launcher** · bold arc weight |
| AI-07 | `app-icon/ai-07.svg` | Optical nudge for mask center |
| AI-08 | `app-icon/ai-08.svg` | Micro eye boost |
| AI-09 | `app-icon/ai-09.svg` | Arc-forward visual weight |
| AI-10 | `app-icon/ai-10.svg` | Balanced timeless default |

---

## Mask guides (dashed gray)

| Guide | Shape | Represents |
|-------|-------|------------|
| Rounded rect 800² | rx=180 | iOS squircle approximation |
| Circle r=400 | center 512 | Android adaptive circle |
| Rounded rect 640² | rx=128 | Safe zone inner |

---

## Readability test tiers

Verify in `sheets/app-icon-size-ladder.svg` at:

| px | Surface |
|----|---------|
| 24 | Notification / status bar |
| 32 | Small launcher / tray |
| 48 | Standard app drawer |
| 64 | Large shortcut / tablet |

**Pass:** Stork profile + arc fragment + eye dot readable without color.

---

## Surface mapping

| Platform surface | Primary concepts |
|------------------|------------------|
| Home Screen | AI-01, AI-10 |
| iOS squircle | AI-03, AI-07 |
| Android adaptive | AI-04, AI-06 |
| Notification | AI-05, AI-08 |
| Launcher | AI-06, AI-09 |

---

**Elimination:** App Icon 10 → 5 → 3 in `05_ELIMINATION_MATRIX.md`
