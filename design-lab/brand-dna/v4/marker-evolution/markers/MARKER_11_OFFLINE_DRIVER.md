# Marker 11 — Offline Driver Marker Analysis

**Sprint:** B-2 | **Type:** State (visual gap) | **System:** —

---

## Mevcut durum

Sürücü offline olduğunda haritada **marker görsel degradasyonu yok**. `go-offline` API (`DriverDashboardPanel`, `DriverStatusBar`) status değiştirir; field map'te offline sürücü zaten gösterilmez.

MARKER_DNA: offline = **0.4 opacity, glow off**, going offline glow release 280 ms.

Nearby drivers list — offline drivers filtered server-side.

---

## Production kullanımı

| Yüzey | Offline ifadesi |
|-------|-----------------|
| Driver dashboard | Online toggle |
| DriverOfferScreen | Driver not on map if offline |
| Trusted hub | `TRUST_OFFLINE` state — list not map |
| Agora | User offline call — not map |

---

## Mevcut dosyalar

- API endpoints `go-offline` / `go-online`
- No offline marker variant PNG

---

## Eksikler

| ID | Eksik |
|----|-------|
| OFF-01 | 0.4 opacity marker variant |
| OFF-02 | going offline animation |
| OFF-03 | Stale GPS grey-out (trip chrome has >10s hint — not marker) |

---

## Okunabilirlik

Offline deprioritize — lower contrast correct. Risk: ghost markers if opacity-only without removal.

---

## Premium / dark / white

Desaturate + reduce glow — premium "sleeping" not dead grey blob.

---

## Accessibility

Announce offline in status bar — marker aria "Çevrimdışı" if shown.

---

## Motion / multimodal

`online.glow` 400 ms fade in reverse for offline. No sonic. No haptic on passive offline.

---

## Logo DNA

Same siluet — state via opacity/glow only (form unchanged) ✅ evolution rule.

---

## Production riski

Showing offline drivers on passenger map — product decision. Visual-only migration low risk if drivers hidden.

---

## Migration planı

1. B-4: Offline wrapper style in `MapEntityMarkerImage` (opacity prop).
2. B-5: Apply when driver status known (future socket field).
3. Default: keep hide-offline policy.

---

## Rollback

Opacity prop default 1.0.

---

## QA kriterleri

- [ ] Offline 0.4 vs online 1.0 side-by-side
- [ ] Glow off offline
- [ ] Transition 280 ms no flash
