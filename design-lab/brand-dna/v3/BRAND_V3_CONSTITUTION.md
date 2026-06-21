# LeylekTAG Brand DNA v3 — Constitution

**Version:** Brand DNA v3.0  
**Status:** Analysis & architecture only  
**Scope:** `design-lab/brand-dna/v3/` — no production changes  
**Authors:** Chief Brand Architect · Chief Sonic Architect · Chief Motion Designer · Chief Product Experience Director  
**Builds on:** LSDS v2 (*Cyan Meridian Body*), LSX v1, Marker Constitution, Marker Lab

---

## 0. Purpose

LeylekTAG V3 marka dili, ses / marker / logo / motion / haptic / glow / timing katmanlarını **tek bir aile** olarak tanımlar. Amaç: platform büyüdükçe her temas noktasında — harita, bildirim, açılış, QR, ödeme — kullanıcı ve operatör **“Bu LeylekTAG”** diyebilmeli.

Bu belge kod, asset veya production dokunmaz. Yalnızca marka karakterini, North Star'ı ve diğer V3 dokümanları arasındaki ilişkiyi sabitler.

---

## 1. LeylekTAG Marka Karakteri

### 1.1 Çekirdek eksenler

| Eksen | V3 tanımı | Ne değil |
|-------|-----------|----------|
| **Güven** | Her onay olayı kapanır; iki cihazda karşılıklı his | Boş bekleme, tek taraflı ses, belirsiz durum |
| **Yolculuk** | Hareket ileriye doğru; eşleşme bir kapı açılışı | Oyun seviyesi geçişi, casino kutlaması |
| **Topluluk** | İki taraf aynı dili duyar — remote ack zorunlu | Sadece aktör cihazında geri bildirim |
| **Operasyon** | Dispatch masası netliği; aciliyet ritim ve timbre ile | Taksi kornası, acil durum sireni, ham bildirim |
| **Teknoloji** | Optik-kinetik, manyetik kilit, dijital röle metaforları | Cyberpunk neon, Tron grid, sci-fi alarm |
| **Premium ama abartısız** | Sessiz güven; cam-hava, hassas tık | Altın kaplama, VIP rozeti, lüks fanfar |

### 1.2 Karakter cümlesi

> LeylekTAG, **güvenilir bir operasyon platformu** gibi davranır — taksi uygulaması gibi bağırmaz, ucuz bildirim gibi tıklamaz; premium bir kontrol odası kadar sakin, canlı bir sistem kadar yanıt verir.

### 1.3 Algı hedefleri (5 saniyelik test)

Bir kullanıcı uygulamayı açtığında veya teklif aldığında:

1. **Güvenli** — “Verilerim ve yolculuğum kontrol altında.”
2. **Canlı** — “Uygulama beni duydu, 200 ms içinde yanıt verdi.”
3. **Özgün** — “Uber/BiTaksi/Moovit değil; LeylekTAG.”
4. **Operasyonel** — “Profesyonel bir platform; oyun değil.”

### 1.4 Mevcut cihaz geri bildirimi → V3 yanıtı

| Geri bildirim | Kök neden (analiz) | V3 ilkesi |
|---------------|-------------------|-----------|
| Sesler çalışıyor ama canlı değil | Ses tek kanal; motion/haptic/timing eksik | **Triad zorunluluğu** — Tier A olaylarda ≥2 kanal |
| Teklif sesi canlı değil | Offer = sound only; kart ingress yok | `relay.ingress` + medium haptic + offer DNA |
| QR sesi belirgin değil | QR micro-blip; lock görseli zayıf | **Magnetic lock** — kısa ama keskin; ringClose + lock haptic |
| Açılış sesi yok | Boot = silent 300–800 ms | `presence.boot` + logo pulse (T4) |
| Sürücü remote QR hissi eksikti | Remote ack yoktu | LSX T3 triad — V3'te zorunlu standart |
| Premium / operasyonel / güvenli | Dağınık wiring | Tek **Brand DNA v3** ailesi |

---

## 2. V3 Unified DNA — Tek Aile

Tüm katmanlar aynı **Cyan Meridian** genomundan türetilir:

```
                    ┌─────────────────────────────────┐
                    │     BRAND DNA v3 — CORE         │
                    │  "Operational Presence"         │
                    │  Anchor: A3 · Cyan · Precision  │
                    └───────────────┬─────────────────┘
                                    │
     ┌──────────┬──────────┬───────┴───────┬──────────┬──────────┐
     ▼          ▼          ▼               ▼          ▼          ▼
  Sonic     Marker      Logo          Motion     Haptic    Light/Glow
  DNA       DNA         DNA           DNA        DNA       DNA
     │          │          │               │          │          │
     └──────────┴──────────┴─────── Timing DNA ───────┴──────────┘
                              (orchestration)
```

### 2.1 Paylaşılan metaforlar

