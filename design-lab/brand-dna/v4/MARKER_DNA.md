# LeylekTAG Marker DNA v4

**Version:** Brand DNA v4.0 — Marker Layer  
**Parent:** Marker Constitution, MARKER_DNA_V3, LSX Motion Language  
**Scope:** Analysis & specification only

---

## 1. Marker Felsefe

Harita marker'ları LeylekTAG'ın **harita yüzündeki canlı imzasıdır**. Marker sadece ikon değildir — **canlı bir sistemdir**: nefes alır, kilitlenir, relay yapar, cluster olur, öncelik taşır.

| İlke | V4 tanım |
|------|----------|
| Canlı ama sakin | Nefes pulse; agresif bounce yok |
| Premium minimal | Tek siluet + kontrollü glow |
| Güven | Net form; belirsiz blob yok |
| Aile | Tüm türler aynı DNA |
| Sistem | Durum = davranış; statik pin yok |
| Değil | Taksi sarısı, kurye kırmızısı, oyun power-up, generic pin |

**North Star testi:** Marker'a bakan **"Bu LeylekTAG haritası"** demeli — Uber siyah pin, Google kırmızı nokta değil.

---

## 2. Marker Ailesi — Tek Genom

V4'te marker ailesi genişletildi. Hepsi aynı yapı taşlarını paylaşır:

```
        ┌─────────────────┐
        │   Glow halo     │  ← Meridian Cyan @ 15–25% opacity
        │  ┌───────────┐  │
        │  │  Core     │  │  ← Depth Slate #1A2332 + Trust White edge
        │  │  siluet   │  │
        │  └───────────┘  │
        │   State ring    │  ← Durum: lock, relay, trust, AI
        │   Direction     │  ← Hareket yönü (araç) / baki (yolcu)
        └─────────────────┘
              ▲ anchor (map pin center)
```

### 2.1 Form dili

| Öğe | Spec |
|-----|------|
| Köşe dili | 2–4 px radius; keskin ama acımasız değil |
| Çizgi kalınlığı | Min 2 px @ 48 px export |
| Siluet | Tek ana blok + en fazla 1 yardımcı form |
| İç detay | Yok (plaka, cam, yüz yok) |
| Anchor | Geometrik merkez veya alt-orta (yolcu, destination) |

### 2.2 Renk hiyerarşisi

| Rol | Renk | Opacity | Öncelik |
|-----|------|---------|---------|
| Gövde | `#1A2332` Depth Slate | 100% | Base |
| Kenar | `#F5F7FA` Trust White | 85% | Readability |
| Aktif glow | `#00D4AA` Meridian Cyan | 15–40% | State |
| Eşleşme / lock | `#00D4AA` ring | 30–50% peak | Tier A |
| Trust overlay | `#C8E6D0` Warm Resolve | 20% | Trust state |
| AI overlay | Cyan + white core | 25% pulse | AI active |
| Uyarı | `#FFB020` Amber | 25% max | Error only |
| Offline | Gray desaturate | 40% opacity | Deprioritize |

---

## 3. Marker Türleri

### 3.1 Driver (Araç / Motor)

| Özellik | Araba | Motor |
|---------|-------|-------|
| Siluet | Yatay dört tekerlek; geniş gövde | İki tekerlek; dar, hafif eğik |
| Yön | Heading rotation — smooth 120 ms | Aynı |
| Boyut | 32 px default; 24 px min | Aynı bounding box |
| Canlılık | Hareket halinde glow trail 1 px cyan, fade 400 ms | Aynı |
| Ayrım | Form birincil — renk kodu yetmez | Form birincil |

### 3.2 Passenger (Yolcu)

| Özellik | Spec |
|---------|------|
| Siluet | Ayakta figür — baş/gövde/bacak oranı net |
| Yön | Baki; rotation yok |
| Anchor | Alt-orta (ayak tabanı) |
| Pulse | waiting.breathe 2 s loop |
| Güven | Tanınabilir insan; stick figure / cartoon değil |

### 3.3 Trust

| Özellik | Spec |
|---------|------|
| Overlay | Warm Resolve ring @ 20% on existing marker |
| Trigger | Trust relationship active |
| Animation | Micro pulse once on accept; 360 ms |
| Ses/haptic | trust.micro + success |
| Değil | Rozet, yıldız, gamification badge |

