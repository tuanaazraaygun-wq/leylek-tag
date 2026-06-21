# 07 — Marker Geometry Constitution

**Version:** Marker Geometry v1.0 — **FROZEN**  
**Sprint:** B5.2 — Brand Geometry Freeze  
**Status:** Design-lab constitution  
**Parent logo:** `06_LOGO_GEOMETRY_CONSTITUTION.md`  
**Master reference:** `frontend/assets/images/leylek-logo-premium.png` (DNA source — markers are **not** mini logos)

---

## 0. Authority

Markers inherit **shared geometry tokens** from logo constitution — stroke, radius, cyan accent, arc fragment language. They do **not** reproduce the stork silhouette on the map.

| Rule | Detail |
|------|--------|
| Canvas | 48 × 48 px artboard (all types) |
| Grid | 4 px base (logo grid / 2) |
| DNA link | Arc stroke + cyan dot + Depth Slate core |
| Forbidden | Gendered human, taxi, luxury car, Google pin, new visual language |

---

## 1. Shared marker canvas

| Token | Value | Locked |
|-------|-------|--------|
| `marker.canvas` | 48 × 48 px | ✅ |
| `marker.grid` | 4 px | ✅ |
| `marker.opticalCenter` | (24, 26) — slight down-shift for map anchor | ✅ |
| `marker.coreRadius` | 11–14 px (type-dependent) | ✅ |
| `marker.haloRadius` | 18–20 px @ 14–22% opacity | ✅ |

---

## 2. Type specifications (12 locked)

### 2.1 Passenger — `marker-01-passenger.svg`

| Property | Locked geometry |
|----------|-----------------|
| ID | `marker.passenger` |
| Silhouette | Gender-neutral: circle head r=3.5 + vertical torso line + two leg lines |
| Head center | (24, 18) |
| Torso | (24, 21) → (24, 29) |
| Legs | (20, 32)→(20, 37), (28, 32)→(28, 37) |
| Core accent | Cyan dot r=1.5 @ (24, 26) — logo eye echo |
| Anchor (map) | Bottom-center (24, 48) — feet on coordinate |
| Display px | 32 |
| Forbidden | Dress, hair, hips, chest curve, gendered proportions |

### 2.2 Driver Car — `marker-02-driver-car.svg`

| Property | Locked geometry |
|----------|-----------------|
| ID | `marker.driver.car` |
| Silhouette | Top-down rectangle body 28×12 px + 4 wheel circles r=3 |
| Body | x=10–38, y=16–28, rx=4 |
| Wheels | (14, 34), (34, 34) |
| Rotation | Heading-aligned (flat marker) |
| Anchor | `{0.5, 0.54}` |
| Display px | 34 |
| Forbidden | Taxi light, luxury grille, brand badge, 3D perspective |

### 2.3 Driver Motor — `marker-03-driver-motorcycle.svg`

| Property | Locked geometry |
|----------|-----------------|
| ID | `marker.driver.motor` |
| Silhouette | Ellipse body 20×10 + two wheel circles r=4 |
| Body center | (24, 22) |
| Wheels | (14, 30), (34, 30) |
| Anchor | `{0.5, 0.53}` |
| Display px | 30 |
| Forbidden | Sport bike fairing, rider silhouette on seat |

### 2.4 Pickup — `marker-08-pickup.svg`

| Property | Locked geometry |
|----------|-----------------|
| ID | `marker.pickup` |
| Form | Concentric ring r=10 + center dot r=4 + stem line to ground |
| Ring center | (24, 22) |
| Ground dot | (24, 40) r=2 |
| Anchor | Ground dot |
| DNA | Ring = logo arc fragment (partial circle) |

### 2.5 Destination — `marker-07-destination.svg`

| Property | Locked geometry |
|----------|-----------------|
| ID | `marker.destination` |
| Form | Flag pole + triangular flag — **not** teardrop pin |
| Pole | (24, 14) → (24, 38) |
| Flag | Triangle apex (24, 10), base (34, 16) |
| Ground ring | (24, 38) r=4 |
| Anchor | Pole base |
| Forbidden | Google Maps pin, balloon pin |

### 2.6 Journey Active — `marker-09-journey-active.svg`

| Property | Locked geometry |
|----------|-----------------|
| ID | `marker.journey.active` |
| Form | Path curve + pulse center dot |
| Path | Cubic arc lower hemisphere |
| Center pulse | r=6 core + r=2.5 cyan dot |
| Use | Map chrome overlay — complements polyline |

### 2.7 Trust Network — `marker-06-trust-network.svg`

| Property | Locked geometry |
|----------|-----------------|
| ID | `marker.trust.network` |
| Form | 3 nodes (r=4) linked triangle + center cyan dot |
| Nodes | (24, 14), (34, 28), (14, 28) |
| Overlay color | `#C8E6D0` Warm Resolve stroke |
| DNA | Network = trust topology, not badge |

