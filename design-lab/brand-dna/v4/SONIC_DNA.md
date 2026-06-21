# LeylekTAG Sonic DNA v4

**Version:** Brand DNA v4.0 — Sonic Layer  
**Codename:** *Cyan Meridian Live*  
**Parent:** LSDS v2, SONIC_DNA_V3, LSX v1  
**Scope:** Analysis & specification only — no WAV generation

---

## 1. V4 Sonic Felsefe

LeylekTAG sesi **markanın sesidir** — sadece güzel ses değil. Her token bir **olay anlamı** taşır; motion ve haptic ile Triad içinde tanınır.

| İlke | V4 tanım |
|------|----------|
| Duyulabilir ama bağırmayan | Peak −1.4 dBFS; urgent = ritim not gain |
| Canlı ama sakin | Body undertone; casino fanfar yok |
| Marka tanınır | A3 anchor; 200 ms içinde "LeylekTAG" |
| Multimodal | Ses tek başına Tier A'da yetmez |
| 10 yıl | Sine + kontrollü partial; trend SFX yok |

**Asla:** Taksi kornası, casino fanfar, generic notification ping, Mixkit SFX, loop, vocal hook.

---

## 2. Genom (10 yıl sabit)

### 2.1 Pitch anchor

**A3 = 220 Hz** — güven zeminı.

| Rol | Hz | Not | V4 kullanım |
|-----|-----|-----|-------------|
| Body | 110 | A2 | Meridian undertone |
| Root | 220 | A3 | Offer, boot, trust |
| Major third | 277 | C♯4 | Match, payment, QM |
| Fifth | 330 | E4 | Offer phase 2, resolve |
| Quick fifth | 349 | F4 | Urgent offer |
| Octave | 440 | A4 | QR lock, boot sparkle |
| Micro | 880 | A5 | UI tap, scan tick |

### 2.2 Envelope & duration

| Kural | Değer |
|-------|-------|
| One-shot only | Loop yasak |
| Max audible | 1.6 s |
| Silence tail | 95 ms max |
| Peak normalize | 0.85 linear (~−1.4 dBFS) |
| Synth | Sine primary; max 4 partials; FM index ≤ 0.06 |

---

## 3. Token Ailesi — Tam Registry

### 3.1 Boot (`sonic.presence.boot`)

| Parametre | Değer |
|-----------|-------|
| Metafor | Kinetic pulse + glass air |
| Süre | 550–750 ms |
| Faz 1 | A3 + body, 180 ms attack |
| Gap | 120 ms (logo pulse peak) |
| Faz 2 | E4 @ −6 dB, 200 ms |
| Tier | A (T4 — no haptic) |
| Platform | App, widget refresh, watch app open |

### 3.2 Offer (`sonic.driver.offer.classic` / `.urgent`)

| Variant | Faz 1 | Gap | Faz 2 | Karakter |
|---------|-------|-----|-------|----------|
| Classic | A3+body | 260 ms | E4 | Sakin dispatch |
| Urgent | A3+body | 175 ms | F4 + M2 | Ritim sıkı; gain değil |

Metafor: **Digital relay** — motion `relay.ingress` ile frame 0 sync.

### 3.3 Quick Match (`sonic.quickMatch.ops`)