### 3.4 Quick Match

| Özellik | Spec |
|---------|------|
| Overlay | Cyan comms ring — dashed → solid 260 ms |
| Trigger | QM ops call active |
| Priority | Above idle; below offer |
| Animation | relay.ingress scale 1→1.03→1 |
| Ses | quickMatch.ops (C♯4 kök) |

### 3.5 Online / Offline

| Durum | Görünüm |
|-------|---------|
| Online | Breathe glow 0.15 opacity; 2 s loop |
| Offline | Opacity 0.4; glow off |
| Going online | online.glow 400 ms fade in |
| Going offline | Glow release 280 ms fade out |

### 3.6 Destination

| Özellik | Spec |
|---------|------|
| Form | Horizon dot + vertical stem (minimal pin değil — meridian nokta) |
| Renk | Cyan accent dot; slate stem |
| Anchor | Tam hedef koordinat |
| Animation | Soft pulse on set; no continuous blink |
| Cluster | Destination cluster = en yüksek zoom'da ayrışır |

### 3.7 Journey (aktif yolculuk)

| Özellik | Spec |
|---------|------|
| Connection line | Cyan `#00D4AA` @ 30%, 2 px |
| Line animation | Dashed → solid 480 ms on match |
| Trail | Direction trail on driver; fade tail 400 ms |
| Midpoint | Optional lock icon @ QR verified |
| End | Line dissolve 280 ms on journey end |

### 3.8 Waiting

| Özellik | Spec |
|---------|------|
| Passenger | waiting.breathe opacity 0.4↔0.7 |
| Driver | Soft online breathe |
| Ses | Bilinçli sessizlik (Tier C) |
| Değil | Spinner, loading bar on map |

### 3.9 Pickup / Dropoff

| Özellik | Pickup | Dropoff |
|---------|--------|---------|
| Overlay | Cyan ring expand once | Warm Resolve ring once |
| Duration | 320 ms | 320 ms |
| Ses | journey.start | payment.confirmed veya journey.end |
| Marker | Passenger pin highlight | Destination pin highlight |

### 3.10 AI (Leylek Zeka harita modu)

| Özellik | Spec |
|---------|------|
| Overlay | Cyan halo pulse 0.20↔0.35; 1.5 s loop |
| Core | White dot center — logo symbol micro |
| Trigger | AI route suggestion / smart match |
| Değil | Robot icon, chat bubble on map |

---

## 4. Canlı Sistem Parametreleri

### 4.1 Glow

| Token | Opacity | Fade | Kullanım |
|-------|---------|------|----------|
| `glow.presence` | 0.15–0.25 | 120 ms in | Online, idle |
| `glow.relay` | 0.30–0.40 | 260 ms trail | Offer, QM |
| `glow.lock` | 0.50 peak | 80 ms flash + 240 ms out | QR, payment |
| `glow.journey` | 0.20 | 480 ms breathe | Match |
| `glow.trust` | 0.20 | 360 ms | Trust accept |
| `glow.ai` | 0.20–0.35 | 1.5 s loop | AI active |
| `glow.caution` | 0.25 | 180 ms | Error |

**Kural:** Max opacity 0.7; harita okunabilirliğini bozmaz.

### 4.2 Pulse / Breathe

| Durum | Scale | Opacity | Süre | Loop |
|-------|-------|---------|------|------|
| Idle online | 1.0 ↔ 1.02 | 0.4 ↔ 0.7 | 2000 ms | Evet |
| Offer relay | 1.0 → 1.03 → 1.0 | — | 260 ms | Hayır |
| Match | 1.0 → 1.04 → 1.0 | — | 480 ms | Hayır |
| QR lock | ring close | flash peak | 320 ms | Hayır |
| Waiting | — | 0.4 ↔ 0.7 | 2000 ms | Evet |

**Marker nefes almalı mı?** Evet — idle ve waiting durumlarında. **Ne kadar?** Scale max ±2%; opacity ±30%; 2 s period. Daha fazlası = dikkat dağıtıcı / yorgunluk.

### 4.3 Scale

