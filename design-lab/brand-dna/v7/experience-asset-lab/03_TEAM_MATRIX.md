# V7.1 — Team Matrix

**Mode:** Read-only RACI for asset production sprints

---

## Teams

| Team | Codename | Lead role | Domain |
|------|----------|-----------|--------|
| **ALPHA** | Meridian Core | Brand Design Lead | Logo · icon · splash · favicon · notification micro |
| **BRAVO** | Map Instrument | Map UX + Icon design | Markers · route · pickup/dest · QM ring |
| **CHARLIE** | Triad | Sonic + Motion architect | WAV · Lottie · haptic bind · ESLint motion |
| **DELTA** | Ecosystem | Product design | Zeka · watermark · widget · store · website marks |
| **ECHO** | Validation | QA + Device | IoU · field tests · jury re-run |

---

## RACI (R=Responsible A=Accountable C=Consulted I=Informed)

| Workstream | Alpha | Bravo | Charlie | Delta | Echo | Product | Eng |
|------------|-------|-------|---------|-------|------|---------|-----|
| Logo v2 SVG | R/A | I | I | I | C | A | C |
| PNG ladder | R | I | — | — | C | I | R export |
| App icon | R/A | I | — | C | C | I | R mipmaps |
| Splash native | R | — | C | I | C | I | R android res |
| Markers ×12 | C | R/A | C | I | C | I | R swap PNG |
| Nav chips (code) | I | C | — | I | C | A | R |
| Glow token fix | I | C | — | — | C | I | R/A |
| Sonic trust.link | I | — | R/A | — | C | C | R |
| Motion lint | I | C | R/A | — | C | I | R |
| Zeka eye v2 | C | — | C | R/A | C | I | R |
| Watermark mono | C | — | — | R/A | C | I | R |
| IoU + human | I | I | — | — | R/A | A | I |
| Production swap | I | I | I | I | C | A | R |

---

## Team Alpha detail

**See:** `01_TEAM_ALPHA_PREMIUM_LOGO.md`

| Member skill | Task |
|--------------|------|
| Vector craft | LC-2 path freeze · constitution v2 |
| Export ops | resvg ladder · Android DPI |
| Brand QA | Human blink · 3-meter |
| iOS/Android | Squircle/adaptive review with Echo |

---

## Team Bravo detail

| Input | Source |
|-------|--------|
| MEX-M chassis | V6 `03_MAP_SYSTEM.md` |
| Wireframes | B5.5 `markers/mk-*.svg` |
| Production gap | B5.6 marker jury FAIL |

**Depends on:** Alpha color token `#00D4AA` locked (not production yet).

---

## Team Charlie detail

| Input | Source |
|-------|--------|
| Sonic registry | V6 `05_SONIC_SYSTEM.md` |
| Existing WAV | `frontend/assets/sounds/` |
| Motion tokens | V6 `06_MOTION_SYSTEM.md` |
| Haptic map | V6 `07_HAPTIC_SYSTEM.md` |

**New asset:** `sonic.trust.link` only confirmed net-new WAV.

---

## Team Delta detail

| Input | Source |
|-------|--------|
| Zeka system | V6 `08_LEYLEK_ZEKA_SYSTEM.md` |
| Current eye | `frontend/assets/images/leylek-zeka-eye.png` |
| Watermark | `leylek-watermark.png` — wrong tier (full color) |

---

## Team Echo detail

| Gate | Owner |
|------|-------|
| G0 | Echo + Brand |
| G1–G4 | Echo |
| G5 B5.7 re-jury | External jury doc |

---

## Communication

| Cadence | Forum |
|---------|-------|
| Daily | Asset lab standup (design-lab status) |
| Gate review | Sign gate doc before next phase |
| Blocker | P0 risk → Product within 24h |

---

## Sprint ownership timeline

| Sprint | Primary team |
|--------|--------------|
| V7.1b | Alpha |
| V7.2 | Bravo (+ Eng swap) |
| V7.3 | Charlie (+ Eng bind) |
| V7.4 | Delta |
| V7b | Echo all |
