# V7.2 — Navigation Language

**Team:** BRAVO  
**Scope:** Pickup/destination beacons · compass · ETA · distance · route · turn arrow · journey pulse  
**Parent:** V6 `04_NAVIGATION_SYSTEM.md` · B5.6 `06_NAVIGATION_JURY.md`

---

## 1. Design thesis

Navigation chrome and map markers must be **one visual language**. A pickup seen on DriverOffer field map must be **the same glyph** scaled on LiveMapView — zero translation cost at 90 km/h.

**Production today:** **Three languages** → composite nav **41/100 FAIL**.

---

## 2. Navigation family inventory (production)

| Element | Production | Spec (MEX Nav) | Match? |
|---------|------------|----------------|--------|
| **Pickup beacon** | `MapPickupPin`: cyan ring + Ionicons `navigate` | Diamond cap + stem = pickup marker ×1.25 | ❌ |
| **Field pickup (DriverOffer)** | Green/orange circles + Ionicons `navigate` | Same as pickup marker | ❌ |
| **Destination beacon** | `MapDestinationFlagPin`: pole + Ionicons `flag` | Pennant on meridian stem (MK-09) | ❌ |
| **Compass** | System map / none branded | Minimal N tick + meridian arc 90° | ❌ Not implemented |
| **ETA chip** | GlassSurface text in LiveMapView chrome | Rounded 8px slate bg · cyan secondary | ⚠️ Partial |
| **Distance chip** | Paired with ETA in journey chrome | Same chassis as ETA | ⚠️ Partial |
| **Route line (pickup leg)** | `#22D3EE` dim/bright/hot polylines | `#00D4AA` 4px + `#0D1117` 1px outline | ❌ |
| **Route line (dest leg)** | Same `#22D3EE` | Same MEX | ❌ |
| **Turn arrow (immersive nav)** | `DriverNavDirectionPointer` — cyan triangles | Chevron wedge matching car marker front | ❌ |
| **Journey pulse** | Static polyline | `pulse.journey` 480ms on match | ❌ |
| **Arrival beacon** | Destination flag static | Dest pennant + pulsing arc base 1.2s | ❌ |
| **Pickup lock flash** | None | `lock flash` 320ms on match | ❌ |
| **User location dot** | System blue (correct) | System blue — do not brand | ✅ |

**Evidence:** `LiveMapView.tsx` `pickupNavRouteStrokeColors` / `destinationNavRouteStrokeColors` · `DriverNavDirectionPointer` styles · `mapMarkerChrome.tsx`.

---

## 3. Route line analysis

### Production

| Property | Value | Source |
|----------|-------|--------|
| Primary stroke | `#22D3EE` | `pickupNavRouteStrokeColors` |
| Dim layer | `rgba(34, 211, 238, 0.28)` | Same |
| Hot highlight | `rgba(243, 248, 255, 0.92)` | Same |
| Width | ~4–6px (context-dependent) | Polyline components |
| Outline on satellite | **None** | MEX requires `#0D1117` 1px outer |
| Traffic | Level enum exists — color unchanged | Amber overlay spec unused on route |

### MEX target

| Property | Value |
|----------|-------|
| Stroke | `#00D4AA` 4px round cap |
| Outline | `#0D1117` 1px — readability on satellite |
| Journey pulse | 480ms opacity breathe on active leg |
| Forbidden | Dashed except reroute preview |

### Readability impact

| Condition | `#22D3EE` production | `#00D4AA` + outline |
|-----------|---------------------|---------------------|
| Dark map | Visible — glow-like | Visible — form-first |
| Satellite | Washes into water/sky tiles | Outline preserves edge |
| Sunlight 1000 nit | Glow competes with tile brightness | Stroke + outline wins (V6 T8 projected) |
| Deuteranopia | Hue-dependent | Form + dual-tone (V6 T7 projected) |

---

## 4. Turn arrow / driver pointer

### Production (`DriverNavDirectionPointer`)

| Property | Value |
|----------|-------|
| Size | 52px (`NAV_IMMERSIVE_POINTER_PX`) |
| Color stack | `#22D3EE` / `#5EEAD4` glow layers |
| Form | Triangle arrow + stem + core ring |
| Rotation | Route bearing + `DRIVER_NAV_ROTATION_OFFSET_DEG` 180° |
| DNA link | **None** to car wedge marker |

### Issues @ speed

