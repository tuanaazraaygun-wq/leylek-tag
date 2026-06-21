# B5.4 — Phase 6: Marker Studio

**Sprint:** B5.4 — LeylekTAG Brand Studio  
**Mode:** Design-lab spec only — **no PNG export · no production swap**  
**Problem:** B6-7 markers became **generic** — lost LeylekTAG family read at speed  
**Genome parent:** `02_LOGO_GENOME.md` marker atoms

---

## Design thesis

Markers are **not mini-logos**. They are **map instruments** sharing logo DNA:

| Logo atom | Marker expression |
|-----------|-------------------|
| Orbital arc fragment | Base ring / heading crescent |
| Cyan eye dot | Active core @ geometric center |
| Bottom mass | Pin anchor weight |
| Open gap | Direction wedge (vehicles) |
| Stroke discipline | Min 2 px @48 · no feather detail |
| Premium calm | No bounce · no comic outline |

**North star @ 80 km/h glance:** *“LeylekTAG haritası”* — not Uber pin · not Google dot · not game power-up.

---

## Universal marker chassis (all types)

```
        ┌─────────────┐
        │  ○ glow 15% │  Meridian Cyan halo — state-scaled
        │ ┌─────────┐ │
        │ │ · core  │ │  Eye dot when ACTIVE
        │ │ SILHOUET│ │  Depth Slate #1A2332 body
        │ └────┬────┘ │  Trust White #F5F7FA edge 1px
        │      ▼      │  Anchor: foot center
        └─────────────┘
```

| Token | Value |
|-------|-------|
| Base size @48 | 48×48 artboard |
| Display default | 32 px entity · 28 px field |
| Min legible | 24 px (zoom 16–18) |
| Glow | `#00D4AA` @ 12–25% — **not** `#22D3EE` |
| Corner language | 2–4 px radius — matches logo arc terminals |
| Max interior detail | 1 helper shape |

---

## Type specifications

### 01 — Passenger

**Read:** Vertical human silhouette — **gender-neutral** · standing · no face  
**Wireframe @48:**
```
    ○
   /|\
   / \
    |
```
**DNA:** Single body mass + optional cyan dot when waiting.breathe active  
**Zoom 16–18:** Dot + shoulders must survive; no hair/gender cues  
**vs old:** `passenger-neutral.png` generic — new adds **arc foot ring** (logo cradle)

---

### 02 — Driver Car

**Read:** Top-down car — wide body · clear front wedge · 4 wheel hints as negative space  
**Wireframe @48:**
```
  ┌───────┐
  │ ▲     │  ← heading wedge (logo open-gap metaphor)
  └─┬─┬─┬─┘
```
**DNA:** Heading rotation smooth 120 ms · cyan core when en-route  
**Zoom 16:** Wedge + width ratio vs motor = primary discriminator  
**vs old:** B5.2 flat blob — indistinguishable from motor @ distance

---

### 03 — Driver Motorcycle

**Read:** Narrow · two-wheel axis · forward lean 8°  
**Wireframe @48:**
```
    ┌──┐
   ╱    ╲
  ○      ○
```
**DNA:** Same chassis · **30% narrower** bounding box than car  
**Zoom 16:** Ellipse + single centerline — never four-wheel read

---

### 04 — Pickup

**Read:** Pin with **upward arc** — pickup is “lift point” not destination flag  
**Wireframe @48:**
```
     ·
    ╱ ╲
   │   │
   └───┘
```
**DNA:** Cyan dot + open arc cap (logo swoosh fragment)  
**vs old:** Ionicons green circle — off-brand

---

### 05 — Destination

**Read:** Flag **without** cartoon pole — arc-stem + pennant wedge  
**Wireframe @48:**
```
    ┌▶
    │
    ▼
```
**DNA:** Trust white edge · amber reserved for error only — destination = cyan/white  
**vs old:** Generic map flag · no LeylekTAG orbit language

---

### 06 — Journey Active

