# V7 — Leylek Zeka System (MEX AI)

**Codename:** Meridian Mind  
**Parent:** Logo eye atom · single companion rule

---

## DNA link

Leylek Zeka is **not a mascot**. It is the **logo eye**, animated — same cyan, same calm, same premium.

| Logo element | Zeka expression |
|--------------|---------------|
| Eye dot | Primary avatar |
| Orbital arc | Listening ring |
| Premium calm | No bounce, no cartoon blink |

**Rule:** On map-adjacent surfaces, **Zeka OR watermark** — never both competing (B5.6 CF-16).

---

## States

| State | Visual | Motion | Sonic | Haptic |
|-------|--------|--------|-------|--------|
| **Idle** | Eye static · 28px header | breathe 3s opacity | — | — |
| **Listening** | Arc ring open 270° | expand 300ms | — | P1 |
| **Thinking** | Ring rotates slow | ai.think 1200ms loop | — | — |
| **Speaking** | Voice pulse bars (3) | meridian.breathe | TTS duck | — |
| **Success** | Ring closes | checkDraw 360ms | system.ok | P1 |
| **Warning** | Amber arc segment | nudge 180ms | system.warn | T5 |

---

## Eye animation spec

| Property | Value |
|----------|-------|
| Base size | 28px header · 64px empty state |
| Eye radius | 5.5px @1x · scales with LC-3 ladder |
| Blink | **Forbidden** — use opacity breathe only |
| Color | `#00D4AA` — no gradient on eye |

---

## Voice pulse

Three bars · meridian cyan · heights 40/70/55% · 800ms loop · only during speaking.

---

## Empty state

Full LC-2 logo @64px + "Leylek Zeka hazır" — premium raster tier optional on hero.

---

## Target score

| Composite Leylek Zeka | **95** |

---

**Mockups:** `widget.svg` · `journey-screen.svg` (Zeka FAB position)