| Speed | Problem |
|-------|---------|
| 90 km/h | Glow-only pointer — jury unreviewed vs DNA (B5.6 nav jury) |
| 50 km/h | Readable as "cyan arrow" — not LeylekTAG |
| 30 km/h | Acceptable generic nav |
| Standing | Fine for dev — fails brand gate |

### MEX target

- Chevron wedge **matching car marker front geometry**  
- `#F5F7FA` fill · `#00D4AA` edge · 120ms rotate  
- **No bounce** · no `#22D3EE`

---

## 5. ETA & distance chips

### Production (LiveMapView journey chrome)

| Aspect | Status |
|--------|--------|
| Typography | PremiumText / GlassSurface — journey theme tokens |
| Color | Journey theme accent — may track `#22D3EE` via driver theme |
| Layout | Bottom/top chrome — not standardized across DriverOffer vs LiveMap |
| Touch | Nav mode minimizes touch targets ✅ |
| Motion | `toast.rise` 200ms — **not verified in code** |

### MEX spec

| Role | Size | Weight | Color |
|------|------|--------|-------|
| ETA primary | 16sp | 600 | `#F5F7FA` |
| ETA secondary | 12 | 400 | `#00D4AA` |
| Distance | 14 | 500 | `#F5F7FA` |

**Gap:** Chips are **UI-branded** but disconnected from marker cyan token — same product, two glow systems.

---

## 6. Pickup vs destination beacon grammar

| Rule | Pickup | Destination |
|------|--------|-------------|
| **Must share** | Arc-foot chassis · stroke weight · anchor logic | Same |
| **Must differ** | Upward diamond / stem | Pennant flag on stem |
| **Instant read @0.4s** | "Meet here" | "End here" |
| **Production diff** | Circle + navigate icon | Pole + flag icon — **different component families** |
| **Discrimination @ z18** | Jury: **FAIL** when both are generic pins | MK-07 vs MK-09 lab passes |

**Critical:** DriverOffer field uses **orange vs green** Ionicons — color-only discrimination fails color-blind test (V6 T7 FAIL).

---

## 7. Compass & heading

| Production | Map rotates in nav mode · no branded compass rose |
|------------|---------------------------------------------------|
| MEX | Minimal N tick + meridian arc 90° · muted `#4B5563` · active `#00D4AA` |
| Priority | P2 — not blocking G2 if turn wedge + markers pass |

---

## 8. Journey pulse & match moments

| Event | Production motion | MEX |
|-------|-------------------|-----|
| Match confirmed | Static markers appear | Route `pulse.journey` 480ms |
| Pickup lock | None | Pickup beacon flash 320ms |
| QM lock | Sound only (`quick-match-driver-ops.wav`) | Map lock ring 480ms + sonic |
| Boarding | Marker swap passenger/driver | State transition doc needed |

**Charlie coupling:** Triad sync ±16ms (G3) requires nav pulse timing locked to marker states (`04_MARKER_STATE_SYSTEM.md`).

---

## 9. Unified family rules (recommended — pre-production)

Every nav element MUST share:

| Token | Value |
|-------|-------|
| `nav.stroke.primary` | 2px @48 reference |
| `nav.color.meridian` | `#00D4AA` only |
| `nav.color.edge` | `#F5F7FA` @85% on dark |
| `nav.color.slate` | `#1A2332` fill |
| `nav.glow.max` | 22% opacity — form carries readability |
| `nav.anchor.ground` | Foot of arc chassis on coordinate |
| `nav.motion.tierA` | Token-only springs — no ad-hoc |

**Pickup beacon = pickup marker ×1.25.**  
**Destination beacon = destination marker ×1.0.**  
**Turn wedge = car marker front extruded.**

---

## 10. Forbidden (carry forward)

- Generic Google green destination pin in driver nav  
- Ionicons arrows on **field** maps (B5.6 order: 30-day retire)  
- Red arrival zones  
- Bouncing turn arrows  
- `#22D3EE` on any new nav asset (grep gate G4-4)

---

## 11. Production readiness link

Navigation language **cannot be fixed by markers alone**. Bravo sprint must deliver:

1. MEX-M marker SVG family  
2. Matching pickup/dest beacon components (replace Ionicons)  
3. Route stroke token migration `#22D3EE` → `#00D4AA` + outline  
4. Driver pointer wedge redesign  
5. Single `mapMarkerChrome.tsx` token source

See `08_PRODUCTION_READINESS.md`.

---

**Navigation language analysis — COMPLETE**
