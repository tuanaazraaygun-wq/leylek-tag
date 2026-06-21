# Marker 01 — Passenger Marker Analysis

**Sprint:** B-2 | **Type:** Entity PNG | **System:** A

---

## Mevcut durum

Yolcu konumu **tek nötr PNG** (`passenger-woman.png`) ile gösterilir. Cinsiyet parametreleri deprecated — App Store 5.1.1 uyumu. `MapEntityMarkerImage` cyan glow halo (`#22D3EE` @ 12%) ve drop shadow ekler. Display: **32 px** (`MARKER_PIXEL.passenger`).

---

## Production kullanımı

| Bileşen | Rol |
|---------|-----|
| `LiveMapView.tsx` | Yolcu "BEN" + sürücü görünümünde karşı taraf yolcu |
| `PassengerWaitingScreen.tsx` | Bekleme haritası — self pin |
| `SearchingMapView.tsx` | Arama haritası |
| `LeylekTripMapPreview.tsx` | Trip preview |

Anchor: `{ x: 0.5, y: 1 }` (ayak tabanı). `tracksViewChanges` kısa süre true (Android PNG draw fix).

---

## Mevcut dosyalar

- `frontend/lib/mapNavMarkers.ts` — `NAV_MARKER_IMG.passenger`, `getPassengerMarkerImage()`
- `frontend/lib/mapMarkerChrome.tsx` — `MapEntityMarkerImage`
- `frontend/assets/markers/passenger-woman.png` (referenced)

---

## Eksikler

| ID | Eksik |
|----|-------|
| PAX-01 | Logo DNA stroke/radius dili yok — generic PNG |
| PAX-02 | Renk `#22D3EE` ≠ genom `#00D4AA` |
| PAX-03 | `waiting.breathe` motion spec uygulanmıyor (static PNG) |
| PAX-04 | White theme varyant yok |
| PAX-05 | Tek PNG — SVG master / tier ladder yok |
| PAX-06 | DriverOfferScreen field map farklı dil (yeşil kare seeking) |

---

## Okunabilirlik

| Zoom | Durum |
|------|-------|
| Küçük (≤14) | 32 px + 12 px glow — OK dark map |
| Orta (15–17) | İyi |
| Büyük (≥18) | Detay yeterli; glow gürültü riski düşük |

**24 px test:** MARKER_DNA min 24 px — mevcut 32 px display OK; source PNG kalitesi P7 verify.

---

## Premium hissi

Orta — glow wrapper premium niyet taşır; PNG stili logo kuş/arc ile **hizasız**. Constitution "oyuncak değil" — mevcut siluet prompt'a uygun olmalı (human-marker.prompt).

---

## Dark mode

Optimize — koyu harita + cyan glow. `#08111F` ink shadow uyumlu.

---

## Future white mode

Form öncelikli inverse: Depth Slate stroke + Meridian accent; glow opacity düşür. Ayrı export gerekir — henüz yok.

---

## Accessibility

Dekoratif map pin — VoiceOver `title`/`description` Marker prop'larından (DriverOfferScreen seeking'de var; LiveMapView entity'de sınırlı). Kontrast glow vs map tile WCAG decorative OK.

---

## Motion uyumu

| Token | Hedef | Mevcut |
|-------|-------|--------|
| `waiting.breathe` | opacity 0.4↔0.7, 2s | Static |
| `pulse.journey` | match anı | Static |
| `lock.ringClose` | QR | Static |

Evrim: Lottie veya RN Animated wrapper — PNG değişmeden breathe eklenebilir.

---

## Logo DNA uyumu

| Öğe | Uyum |
|-----|------|
| Stroke 2–2.5 px | PNG içinde belirsiz |
| Meridian Cyan accent | Drift `#22D3EE` |
| Trust White edge | Kısmen |
| Orbital arc / lock ring | Yok |
| Pin teardrop | Yok ✅ |

**Hedef:** İnsan silueti + alt horizon hint + optional accent dot (logo M1 tier echo).

---

## LHIS uyumu

LeylekEye haritada değil — passenger marker LHIS companion değil. Accent rengi LeylekEye iris ile kalibre edilmeli.

---

## LSX uyumu

`lsx.motion.waiting.breathe` — uygulanmıyor. Map surface policy: "slow breathe; milestone pulses only" — gap.

---

## Sonic uyumu

Marker görsel ses üretmez. Waiting state Tier C bilinçli sessizlik — OK.

---

## Haptic uyumu

Pin tap haptic yok. Marker selection haptic DNA'da yok — OK.

---

## Production riski

| Risk | Severity |
|------|----------|
| PNG swap tüm trip ekranlarını etkiler | P1 |
| Android tracksViewChanges regression | P1 |
| Anchor shift UX kayması | P2 |

---

## Migration planı

1. B-3: design-lab passenger SVG @48/32/24 PNG export (logo genom stroke).
2. B-4: `mapNavMarkers.ts` path swap.
3. B-5: `MapEntityMarkerImage` glow token → `#00D4AA`.
4. B-6: Animated breathe wrapper (opsiyonel).

---

## Rollback planı

`_backup-pre-marker-evolution/passenger-woman.png` restore + glow token revert.

---

## QA kriterleri

- [ ] 24/32/48 px dark map okunur
- [ ] Car/motor marker yan yana karışmaz
- [ ] Logo accent hue family match
- [ ] Android first-frame draw
- [ ] Blind "yolcu" tanınırlığı ≥90%
