# Marker 07 — Destination Marker Analysis

**Sprint:** B-2 | **Type:** Chrome pin (3 implementations) | **System:** A / B split

---

## Mevcut durum

**Üç farklı destination görseli:**

| Implementasyon | Görsel | Dosya |
|----------------|--------|-------|
| LiveMapView trip | Bayrak pini — pole + cyan border flag | `MapDestinationFlagPin` |
| PassengerWaiting / Searching | Same flag pin | `mapMarkerChrome.tsx` |
| Route picker (index) | **58 px cyan circle** + pulse rings | `index.tsx` styles `destinationPinCore` |
| OfferMapScreen | Kırmızı daire + `flag` icon | Generic |

MARKER_DNA hedef: **horizon dot + vertical stem** — minimal pin değil; mevcut flag **generic navigation pin**.

---

## Production kullanımı

- `LiveMapView.tsx` — `destinationLocation`, anchor `{0.15, 0.95}`
- `PassengerWaitingScreen.tsx` — destination coord
- `app/index.tsx` — destination search modal map
- `LeylekTripMapPreview.tsx` — flag pin

---

## Mevcut dosyalar

- `frontend/lib/mapMarkerChrome.tsx` — `MapDestinationFlagPin`
- `frontend/app/index.tsx` — `destinationPinMarkerWrap`, rings
- Ionicons `flag` — not brand glyph

---

## Eksikler

| ID | Eksik |
|----|-------|
| DST-01 | **P0** üç farklı destination UI |
| DST-02 | Logo meridian dot + stem spec |
| DST-03 | Soft pulse on set — partial (index rings only) |
| DST-04 | Generic red dropoff OfferMapScreen |

---

## Okunabilirlik

Flag pin büyük (50 px pole) — küçük zoom'da dominant. Index 58 px circle — Uber-like. DNA stem+dot daha compact.

| Küçük zoom | Flag okunur ama heavy |
| Büyük zoom | Anchor precision OK |

---

## Premium hissi

Flag chrome cyan border — orta premium. Index circle `#0EA5E9` — logo dışı.

---

## Dark / white / a11y

Dark optimized. `MapDestinationFlagPin` aria via map. White: stem slate, dot cyan.

---

## Motion / DNA / multimodal

- `journey` highlight on destination — partial pulse index
- Logo DNA: accent dot = logo eye echo
- LSX: `pulse.journey` on set destination
- Sonic: journey end phrases — not marker bound

---

## Production riski

**P0** inconsistent destination = user trust in routing.

---

## Migration planı

1. B-3: Unified `MapDestinationMeridianPin` spec (stem+dot) design-lab.
2. B-5: Replace MapDestinationFlagPin + index styles + OfferMapScreen.
3. Single anchor policy: bottom-center dot on coord.

---

## Rollback

Keep flag PNG/component backup.

---

## QA kriterleri

- [ ] All surfaces same destination glyph
- [ ] Pickup vs destination instant distinguish
- [ ] 32 px stem+dot readable
- [ ] ≠ generic Google red pin
