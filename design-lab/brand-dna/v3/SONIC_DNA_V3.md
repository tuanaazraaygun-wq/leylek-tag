# LeylekTAG Sonic DNA v3

**Version:** Brand DNA v3.0 — Sonic Layer  
**Codename:** *Cyan Meridian Live*  
**Parent:** LSDS v2 (*Cyan Meridian Body*), LSX v1  
**Scope:** Analysis & specification only — no WAV generation in this patch

---

## 1. V3 Sonic Felsefe

V3 sesi **duyulabilir ama bağırmayan**, **canlı ama sakin** bir operasyon dili tanımlar. Ses tek başına “canlılık” vermez; motion ve haptic ile **Triad** içinde anlam kazanır.

| V1/V2 sorun | V3 hedef |
|-------------|----------|
| Teklif “duyuluyor” ama “gelmiyor” hissi | Relay metaforu — iki faz, ingress ile eşzamanlı |
| QR çok kısa / kayboluyor | Magnetic lock — attack tanımlı, A4 octave net |
| Boot sessiz | Presence boot — 220 ms nefes, logo ile lockstep |
| Remote QR sürücüde yok | `qr.remoteAck` — local lock'un kısa yankısı |

**Asla:** taksi kornası, casino fanfar, generic notification ping, Mixkit SFX, loop.

---

## 2. Genom (miras + V3 delta)

### 2.1 Pitch anchor (değişmez)

**A3 = 220 Hz** — güven zeminı. Tüm tokenlar bu aileden.

| Rol | Hz | Not | V3 kullanım |
|-----|-----|-----|-------------|
| Body | 110 | A2 | Meridian undertone (operasyonel tokenlar) |
| Root | 220 | A3 | Offer, boot, trust |
| Major third | 277 | C♯4 | Match, payment, QM |
| Fifth | 330 | E4 | Offer phase 2, resolve |
| Quick fifth | 349 | F4 | Urgent offer |
| Octave | 440 | A4 | QR lock, boot sparkle |
| Micro | 880 | A5 | UI tap |

### 2.2 V3 yeni tokenlar

| Token | Süre | Tier | Durum |
|-------|------|------|-------|
| `sonic.presence.boot` | 0.55–0.75 s | A | **Yeni — spec** |
| `sonic.qr.remoteAck` | 0.18–0.32 s | A | **Yeni — spec** |
| `sonic.qr.scanTick` | 0.04–0.08 s | B | **Yeni — micro** |
| `sonic.trust.micro` | 0.25–0.40 s | B | **Yeni — spec** |
| `sonic.leylek.open` | 0.30–0.50 s | B | **Yeni — spec** |
| `sonic.journey.start` | 0.45–0.65 s | A | Match'ten ayrık resolve |

Mevcut tokenlar (offer, QM, match, QR, payment, ui tap, brand signature) V2 body katmanını miras alır; V3 **orchestration + yeni token** ile tamamlanır.

---

## 3. Olay bazlı ses tasarımı

### 3.1 Açılış sesi (`sonic.presence.boot`)

**Metafor:** Kinetic pulse + glass air — sistem nefes alıyor, henüz konuşmuyor.

| Parametre | Değer |
|-----------|-------|
| Faz 1 | A3 + body, 180 ms attack, soft transient |
| Gap | 120 ms (logo pulse peak ile hizalı) |
| Faz 2 | E4 @ −6 dB, 200 ms — “açıldı” |
| Toplam | ≤ 750 ms |
| Haptic | Yok (T4 — silent mode friendly) |
| Motion eşleşmesi | `lsx.motion.presence.pulse` frame 0; ses +40 ms |

**Hissi:** Tesla uygulama açılışı kadar kısa, Apple boot kadar abartısız. Jingle değil — **presence**.

**Asla:** 2 sn logo sting, fanfar, vocal hook.

---

### 3.2 Teklif sesi (`sonic.driver.offer.classic` / `.urgent`)

**Metafor:** Digital relay — bilgi bir kanaldan geliyor, iki faz ile “iletilmiş” hissi.

| Variant | Faz 1 | Gap | Faz 2 | Karakter |
|---------|-------|-----|-------|----------|
| Classic | A3+body | 260 ms | E4 | Sakin dispatch |
| Urgent | A3+body | 175 ms | F4 + M2 partial | Ritim sıkı; gain değil |

**V3 canlılık gereksinimleri:**

1. Ses **kart ingress** ile aynı frame'de başlar (ses önde değil).
2. Classic vs urgent — 3 tekrar yorgunluk testi geçmeli.
3. QM ops'tan **timbral** ayrım: offer = A3 kök; QM = C♯4 kök.

**Fiziksel metafor eşlemesi:** Digital relay → motion `relay.ingress` → marker offer glow trail.

---

### 3.3 QR lock sesi (`sonic.qr.success` + `sonic.qr.remoteAck`)

**Metafor:** Magnetic lock — tek net “tık”, manyetik halka kapanması.