### 2.8 Trusted Driver — `marker-05-trusted-driver.svg`

| Property | Locked geometry |
|----------|-----------------|
| ID | `marker.trust.driver` |
| Form | Car body (simplified) + outer Warm Resolve ring r=21 |
| Ring stroke | 2.5 px @ 70% opacity |
| Chevron | Small trust indicator above car |
| Use | Overlay on driver car marker |

### 2.9 Quick Match — `marker-04-quick-match.svg`

| Property | Locked geometry |
|----------|-----------------|
| ID | `marker.quickmatch` |
| Form | **Logo arc fragment** inside core circle |
| Arc path | Same curve family as `layer.orbitalArc` — scaled to 48 canvas |
| Center dot | r=2.5 cyan |
| Forbidden | Lightning bolt, taxi dispatch, generic relay icon |

### 2.10 Cluster — `marker-10-cluster.svg`

| Property | Locked geometry |
|----------|-----------------|
| ID | `marker.cluster` |
| Form | Two overlapping circles r=10 + count label |
| Offset | (20, 22) and (30, 26) |
| Label | "3+" max — system font 11 px |
| Performance | Single sprite PNG in production |

### 2.11 Offline Driver — `marker-11-offline-driver.svg`

| Property | Locked geometry |
|----------|-----------------|
| ID | `marker.driver.offline` |
| Form | Desaturated car (45% opacity) + diagonal strike |
| Strike | (10, 12) → (38, 36), 2 px `#94A3B8` |
| Forbidden | Red X, skull, power-off icon |

### 2.12 Searching Pulse — `marker-12-searching-pulse.svg`

| Property | Locked geometry |
|----------|-----------------|
| ID | `marker.searching` |
| Form | 3 concentric rings r=18/13/8 + solid center r=4 |
| Ring opacity | 0.35 / 0.55 / 0.85 |
| Animation spec | Scale opacity pulse 2s — static in PNG export |
| DNA | Ripple = logo arc radial echo |

---

## 3. Anchor matrix (production)

| Marker | Anchor X | Anchor Y | Rotation |
|--------|----------|----------|----------|
| Passenger | 0.5 | 1.0 | none |
| Driver car | 0.5 | 0.54 | heading |
| Driver motor | 0.5 | 0.53 | heading |
| Pickup | 0.5 | 1.0 | none |
| Destination | 0.5 | 0.95 | none |
| Journey | 0.5 | 0.5 | none |
| Trust network | 0.5 | 0.5 | none |
| Trusted driver | 0.5 | 0.54 | heading |
| Quick match | 0.5 | 0.5 | none |
| Cluster | 0.5 | 0.5 | none |
| Offline | 0.5 | 0.54 | heading |
| Searching | 0.5 | 0.5 | none |

---

## 4. Zoom readability (locked)

| Zoom | Min display px | Rule |
|------|----------------|------|
| ≤14 | 24 | Halo reduced −30%; stroke min 1.5 px |
| 15–17 | 32–34 | Production default |
| ≥18 | 48 | Full artboard detail |

---

## 5. Theme adjustments (locked deltas)

| Theme | Stroke | Glow | Core fill |
|-------|--------|------|-----------|
| Dark map | 2 px | 18% cyan | `#1A2332` |
| White map | 2.5 px | 12% cyan | `#1A2332` |
| Offline | 2 px | 0% | 45% desaturate |

---

## 6. File registry (frozen)

| File | Type ID |
|------|---------|
| `markers/marker-01-passenger.svg` | passenger |
| `markers/marker-02-driver-car.svg` | driver-car |
| `markers/marker-03-driver-motorcycle.svg` | driver-motor |
| `markers/marker-04-quick-match.svg` | quick-match |
| `markers/marker-05-trusted-driver.svg` | trusted-driver |
| `markers/marker-06-trust-network.svg` | trust-network |
| `markers/marker-07-destination.svg` | destination |
| `markers/marker-08-pickup.svg` | pickup |
| `markers/marker-09-journey-active.svg` | journey-active |
| `markers/marker-10-cluster.svg` | cluster |
| `markers/marker-11-offline-driver.svg` | offline-driver |
| `markers/marker-12-searching-pulse.svg` | searching-pulse |

---

## 7. Amendment log

| Version | Date | Change |
|---------|------|--------|
| v1.0 FROZEN | 2026-06-21 | B5.2 — 12-type geometry lock |

---

**Parent:** `06_LOGO_GEOMETRY_CONSTITUTION.md`, `03_MARKER_PRODUCTION_SPEC.md`  
**Next:** `08_SHARED_ICON_SYSTEM.md`
