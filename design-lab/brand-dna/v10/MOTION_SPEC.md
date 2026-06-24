# Brand Motion Specification — Premium Master V2

**Sprint:** RC-BRAND-V10  
**Parent:** [MASTER_V2_SPEC.md](./MASTER_V2_SPEC.md)  
**Status:** Animation specification only — no Lottie, no code

---

## 1. Motion character

| Attribute | Value |
|-----------|-------|
| Personality | **Apple restraint** — breathes, never shouts |
| North star | Quiet kinetic presence; confirmation = inward settle |
| Reference tone | Tesla lock snap (ring only) · DJI precision · **Not** Duolingo bounce |
| Forbidden | Spinning bird, cartoon squash, particle burst, casino glow, orbit rotation of stork |

**Rule:** Motion applies to **light, ring, eye** — stork silhouette remains **rigid** (no skeletal animation).

---

## 2. Global motion tokens

| Token | Cubic-bezier | Use |
|-------|--------------|-----|
| `motion.premium.stop` | `(0.22, 1, 0.36, 1)` | Settle, dismiss, splash handoff |
| `motion.lock.snap` | `(0.34, 1.56, 0.64, 1)` | Ring lock only — max scale 1.06 |
| `motion.exit.dismiss` | `(0.4, 0, 0.2, 1)` | Splash → app chrome |
| `motion.breathe.loop` | Sine ease-in-out | Idle hold |
| `motion.shimmer.loop` | Linear | Ring orbital shimmer phase |

| Duration band | Range |
|---------------|-------|
| Micro feedback | 120–220 ms |
| Presence boot | 400–550 ms |
| Idle loop period | 2400–3600 ms |
| QR lock | 280–320 ms |

---

## 3. Animation catalog

### 3.1 Ring slow orbital shimmer

**ID:** `anim.ring.shimmer.idle`

| Property | Spec |
|----------|------|
| Target layer | `layer.orbitalArc.rim` highlight only |
| Motion | Specular highlight travels **clockwise** along arc path |
| Period | **3200 ms** full cycle |
| Amplitude | Highlight opacity **0.25 → 0.45 → 0.25** |
| Spatial travel | ~15% of arc length per cycle — **not** full orbit |
| Stork | Static |
| Glow bloom | **Does not pulse** — shimmer is rim-only |
| Use surfaces | Splash idle hold, login ambient (optional, default off) |

**Forbidden:** Full 360° neon chase; strobing; sync to music.

### 3.2 Eye pulse

**ID:** `anim.eye.pulse.idle`

| Property | Spec |
|----------|------|
| Target | `layer.accentDot` fill |
| Motion | Scale **1.0 → 1.08 → 1.0** + opacity **0.85 → 1.0 → 0.85** |
| Period | **2800 ms** |
| Easing | Sine loop |
| Glow halo | **None** — dot only |
| Use surfaces | Leylek Zeka empty state (optional), splash idle |
| Max concurrent | One pulse channel per screen |

**Forbidden:** Blink, wink, double-pulse heartbeat, red error flash.

### 3.3 Light sweep

**ID:** `anim.metal.sweep.boot`

| Property | Spec |
|----------|------|
| Target | `layer.storkBody` specular mask + `layer.orbitalArc.rim` |
| Motion | Narrow band highlight sweeps **upper-left → lower-right** across symbol |
| Duration | **480 ms** one-shot |
| Band width | ~12% symbol width |
| Peak opacity | **0.35** on metal pass |
| Trigger | Splash boot frame 0–480 ms **once** |
| Stork transform | **None** — mask sweep only |

**Forbidden:** Repeated sweep loop on login; lens flare streak across full screen.

### 3.4 Splash boot sequence (composed)

**ID:** `anim.presence.boot` — total **550 ms**

| ms | Logo opacity | Logo scale | Ring shimmer | Eye pulse | Light sweep | Glow (ring outer) |
|----|--------------|------------|--------------|-----------|-------------|-------------------|
| 0 | 0 → 1 (120 ms) | 0.96 | off | off | start | 0 |
| 120 | 1 | 0.96 → 1.03 (160 ms) | off | off | active | 0 → 0.12 |
| 280 | 1 | 1.03 → 1.0 (120 ms) | fade in idle | off | end | 0.12 |
| 400 | 1 | 1.0 | idle eligible | eligible | off | 0.12 → 0.08 |
| 550 | handoff fade 150 ms | 1.0 | stop | stop | off | 0 |

**Handoff @550 ms:** Crossfade to app chrome — logo motion **stops** (no infinite splash spin).

### 3.5 QR lock snap (ring only)

**ID:** `anim.ring.lock.qr`

| Property | Spec |
|----------|------|
| Duration | **320 ms** |
| Ring | Stroke-dashoffset 100% → 0% on **gap segment only** — closes gap **8 px** visual |
| Scale | Ring **1.0 → 1.04 → 1.0** with `motion.lock.snap` |
| Stork | Static |
| Glow | Peak **0.15** — not boot intensity |
| Haptic | Optional single light — out of scope V10 |

**Forbidden:** Bird rotates to face QR; full ring becomes solid circle.

### 3.6 Match success breathe

**ID:** `anim.symbol.breathe.match`

| Property | Spec |
|----------|------|
| Duration | **480 ms** |
| Whole symbol scale | **1.0 → 1.03 → 1.0** |
| Ring opacity | **0.6 → 0.85 → 0.6** |
| Eye | No pulse |
| Use | Match confirmed — logo on separate screen from map |

---

## 4. Layer motion authority

| Layer | Allowed motion | Forbidden |
|-------|----------------|-----------|
| orbitalArc | Shimmer, lock snap, opacity breathe | Path morph, spin transform |
| storkBody | Specular sweep mask | Scale squash, rotate, translate bounce |
| wingHighlight | Opacity fade only | Flap animation |
| accentDot | Pulse scale/opacity | Expression change |
| groundShadow | Opacity 0.8→1.0 on settle | Shadow slide |
| background | Crossfade | Parallax on logo |

---

## 5. Reduced motion & accessibility

| Setting | Behavior |
|---------|----------|
| `prefers-reduced-motion: reduce` | All loops off; boot = opacity fade 200 ms only |
| Low power mode | Disable shimmer + eye pulse on login |
| Static fallback | First frame of LC-2 @ target size — always available |

---

## 6. Performance budget

| Surface | Max animated layers | GPU |
|---------|---------------------|-----|
| Splash | 3 (ring rim + eye + sweep mask) | OK |
| Login | 0 default; 1 optional shimmer | Lightweight |
| App icon | **0** — static only |
| Notification | **0** | — |

---

## 7. Future deliverables (post-V10)

| Asset | Format | Source |
|-------|--------|--------|
| `logo-motion-boot.json` | Lottie ≤ 40 KB | anim.presence.boot |
| `logo-motion-shimmer.json` | Lottie ≤ 12 KB | anim.ring.shimmer.idle |
| `logo-motion-lock.json` | Lottie ≤ 8 KB | anim.ring.lock.qr |

**V10:** Spec only — no Lottie files created.

---

## 8. Explicit forbidden motion list

- Stork wing flap
- Stork head turn / nod
- Full symbol spin > 5°
- Particle trails on arc
- Rainbow gradient cycle
- Bounce easing on symbol scale > 1.06
- Cartoon blink on eye
- Pulsing outer glow > 0.25 alpha

---

**Lineage:** `design-lab/brand-dna/v4/logo-master/LOGO_MOTION.md` · `MOTION_DNA.md`
