# Marker 12 — Searching Animation Marker Analysis

**Sprint:** B-2 | **Type:** Field map animated Views | **System:** B

---

## Mevcut durum

Driver field map (`DriverOfferScreen`) **arama animasyonu** üç katman:

| Katman | Görsel | Key styles |
|--------|--------|------------|
| **Seeking active** (listed) | 36 px yeşil kare `#059669` + navigate icon | `passengerMarkerSeekingActive` |
| **Seeking near** (unlisted) | 34 px orange ring `#EA580C` | `passengerMarkerSeekingNear` |
| **Light signal** | 11 px cyan dot | `passengerMarkerLightSignal` |
| **City heat** | Amber/cyan disks animated pulse | `CityHeatCellMarker` |

**Logo/mark genom dışı** — yeşil/turuncu generic dispatch UI.

---

## Production kullanımı

- `DriverOfferScreen.tsx` — `mapSeekingMarkerElements`, `mapLightMarkerElements`, `mapHeatMarkerElements`
- Zoom bands: near/mid/far — LOD selection
- LHIS comment on CityHeatCellMarker — operasyon alanı diski

---

## Mevcut dosyalar

- Inline StyleSheet markers (no PNG)
- `resolveFieldHeatCellVisual` — intensity → color disk

---

## Eksikler

| ID | Eksik |
|----|-------|
| SRCH-01 | Yeşil/turuncu ≠ Meridian genom — **P0** |
| SRCH-02 | Passenger PNG not used on field map |
| SRCH-03 | `waiting.breathe` vs static squares |
| SRCH-04 | Heat disk amber at low intensity — caution token OK but inconsistent |

---

## Okunabilirlik

| Zoom | Behavior |
|------|----------|
| far | seeking/light hidden |
| mid | seeking listed only; light capped |
| near | full set + heat capped |

11 px light dot — küçük zoom OK. Orange vs green distinction clear — brand wrong.

---

## Premium hissi

Düşük — dispatch dashboard estetiği, logo evolution hedefi ile çelişir.

---

## Dark / white

Dark map OK. Orange `#EA580C` high saturation — constitution caution amber `#FFB020` closer.

---

## Accessibility

Marker `title`/`description` set — "Aktif Talep", "Yakın Talep" ✅.

---

## Motion / multimodal

| Öğe | Motion |
|-----|--------|
| CityHeatCellMarker | 2800 ms pulse scale — custom |
| Seeking | Static |
| Light | Static dot |

LSX `waiting.breathe` not applied. Sonic silent Tier C OK.

---

## Logo DNA uyumu

**En zayıf yüzey** — pin/teardrop yok ✅ ama renk/form logo ailesinden kopuk.

**Hedef:** Passenger M1 tier + state ring (listed=cyan solid, near=amber caution ring).

---

## Production riski

**P0** driver sees different passenger representation than passenger sees self.

---

## Migration planı

1. B-5 priority: Replace seeking Views with `MapEntityMarkerImage` + overlay rings.
2. B-4: Heat disk token unify cyan scale (intensity = opacity not hue shift to amber).
3. B-6: Animate breathe on seeking listed state.

---

## Rollback

Restore StyleSheet seeking markers.

---

## QA kriterleri

- [ ] Field map passenger = trip PNG siluet
- [ ] Listed vs near distinguishable without orange/green off-brand
- [ ] Heat does not obscure pins
- [ ] Zoom LOD unchanged behavior
- [ ] 30+ seeking pins perf OK