| Metafor | Ses | Marker | Logo | Motion | Haptic | Glow |
|---------|-----|--------|------|--------|--------|------|
| **Magnetic lock** | QR/payment kilit tonu | Ring kapanışı | Logo halka birleşmesi | `lock.ringClose` | `lock` rigid | Cyan ring flash |
| **Optical scan** | Scan tick | Viewfinder çerçevesi | Işın geçişi | `scan.viewfinderFlash` | `light` | Border pulse |
| **Digital relay** | Offer/QM iki faz | Ingress glow | İki nokta birleşir | `relay.ingress` | `medium` | Relay trail |
| **Kinetic pulse** | Body undertone | Canlılık nefesi | Logo nefes | `presence.pulse` | — | Soft breathe |
| **Glass air** | Harmonik sheen | Cam kenar | Şeffaf katman | Smooth decel easing | — | Frost edge |
| **Precision click** | UI tap | — | Mikro snap | `click.press` | `selection` | — |

### 2.2 Renk ve ışık sabiti

| Token | Değer | Kullanım |
|-------|-------|----------|
| **Meridian Cyan** | `#00D4AA` (primary accent) | Glow, marker vurgu, logo lock |
| **Trust White** | `#F5F7FA` @ 92% | Logo / marker highlight |
| **Depth Slate** | `#1A2332` | Marker gövde, dark map uyumu |
| **Warm Resolve** | `#C8E6D0` @ 40% | Match / payment tamamlanma |

Glow asla “neon patlaması” değil — **kontrollü dijital enerji**: max opacity 0.7, fade 120–320 ms.

---

## 3. V3 North Star

> **LeylekTAG, güvenilir bir operasyon masası gibi nefes alır — her onay manyetik bir kilit gibi kapanır, her yolculuk optik bir ışık hattı gibi ilerler; premium ama sessiz, canlı ama sakin.**

---

## 4. Rakiplerden Ayrışma (özet)

| Referans | Alınacak mantık | Alınmayacak estetik |
|----------|-----------------|---------------------|
| **Uber / BiTaksi** | Durum = net geri bildirim | Taksi sarısı, horn, agresif bildirim |
| **Moovit / Google Maps** | Harita okunabilirliği | Generic pin, nötr mavi blob |
| **Apple** | Kısa, multimodal, tek karakter | iOS sistem sesi kopyası |
| **Tesla** | Lock confirm, premium snap | Araç UI klonu |
| **DJI** | Optik-kinetik, hassas | Drone / RC kumanda hissi |

**LeylekTAG'ın kendi hissi:** *Operational Presence* — Türkiye'nin güvenilir ulaşım platformu; leylek = yol + göç + güven metaforu; teknoloji görünür ama bağırmaz.

Detay: `CROSS_LANGUAGE_MAP_V3.md` § Rakip analizi ve `BRAND_V3_ROADMAP.md`.

---

## 5. Tier Sistemi (deneyim önceliği)

| Tier | Olaylar | Triad | V3 zorunluluk |
|------|---------|-------|---------------|
| **A** | Boot, offer, match, QR lock, payment, remote ack | Evet | Tüm kanallar senkron |
| **B** | CTA, role select, trust accept | Motion + 1 kanal | Haptic minimum |
| **C** | Waiting, map pan, online badge | Motion veya sessizlik | Bilinçli sessizlik |
| **D** | Poll, socket heartbeat | Sessiz | Dokunma |

---

## 6. Governance

| Rol | Sorumluluk |
|-----|------------|
| Chief Brand Architect | Constitution, logo/marker aile tutarlılığı |
| Chief Sonic Architect | `SONIC_DNA_V3.md`, LSDS v3 token spec |
| Chief Motion Designer | Motion, glow, timing — `MOTION_HAPTIC_DNA_V3.md` |
| Chief Product Experience Director | Cross-language map, journey öncelik, roadmap |

**Versiyon bump kuralı:** Tier A timing veya core metafor değişirse → Brand DNA v3.x minor; yeni metafor ailesi → v4.

---

## 7. Document Index

| Dosya | İçerik |
|-------|--------|
| `SONIC_DNA_V3.md` | Ses DNA, token spec, fiziksel metaforlar |
| `MARKER_DNA_V3.md` | Harita marker ailesi, glow, durum |
| `LOGO_DNA_V3.md` | Logo karakteri, açılış bağlantısı |
| `MOTION_HAPTIC_DNA_V3.md` | Motion, haptic, light/glow, timing |
| `CROSS_LANGUAGE_MAP_V3.md` | Event → tüm kanallar tablosu |
| `BRAND_V3_ROADMAP.md` | Fazlı uygulama yol haritası (design-lab) |

---

## 8. Non-Goals (bu patch)

- Kod, commit, asset üretimi yok  
- `frontend/`, `backend/`, production asset değişikliği yok  
- LSDS WAV regenerate yok (spec only)

**Sonraki adım:** `BRAND_V3_ROADMAP.md` Faz 1 — dinleme oturumu + boot/QR/remote token spec onayı.
