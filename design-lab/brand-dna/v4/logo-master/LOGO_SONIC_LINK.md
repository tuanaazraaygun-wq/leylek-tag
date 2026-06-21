# LeylekTAG Logo ↔ Sonic Link

**Version:** Logo Sonic Link v1.0  
**Status:** Analysis only  
**Parent:** `SONIC_DNA.md`, LSDS v2, `LSX_CONSTITUTION.md`

---

## 1. Felsefe

Logo ve ses **aynı nefes ritminde** — ayrı kanallar değil, tek olayın iki yüzü. 200 ms içinde kullanıcı "LeylekTAG yanıt verdi" demeli; jingle hatırlamalı değil, **güven ve hazır olma** hissetmeli.

**LSDS anchor:** A3 = 220 Hz = güven zeminı = horizon metaforu.

---

## 2. 200 ms Tanınırlık Modeli

| ms | Görsel (logo) | Ses | Algı |
|----|---------------|-----|------|
| 0–16 | Opacity/transform başlar | — | "Yanıt var" |
| 16–40 | Scale attack | A3 attack @ +40 boot | "Sistem canlı" |
| 40–120 | Glow fade in | Body undertone | "Marka" |
| 80–200 | Opacity commit / siluet net | Phase 1 peak | "LeylekTAG — generic değil" |

**Boot özel:** Ses +40 ms — görsel önce 0 ms; laggy hissiyat yok.

---

## 3. Boot — `sonic.presence.boot`

### 3.1 Ses spec (özet)

| Parametre | Değer |
|-----------|-------|
| Süre | 550–750 ms (app remix ≤550 ms) |
| Faz 1 | A3 + Meridian Body, 180 ms attack |
| Gap | 120 ms — **logo pulse peak @ 160 ms** |
| Faz 2 | E4 @ −6 dB, 200 ms resolve |
| Peak | −1.4 dBFS normalize |

### 3.2 Logo ↔ ses timeline

```
ms     Logo motion              Sonic                    Algı
────────────────────────────────────────────────────────────────
0      opacity 0→1              —                        Görsel lead
40     A3 attack görsel sync    presence.boot attack     "Hazır"
120    glow peak building       body swell               "Canlı"
160    scale 1.03 PEAK          gap başlangıcı           Nefes tepe
280    settle başlar            phase 2 E4 attack        Resolve başlar
400    scale 1.0                phase 2 decay            Kapanış
550    handoff                  tail 95 ms               Geçiş
```

### 3.3 Logo pulse = ses vücut

| Ses fazı | Logo hareketi |
|----------|---------------|
| A3 attack (body) | Scale 0.96→1.0 + opacity rise |
| Gap (sakin) | Hold 1.03 — nefes doruk |
| E4 resolve | Settle 1.03→1.0 |
| Tail | Glow fade — statik |

**Kural:** Logo pulse **metronom değil** — ses envelope'una mirror; linear loop yok.

---

## 4. Presence — Marka Varlığı

| Context | Ses | Logo |
|---------|-----|------|
| App cold open | presence.boot full | T4 splash |
| Widget first pin (opsiyonel) | presence.boot micro 200 ms | M0 static |
| Watch app open | ui.tap veya boot 70% shorten | Static |
| Website (gesture) | presence.boot | presence.pulse |

**200 ms kuralı:** İlk A3 transient + logo opacity 1 = presence tanınır.

---

## 5. Lock — QR / Payment

| Token | Ses | Logo |
|-------|-----|------|
| `sonic.qr.success` | A4 + A3 undertone, 0.28–0.38 s | lock.ringClose @ 0 ms |
| Peak | 8–12 ms attack transient | glow.lock @ 80 ms |
| `sonic.payment.confirmed` | C♯4→E4 handshake | checkDraw overlay |

**Magnetic lock metaforu:** Ses transient sharp = ring close görsel; ikisi aynı **kapanış** anı.

| ms | Ses | Logo |
|----|-----|------|
| 0 | A4 attack | Ring stroke animate start |
| 40 | Body | Ring 50% |
| 80 | Peak | Cyan flash + ring close peak |
| 160 | Decay | Ring complete |
| 320 | End | Statik locked state |

