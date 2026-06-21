# 03 — Marker Production Spec

**Sprint:** B5 — Brand Identity Production  
**Status:** Design-lab spec + 12 SVG markers  
**Parent:** `MARKER_DNA.md`, `marker-evolution/markers/MARKER_*.md`

---

## 1. Marker philosophy

Harita marker'ları LeylekTAG'ın **harita yüzündeki canlı imzasıdır** — logo değil, logo ile **aynı genom**.

| İlke | Spec |
|------|------|
| Canlı ama sakin | Pulse ≤2s; agresif bounce yok |
| Premium minimal | Tek siluet + kontrollü glow |
| Güven | Net form; belirsiz blob yok |
| Aile | 12 tür aynı DNA |
| Logo relation | Shared stroke/radius/color — **not** mini logo |
| Değil | Taksi, pin, kadın/erkek siluet, lüks araç, oyun power-up |

**North Star:** "Bu LeylekTAG haritası" — Uber pin veya Google nokta değil.

---

## 2. Shared genom (all markers)

### 2.1 Canvas

| Property | Value |
|----------|-------|
| Artboard | 48 × 48 px |
| Anchor default | Center (24, 24) |
| Entity anchor | Bottom-center (24, 48) for passenger |
| Grid | 4 px |

### 2.2 Color

| Role | Hex | Usage |
|------|-----|-------|
| Core fill | `#1A2332` | Depth Slate body |
| Edge stroke | `#F5F7FA` | Trust White @ 2px |
| Active glow halo | `#00D4AA` | 15–22% opacity circle |
| Trust overlay | `#C8E6D0` | Warm Resolve ring |
| Offline | `#94A3B8` | 45% opacity + strike |
| Error (rare) | `#FFB020` | Amber max 25% — not default |

### 2.3 Form language

| Rule | Value |
|------|-------|
| Corner radius | 2–4 px |
| Min stroke @48 | 2 px |
| Max inner detail | 1 helper shape |
| Face / plate / text | **Forbidden** on map marker |
| Glow | Optional outer circle — not CSS blur in SVG |

### 2.4 Theme compatibility

| Theme | Adjustment |
|-------|------------|
| Dark map (default) | Standard genom |
| White theme map | Increase edge stroke to 2.5px; glow opacity −30% |
| Reduce motion | Static marker; pulse animation off |

---

## 3. Marker types (12)

### 3.1 Passenger — `marker-01-passenger.svg`

| Property | Spec |
|----------|------|
| Siluet | Gender-neutral: round head + rectangular torso + two legs |
| Forbidden | Hair, dress, beard, chest curve, hip emphasis |
| Anchor | Bottom-center (feet) |
| Display px | 32 (production default) |
| Replaces | `passenger-woman.png` |
| Pulse | `waiting.breathe` 2s when searching |

### 3.2 Driver car — `marker-02-driver-car.svg`

| Property | Spec |
|----------|------|
| Siluet | Top-down simple sedan — rectangle body, 4 wheels |
| Forbidden | Luxury grille, taxi light, brand badge |
| Rotation | Heading-aligned (flat marker) |
| Display px | 34 |
| Anchor | `{0.5, 0.54}` (production) |
| Replaces | `driver-car.png` |

### 3.3 Driver motorcycle — `marker-03-driver-motorcycle.svg`

| Property | Spec |
|----------|------|
| Siluet | Two wheels + narrow body |
| Display px | 30 |
| Anchor | `{0.5, 0.53}` |
| Replaces | `driver-motor.png` |

### 3.4 Quick Match — `marker-04-quick-match.svg`

| Property | Spec |
|----------|------|
| Visual | Relay arc + center dot |
| Trigger | QM invite active on map |
| Production today | UI banner only — **new map marker** |
| Sonic link | `notifyQuickMatchDriverOpsSoundFromInvite` |

### 3.5 Trusted Driver — `marker-05-trusted-driver.svg`

| Property | Spec |
|----------|------|
| Visual | Car silhouette + Warm Resolve outer ring + chevron |
| Overlay | On existing driver marker — not separate entity |
| Trigger | Trust relationship active |

### 3.6 Trust Network — `marker-06-trust-network.svg`

| Property | Spec |
|----------|------|
| Visual | Three linked nodes (triangle) |
| Use | Hub / network map mode — not trip entity |
| Production today | List UI only |

### 3.7 Destination — `marker-07-destination.svg`

| Property | Spec |
|----------|------|
| Visual | Flag on pole + ground ring — **not teardrop pin** |
| Anchor | Pole base |
| Replaces | `MapDestinationFlagPin` chrome |

### 3.8 Pickup — `marker-08-pickup.svg`