**Read:** Dual-point path chip — thin arc connector between pickup/destination grammar  
**Wireframe @48:**
```
  · ～～～ ▶
```
**DNA:** Motion-ready separated layers · static export = arc + arrowhead  
**Use:** Active trip overlay · not entity replacement

---

### 07 — Quick Match

**Read:** Two silhouettes bridged by **cyan lock ring** — instant match metaphor  
**Wireframe @48:**
```
  ○ ○
   ╲╱
    ○  lock dot
```
**DNA:** Ring pulse spec 1.2 s — no casino sparkle  
**vs old:** UI-only — no map marker

---

### 08 — Trust (Trusted Driver)

**Read:** Car/motor base + **warm resolve arc** `#C8E6D0` @ 20% outer ring  
**Wireframe @48:**
```
  ╭─────╮
  │ CAR │
  ╰─────╯
```
**DNA:** Trust is overlay — never replaces vehicle silhouette  
**Discriminator:** Double ring vs standard driver

---

### 09 — Trust Network

**Read:** Hub node — 3 micro dots on orbit ring (network graph)  
**Wireframe @48:**
```
   ·─·─·
    ╲ ╱
     ○
```
**DNA:** List/hub UI + optional map hub · not passenger scale

---

### 10 — Cluster

**Read:** Count badge on **shared arc base** — not a pile of circles  
**Wireframe @48:**
```
   ┌───┐
   │ 3 │
  ╰─────╯
```
**DNA:** Digit ≥2 px stroke · max "99+" · slate body white numeral

---

### 11 — Offline Driver

**Read:** Same vehicle silhouette @ **40% opacity** · gray desaturate · **no glow**  
**Wireframe @48:**
```
  ┌───────┐  (dashed outer ring optional)
  │ ░░░░░ │
  └───────┘
```
**DNA:** Deprioritize without hiding — form preserved

---

### 12 — Searching

**Read:** Concentric **arc pulses** (logo orbit) — not radar sweep clipart  
**Wireframe @48:**
```
    ╭───╮
   ╭─────╮
    · core
```
**DNA:** 3-ring pulse 2.4 s · amplitude ≤15% · cyan only  
**vs old:** DriverOfferScreen heat blobs — generic

---

## Zoom test matrix (required before production)

| Zoom | px equiv | Pass criteria |
|------|----------|---------------|
| **16** | ~24 display | Type discriminable car vs motor vs passenger |
| **18** | ~28 display | Pickup vs destination distinct |
| **20** | ~32 display | Trust ring + offline fade readable |

Test surfaces: dark map `#0D1117` · light map `#E8ECF0` · satellite overlay.

---

## B5.2 / B6-5 failure analysis

| Failure | Cause | Studio fix |
|---------|-------|------------|
| Generic bird-feel on logo | Flat trace | F1–F3 restoration |
| Generic markers | Icon-template PNGs without orbit DNA | Arc foot + cyan core system |
| Wrong glow hue | `#22D3EE` in chrome | Lock `#00D4AA` |
| Passenger gender read | Legacy assets | Neutral silhouette + arc chassis |
| Pickup/destination | Ionicons | Unified pin family |

---

## Marker family wireframe board (ASCII)

```
PASSENGER   CAR         MOTOR       PICKUP      DEST
   ○       ┌───┐        ┌┐          ·          ┌▶
  /|\      │ ▲ │       ╱  ╲        ╱ ╲          │
  / \      └─┬─┘       ○  ○       └───┘         ▼

QUICK MATCH  TRUST       CLUSTER    OFFLINE    SEARCH
  ○ ○       ╭───╮       ┌───┐      ░░░░░      ╭───╮
   ╲╱       │CAR│       │ 3 │      ┌───┐     ╭─────╮
    ○       ╰───╯       ╰───╯      │ ░ │      ·
```

---

## Production freeze

| Action | Status |
|--------|--------|
| SVG masters in design-lab | ⏸ Spec only this sprint |
| Replace `frontend/assets/markers/` | ❌ Blocked |
| Touch `mapNavMarkers.ts` | ❌ Blocked |

---

**Next:** `07_VISUAL_ECOSYSTEM.md`
