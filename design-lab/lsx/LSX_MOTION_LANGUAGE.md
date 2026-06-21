# LSX Motion Language

**Version:** LSX v1.0  
**Codename:** *Cyan Flow*  
**Scope:** Analysis — single Motion DNA for all LeylekTAG surfaces

---

## 1. Motion DNA (one character)

LeylekTAG motion is **optical-kinetic**: light travels, surfaces lock, chrome breathes. Not bouncy game UI; not stiff enterprise forms.

| Attribute | Value |
|-----------|-------|
| **Primary easing** | `cubic-bezier(0.22, 1, 0.36, 1)` — smooth deceleration (premium stop) |
| **Secondary easing** | `cubic-bezier(0.4, 0, 0.2, 1)` — exits and dismiss |
| **Snap easing** | `cubic-bezier(0.34, 1.56, 0.64, 1)` — lock confirm only (max 1.08 scale) |
| **Duration bands** | Micro 80–120 ms · Standard 180–280 ms · Resolve 320–480 ms · Narrative 600–900 ms |
| **Scale range** | 0.96–1.04 typical; lock snap to 1.06 max |
| **Opacity** | Never flash; 0 → 1 min 120 ms on overlays |
| **Direction** | Ascend = inform · Inward = lock · Expand = journey open · Descend = dismiss |

---

## 2. Core Motion Tokens

| Token | Duration | Transform | Use |
|-------|----------|-----------|-----|
| `lsx.motion.presence.pulse` | 220 ms | scale 1 → 1.03 → 1 | Boot, brand |
| `lsx.motion.relay.ingress` | 260 ms | translateY 12→0 + opacity | Offer card, QM banner |
| `lsx.motion.lock.ringClose` | 320 ms | ring stroke 100%→0, scale 1.02→1 | QR verify, payment |
| `lsx.motion.scan.viewfinderFlash` | 100 ms | border glow cyan fade | QR local scan |
| `lsx.motion.pulse.journey` | 480 ms | map chrome scale breathe | Match, journey start |
| `lsx.motion.click.press` | 90 ms | scale 1 → 0.97 → 1 | CTA |
| `lsx.motion.dismiss.sheet` | 280 ms | translateY 0→100% | Modal close |
| `lsx.motion.waiting.breathe` | 2000 ms loop | opacity 0.4↔0.7 slow | Waiting (Tier C) |
| `lsx.motion.error.nudge` | 180 ms | translateX ±4 | Soft fail |
| `lsx.motion.success.checkDraw` | 360 ms | checkmark path stroke | Payment, trust accept |

---

## 3. Surface Rules

| Surface | Motion policy |
|---------|---------------|
| **Map / cockpit** | Slow breathe; milestone pulses only |
| **Modals / sheets** | Enter 280 ms; exit 280 ms; success hold 350–500 ms before dismiss |
| **Lists (offers)** | Stagger 40 ms per item max; new item = relay.ingress |
| **QR camera** | Viewfinder flash on decode; lock.ringClose on verify |
| **Leylek Zeka orb** | Existing flutter/breathe — LSX events must not fight orb loop |
| **Role select heroes** | Hero scale on selection 200 ms — already visual-rich; add haptic sync |

---

## 4. Motion × Journey (quick reference)

| Journey | Primary motion token |
|---------|---------------------|
| App boot | `presence.pulse` on logo |
| Driver offer | `relay.ingress` on request row |
| Match | `pulse.journey` on map chrome |
| QR boarding | `scan.viewfinderFlash` → `lock.ringClose` |
| Payment | `lock.ringClose` + `success.checkDraw` |
| UI tap | `click.press` |

Full per-journey: `LSX_JOURNEY_MAP.md`

---

## 5. Anti-Patterns

- No infinite bounce on alerts  
- No parallax on operational confirms  
- No motion without state change  
- No 500 ms+ blocking animation before user can act (except narrative match hold ≤480 ms)  

---

## 6. Implementation Notes (future — not this patch)

- Prefer `useNativeDriver: true` for transform/opacity  
- Reanimated shared values for triad sync where possible  
- Motion lead time: 0–16 ms before haptic/sound  

See `LSX_CONSTITUTION.md` §6 Timing.