| Property | Spec |
|----------|------|
| Visual | Concentric ring + center dot + stem |
| Anchor | Ground dot |
| Replaces | `MapPickupPin` + green circles in OfferMapScreen |

### 3.9 Active Journey — `marker-09-journey-active.svg`

| Property | Spec |
|----------|------|
| Visual | Path curve + pulse center |
| Use | Journey in-progress indicator on map chrome |
| Complements | Polyline + `DriverNavDirectionPointer` |

### 3.10 Cluster — `marker-10-cluster.svg`

| Property | Spec |
|----------|------|
| Visual | Overlapping circles + count ("3+") |
| Production today | Not implemented — DNA ready |
| Performance | Single PNG @48; no per-entity render |

### 3.11 Offline driver — `marker-11-offline-driver.svg`

| Property | Spec |
|----------|------|
| Visual | Desaturated car + diagonal strike |
| Opacity | 45% |
| Production today | API go-offline — no map marker |

### 3.12 Searching pulse — `marker-12-searching-pulse.svg`

| Property | Spec |
|----------|------|
| Visual | Concentric rings (3) + solid center |
| Animation | Scale opacity 0.35→0.85→0.35 @ 2s |
| Replaces | DriverOfferScreen seeking/light/heat View markers |
| Unify | System A + B → single genom |

---

## 4. Zoom readability matrix

| Zoom level | px display | Requirement |
|------------|------------|-------------|
| Low (≤14) | 24–32 | Silhouette readable; glow reduced |
| Medium (15–17) | 32–40 | Full genom |
| High (≥18) | 40–48 | Premium detail; no new inner lines |

---

## 5. Performance rules

| Rule | Spec |
|------|------|
| Format | PNG @1x/2x/3x from SVG — no runtime SVG on map |
| Max marker PNG size | 4 KB @48px target |
| Cluster | One sprite — not N entities |
| `tracksViewChanges` | Minimize — static PNG preferred |
| Glow | Baked into PNG — not live shadow |

Reference: `marker-evolution/PERFORMANCE_ANALYSIS.md`

---

## 6. Logo vs marker boundary

| Logo | Marker |
|------|--------|
| Full stork + arc | Abstract entity silhouettes |
| Brand mark | Operational map icon |
| App icon / splash | LiveMap / offer map |
| Meridian cyan accent dot | Shared color only |

**Forbidden:** Shrink full leylek logo as map pin.

---

## 7. Production file mapping (future migration)

| B5 SVG | Production target |
|--------|-------------------|
| `marker-01-passenger.svg` | `frontend/assets/markers/passenger-neutral.png` |
| `marker-02-driver-car.svg` | `frontend/assets/markers/driver-car.png` |
| `marker-03-driver-motorcycle.svg` | `frontend/assets/markers/driver-motor.png` |
| `marker-07-destination.svg` | `mapMarkerChrome` destination export |
| `marker-08-pickup.svg` | `mapMarkerChrome` pickup export |
| Others | New assets + `mapNavMarkers.ts` entries |

Rename `passenger-woman.png` → `passenger-neutral.png` on migration.

---

## 8. QA gates

| ID | Test |
|----|------|
| MRK-Q-01 | Passenger — no gender read @32px |
| MRK-Q-02 | Car — not taxi, not luxury |
| MRK-Q-03 | No generic Google pin shape |
| MRK-Q-04 | Dark + white theme contrast |
| MRK-Q-05 | 24px min readable |
| MRK-Q-06 | Distinct passenger vs driver @ glance |
| MRK-Q-07 | Same DNA family — stroke/color match logo spec |
| MRK-Q-08 | Performance ≤4KB @48px PNG |

---

## 9. B5 deliverables

| # | File | Status |
|---|------|--------|
| 1 | `markers/marker-01-passenger.svg` | ✅ |
| 2 | `markers/marker-02-driver-car.svg` | ✅ |
| 3 | `markers/marker-03-driver-motorcycle.svg` | ✅ |
| 4 | `markers/marker-04-quick-match.svg` | ✅ |
| 5 | `markers/marker-05-trusted-driver.svg` | ✅ |
| 6 | `markers/marker-06-trust-network.svg` | ✅ |
| 7 | `markers/marker-07-destination.svg` | ✅ |
| 8 | `markers/marker-08-pickup.svg` | ✅ |
| 9 | `markers/marker-09-journey-active.svg` | ✅ |
| 10 | `markers/marker-10-cluster.svg` | ✅ |
| 11 | `markers/marker-11-offline-driver.svg` | ✅ |
| 12 | `markers/marker-12-searching-pulse.svg` | ✅ |

---

**Parent:** `02_LOGO_EVOLUTION_PRODUCTION_SPEC.md`  
**Next:** `04_BRAND_IDENTITY_QA_REPORT.md`
