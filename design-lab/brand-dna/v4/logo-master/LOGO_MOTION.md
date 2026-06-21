# LeylekTAG Logo Motion DNA

**Version:** Logo Motion v1.0  
**Status:** Analysis only  
**Parent:** `MOTION_DNA.md`, `LIGHT_DNA.md`, `LSX_MOTION_LANGUAGE.md`

---

## 1. Motion Karakteri

Logo hareketi **optical-kinetic presence** — nefes alır, kilitlenir, asla bağırmaz.

| Attribute | Logo değeri |
|-----------|-------------|
| Karakter | Apple restraint + Tesla lock snap + DJI precision |
| North Star | Sessiz nefes; onay = inward close |
| Değil | Bounce, spin, particle, casino celebration |

Logo motion = `v4.motion.*` token'larının **görsel anchor yüzeyi**. Marker ve UI ile aynı timing.

---

## 2. Easing (logo-spesifik)

| Token | Cubic-bezier | Logo kullanımı |
|-------|--------------|----------------|
| Premium stop | `(0.22, 1, 0.36, 1)` | Boot settle, dismiss |
| Lock snap | `(0.34, 1.56, 0.64, 1)` | Ring close only; max 1.06 |
| Exit dismiss | `(0.4, 0, 0.2, 1)` | Splash handoff |
| Breathe | Sine loop | Idle splash hold |

---

## 3. Boot — Açılış (T4 Presence)

**Total narrative:** ≤550 ms  
**Token:** `v4.motion.presence.pulse` + `v4.motion.splash.handoff`

```
ms    Logo                    Glow              Chrome
────  ─────────────────────   ───────────────   ─────────────
0     opacity 0→1 (120ms)     —                 void ground
0     scale 0.96→…            —                 —
40    sonic +40ms A3 attack   fade in start     —
120   opacity 1                 0→0.15            —
160   scale peak 1.03         0.25 max          —
280   sonic phase 2 gap end   hold              —
400   scale settle 1.0        fade 0.15→0.08    —
550   handoff fade 150ms      off               app chrome in
```

| Kanal | Boot |
|-------|------|
| Motion | presence.pulse 220 ms core |
| Sound | presence.boot +40 ms — **ses önde değil** |
| Haptic | Yok |
| Glow | Cyan 0.25 max 120 ms — `LIGHT_DNA.md` |

**Splash layout:** Logo merkez veya alt-üçte bir; wordmark ayrı katman (stagger +40 ms).

---

## 4. Eşleşme (Match)

| Parametre | Değer |
|-----------|-------|
| Token | `v4.motion.pulse.journey` |
| Süre | 480 ms |
| Logo | Symbol breathe scale 1.0→1.04→1.0 |
| Ring | Idle ring opacity 0.6→0.8 pulse |
| Glow | Warm Resolve 0.20 — journey token |
| Ses | match.success — frame 0 sync |
| Harita | Marker connection line — logo ayrı ekranda statik breathe |

**Kural:** Match'te logo spin/burst yok — chrome + marker taşır enerji; logo subtle.

---

## 5. QR — Lock

| Phase | Token | Süre | Logo |
|-------|-------|------|------|
| Camera open | viewfinder fade | 120 ms | Statik |
| Decode | `scan.viewfinderFlash` | 100 ms | Ring border flash |
| Verified | `lock.ringClose` | 320 ms | Ring stroke 100%→0 |
| Peak | glow.lock | 80 ms | Cyan flash @ peak |
| Error | `error.nudge` | 180 ms | ±4 px horizontal — logo only on QR overlay context |

**Marker sync:** `lock.ringClose` **aynı frame, aynı süre, aynı stroke animasyonu** — multimodal mühür.

---

## 6. Trust

| Olay | Motion | Logo |
|------|--------|------|
| Trust accept | `success.checkDraw` 360 ms | Check overlay on symbol |
| Trust badge | `online.glow` 400 ms | Warm ring micro pulse once |

Logo ring + warm resolve — gamification badge animasyonu yok.

---

## 7. Loading

| Tür | Motion | Logo |
|-----|--------|------|
| Boot | presence.pulse | Logo animated |
| App data fetch | `loading.indeterminate` | Meridian sweep along horizon — 1500 ms loop |
| Session restore | Statik symbol + spinner **yasak** | Sweep or breathe |