| Event | Scale range |
|-------|-------------|
| Default | 1.0 |
| Relay ingress | 1.0 → 1.03 → 1.0 |
| Match pulse | 1.0 → 1.04 → 1.0 |
| Selection | 1.0 → 1.06 → 1.0 (snap) |
| Cluster expand | 1.0 → 1.08 (tap to expand) |

### 4.4 Shadow / Depth

| Katman | Spec |
|--------|------|
| Drop shadow | 0 2 px 4 px rgba(0,0,0,0.25) — subtle |
| Inner edge | 1 px Trust White @ 85% |
| Z-order | Selected > Offer > Active > Idle > Offline |

### 4.5 Selection / Hover / Navigation

| Eylem | Davranış |
|-------|----------|
| Tap select | Scale 1.06 snap 120 ms + glow peak |
| Deselect | Scale 1.0 premium stop 180 ms |
| Hover (web) | Glow +2% opacity; no scale |
| Navigation focus | Direction trail activate; driver leading |

### 4.6 Distance / Priority

| Mesafe | Davranış |
|--------|----------|
| < 500 m | Full marker + glow |
| 500 m – 2 km | Core siluet; reduced glow |
| > 2 km | Min siluet; no trail |
| Priority | Offer > QM > Journey > Trust > Idle |

### 4.7 Cluster

| Kural | Spec |
|-------|------|
| Threshold | 3+ markers same 48 px cell |
| Visual | Count badge + merged glow |
| Tap | Expand stagger 40 ms per marker |
| Color | Dominant state wins (offer > idle) |

### 4.8 Transition

| Geçiş | Süre | Easing |
|-------|------|--------|
| Offline → Online | 400 ms | premium stop |
| Idle → Offer | 260 ms | relay |
| Match → Journey | 480 ms | journey pulse |
| Journey → End | 280 ms | dismiss |
| State change | Crossfade opacity 120 ms min |

---

## 5. Motion Language (Marker)

| Token | Süre | Marker etkisi |
|-------|------|---------------|
| `presence.pulse` | 220 ms | — (logo only) |
| `relay.ingress` | 260 ms | Ingress glow trail |
| `lock.ringClose` | 320 ms | Ring stroke close |
| `pulse.journey` | 480 ms | Connection line + dual breathe |
| `waiting.breathe` | 2000 ms | Opacity loop |
| `online.glow` | 400 ms | Badge fade in |
| `remote.ack` | 320 ms | Ring close + chip |

**Kural:** Marker animasyonu ses öncesi veya aynı frame başlar (Tier A).

---

## 6. Harita Zoom Kuralları

| Zoom | Davranış |
|------|----------|
| ≤ 14 | Core siluet only; glow minimal |
| 15–17 | Full marker + direction |
| ≥ 18 | Glow + trail + state ring detail |

**Boyut testi zorunlu:** 24, 32, 48 px.

---

## 7. Durum → Marker Matrisi

| Durum | Driver | Passenger | Destination | Journey line | AI |
|-------|--------|-----------|-------------|--------------|-----|
| Offline | 0.4 opacity | — | Static | — | — |
| Online idle | Breathe | Breathe | Soft dot | — | — |
| Offer pending | Relay trail | — | — | — | — |
| QM active | Comms ring | — | — | — | — |
| Matched | Lock ring | Lock ring | Highlight | Solid forming | — |
| En route | Direction trail | Soft pulse | Pulse | Solid + tail | Optional |
| QR verified | Ring close | Ring close | — | Check midpoint | — |
| Trust active | Trust ring | Trust ring | — | — | — |
| AI suggest | — | — | AI overlay | AI path glow | Halo pulse |
| Journey end | Glow release | Fade | Resolve once | Dissolve | — |

---

## 8. Anti-Patterns

- Balon / damla pin (Google Maps generic)
- Sarı taksi, kırmızı acil nokta
- 3D gerçekçi render
- Tron neon grid
- Emoji marker
- Sürekli blink
- Marker sesi (ses ayrı kanal — marker görsel only)
- Farklı glow dili per marker type

---

## 9. Cross-Reference

- Light: `LIGHT_DNA.md` § Marker glow  
- Motion: `MOTION_DNA.md`  
- Sonic: `SONIC_DNA.md` § marker events  
- AI: `AI_DNA.md` § map overlay

**Non-goals:** PNG/SVG/Lottie üretilmedi; production marker değiştirilmedi.
