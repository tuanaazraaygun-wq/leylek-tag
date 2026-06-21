# V7.1 — Forbidden List

**Mode:** Absolute · cumulative from B5.3 → B5.6 → V6 → V7.1  
**Violation = sprint stop + rollback review**

---

## 1. Asset production (V7.1 sprint)

| # | Forbidden |
|---|-----------|
| F-01 | SVG / PNG / Lottie / WAV üretmek |
| F-02 | `frontend/assets/` yazmak |
| F-03 | `website/` asset yazmak |
| F-04 | Android `res/` mipmaps yazmak |
| F-05 | Ses dosyası render etmek |
| F-06 | Auto-trace logo PNG |

---

## 2. Code & config (all pre-G4 phases)

| # | Forbidden |
|---|-----------|
| F-10 | Production frontend değiştirmek (V7.1 analiz sprintinde) |
| F-11 | Backend değiştirmek |
| F-12 | `app.json` değiştirmek (V7.1 analiz sprintinde) |
| F-13 | Map logic / dispatch / socket değiştirmek |
| F-14 | git commit / push (unless explicitly requested) |
| F-15 | git diff (user rule V7.1) |

---

## 3. Logo identity (forever until council amend)

| # | Forbidden |
|---|-----------|
| F-20 | **Yeni logo tasarlamak** — redesign |
| F-21 | F1 Meridian Wing direction |
| F-22 | Crown / mascot / pin-drop / abstract bird |
| F-23 | B5.2 `leylek-symbol-master-v1.svg` as production master |
| F-24 | Auto-trace from PNG |
| F-25 | Beak shorten · arc hairline · one-leg removal |
| F-26 | Closed orbital badge (ring seal) |
| F-27 | Chibi head · cartoon eye |
| F-28 | Ship logo without human panel + IoU |
| F-29 | LC-3 as 512 master without blink pass |

---

## 4. Brand migration process

| # | Forbidden |
|---|-----------|
| F-30 | B6-8 DNA Freeze before G4 + G5 |
| F-31 | Store RC before V7b field tests |
| F-32 | Partial marker migration (dual Ionicons + PNG) |
| F-33 | Marketing "rebrand" / "new logo" language |
| F-34 | Skip rollback when users report "logo değişmiş" |
| F-35 | Use 512 B6-2 export as IoU reference |
| F-36 | Override B6-7 human fail with "technical QA passed" |

---

## 5. Map & markers

| # | Forbidden |
|---|-----------|
| F-40 | `#22D3EE` glow (must be `#00D4AA`) |
| F-41 | Ionicons pickup/destination on field maps (post-V7.2) |
| F-42 | Generic heat blob searching (post-V7.2) |
| F-43 | Quick Match invisible on map (post-V7.2) |
| F-44 | Gendered passenger marker |
| F-45 | Uber-style black pin clone |

---

## 6. Sonic / motion / haptic

| # | Forbidden |
|---|-----------|
| F-50 | Mixkit / generic notification ping |
| F-51 | Looping boot sound |
| F-52 | Undeclared spring animation on Tier A |
| F-53 | Random `Vibration.vibrate()` without pattern |
| F-54 | Same haptic for offer + QM without discrimination |
| F-55 | Trust connection silent (no earcon post-V7.3) |

---

## 7. Ecosystem

| # | Forbidden |
|---|-----------|
| F-60 | Full-color premium PNG as watermark |
| F-61 | Map tile watermark logo |
| F-62 | Leylek Zeka + full watermark compete same surface |
| F-63 | Website fourth marker dialect (post-V7.4) |

---

## 8. Allowed (explicit)

| # | Allowed |
|---|---------|
| A-01 | V7.1 design-lab markdown analysis |
| A-02 | Read production files read-only |
| A-03 | Reference design-lab mockups V6 |
| A-04 | Ops rollback PNG (Phase 0 · separate waiver) |
| A-05 | LC-2 restoration **evolution** with CORE DNA locked |

---

## Enforcement

| Violation | Consequence |
|-----------|-------------|
| F-20–29 | Brand council stop |
| F-30–36 | Product gate revoke |
| F-01–06 during V7.1 | Sprint invalid — discard assets |
| F-40–45 post-V7.2 | G2 auto-fail |

---

**This list is binding for V7.1b asset production and all subsequent phases.**