**Yasak:** Generic circular spinner as brand moment.

---

## 8. Idle Davranışları

| Context | Logo motion |
|---------|-------------|
| Splash hold (pre-nav) | breathe 2 s opacity 0.92↔1.0; scale ±2% |
| App chrome header | **Statik** — glow off |
| Waiting screen watermark | Opacity 0.15 static — no pulse |
| Website hero | breathe reduced amplitude ±1% |
| Watch | **Statik** |
| CarPlay | **Statik** |

**North Star:** Idle = sessiz; nefes yalnızca **bilinçli waiting** yüzeylerinde.

---

## 9. Leylek Zeka (AI Orb)

| State | Token | Süre | Logo |
|-------|-------|------|------|
| Open | `ai.orbExpand` | 300 ms | Symbol → orb; glass halo |
| Think | `ai.think` loop | 1200 ms | Core pulse glow only |
| Response | checkDraw micro | 200 ms | Single resolve flash |
| Dismiss | dismiss.sheet | 280 ms | Orb → symbol |

Orb core = logo symbol geometry — expand path morph, yeni form değil.

---

## 10. Offer / Relay (logo context)

Driver offer ekranında logo genelde görünmez. **Exception:**

| Context | Motion |
|---------|--------|
| Offer card header mark | `relay.ingress` 260 ms — iki nokta birleşir → symbol |
| Push → app open | Boot kısaltılmış 400 ms |

---

## 11. Payment

| Phase | Motion | Logo |
|-------|--------|------|
| Confirmed | `success.checkDraw` 360 ms | Check on symbol |
| Lock echo | `lock.ringClose` 320 ms | Ring close (QR sonrası) |

---

## 12. Dismiss ve Exit

| Olay | Motion | Logo |
|------|--------|------|
| Logout | dismiss descend | opacity fade + scale 0.98 |
| Journey end | dismiss 280 ms | Symbol fade |
| Modal close | dismiss.sheet | Logo statik |

---

## 13. Direction Semantiği (logo)

| Yön | Anlam | Logo örneği |
|-----|-------|-------------|
| Ascend | Bilgi, offer | Ingress scale up |
| Inward | Onay, lock | Ring close |
| Expand | Journey, AI | Orb expand |
| Descend | Çıkış | Splash handoff |

---

## 14. Timing Orchestration

| Pattern | Motion start | Sound | Logo peak |
|---------|--------------|-------|-----------|
| T4 Presence (boot) | 0 ms | +40 ms | 160 ms |
| T1 Triad (match) | 0 ms | +8 ms | 240 ms |
| T3 Remote (QR remote) | 0 ms | +24 ms | 160 ms |
| Lock | 0 ms | sync peak | 80 ms flash |

**Altın kural:** Tier A'da ses motion'dan önce başlamaz (boot +40 ms istisna offset — görsel önce 0 ms).

---

## 15. Platform Adaptasyonları

| Platform | Logo motion |
|----------|-------------|
| iOS splash | Full T4 |
| Android splash | Full T4 |
| Web hero | presence.pulse on load; `prefers-reduced-motion` → static |
| Watch | Statik |
| Widget | Statik |
| Notification | Statik icon |
| CarPlay | Statik |

---

## 16. Lottie Spec (Phase 3 hedef — analiz)

| Asset | Süre | FPS | Layers |
|-------|------|-----|--------|
| `logo-boot-presence.lottie` | 550 ms | 60 | symbol, ring, glow, accent |
| `logo-lock-ring.lottie` | 320 ms | 60 | ring stroke only |
| `logo-sweep-loading.lottie` | 1500 ms loop | 30 | horizon sweep |

**Kural:** Lottie path = master SVG path — ayrı çizim yok.

---

## 17. Anti-Patterns

- Logo bounce on notification
- Spinning logo on loading
- Parallax logo on scroll (web)
- Different boot timing iOS vs Android
- Elastic rubber band on symbol
- Particle burst on match
- Continuous logo spin on waiting

---

## 18. QA Checklist

- [ ] Boot ≤550 ms total
- [ ] Lock ring = marker ring frame-accurate
- [ ] Idle header logo static
- [ ] Reduced motion fallback
- [ ] Lock overshoot ≤1.06
- [ ] No spinner brand moment

---

**Non-goals:** Lottie/Reanimated implementasyonu yok.
