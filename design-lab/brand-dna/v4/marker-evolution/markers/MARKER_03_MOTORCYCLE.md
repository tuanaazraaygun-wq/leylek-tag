# Marker 03 — Motorcycle Marker Analysis

**Sprint:** B-2 | **Type:** Entity PNG + field icon | **System:** A / B

---

## Mevcut durum

**Trip (A):** `driver-motor.png` @ **30 px**, anchor `{0.5, 0.53}`, same rotation offset 180°.

**Field (B):** `MaterialCommunityIcons motorbike` @ 22 px in same blue pulse wrap as car.

Vehicle kind from tag/API: `motorcycle` vs `car`.

---

## Production kullanımı

Same surfaces as Driver Car — `getDriverMarkerImage('motorcycle')`.

---

## Mevcut dosyalar

- `mapNavMarkers.ts` — `driverMotor`, `MARKER_PIXEL.driverMotor: 30`
- `frontend/assets/markers/driver-motor.png`
- `DriverOfferScreen.tsx` — `isMotor` branch

---

## Eksikler

| ID | Eksik |
|----|-------|
| MOT-01 | A/B split (same as car) |
| MOT-02 | Form ayrımı car vs motor — PNG'de test zorunlu |
| MOT-03 | Bounding box parity MARKER_DNA "same bounding box" |

---

## Okunabilirlik

30 px vs car 34 px — motor biraz küçük (doğru hiyerarşi). Küçük zoom: iki teker okuması şart.

---

## Premium / dark / white

Car marker ile aynı değerlendirme. Motor prompt: `design-lab/markers/prompts/motor-marker.prompt.md`.

---

## Accessibility

Form birincil ayırıcı — renk körcülüğü için car/motor aynı renk olabilir; **siluet farkı zorunlu**.

---

## Motion / DNA / multimodal

Car marker analizi ile parallel. LSX relay on offer applies to both vehicle kinds.

---

## Production riski

Car ile birlikte unify. Motor yanlış export → car ile karışma P0 QA.

---

## Migration planı

1. Joint export car+motor aynı grid (B-3).
2. Side-by-side 24 px red team.
3. Field map icon retire → PNG.

---

## Rollback / QA

Car marker rollback includes motor PNG. QA: instant "motor" vs "araba" at 32 px ≥95%.
