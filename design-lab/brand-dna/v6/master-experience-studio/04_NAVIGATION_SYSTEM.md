# V7 — Navigation System (MEX Nav)

**Codename:** Meridian Guidance  
**Parent:** `09_PRODUCT_LANGUAGE.md`  
**Rule:** Every nav element = **one visual language** with map markers

---

## Components

| Element | Form | Color | Motion |
|---------|------|-------|--------|
| **Turn arrow** | Chevron wedge — matches car marker front | `#F5F7FA` fill · `#00D4AA` edge | Rotate with heading · 120ms |
| **Compass** | Minimal N tick + meridian arc 90° | Muted `#4B5563` · active `#00D4AA` | None — stability |
| **Route line** | 4px meridian cyan | `#00D4AA` | pulse.journey on match |
| **Arrival beacon** | Destination pennant + pulsing arc base | Same as dest marker | breathe 1.2s |
| **Pickup beacon** | Diamond cap + stem | Same as pickup marker | lock flash 320ms |
| **Destination beacon** | Pennant | Same as dest marker | static |
| **ETA chip** | Rounded 8px · slate bg · cyan text | `#121820` · `#00D4AA` | toast.rise 200ms |
| **Distance chip** | Same chassis · white primary text | Paired with ETA | sync update |

---

## Typography (nav chrome)

| Role | Size | Weight | Color |
|------|------|--------|-------|
| ETA primary | 16sp/pt | 600 | `#F5F7FA` |
| ETA secondary | 12 | 400 | `#00D4AA` |
| Distance | 14 | 500 | `#F5F7FA` |
| Nav instruction | 15 | 500 | `#F5F7FA` |

---

## Driver @ speed layout

```
┌─────────────────────────────┐
│  [Turn wedge]  200m  → Sağa │  ← top bar · high contrast
├─────────────────────────────┤
│                             │
│         MAP + ROUTE         │
│                             │
├─────────────────────────────┤
│  ETA 8 dk    ·    4.2 km    │  ← chips · 48pt min touch nowhere here
└─────────────────────────────┘
```

**Car dashboard mock:** `mockups/car-dashboard-concept.svg`  
Route **6px** on large displays · marker **1.5×** scale.

---

## Forbidden

- Generic Google Maps green destination pin in **driver nav**  
- Ionicons arrows  
- Red arrival zones (use cyan + amber error only)  
- Bouncing turn arrows  

---

## Alignment with markers

Pickup beacon **=** pickup marker scaled 1.25× at coordinate.  
Zero translation between "field picker" and "live map" — **one SVG genom**.

---

## Target score

| Composite nav lane | **97** (designed) |

---

**Mockups:** `journey-screen.svg` · `car-dashboard-concept.svg`
