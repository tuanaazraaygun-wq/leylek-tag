# Marker Performance Analysis

**Sprint:** B-2 — Marker Evolution  
**Mode:** Read-only  
**Date:** 2026-06-21

---

## Executive summary

Production marker perf **bitmap PNG + RN View hierarchy** ağırlıklı. `tracksViewChanges` Android'de kritik — sürekli true driver pulse marker'da GPU/CPU yükü. Heat seeking markers use `tracksViewChanges={false}` — iyi. Cluster future en büyük render riski.

---

## Bitmap vs vector

| Approach | Mevcut | Pros | Cons |
|----------|--------|------|------|
| **PNG @1x** | `assets/markers/*.png` | Hızlı draw, tutarlı | Multi-DPI ladder gerekir |
| **SVG → PNG export** | design-lab hedef | Logo genom scale | Export pipeline |
| **Inline View/Ionicons** | DriverOfferScreen | No asset | Her marker View tree |
| **Leaflet divIcon HTML** | Website | CSS animate | DOM count |

**Öneri:** Mobile SSOT = PNG ladder 24/32/48 @1x @2x @3x from single SVG master (logo evolution shared pipeline).

---

## Memory

| Kaynak | Tahmin |
|--------|--------|
| 3 PNG requires bundled | ~3×50KB = 150KB bundle |
| MapEntityMarkerImage glow View | +2 Views per marker |
| 30 seeking markers | 30× View — **~90 subviews** field map |
| City heat 20 cells animated | 20× Animated loop |

**Risk:** PassengerWaiting `WAIT_MAP_MAX_DRIVER_MARKERS` × marker views — monitor heap on low-RAM Android.

---

## Render

| Pattern | Dosya | Perf note |
|---------|-------|-----------|
| `tracksViewChanges={false}` | heat, seeking, light | ✅ Good |
| `tracksViewChanges` true pulse | driver self marker | ⚠️ Continuous re-render |
| `tracksViewChanges` pinTracks timed | LiveMapView PNG | ✅ Pattern documented |
| `collapsable={false}` | Android fix | Required — small cost |

LiveMapView comment: sürekli true → PNG kaybolur OR perf hit — timed toggle essential.

---

## Animation

| Animation | Driver | Cost |
|-----------|--------|------|
| CityHeatCellMarker pulse | JS Animated loop | Medium — limit cell count ✅ |
| Driver pulse rings | JS Animated continuous | High — single marker OK |
| LSX breathe target | opacity loop | Low if native driver |
| Lottie marker overlay | Future | GPU — cache layers |

**Rule:** Max 15 simultaneous animated markers on screen (proposed B-4 perf budget).

---

## GPU

- Shadow/elevation on MapPickupPin, flag pin — GPU compositing.
- Many shadows × 30 markers = overdraw — prefer single glow layer spec.
- Heat disk blur — minimal.

---

## tracksViewChanges stratejisi (mevcut best practice)

```
Mount → tracksViewChanges true (300–800ms) → false
Exception: actively animating driver self marker
```

Evolution exports should not require permanent true.

---

## Cluster perf (future)

| Approach | Perf |
|----------|------|
| Native clustering lib | Better — fewer Markers |
| Custom super-marker | 1 View + count |
| No cluster + 100 Markers | **Bad** — Ankara fail |

---

## Website Leaflet

CSS pulse animations on `.leylek-marker-pulse` — low count marketing markers OK.

---

## Production riski

| Risk | Mitigation |
|------|------------|
| Asset swap larger PNG | WebP or optimized PNG |
| Animated overlay storm | Perf budget 15 |
| Cluster expand stagger | Cap expand count |

---

## Migration perf checklist

- [ ] PNG file size < 15KB each @3x
- [ ] tracksViewChanges policy doc enforced
- [ ] Seeking marker count benchmark 50 pins
- [ ] Memory profile PassengerWaiting + field map
- [ ] No Lottie on all idle markers

---

**İlişkili:** `MAP_BEHAVIOR_ANALYSIS.md`, `MARKER_QA_PLAN.md`
