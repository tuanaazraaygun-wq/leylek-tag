# Marker 09 — Journey Active Marker Analysis

**Sprint:** B-2 | **Type:** Dynamic route chrome (not static pin) | **System:** Nav + polyline

---

## Mevcut durum

Aktif yolculuk **marker tipi değil** — **polyline + nav pointer + entity PNG** kombinasyonu:

| Öğe | Implementasyon |
|-----|----------------|
| Connection line | Cyan/orange polylines LiveMapView |
| Driver nav | `DriverNavDirectionPointer` flat marker |
| Entity markers | PNG passenger/driver continue |
| QR verified | Midpoint — no lock icon marker yet |
| Journey end | Line dissolve — animated partial |

---

## Production kullanımı

- `LiveMapView.tsx` — `destinationRoute`, `pickupNavRouteStrokeColors`, boarding phases
- `LeylekTripLiveRideChrome.tsx` — chrome overlay, stale location hint
- Tag status phases: searching → matched → en route

---

## Mevcut dosyalar

- LiveMapView polyline styles (~line 1915+ stroke colors)
- No `journey-active-marker.png`

---

## Eksikler

| ID | Eksik |
|----|-------|
| JRN-01 | MARKER_DNA dashed→solid 480 ms line animation polish |
| JRN-02 | Direction trail on driver PNG |
| JRN-03 | QR lock midpoint icon |
| JRN-04 | Warm resolve on journey end destination pulse |

---

## Okunabilirlik

Lines @ zoom ≤14 — MARKER_DNA minimal glow. Traffic color levels — premium cyan family OK.

---

## Premium / zoom

Small zoom: thin lines OK. Large zoom: trail detail — performance risk (see PERFORMANCE_ANALYSIS).

---

## Dark / white / a11y

Dark map lines visible. VoiceOver: route progress in chrome not marker.

---

## Motion / DNA / multimodal

| Token | Durum |
|-------|-------|
| `pulse.journey` | Partial map chrome breathe |
| `lock.ringClose` | QR — viewfinder not map midpoint |
| Sonic | `match_success`, `payment_confirmed` |
| Haptic | match, lock, payment tokens |
| Logo | Line = orbital arc metaphor ✅ |

---

## Production riski

Polyline perf on low-end Android. Nav pointer + PNG rotation conflict.

---

## Migration planı

1. B-4: Journey line token doc → stroke color unify `#00D4AA`.
2. B-6: QR midpoint lock glyph spec (design-lab).
3. No new static marker PNG — enhance chrome.

---

## Rollback

Stroke color constants revert.

---

## QA kriterleri

- [ ] Pickup→dest line visible all zoom bands
- [ ] Boarding phase line switch
- [ ] Nav pointer ≠ entity PNG overlap readable
- [ ] Journey end line fade
