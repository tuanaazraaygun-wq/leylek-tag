# V7 — Motion System (MEX Motion)

**Codename:** Optical-Kinetic Presence  
**Parent:** v4 MOTION_DNA · V7 enforcement layer

---

## One grammar

All motion uses **four easings only**:

| Token | Cubic-bezier | Use |
|-------|--------------|-----|
| `meridian.enter` | (0.22, 1, 0.36, 1) | Default enter |
| `meridian.exit` | (0.4, 0, 0.2, 1) | Dismiss |
| `meridian.lock` | (0.34, 1.56, 0.64, 1) | QR/payment only · max 1.06 scale |
| `meridian.breathe` | sine | Idle loops |

**Linear easing on Tier A confirms — forbidden.**

---

## Product event map

| Event | Token | ms | Surface |
|-------|-------|-----|---------|
| **Startup** | presence.pulse + splash.handoff | 220 + 150 | Splash → app |
| **Offer** | relay.ingress | 260 | Offer card |
| Quick Match | lock.ringClose + QM chip rise | 320 + 200 | Map + sheet |
| Journey | pulse.journey | 480 | Route draw |
| QR | scan.viewfinderFlash + lock.ringClose | 100 + 320 | Camera |
| Payment | lock.ringClose + success.checkDraw | 320 + 360 | Pay sheet |
| Trust | success.checkDraw | 360 | Trust toast |
| Rating | rating.star stagger | 120 × n | Stars |
| Transitions | meridian.enter/exit | 220–280 | Stack nav |
| Map marker idle | waiting.breathe | 2000 loop | Passenger/search |
| Searching | orbit.pulse | 2400 loop | MK-19 |
| Leylek Zeka | ai.orbExpand / ai.think | 300 / 1200 | Zeka panel |

---

## Startup sequence (product)

```
0ms     tap icon
0–220ms presence.pulse on logo (scale 1→1.03→1)
220–600ms logo hold @ opacity 1
600–750ms splash.handoff (logo fade, chrome enter 150ms)
750ms+  map marker breathe begins
```

**No blocking animation >500ms** except boot total ≤750ms.

---

## CI enforcement (implementation phase)

- ESLint rule: flag `Easing.linear` on Tier A screens  
- Snapshot tests for offer card ingress @260ms  
- Marker pulse must use token — static PNG **rejected**

---

## Target score

| Composite motion (implemented) | **95** |

---

**Mockups:** `splash-in-phone.svg` · `offer-screen.svg`