| Parametre | Değer |
|-----------|-------|
| Kök | C♯4 (offer'dan timbral ayrım) |
| Süre | 0.45–0.65 s |
| Metafor | Comms channel — operasyon masası |
| FM | Phase 2 only; index ≤ 0.06 |

### 3.4 QR (`sonic.qr.success`, `.remoteAck`, `.scanTick`, `.error`)

| Token | Süre | Pitch | Metafor |
|-------|------|-------|---------|
| success (local lock) | 0.28–0.38 s | A4 + A3 undertone | Magnetic lock |
| remoteAck | 0.18–0.28 s | A4 → E4 mini | Lock echo — driver |
| scanTick | 0.04–0.08 s | A5 whisper | Optical scan |
| error | 0.15–0.25 s | G♯3 → A3 descent | Caution — ceza yok |

### 3.5 QR Remote

`sonic.qr.remoteAck` — T3 Remote Echo pattern. Sürücü cihazında zorunlu; ses kapalı olsa haptic devam.

### 3.6 Journey (`sonic.journey.start`, `.end`)

| Token | Süre | Karakter |
|-------|------|----------|
| start | 0.45–0.65 s | Ascending fifth — forward pulse |
| end | 0.35–0.50 s | Descending resolve — warm, kısa |

Match'ten ayrık; match = duygusal kapı; journey start = hareket.

### 3.7 Payment (`sonic.payment.confirmed`)

| Parametre | Değer |
|-----------|-------|
| Metafor | Handshake lock |
| Pitch | C♯4 → E4 |
| Karakter | Match'ten resmi; daha az harmonic stack |
| Süre | 0.40–0.55 s |

### 3.8 Trust (`sonic.trust.micro`)

| Parametre | Değer |
|-----------|-------|
| Metafor | Precision click + warm |
| Pitch | A3 → C♯4 |
| Süre | 0.25–0.40 s |
| Tier | B |

### 3.9 AI (`sonic.leylek.open`, `.think`, `.response`)

| Token | Süre | Karakter |
|-------|------|----------|
| open | 0.30–0.50 s | Glass air — orb açılış |
| think | — | **Sessiz** — görsel pulse only |
| response | 0.20–0.35 s | Soft C♯4 resolve — konuşma sırasında sessiz |

### 3.10 Warning / Error

| Token | Kullanım | Karakter |
|-------|----------|----------|
| `sonic.qr.error` | QR fail | Soft caution |
| `sonic.feedback.error` | System error | Net; warning'den ayrı |
| `sonic.warning.generic` | Ops alert | A3 pulse; no siren |

### 3.11 Button (`sonic.ui.tap`)

| Parametre | Değer |
|-----------|-------|
| Süre | 65 ms |
| Pitch | A5 burst |
| Partial | No undertone |
| Volume | 0.40 default; optional off |

### 3.12 Marker

Marker'ın kendi sesi **yok** — marker olayları ilgili token'ı tetikler (offer, lock, match). Harita sessiz kalır; olay sesi UI/haptic ile sync.

### 3.13 Widget

| Olay | Token |
|------|-------|
| Widget tap open app | `ui.tap` micro |
| Status change | — (sessiz) veya `presence.boot` micro 200 ms on first pin |

### 3.14 Apple Watch

| Olay | Token |
|------|-------|
| Complication tap | `ui.tap` |
| Offer on watch | `offer.urgent` shortened 70% |
| QR confirm | `qr.success` shortened |
| Haptic primary | Watch'ta ses varsayılan off — haptic öncelik |

### 3.15 Bildirim

| Tür | Token | Kural |
|-----|-------|-------|
| Offer push | offer.classic excerpt 0.3 s | Custom sound bundle |
| Match | match.success excerpt | |
| QR remote | qr.remoteAck | |
| Generic | **Yasak** — her bildirim token-specific |

### 3.16 Background / Foreground

| Durum | Davranış |
|-------|----------|
| Background | Push token only; no loop |
| Foreground | Full triad |
| Silent mode | Ses off; haptic+motion Tier A devam |
| DND | Tier A haptic only on watch |

### 3.17 Brand Signature (`sonic.brand.signature`)

| Parametre | Değer |
|-----------|-------|
| Kullanım | Marketing, website hero (optional), boot phase 1 source |
| Süre | Boot için remix → 550 ms max |
| Not | Jingle değil — presence source |

---

## 4. Referans Marka Mantık Analizi (estetik kopyalanmaz)

### 4.1 Apple

| Mantık | LeylekTAG uygulaması |
|--------|---------------------|
| Kısa, tutarlı, tek karakter | A3 ailesi; tüm platformlarda aynı token |
| Multimodal confirm | Triad zorunlu Tier A |
| Boot presence abartısız | T4 — 750 ms max; fanfar yok |
| **Alınmaz** | iOS tri-tone, SF sound kopyası |

### 4.2 Tesla

| Mantık | LeylekTAG uygulaması |
|--------|---------------------|
| Lock confirm premium snap | qr.success A4 magnetic lock |
| Kısa app açılış | presence.boot |
| **Alınmaz** | Araç UI sesleri, door chime |

### 4.3 DJI

| Mantık | LeylekTAG uygulaması |
|--------|---------------------|
| Optik-kinetik "sistem hazır" | scanTick + viewfinder flash |
| Hassas, operasyonel | QM comms timbre |
| **Alınmaz** | Drone motor, RC beep |

### 4.4 BMW

| Mantık | LeylekTAG uygulaması |
|--------|---------------------|
| Marka sesi tanınır ama abartısız | A3 anchor — BMW gong değil |
| Kalite = harmonic depth | Body undertone + glass sheen partial |
| **Alınmaz** | Startup gong, engine note |

### 4.5 Nintendo

| Mantık | LeylekTAG uygulaması |
|--------|---------------------|
| Her olay = distinct chime | Token per event; generic ping yasak |
| Kısa, memorable | Max 1.6 s |
| **Alınmaz** | 8-bit, coin sound, fanfar |

### 4.6 PlayStation

| Mantık | LeylekTAG uygulaması |
|--------|---------------------|
| Boot = brand presence | presence.boot — not orchestral |
| Tier hierarchy | A/B/C token priority |
| **Alınmaz** | PS1 startup, orchestral swell |

---

## 5. Fiziksel Metafor → Ses Haritası

| Metafor | Ses imzası | Partial / envelope |
|---------|------------|-------------------|
| Magnetic lock | A4 + undertone, 8–12 ms attack | Transient sharp |
| Optical scan | A5 micro 60 ms | No body |
| Digital relay | Two phase, gap 175–275 ms | Body phase 1 |
| Kinetic pulse | A3 swell 40 ms attack | Soft |
| Glass air | h2 @ −18 dB | Warm LP |
| Precision click | A5 burst 65 ms | No undertone |
| Handshake | C♯4 → E4 | Official resolve |

---

## 6. Loudness & Fatigue

| Kural | Değer |
|-------|-------|
| Boot | −3 dB vs offer |
| QR lock | Same peak; shorter = sharper perception |
| 3× repeat | Offer, QM, match — Mild veya None |
| 10× tap | ui.tap — None |
| Urgent ≠ louder | Brighter partials + tighter gap |

---

## 7. Haptic Pairing (özet — detay HAPTIC_DNA.md)

| Token | Haptic |
|-------|--------|
| boot | — |
| offer classic | medium |
| offer urgent | double |
| match | success +16 ms |
| qr success | lock |
| qr remoteAck | remote |
| payment | success +24 ms |
| journey start | light |
| trust | success +16 ms |
| leylek open | light |
| ui tap | selection |

---

## 8. LSDS v2 → v3 → v4 Lineage

| Versiyon | Katkı |
|----------|-------|
| LSDS v1 | A3 anchor, token ailesi, pitch grid |
| LSDS v2 | Meridian Body, transient rules, v2 WAV candidates |
| LSDS v3 (spec) | presence.boot, remoteAck, journey.start, leylek.open |
| V4 Sonic DNA | Full platform token map + competitor logic + AI tokens |

---

## 9. Dinleme Kabul Kriterleri

- [ ] Telefon hoparlörü @40% duyulur
- [ ] 70% volume premium, ucuz değil
- [ ] Motion ile 200 ms içinde "aynı olay"
- [ ] Rakip/taksi/generic benzemez
- [ ] A3 ailesi tanınır (blind test n≥8, ≥80%)
- [ ] 3× fatigue geçer
- [ ] Watch speaker @50% — shortened tokens clear

**Non-goals:** WAV üretilmedi; production sound değiştirilmedi.
