# LeylekTAG Motion DNA v4

**Version:** Brand DNA v4.0 — Kinetic Layer  
**Parent:** LSX_MOTION_LANGUAGE, MOTION_HAPTIC_DNA_V3  
**Scope:** Analysis & specification only

---

## 1. Motion Karakteri

LeylekTAG hareketi **optical-kinetic presence** — ışık taşır, yüzeyler kilitlenir, krom nefes alır.

| Attribute | V4 değer |
|-----------|----------|
| Karakter | Apple sade + Tesla snap + DJI precision — LeylekTAG easing |
| Değil | Bouncy game UI, stiff enterprise, parallax circus |
| North Star | "Sessizce nefes alan" — motion = nefes ve kapanış |

---

## 2. Easing Constitution

| Token | Cubic-bezier | Kullanım |
|-------|--------------|----------|
| **Premium stop** | `(0.22, 1, 0.36, 1)` | Default enter, settle |
| **Exit dismiss** | `(0.4, 0, 0.2, 1)` | Sheet close, logout |
| **Lock snap** | `(0.34, 1.56, 0.64, 1)` | QR/payment only; max scale 1.06 |
| **Breathe** | Sine approximation | Idle loops |
| **Linear** | — | **Yasak** Tier A confirm |

---

## 3. Duration Bands

| Band | ms aralığı | Kullanım |
|------|------------|----------|
| **Micro** | 80–120 | Tap, scan flash |
| **Standard** | 180–280 | Ingress, dismiss, error nudge |
| **Resolve** | 320–480 | Lock, match, journey |
| **Narrative** | 600–900 | Boot total, match hold |
| **Idle loop** | 1500–2000 | Waiting breathe, marker pulse |

**Kural:** 500 ms+ blocking animation before user action — yasak (match hold ≤480 ms istisna).

---

## 4. Motion Token Registry

| Token | Süre | Transform | Metafor |
|-------|------|-----------|---------|
| `v4.motion.presence.pulse` | 220 ms | scale 1→1.03→1 | Boot, brand |
| `v4.motion.relay.ingress` | 260 ms | translateY 12→0 + opacity | Offer, QM card |
| `v4.motion.lock.ringClose` | 320 ms | ring stroke 100%→0 | QR, payment |
| `v4.motion.scan.viewfinderFlash` | 100 ms | border glow cyan | QR decode |
| `v4.motion.pulse.journey` | 480 ms | map chrome breathe | Match, journey |
| `v4.motion.click.press` | 90 ms | scale 1→0.97→1 | CTA, button |
| `v4.motion.dismiss.sheet` | 280 ms | translateY 0→100% | Modal close |
| `v4.motion.waiting.breathe` | 2000 ms loop | opacity 0.4↔0.7 | Search, waiting |
| `v4.motion.error.nudge` | 180 ms | translateX ±4 | Soft fail |
| `v4.motion.success.checkDraw` | 360 ms | checkmark stroke | Trust, payment |
| `v4.motion.online.glow` | 400 ms | badge fade in | Driver online |
| `v4.motion.remote.ack` | 320 ms | lock + chip | Remote QR |
| `v4.motion.toast.rise` | 200 ms | translateY 16→0 | Toast enter |
| `v4.motion.toast.dismiss` | 180 ms | opacity + translateY | Toast exit |
| `v4.motion.rating.star` | 120 ms | scale per star stagger 40 ms | Rating |
| `v4.motion.ai.orbExpand` | 300 ms | symbol→orb | Leylek Zeka open |
| `v4.motion.ai.think` | 1200 ms loop | subtle pulse | AI processing |
| `v4.motion.splash.handoff` | 150 ms | logo fade, chrome in | Boot → app |
| `v4.motion.loading.indeterminate` | 1500 ms loop | meridian sweep | Loading (spinner değil) |

---

## 5. Yüzey Kuralları

### 5.1 Kartlar

| Eylem | Motion |
|-------|--------|
| Enter (offer) | relay.ingress 260 ms |
| Select | click.press 90 ms |
| Dismiss | dismiss.sheet 280 ms |
| Stagger list | 40 ms per item max |

### 5.2 Bottom Sheet

| Eylem | Motion |
|-------|--------|
| Open | translateY 100%→0, 280 ms premium stop |
| Close | dismiss.sheet 280 ms |
| Drag snap | Spring damping 0.85 — no overshoot except lock |

### 5.3 Popup / Modal

| Eylem | Motion |
|-------|--------|
| Enter | scale 0.96→1 + opacity, 220 ms |
| Success hold | 350–500 ms before auto-dismiss |
| Exit | exit dismiss 280 ms |

### 5.4 Toast

| Eylem | Motion |
|-------|--------|
| Enter | toast.rise 200 ms |
| Exit | toast.dismiss 180 ms |
| Max visible | 3 s default; Tier A toast 4 s |

