# Marker 06 — Trust Network Marker Analysis

**Sprint:** B-2 | **Type:** Hub / list UI — not map entity | **System:** —

---

## Mevcut durum

Trust Network (`/trusted-network`, `TrustedNetworkHub`) **liste/hub UI** — harita marker değil. Online/offline trusted connections count; map pin yok.

Website: trust architecture showcase — illustrative, not live map markers.

---

## Production kullanımı

| Yüzey | Tip |
|-------|-----|
| `app/trusted-network.tsx` | Hub screen |
| `superUx/TrustedNetworkHub.tsx` | Connections list |
| `useTrustedSummary.ts` | API summary |
| Website trust components | Marketing glyphs |

---

## Mevcut dosyalar

- `trustedNetworkApi.ts`, `trustedHubCopy.ts`
- No `trust-network-marker.png`

---

## Eksikler

MARKER_DNA network-level visualization yok. Future: hub map preview (`LeylekTripMapPreview` level) could show trusted ties — **out of scope production today**.

---

## Evolution hedefi

Trust Network **marker değil** — evolution programında:

1. Hub avatar chips use logo-tier M1 icon (logo evolution dependency).
2. Optional future map: trusted connection line between known pairs (journey line variant) — `MARKER_DNA` journey + trust composite.

---

## Okunabilirlik / premium / zoom

N/A map. Hub list icons: Ionicons — generic.

---

## Dark / white / a11y

Hub UI premium navy — OK. List items accessible.

---

## Motion / DNA / multimodal

Network accept — chip animation, not marker. Sonic/haptic on trust accept applies to hub actions.

---

## Production riski

Düşük — hub-only. Risk: future map feature scope creep.

---

## Migration planı

1. B-2 (this analysis): classify as **non-map** — no PNG sprint.
2. Logo P8: hub tile icon unify.
3. Future B-7: optional trusted pair line spec (design-lab only).

---

## Rollback / QA

N/A map migration. QA: hub does not imply map pin exists.

---

## QA kriterleri

- [ ] Docs clarify Trust Network ≠ map marker
- [ ] Hub icon ≠ passenger PNG
- [ ] Future line spec reviewed if scoped
