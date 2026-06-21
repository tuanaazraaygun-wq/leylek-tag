# Marker 10 — Cluster Marker Analysis

**Sprint:** B-2 | **Type:** **Not implemented** | **System:** DNA spec only

---

## Mevcut durum

React Native Maps **clustering implementasyonu yok**. `Marker` per entity; DriverOfferScreen zoom LOD filters pins (`selectField*ForZoom`) — **density management**, not visual cluster badge.

Website marketing maps: multiple district markers — no count badge cluster.

MARKER_DNA §4.7: 3+ markers same 48 px cell → count badge + merged glow.

---

## Production kullanımı

| Mekanizma | Davranış |
|-----------|----------|
| `selectFieldSeekingPinsForZoom` | far band → hide; mid → listed only |
| `selectFieldLightPinsForZoom` | cap count mid zoom |
| `selectFieldHeatCellsForZoom` | cap heat cells near zoom |
| `WAIT_MAP_MAX_DRIVER_MARKERS` | slice nearby drivers |

**Functional clustering** without cluster glyph.

---

## Mevcut dosyalar

- Zoom band logic `DriverOfferScreen.tsx`
- No cluster asset

---

## Eksikler

| ID | Eksik |
|----|-------|
| CLU-01 | Visual cluster marker — **100% gap** |
| CLU-02 | Tap expand stagger 40 ms |
| CLU-03 | Dominant state color (offer > idle) |

---

## Okunabilirlik (hedef)

Cluster badge @ 24 px min — count digit legible. Merged glow max 0.4 opacity.

---

## Premium / dark / white / a11y

Badge: Depth Slate disk + Trust White count + Meridian edge. a11y: "5 yolcu talebi, genişlet".

---

## Motion / DNA

`cluster expand` scale 1→1.08 — LSX premium stop. Logo DNA: merged glow = shared orbital arc segment.

---

## Production riski

| Risk | Note |
|------|------|
| react-native-maps-clustering lib | New dependency |
| tracksViewChanges storm | Expand animation perf |
| Ankara dense urban | P0 need |

---

## Migration planı

1. B-4: Cluster spec + badge SVG design-lab.
2. B-7: Evaluate `react-native-map-clustering` or custom Marker.
3. Pilot: DriverOfferScreen seeking pins only.
4. Rollout: PassengerWaiting nearby drivers.

---

## Rollback

Feature flag off → current LOD filter.

---

## QA kriterleri

- [ ] 3 pins → 1 cluster @ zoom 15
- [ ] Expand tap reveals all
- [ ] Offer state dominant color
- [ ] Dense Ankara sim 50+ pins
