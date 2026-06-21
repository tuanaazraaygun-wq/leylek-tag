# Marker 02 — Driver Car Marker Analysis

**Sprint:** B-2 | **Type:** Entity PNG + field icon | **System:** A / B

---

## Mevcut durum

**Trip/nav (A):** `driver-car.png` @ **34 px**, heading rotation via `Marker.flat` + `DRIVER_NAV_ROTATION_OFFSET_DEG: 180`. Anchor car `{0.5, 0.54}`.

**Field dispatch (B):** `DriverOfferScreen` — `#0369a1` daire + `Ionicons car` @ 22 px, pulse rings `#22D3EE`. **Farklı görsel dil.**

---

## Production kullanımı

| Bileşen | Variant |
|---------|---------|
| `LiveMapView.tsx` | PNG + nav rotation |
| `PassengerWaitingScreen.tsx` | Nearby drivers PNG |
| `SearchingMapView.tsx` | Driver pins |
| `DriverOfferScreen.tsx` | Self marker — **Ionicons B** |
| `OfferMapScreen.tsx` | Generic car icon |

---

## Mevcut dosyalar

- `frontend/lib/mapNavMarkers.ts` — `driverCar`, rotation, anchor
- `frontend/assets/markers/driver-car.png`
- `DriverOfferScreen.tsx` — `driverMarker`, `driverPulseRing`

---

## Eksikler

| ID | Eksik |
|----|-------|
| CAR-01 | A vs B visual split — P0 brand |
| CAR-02 | Heading smooth 120 ms DNA — bearing smooth ref var, PNG rotation OK |
| CAR-03 | Relay trail glow on offer — yok |
| CAR-04 | Offline opacity 0.4 — yok |
| CAR-05 | Meridian genom renk |

---

## Okunabilirlik

Yatay dört teker siluet @ 34 px — MARKER_DNA uygun. Field map 64 px wrap — icon okunur ama generic Uber-like mavi daire.

| Zoom küçük | PNG küçülmez (fixed px) — harita zoom out'ta relative küçülme OK |
| Zoom büyük | Rotation doğru — nav pointer ayrı overlay (DriverNavDirectionPointer) |

---

## Premium hissi

PNG: orta. Field B: startup/generic — premium kuş logosu ile **%0 uyum**.

---

## Dark / white mode

Dark OK. White: mavi `#0369a1` field marker light haritada farklı davranır — spec gerekir.

---

## Accessibility

Nav rotation görsel — ek a11y label gerekmez. Field marker `title="Siz"`.

---

## Motion uyumu

| Token | Trip PNG | Field B |
|-------|----------|---------|
| `online.glow` | Static glow wrapper | Animated pulse rings ✅ |
| `relay.ingress` | — | — |
| `direction trail` | Nav polyline | — |

---

## Logo DNA uyumu

Hedef: yatay araba siluet + Trust White stroke + Meridian accent edge — logo wing arc **yok** (doğru). Renk token unify gerekli.

---

## LHIS / LSX / Sonic / Haptic

- LHIS: N/A map car
- LSX: field pulse ≈ breathe ama token farklı easing
- Sonic: driver offer `driver_offer_classic` — marker ile sync yok
- Haptic: offer `medium` — marker flash yok

---

## Production riski

**P0:** DriverOfferScreen vs LiveMapView aynı sürücü farklı görünür.

---

## Migration planı

1. Unify: field map → PNG A + pulse wrapper (B-5).
2. Export car SVG logo-genom stroke (B-3).
3. Rotation offset verify pre/post swap.

---

## Rollback

Restore PNG + DriverOfferScreen styles.

---

## QA kriterleri

- [ ] iOS/Android rotation @ bearing change
- [ ] Field = trip same siluet
- [ ] vs Google car icon red team
- [ ] 32 px min readability