| Token | Süre | Pitch | Attack |
|-------|------|-------|--------|
| Local lock | 0.28–0.38 s | A4 fundamental + A3 undertone −18 dB | 8–12 ms transient (max) |
| Remote ack | 0.18–0.28 s | A4 → E4 mini resolve | Aynı DNA, %70 süre |

**V3 belirginlik kuralı:** QR lock, UI tap'ten **4× uzun** algılanmalı; offer classic'ten **2× kısa**. Telefon hoparlöründe 40% volume'de duyulabilir.

**Scan tick** (`sonic.qr.scanTick`): decode anı — 60 ms A5 whisper; viewfinder flash ile T2.

**Hata** (`sonic.qr.error`): G♯3 → A3 descent, 120 ms gap — caution, cezalandırıcı değil.

---

### 3.4 Match / journey start

| Token | Metafor | Süre | Duygu |
|-------|---------|------|-------|
| `sonic.match.success` | Journey door open | 1.15–1.45 s | Sıcak resolve — C♯4 → A3/E4 stack |
| `sonic.journey.start` | Kinetic pulse forward | 0.45–0.65 s | Match'ten kısa; “hareket başladı” |

**Match:** Kutlama değil — **ortak yolculuk onayı**. Phase gap 360 ms; release uzun ama casino değil.

**Journey start:** Match chime'den 400 ms sonra (veya boarding confirm) — tek faz ileri hareket (ascending fifth).

---

### 3.5 Payment / trust sesi

| Token | Metafor | Karakter |
|-------|---------|----------|
| `sonic.payment.confirmed` | Handshake lock | C♯4 → E4; match'ten daha “resmi”, daha kısa tail |
| `sonic.trust.micro` | Precision click + warm | A3 → C♯4; 300 ms max |

**Payment ≠ match:** Match duygusal sıcaklık; payment **güven mührü** — daha az harmonic stack, daha net attack.

---

### 3.6 Leylek Zeka sesi (`sonic.leylek.open`)

**Metafor:** Glass air — zeka katmanı açılıyor, alarm değil.

| Parametre | Değer |
|-----------|-------|
| Faz 1 | C♯4 soft, 150 ms |
| Faz 2 | A4 @ −12 dB, 100 ms |
| Loop | **Yasak** |
| Konuşma sırasında | Sessiz |

Orb expand animasyonu ile +16 ms; haptic `light` only.

---

## 4. Fiziksel metafor → ses haritası

| Metafor | Ses imzası | Partial / envelope |
|---------|------------|-------------------|
| **Magnetic lock** | Kısa A4 + undertone, keskin attack | Transient 8–12 ms |
| **Optical scan** | A5 micro blip | 60 ms, no body |
| **Digital relay** | İki faz, gap 175–275 ms | Body on phase 1 |
| **Kinetic pulse** | A3 body swell | Soft attack 40 ms |
| **Glass air** | h2 @ −18 dB, warm LP | No harsh highs |
| **Precision click** | A5 burst 65 ms | No undertone |

---

## 5. Loudness & fatigue (V3)

| Kural | Değer |
|-------|-------|
| Peak normalize | 0.85 linear (~−1.4 dBFS) |
| Urgent ≠ louder | Brighter partials + tighter gap |
| Boot | −3 dB vs offer (presence, not announcement) |
| QR lock | Same peak as offer; shorter = daha “keskin” algı |
| 3× repeat test | Offer, QM, match — Mild veya None |
| 10× tap test | ui.tap — None fatigue |

---

## 6. Haptic pairing (özet — detay MOTION_HAPTIC_DNA_V3.md)

| Token | Haptic |
|-------|--------|
| boot | — |
| offer classic | medium |
| offer urgent | double (80 ms) |
| match | success (+16 ms) |
| qr success | lock |
| qr remoteAck | remote |
| payment | success (+24 ms) |
| leylek open | light |
| ui tap | selection |

---

## 7. V2 → V3 promotion notları

| Mevcut V2 aday | V3 aksiyon |
|----------------|------------|
| brand_signature_v2* | Boot için remix → `presence.boot` (kısaltılmış) |
| driver_offer v2* | Canlılık = orchestration; timbre v2a/v2b korunabilir |
| qr_success_v2* | Attack güçlendir; remoteAck türet |
| — | `presence.boot`, `qr.remoteAck`, `journey.start` generate (Faz 2) |

---

## 8. Dinleme kabul kriterleri (V3)

Her token için:

- [ ] Telefon hoparlörü @40% duyulur
- [ ] 70% volume'de premium, ucuz değil
- [ ] İlgili motion ile 200 ms içinde “aynı olay” hissi
- [ ] Rakip bildirim / taksi sesine benzemez
- [ ] LeylekTAG ailesi (A3 anchor) tanınır

**Non-goals:** Bu belge WAV üretmez; `design-lab/sonic/v3/` Faz 2'de.
