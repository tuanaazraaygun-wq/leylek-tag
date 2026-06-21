# Marker 08 — Pickup Marker Analysis

**Sprint:** B-2 | **Type:** Meeting point chrome | **System:** A / B split

---

## Mevcut durum

| Implementasyon | Görsel | Konum |
|----------------|--------|-------|
| `MapPickupPin` | Cyan ring + core + `navigate` icon | `mapMarkerChrome.tsx`, `LeylekTripMapPreview` |
| `OfferMapScreen` | Yeşil daire + `location` icon | Legacy |
| LiveMapView | Pickup often = user/passenger PNG at pickup coord | Implicit |

MARKER_DNA: pickup **cyan ring expand once** 320 ms overlay on passenger highlight.

---

## Production kullanımı

- `LeylekTripMapPreview.tsx` — `<MapPickupPin compact />`
- Tag pickup coords in LiveMapView — passenger marker at pickup, not dedicated pickup pin
- Driver nav phase — pickup route polylines

---

## Mevcut dosyalar

- `mapMarkerChrome.tsx` — `MapPickupPin` (CYAN `#22D3EE`)
- `OfferMapScreen.tsx` — green `COLORS.primary` pickup

---

## Eksikler

| ID | Eksik |
|----|-------|
| PU-01 | LiveMapView dedicated pickup pin — often merged with passenger |
| PU-02 | OfferMapScreen green ≠ cyan genom |
| PU-03 | One-shot ring expand animation |
| PU-04 | Pickup vs passenger distinction when coincident |

---

## Okunabilirlik

MapPickupPin 36–40 px — OK. Green OfferMapScreen breaks brand.

---

## Premium / dark / white

PickupPin premium chrome — iyi yönde. Genom `#00D4AA` swap gerekli.

---

## Accessibility

Pickup = critical waypoint — needs `accessibilityLabel` "Alış noktası" on Marker.

---

## Motion / multimodal

| Token | Hedef |
|-------|-------|
| LSX | ring expand 320 ms |
| Sonic | `journey.start` |
| Haptic | `light` |
| Logo | Cyan dot = accent |

---

## Production riski

Coincident passenger+pickup double marker stack.

---

## Migration planı

1. B-3: Pickup spec = compact meridian ring (shared with destination family).
2. B-5: Unify OfferMapScreen → MapPickupPin.
3. LiveMapView: show pickup pin when pickup ≠ user GPS (spec).

---

## Rollback / QA

- [ ] Pickup ≠ destination ≠ dropoff colors/forms
- [ ] Coincident coord single merged marker policy
- [ ] 32 px ring readable
