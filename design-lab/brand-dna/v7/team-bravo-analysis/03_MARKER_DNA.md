# V7.2 — Marker DNA

**Team:** BRAVO  
**Question:** How markers inherit Logo · Arc · Eye · Premium · Trust DNA **without becoming logos**  
**Sources:** Alpha `02_LOGO_DNA_LOCK.md` · `07_MARKER_GEOMETRY_CONSTITUTION.md` · V6 `03_MAP_SYSTEM.md` · `brand-studio/02_LOGO_GENOME.md` shared genom

---

## 1. Core rule

> Markers inherit **atoms** from the logo — not the stork silhouette.

Putting the bird on every pin = mascot map = **FORBIDDEN** (`03_MARKER_PRODUCTION_SPEC.md` §1).

---

## 2. DNA inheritance map

| Logo DNA | Marker atom | Must NOT |
|----------|-------------|----------|
| **Orbital arc** | Partial arc foot under entity · heading halo fragment · route curve language | Full 270° swoosh · closed badge |
| **Cyan eye** | Active-state dot r=1.5–3 @48 artboard · searching pulse core | Full stork head · cartoon eye |
| **Premium calm** | 2px min stroke · no bounce · controlled glow 12–22% | Heat blobs · comic outlines |
| **Trust (Warm Resolve)** | Outer ring `#C8E6D0` @20% on trusted entities | Separate trust icon family |
| **Depth / material** | `#1A2332` body · `#F5F7FA` 1–2px edge | Metallic PNG on map · 3D gradients |
| **Bottom mass (arc)** | Anchor weight at pin foot · thickest stroke at ground contact | Floating bubble markers |
| **Open gap (arc)** | Direction wedge on vehicle markers (forward intent) | Closed ring halos |

---

## 3. MEX-M universal chassis (target)

```
        ┌─ entity silhouette ─┐
        │    · eye (active)   │   ← optional state dot
        ╰─────────◡───────────╯   ← arc foot (logo DNA)
              ▲ anchor (ground)
```

| Token | Locked value |
|-------|--------------|
| Artboard | 48×48 px |
| Display | 28–34 px by type |
| Glow | `#00D4AA` @ 12–22% |
| Body | `#1A2332` + `#F5F7FA` 1px edge |
| Optical center | (24, 26) — slight down-shift |
| Anchor | Foot center of arc |

**Production gap:** Circular PNG badges with `#22D3EE` halo — **no arc foot**.

---

## 4. Atom-by-atom specification

### Arc DNA

| Logo (immutable) | Marker (derived) |
|------------------|------------------|
| Open swoosh ~270° | **Arc fragment** ~90–120° at entity base |
| Bottom mass thickest | Foot stroke 2–3px @48 |
| Gap top-right | Forward **wedge gap** on car marker nose |
| `#00D4AA` family | Same token — never `#22D3EE` |

**Pickup marker:** Arc-cap diamond (MK-07) — ring = logo arc fragment.  
**Route line:** Full arc metaphor as path — not second logo.

### Eye DNA

| Logo | Marker |
|------|--------|
| Single dot (292,166) r=5.5 @512 | r=1.5–3 @48 artboard on **active/searching** states |
| Non-expressive | Never sclera · never blink on map |
| Links bird to orbit | Same hue links entity to system "alive" |

**Idle passenger:** Eye optional @32px.  
**Searching driver field:** MK-19 orbit rings **centered on eye atom**, not bird.

### Premium DNA

| Logo premium read | Marker premium read |
|-------------------|---------------------|
| Jewelry / instrument @ hero | **Instrument at speed** — Mercedes dashboard, not sticker |
| Metallic raster | Flat slate + edge stroke |
| Calm | Pulse ≤2s opacity — no bounce |

**Production fail:** Glow does premium's job — geometry too weak (B5.6 "ClipArt").

### Trust DNA

| Token | Application |
|-------|-------------|
| `#C8E6D0` Warm Resolve | Outer ring @20% on trusted driver overlay |
| Not on every marker | Trust **state** only — MK-15 |
| Map-native | Ring on **driver entity**, not separate chip-only |

