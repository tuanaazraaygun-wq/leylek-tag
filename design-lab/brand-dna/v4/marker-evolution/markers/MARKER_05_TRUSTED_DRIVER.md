# Marker 05 — Trusted Driver Marker Analysis

**Sprint:** B-2 | **Type:** Relationship overlay + UI chip | **System:** UI (not map glyph)

---

## Mevcut durum

"Trusted driver" haritada **ayrı pin tipi değil**. `LiveMapView` journey fazında `TrustedAddButton` chip gösterir (`useTrustedAddStatus`). Marker PNG değişmez — trust state **chip + copy** ile iletilir.

`EMERGENCY_TRUST_JOURNEY_UI_DISABLED` flag — trust UI geçici kapalı olabilir.

---

## Production kullanımı

| Bileşen | Rol |
|---------|-----|
| `LiveMapView.tsx` | TrustedAddButton overlay |
| `trusted/TrustedAddButton.tsx` | Chip UI |
| `RatingModal.tsx` | Post-trip trust invite |
| `match_channel: trusted` | Tag metadata — marker değil |

---

## Mevcut dosyalar

- `TrustedAddButton.tsx` — Ionicons + text
- `trustedHubCopy.ts` — copy SSOT
- `MARKER_DNA.md` §3.3 — Warm Resolve ring @ 20% on **existing marker**

---

## Eksikler

| ID | Eksik |
|----|-------|
| TRD-01 | Warm Resolve ring overlay on driver/passenger PNG — **eksik** |
| TRD-02 | Micro pulse 360 ms on accept |
| TRD-03 | Trusted journey marker distinction vs normal |

---

## Okunabilirlik

Chip harita dışı chrome — OK. Hedef ring marker etrafında 4–6 px — 32 px marker'da okunur.

---

## Premium hissi

Chip premium auth styles — iyi. Ring overlay olmadan trust **haritada görünmez** (sadece metin).

---

## Dark / white / a11y

Warm Resolve `#C8E6D0` @ 20% — dark map OK. Chip `accessibilityLabel` mevcut. Ring decorative + state announced.

---

## Motion / multimodal

| Token | Hedef |
|-------|-------|
| LSX | trust micro pulse |
| Sonic | trust accept (success family) |
| Haptic | `lsx.haptic.success` +16 ms |
| Logo DNA | Trust ≠ gamification badge ✅ |

---

## Production riski

Ring + chip double UI kalabalık — policy: ring only on map, chip in sheet.

---

## Migration planı

1. B-4: Trust ring component in `mapMarkerChrome.tsx` (design spec).
2. B-5: Wire `trustedAddStatus === 'connected'` → ring on counterparty marker.
3. Keep TrustedAddButton for action; ring for state.

---

## Rollback

Ring wrapper conditional off.

---

## QA kriterleri

- [ ] Trust connected ring visible @ 32 px
- [ ] ≠ QM dashed ring
- [ ] Accept animation once only
- [ ] Emergency flag behavior documented