---

## 6. Match — `sonic.match.success`

| Parametre | Değer |
|-----------|-------|
| Pitch | C♯4 major third family |
| Süre | ~0.5 s |
| Logo | breathe 480 ms — ses ile frame 0 |
| Glow | Warm Resolve — ses harmonik sıcaklık |

Match sesi **fanfar değil** — logo da celebrate bounce değil.

---

## 7. Offer — Digital Relay

Logo doğrudan ses taşımaz; **relay ingress** ekranlarında:

| Token | Ses gap | Motion | Logo görünürlük |
|-------|---------|--------|---------------|
| offer.classic | 260 ms | relay.ingress | Header symbol |
| offer.urgent | 175 ms | same | same |

**İki faz ses = iki nokta birleşir** — logo ingress animasyonu varsa ses faz 1 = nokta görünür, faz 2 = symbol settle.

---

## 8. Trust — `sonic.trust.micro`

| Parametre | Değer |
|-----------|-------|
| Pitch | A3→C♯4 |
| Süre | 0.25–0.40 s |
| Logo | checkDraw 360 ms |
| Tier | B |

---

## 9. AI — `sonic.leylek.open`

| State | Ses | Logo |
|-------|-----|------|
| Open | Glass air harmonics | orbExpand 300 ms |
| Think | **Sessiz** | ai.think visual only |
| Response | Soft C♯4 | micro flash |

**Kural:** Think sırasında logo pulse ses **yok** — sessizlik tasarımı.

---

## 10. UI Tap — Logo butonları

Navbar logo tap → home: `sonic.ui.tap` 65 ms A5 — logo scale `click.press` 90 ms.

---

## 11. Haptic Pairing (logo context)

| Olay | Ses | Haptic | Logo |
|------|-----|--------|------|
| Boot | presence.boot | — | pulse |
| Match | match.success | success +16 ms | breathe |
| QR lock | qr.success | lock | ringClose |
| Payment | payment.confirmed | success +24 ms | checkDraw |
| Trust | trust.micro | success +16 ms | checkDraw |

Boot: **ses + haptic yok** — sakin açılış.

---

## 12. Loudness vs Logo

| Kural | Değer |
|-------|-------|
| Boot | −3 dB vs offer |
| Logo lock | Same peak; shorter = sharper |
| Urgent | Tighter gap — logo ingress hızlanır, gain artmaz |

---

## 13. Fatigue ve Logo

| Olay | 3× repeat | Logo |
|------|-----------|------|
| Boot | Her cold open | Full — fatigue düşük |
| Offer | Mild | Logo ingress her seferinde |
| ui.tap | None | — |

---

## 14. Platform Ses Davranışı

| Platform | Ses | Logo sync |
|----------|-----|-------------|
| iOS | Full tokens | Full motion |
| Android | Full tokens | Full motion |
| Watch | Default off | Static logo |
| Web | Gesture only | motion optional |
| CarPlay | Journey tokens | Static |
| Silent mode | Off | Motion continues Tier A |

---

## 15. Dinleme Kabul Kriterleri (logo+ses)

- [ ] 200 ms içinde "aynı olay" (motion+ses)
- [ ] Boot pulse peak @ 160 ms = sonic gap
- [ ] Lock peak frame-accurate ±16 ms
- [ ] A3 ailesi blind ≥80%
- [ ] Taksi/generic ping benzerliği 0
- [ ] Phone speaker @40% boot clear
- [ ] Logo görünür olmadan ses tanınırlığı — **fail** (logo gerekli Tier A)

---

## 16. Mevcut Production Gap

| Alan | Durum |
|------|-------|
| Boot ses wired | Spec var; logo motion sync yok |
| Logo form | Pin/kuş — lock ring animasyonu yok |
| Renk | Sonic meridian ≠ logo gradient |
| Website | Ses gesture; logo motion ayrı |

**Phase 4 hedef:** Tek `fireTriad('boot')` — logo Lottie + presence.boot + glow.

---

**Non-goals:** WAV üretimi, `sound.ts` değişikliği yok.