### 5.5 Offer

| Eylem | Motion |
|-------|--------|
| New offer row | relay.ingress + glow trail |
| Urgent | Same + 175 ms sound gap sync |
| Expire | opacity fade 180 ms — no shake |

### 5.6 QR

| Phase | Motion |
|-------|--------|
| Camera open | viewfinder fade in 120 ms |
| Decode | viewfinderFlash 100 ms |
| Verified | lock.ringClose 320 ms |
| Error | error.nudge 180 ms |

### 5.7 Harita

| Durum | Motion |
|-------|--------|
| Pan/zoom | Native map — LSX overlay only on events |
| Match | pulse.journey 480 ms on chrome |
| Marker | waiting.breathe 2 s loop Tier C |

### 5.8 AI

| Durum | Motion |
|-------|--------|
| Open | ai.orbExpand 300 ms |
| Thinking | ai.think loop — no fight orb native animation |
| Response | checkDraw or subtle glow — no bounce |

### 5.9 Splash / Logo

Boot sequence — `LOGO_DNA.md` §5.1. Total narrative ≤550 ms.

### 5.10 Loading

| Tür | Motion |
|-----|--------|
| Boot | presence.pulse — not spinner |
| Data fetch | loading.indeterminate meridian sweep |
| **Yasak** | Generic circular spinner as brand moment |

### 5.11 Journey

| Event | Motion |
|-------|--------|
| Match | pulse.journey |
| Start | pulse.journey shortened 320 ms |
| En route | Marker trail only — chrome minimal |
| End | dismiss descend 280 ms |

### 5.12 Rating

| Eylem | Motion |
|-------|--------|
| Star tap | rating.star stagger |
| Submit | success.checkDraw 360 ms |

### 5.13 Trust

| Eylem | Motion |
|-------|--------|
| Accept | success.checkDraw |
| Badge appear | online.glow 400 ms |

---

## 6. Fizik Parametreleri

### 6.1 Acceleration / Deceleration

| Pattern | Accel | Decel |
|---------|-------|-------|
| Ingress | Fast 0–40% | Premium stop 40–100% |
| Lock | Instant attack | Snap settle |
| Dismiss | — | Exit curve full |
| Breathe | Sine symmetric | Sine symmetric |

### 6.2 Spring

| Kullanım | Damping | Stiffness |
|----------|---------|-----------|
| Sheet drag | 0.85 | Medium |
| Lock snap | 0.75 | High — max 1.06 overshoot |
| **Default UI** | **No spring** | Bezier preferred |

### 6.3 Overshoot

| İzin | Max |
|------|-----|
| Lock snap only | scale 1.06 |
| All other | **0** — no overshoot |

### 6.4 Momentum

| Kural | Spec |
|-------|------|
| List scroll | Native physics |
| Map | Native — no artificial momentum overlay |
| Card swipe dismiss | Velocity threshold — exit dismiss |

### 6.5 Breathe / Idle

| Surface | Period | Amplitude |
|---------|--------|-----------|
| Waiting screen | 2000 ms | opacity ±30% |
| Marker idle | 2000 ms | scale ±2% |
| Logo idle (splash hold) | 2000 ms | scale ±2% |
| AI think | 1200 ms | glow ±15% |

---

## 7. Direction Semantiği

| Yön | Anlam |
|-----|-------|
| **Ascend** (translateY −, scale up) | Inform, offer arrive |
| **Inward** (ring close) | Lock, confirm |
| **Expand** | Journey open, AI orb |
| **Descend** | Dismiss, logout, journey end |
| **Horizontal nudge** | Error only — ±4 px |

---

## 8. Timing Orchestration (Motion lead)

| Pattern | Motion start | Sound offset | Haptic offset |
|---------|--------------|--------------|---------------|
| T1 Triad | 0 ms | +8 ms | 0 ms |
| T2 Micro | +4 ms | +12 ms | 0 ms |
| T3 Remote | 0 ms | +24 ms | +16 ms |
| T4 Presence | 0 ms | +40 ms | — |
| T5 Caution | +40 ms | +20 ms | 0 ms |

**Altın kural:** Tier A'da ses motion'dan önde başlamaz.

---

## 9. Anti-Patterns

- Infinite bounce on alerts
- Parallax on operational confirms
- Motion without state change
- 500 ms+ block before user action
- Different easing per platform (iOS/Android same spec)
- Spinner as brand loading
- Elastic rubber band on cards

---

## 10. Cross-Reference

- Haptic: `HAPTIC_DNA.md`  
- Light: `LIGHT_DNA.md`  
- Sonic: `SONIC_DNA.md`  
- Logo boot: `LOGO_DNA.md` §5

**Non-goals:** Kod implementasyonu yok; Reanimated spec only.
