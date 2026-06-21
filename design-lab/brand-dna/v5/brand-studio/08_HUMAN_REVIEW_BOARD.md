# B5.4 — Phase 8: Human Review Board

**Sprint:** B5.4 — LeylekTAG Brand Studio  
**Status:** ⏸ **PENDING HUMAN APPROVAL**  
**Production:** ❌ Frozen — no replacement until signed

---

## Board A — Logo comparison

Display full-width on `#0D1117`. Order is mandatory.

| Panel | Label | Source |
|-------|-------|--------|
| **0** | Old Premium (production PNG) | `frontend/assets/images/leylek-logo-premium.png` |
| **1** | Failed vector (reference) | `v4/logo-restoration/overlay/b52-failed-trace-512.png` |
| **2** | Candidate A — F1 Meridian Faithful | `v4/logo-restoration/overlay/candidate-a-ultra-faithful-1254.png` |
| **3** | Candidate B — F2 Meridian Balance | `v4/logo-restoration/overlay/candidate-b-optical-balance-1254.png` |
| **4** | Candidate C — F3 Meridian Horizon | `v4/logo-restoration/overlay/candidate-c-small-size-1254.png` |

### Blink test protocol
Alternate Panel 0 ↔ Panel 2 @ 500 ms for 10 cycles.  
**PASS:** No silhouette jump · beak length stable · arc mass stable.

### Review questions

| # | Question | PASS |
|---|----------|------|
| L1 | “Bu bizim LeylekTAG logosu mu?” | Evet |
| L2 | “Logo değişmiş mi?” | Hayır |
| L3 | “Daha premium ve kaliteli mi?” | Evet |
| L4 | “Başka uygulama ikonu gibi mi?” | Hayır |
| L5 | “10 yıl dayanır mı?” | Evet |

**Gate:** ≥70% reviewers PASS L1–L4 on **one** of Panel 2–4.

---

## Board B — Logo @ small sizes

| Row | Asset |
|-----|-------|
| Master resized | Reference @48 |
| F1 | `candidate-a-ultra-faithful-48.png` |
| F2 | `candidate-b-optical-balance-48.png` |
| F3 | `candidate-c-small-size-48.png` |
| B5.2 fail | `b52-failed-trace-512.png` scaled to 48 |

**PASS @48:** Stork profile + arc swoosh + eye dot readable in &lt;2 s glance.

---

## Board C — Marker family (spec wireframes)

Compare **old production read** vs **B5.4 studio spec** — side by side in Figma from `06_MARKER_STUDIO.md`.

| Row | Old | New (spec) |
|-----|-----|------------|
| Passenger | Generic neutral PNG | Arc-foot neutral silhouette |
| Driver Car | Flat top-down | Wedge + width discriminator |
| Driver Motor | Similar blob to car | Narrow lean ellipse |
| Pickup | Ionicons green | Arc-cap pin |
| Destination | Generic flag | Arc-stem pennant |
| Searching | Heat blob | Orbit pulse rings |

### Marker questions

| # | Question | PASS |
|---|----------|------|
| M1 | “Haritada LeylekTAG hissi var mı?” | Evet |
| M2 | “Uber/Google gibi generic mi?” | Hayır |
| M3 | @ zoom 16 arabayı motordan ayırabildin mi?” | Evet |
| M4 | “Logo ile aynı ailede mi?” | Evet |

**Gate:** ≥70% PASS M1–M4 on studio spec.

---

## Board D — Ecosystem strip (mockup)

Single horizontal strip showing **approved finalist** across:
App Icon · Splash · Login · Zeka · Watermark · Marker · QR · Notification · Launcher

Use `07_VISUAL_ECOSYSTEM.md` specs — no exported PNGs required for sign-off; Figma mock sufficient.

---

## Reviewer scorecard

| Reviewer | Date | Logo pick (F1/F2/F3) | L1–L5 | M1–M4 | Notes |
|----------|------|----------------------|-------|-------|-------|
| | | | | | |
| | | | | | |
| | | | | | |

---

## Outcomes

| Result | Next step |
|--------|-----------|
| **PASS** | Record in `10_BRAND_MASTER_DECISION.md` → `09_IMPLEMENTATION_PLAN.md` |
| **FAIL logo** | Iterate F1 paths in design-lab only |
| **FAIL markers** | Revise `06_MARKER_STUDIO.md` chassis |
| **FAIL both** | Do not proceed to production regen |

---

## Explicit prohibitions

- ❌ Replace `frontend/assets/images/leylek-logo-premium.png`
- ❌ Replace `frontend/assets/markers/*`
- ❌ Regenerate splash / app icon / website assets
- ❌ DNA Freeze EXECUTED

---

**Next:** `09_IMPLEMENTATION_PLAN.md` · `10_BRAND_MASTER_DECISION.md`