**Production:** TrustedAddButton chip — trust DNA in UI layer only.

---

## 5. Type-specific DNA binding

| Marker type | Primary DNA | Secondary | Forbidden |
|-------------|-------------|-----------|-----------|
| Passenger | Arc foot + neutral silhouette | Eye dot when searching | Gendered body |
| Driver car | Wedge + arc foot + width | Eye when active offer | Taxi light · badge |
| Driver motor | Narrow frame + arc foot | Dual wheel stroke | Rider on seat |
| Pickup | Arc ring + stem | Lock pulse once | Teardrop Google pin |
| Destination | Pennant + arc base ring | Static | Balloon pin |
| Journey | Route cyan + arrowhead | Pulse on polyline | Second bird |
| Quick Match | Dual node + center lock | Sonic sync | Full logo |
| Trusted | Warm ring overlay | On car/motor/passenger | Shield icon |
| Offline | 40% opacity + dashed arc | Same silhouette | Hide entity |
| Searching | Orbit pulse (MK-19) | 3 rings max | Red heat blob |
| Cluster | Arc base + count | Integer stroke ≥2px | Amazon badge |

---

## 6. Shared marker language (all types)

**YES — every marker MUST share:**

| Property | Spec | Production |
|----------|------|------------|
| **Artboard** | 48×48 export grid | PNGs vary — circular badges |
| **Stroke min @48** | 2px | ~1px effective on motor windows |
| **Glow max** | 22% `#00D4AA` | `#22D3EE` 12–45% — wrong hue |
| **Anchor** | Arc foot on coordinate | Mixed `{0.5,1}` vs `{0.5,0.54}` |
| **Optical center** | (24, 26) down-shift | Not applied |
| **Elevation** | Flat marker + optional 1px shadow | Android elevation on Ionicons flags |
| **Collision spacing** | Min 44dp tap — separate from glyph | zIndex stacks only |
| **Safe area** | Entity inside 44×44 live zone | Circle badge fills frame |
| **Animation** | State-specific — not universal bounce | DriverOffer pulse on Ionicons only |

**NO — must NOT share across types:**

| Property | Why |
|----------|-----|
| Same silhouette | Car ≠ passenger |
| Same size | Motor 30 · car 34 · passenger 32 — intentional |
| Same color only | Form discriminates at speed — color is backup |

---

## 7. Logo → marker translation examples

| Logo element | Correct marker use | Incorrect use |
|--------------|-------------------|---------------|
| Stork beak | **Nothing** — direction via car wedge | Mini beak on pin |
| Orbital arc | Foot + route | Full stork-in-ring |
| Eye dot | Active core | Mascot face |
| Silver body | Slate fill | Chrome PNG marker |
| One-leg pose | **Nothing** on vehicle pins | Stork on car |

---

## 8. B5.5 sketch → DNA mapping

| Finalist | DNA emphasis |
|----------|--------------|
| **MC-1** Vehicle | Wedge width ratio · arc foot |
| **MC-2** Field | Pickup diamond vs dest pennant · arc foot |
| **MC-3** State | MK-19 orbit = arc DNA · MK-15 trust ring |

Production PNGs do not implement MC chassis.

---

## 9. Validation gates (pre-export)

| Gate | Test |
|------|------|
| G2-1 | z16 car vs motor 90% @0.4s |
| G2-2 | z18 pickup vs dest 90% |
| G4-4 | grep: no `#22D3EE` in marker/nav paths |
| Blink | "LeylekTAG map" not "Uber glow map" |
| Logo test | No stork silhouette @ any marker tier |

---

## 10. Amendment authority

Marker DNA amendments require:

1. Alpha cyan token lock (`#00D4AA`)  
2. Logo DNA lock unchanged (Team Alpha)  
3. G2 device video proof  
4. Update `07_MARKER_GEOMETRY_CONSTITUTION v2`

---

**Marker DNA analysis — COMPLETE**
