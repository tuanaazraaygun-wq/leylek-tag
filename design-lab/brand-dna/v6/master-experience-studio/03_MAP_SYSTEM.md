# V7 — Map System (MEX Map)

**Codename:** Meridian Map Instrument  
**Parent:** `09_PRODUCT_LANGUAGE.md`  
**Replaces:** Dual PNG/Ionicons dialect · B5.6 FAIL (43/100)

---

## Design thesis

The map is LeylekTAG's **primary brand stage**. Users spend more time here than on splash or login. Markers must read as **instruments at 90 km/h in 0.4s** — not stickers.

---

## Universal marker chassis (MEX-M)

Every map entity shares:

```
        ┌─ entity silhouette ─┐
        │    · eye (active)   │
        ╰─────────◡───────────╯   ← arc foot (logo DNA)
              ▲ anchor
```

| Token | Value |
|-------|-------|
| Artboard | 48×48 |
| Display | 28–34px by type |
| Glow | `#00D4AA` @ 12–22% — **never** `#22D3EE` |
| Body | `#1A2332` + `#F5F7FA` 1px edge |
| Anchor | Foot center of arc |
| Motion idle | `waiting.breathe` 2s opacity 0.85↔1 |

---

## Entity specifications

| Type | Silhouette | z16 discriminator | Motion |
|------|------------|-------------------|--------|
| **Passenger** | Neutral stand, no gender | Head dot + shoulders | breathe |
| **Driver car** | Wide wedge top-down | Width ≥1.35× motor | heading rotate 120ms |
| **Motorcycle** | Narrow + dual wheel stroke | Aspect ratio <0.75 car | same |
| **Pickup** | Arc-cap diamond stem | Upward point vs dest flag | lock pulse once |
| **Destination** | Pennant on meridian stem | Flag vs pickup diamond | static |
| **Journey active** | Route polyline + arrowhead | Cyan 4px path | pulse.journey 480ms |
| **Cluster** | Arc base + count | Integer ≥2px stroke | none |
| **Quick Match** | Dual node + center lock ring | Two dots + ring | QM sonic sync |
| **Trusted** | Entity + warm outer ring `#C8E6D0` @20% | Double ring | none |
| **Offline** | Same silhouette @40% + dashed ring | Fade not hide | none |
| **Searching** | MK-19 orbit pulse 3 rings | Concentric arc | 2.4s loop |

---

## Traffic & overlays

| Layer | Spec |
|-------|------|
| Route line | `#00D4AA` 4px · round cap · no dashed except reroute preview |
| Route outline | `#0D1117` 1px outer — readability on satellite |
| Traffic amber | `#FFB020` @25% overlay — **never** on markers |
| Heat (driver seeking) | Orbit pulse only — **no** red blob |
| User location | System blue dot **unchanged** — do not brand |

---

## Map themes

| Theme | Map bg | Marker edge | Glow max |
|-------|--------|-------------|----------|
| Night (default) | `#0D1117` chrome | Trust white 85% | 22% |
| Day | `#E8ECF0` tiles | Depth slate 100% | 15% |
| Satellite | Auto + outline stroke | +1px dark halo | 18% |

---

## Quick Match on map (resolved)

**V7 decision:** QM appears as **ephemeral lock ring** between passenger and matched driver for 480ms — then collapses to standard entity markers. **Must exist on map** — B5.6 FAIL closed.

---

## Production gap vs V7

| Item | Production | V7 MEX |
|------|------------|--------|
| Glow hue | `#22D3EE` | `#00D4AA` |
| Field pins | Ionicons | MEX family |
| QM map | Missing | Lock ring |
| Searching | Heat blob | Orbit pulse |
| z16 proof | None | Mandatory video |

---

## Target score (when implemented)

| Dimension | Target |
|-----------|--------|
| Map visibility @ speed | 98 |
| Brand uniqueness | 96 |
| **Composite map lane** | **96** |

---

**Mockup:** `mockups/google-maps-journey.svg`
