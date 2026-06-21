# V7 — Sonic System (MEX Sonic)

**Codename:** Cyan Meridian Live  
**Anchor:** **Offer sound = brand signature**  
**Parent:** v4 SONIC_DNA · V7 product binding

---

## Signature principle

If a user hears **one** LeylekTAG sound in isolation, it must be **`sonic.driver.offer.classic`**.  
All other tokens are **harmonic relatives** of A3 220 Hz anchor.

---

## Family registry (product-bound)

| Event | Token | Pitch core | Duration | Tier | Product surface |
|-------|-------|------------|----------|------|-----------------|
| **Startup** | `sonic.presence.boot` | A3→E4 | 550–750ms | A | Splash handoff |
| **Offer** ★ | `sonic.driver.offer.classic` | A3+body→E4 | ~0.9s | A | Offer card ingress |
| Offer urgent | `sonic.driver.offer.urgent` | A3→F4 | shorter gap | A | Urgent badge |
| **Quick Match** | `sonic.quickMatch.ops` | C♯4 | 0.45–0.65s | A | QM lock ring |
| Match accepted | `sonic.match.resolve` | C♯4→A3 | 0.5s | A | Match sheet |
| Journey started | `sonic.journey.start` | A3 whisper | 0.35s | B | Map transition |
| Journey ended | `sonic.journey.end` | A3 descent | 0.4s | B | Rating entry |
| QR success | `sonic.qr.success` | A4 lock | 0.28–0.38s | A | QR overlay |
| QR error | `sonic.qr.error` | G♯3→A3 | 0.2s | B | Scan fail |
| Payment success | `sonic.payment.resolve` | C♯4 third | 0.45s | A | Payment sheet |
| Trust connected | `sonic.trust.link` | A3 warm | 0.4s | B | Trust chip — **NEW required** |
| Nav alert | `sonic.nav.alert` | A4 tick | 0.12s | B | Turn imminent |
| System success | `sonic.system.ok` | A4 micro | 0.15s | C | Settings |
| System warning | `sonic.system.warn` | amber pair | 0.2s | B | Offline |
| System error | `sonic.system.err` | low A descent | 0.25s | B | Network |

★ **Signature** — used in marketing earcons, store preview video, brand guidelines.

---

## Offer signature spec (detailed)

| Phase | ms | Content |
|-------|-----|---------|
| Attack | 0–40 | A2 body undertone fade in |
| Phase 1 | 40–220 | A3 primary — **identify brand** |
| Gap | 220–480 | 260ms silence — digital relay |
| Phase 2 | 480–680 | E4 fifth — forward resolve |
| Tail | 680–750 | 95ms silence |

**Traffic test:** Audible @ 80 km/h cabin with windows cracked · peak −1.4 dBFS · **no** gain stacking on repeat.

---

## Triad sync (mandatory)

| Event | Frame 0 | +16ms | +120ms |
|-------|---------|-------|--------|
| Offer | motion.relay.ingress | haptic P2 | sonic phase 1 peak |
| QR lock | lock.ringClose | haptic P4 | sonic.qr.success |
| Match | pulse.journey | haptic P6 | sonic.match.resolve |

---

## Anti-patterns (instant FAIL)

- Mixkit / generic ping  
- Looping boot sound  
- Same waveform for offer + QM (must differ by **C♯4** vs **A3**)  
- Trust silent (B5.6 FAIL — **`sonic.trust.link` required**)

---

## Target score

| Composite sonic (implemented + traffic tested) | **96** |

---

**Offer screen mock:** `mockups/offer-screen.svg` (annotation)
