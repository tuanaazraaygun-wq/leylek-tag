# White Theme Marker Strategy

**Sprint:** B-2 — Marker Evolution  
**Mode:** Specification only — **no assets**  
**Date:** 2026-06-21

---

## Executive summary

Marker sistemi bugün **dark map + dark app** için optimize. `design-lab/markers/constitution.md` §9 ve `MARKER_DNA.md` white theme esnekliği gerektirir. Strateji: **form sabit, token swap** — ayrı siluet çizimi yok.

---

## Design principles

| # | Kural |
|---|-------|
| W-01 | Siluet path dark/light **aynı** |
| W-02 | Glow opacity light'ta **%40 azalt** |
| W-03 | Stroke öncelikli; fill ikincil |
| W-04 | Caution amber aynı hue — contrast check |
| W-05 | Heat disk intensity = opacity not hue |

---

## Token swap table

| Token | Dark theme | Light theme |
|-------|------------|-------------|
| Body fill | `#1A2332` Depth Slate | `#F5F7FA` Trust White |
| Stroke | `#F5F7FA` @ 85% | `#0D1117` @ 75% |
| Accent glow | `#00D4AA` @ 15–40% | `#00D4AA` @ 10–25% |
| Shadow | `#0D1117` @ 25% | `#0D1117` @ 12% |
| Seeking near ring | Amber `#FFB020` | Amber @ 30% stroke |
| Offline | opacity 0.4 | opacity 0.35 + desaturate |

---

## Per marker type

| Marker | Light strategy |
|--------|----------------|
| Passenger / Driver PNG | `@2x` export pair: `-dark.png` / `-light.png` OR runtime tint |
| MapEntityMarkerImage glow | Theme prop `chromeTone: 'dark' \| 'light'` |
| Destination stem+dot | Slate stem darkens on light map |
| Pickup ring | Stroke-only on light |
| Seeking overlay | Ring stroke not fill square |
| Heat disk | Cyan radial lower opacity |
| Cluster badge | White fill + slate text |
| Website CSS markers | `[data-theme=light]` overrides in globals.css |

---

## Map tile interaction

| Map style | Marker set |
|-----------|------------|
| Google dark | dark tokens (default) |
| Google standard | light tokens |
| Satellite | dark tokens + stronger stroke |

App `userInterfaceStyle: automatic` — marker theme should follow **map** not only app chrome.

---

## Logo DNA alignment

Light marker accent = Meridian Cyan `#00D4AA` — logo evolution genom ile **aynı token file** (`GENOM_TOKENS_SPEC` cross-ref).

---

## Implementation phases (future)

1. **B-4:** Token doc only (this file) + DNA freeze.
2. **B-6:** Export light PNG pair design-lab.
3. **B-8:** `useMapMarkerTheme()` hook — production (post-freeze).
4. **B-9:** QA matrix light map screenshots.

---

## Anti-patterns

- Inverted siluet (new bird shape) — rebrand
- Pure white fill on white map — invisible
- Neon boost on light — constitution violation

---

## QA criteria (future)

- [ ] 32 px passenger on Google standard map
- [ ] Glow not bloom on white
- [ ] Car vs motor on light
- [ ] Destination vs pickup distinguish
- [ ] WCAG 3:1 decorative contrast

---

**İlişkili:** `MARKER_DNA_FREEZE_GATE.md`, logo evolution `VECTOR_MASTER_SPEC.md`
