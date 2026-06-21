# Marker 04 — Quick Match Marker Analysis

**Sprint:** B-2 | **Type:** State overlay (no dedicated pin) | **System:** —

---

## Mevcut durum

Production'da **ayrı Quick Match map marker yok**. QM `tags.match_channel === 'quick'` / `quick_match` flow ile UI kartları (`DriverQuickMatchInviteCard`, `useQuickMatchPassengerSession`) üzerinden yönetilir. Haritada sürücü/yolcu **standart PNG entity marker** veya field seeking pin kullanılır.

---

## Production kullanımı

| Yüzey | QM ifadesi |
|-------|------------|
| `app/index.tsx` | `quickMatchFlowVisible`, route context |
| `DriverQuickMatchInviteCard.tsx` | Davet UI — map değil |
| `LiveMapView.tsx` | QM-specific marker yok |
| Sonic | `quick_match_ops_v2*.wav` |

---

## Mevcut dosyalar

- Logic: quick match hooks/sessions — görsel marker asset yok
- `MARKER_DNA.md` §3.4 — hedef: cyan comms ring dashed→solid 260 ms

---

## Eksikler

| ID | Eksik |
|----|-------|
| QM-01 | Dedicated QM overlay — **tamamen eksik** |
| QM-02 | Priority z-order Offer > QM > Idle — görsel uygulanmıyor |
| QM-03 | `relay.ingress` on QM marker |

---

## Okunabilirlik / premium / zoom

Overlay olarak mevcut 32–34 px marker üzerine **8 px ring** — küçük zoom'da ring kaybolmamalı (stroke min 2 px).

---

## Dark / white / a11y

Ring Meridian Cyan — dark OK. White: stroke-only ring. QM state `accessibilityLabel` "Hızlı eşleşme aktif" marker'a eklenmeli (migration).

---

## Motion / DNA / multimodal

| Katman | Hedef |
|--------|-------|
| LSX | `relay.ingress` 260 ms |
| Sonic | `quick_match_ops` C♯4 kök |
| Haptic | `lsx.haptic.medium` |
| Logo DNA | Dashed orbital arc → solid (lock ring türevi) |

---

## Production riski

QM overlay eklenirken normal offer marker karışabilir — state machine net olmalı.

---

## Migration planı

1. B-3: QM ring SVG layer (overlay only, PNG base unchanged).
2. B-5: LiveMapView + DriverOfferScreen `match_channel` conditional wrapper.
3. B-6: LSX token sync doc → code (ayrı sprint).

---

## Rollback

Feature flag `MARKER_QM_OVERLAY` off → base markers only.

---

## QA kriterleri

- [ ] QM active vs idle side-by-side
- [ ] Offer pending > QM priority visual
- [ ] Sonic+haptic+ring ±20 ms
- [ ] Ring ≠ trust ring (form farkı)
