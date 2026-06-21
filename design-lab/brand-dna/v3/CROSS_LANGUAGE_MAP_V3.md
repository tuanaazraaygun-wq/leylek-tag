# LeylekTAG Cross-Language Map v3

**Version:** Brand DNA v3.0  
**Purpose:** Her journey event'inde Sound · Marker · Logo · Motion · Haptic · Feeling tek satırda  
**Scope:** Analysis only

---

## 1. Master event table

Timing: **T1** Triad · **T2** Micro · **T3** Remote · **T4** Presence · **T5** Caution

| Event | Sound | Marker | Logo | Motion | Haptic | Feeling |
|-------|-------|--------|------|--------|--------|---------|
| **App Boot** | `presence.boot` — A3→E4 nefes, 550–750 ms | — | `presence.pulse` opacity+scale | `presence.pulse` 220 ms | — | “Sistem hazır; güvenli açılış” |
| **Driver Online** | — (sessiz) | Online breathe glow on vehicle pin | — | `online.glow` badge 400 ms | `light` | “Operasyona hazırım” |
| **Passenger Search** | — (bilinçli sessizlik) | Yolcu pin soft breathe | — | `waiting.breathe` 2 s loop | — | “Sakin bekleme; panik yok” |
| **Offer Arrived** | `driver.offer.*` — digital relay 2-faz | Driver pin ingress glow trail | — | `relay.ingress` 260 ms | `medium` / `double` urgent | “Görev geldi; net ve canlı” |
| **Quick Match** | `quickMatch.ops` — C♯4 comms | QM banner + pin highlight | — | `relay.ingress` | `medium` | “Operasyon masası arıyor” |
| **Match Success** | `match.success` — warm resolve | Connection line + dual ring | Symbol breathe | `pulse.journey` 480 ms | `success` +16 ms | “Eşleştik; yolculuk kapısı açıldı” |
| **QR Verified (local)** | `qr.success` — magnetic lock A4 | Both pins `ringClose` | Ring close on symbol | `lock.ringClose` 320 ms | `lock` | “Kilit tık; güvenli boarding” |
| **QR Verified (remote)** | `qr.remoteAck` — lock echo | Driver pin ring close | — | `remote.ack` + chip | `remote` | “Karşı taraf onayladı; boşluk kapandı” |
| **Journey Started** | `journey.start` — forward pulse | Direction trail activate | — | `pulse.journey` | `light` | “Hareket başladı” |
| **Payment Confirmed** | `payment.confirmed` — handshake | — | Check overlay on symbol | `lock.ringClose` + `checkDraw` | `success` +24 ms | “Resmi tamam; güven mührü” |
| **Trust Added** | `trust.micro` — warm click | — | Symbol micro pulse | `success.checkDraw` | `success` +16 ms | “İlişki güçlendi” |
| **Leylek Zeka Opened** | `leylek.open` — glass air | — | Orb expand from symbol | orb expand (existing) | `light` | “Zeka katmanı; sakin asistan” |

---

## 2. Secondary events (Tier B/C)

| Event | Sound | Marker | Logo | Motion | Haptic | Feeling |
|-------|-------|--------|------|--------|--------|---------|
| UI CTA press | `ui.tap` optional | — | — | `click.press` 90 ms | `light` | “Dokundum; yanıt var” |
| Role continue | `ui.tap` | — | — | `click.press` | `selection` | “Seçim onaylandı” |
| QR scan decode | `qr.scanTick` micro | Viewfinder edge | — | `scan.viewfinderFlash` | `light` | “Okundu” |
| QR error | `qr.error` | Amber edge flash | — | `error.nudge` | `warning` | “Tekrar dene; ceza yok” |
| Feedback error | `feedback.error` | — | — | `error.nudge` | `error` | “Bir şey yanlış; net” |
| Socket connected | — | — | — | dot pulse once | — | “Bağlantı canlı” (Tier C) |
| Logout | — | Glow release | Fade | dismiss descend | `light` on confirm only | “Oturum kapandı” |

---

## 3. Metafor → event eşlemesi

| Metafor | Primary events |
|---------|----------------|
| **Magnetic lock** | QR Verified, Payment Confirmed |
| **Optical scan** | QR scan decode, QR Verified (local) |
| **Digital relay** | Offer Arrived, Quick Match |
| **Kinetic pulse** | App Boot, Journey Started, Match Success |
| **Glass air** | Leylek Zeka Opened, boot phase 2 |
| **Precision click** | UI CTA, Trust Added |

---

## 4. Rakiplerden ayrışma analizi

### 4.1 Görsel / harita

| Rakip | Onların dili | LeylekTAG V3 farkı |
|-------|--------------|-------------------|
| Uber | Siyah pin, minimal, generic | Cyan meridian glow; leylek geometry; relay line |
| BiTaksi | Sarı taksi ikonu | Depth slate siluet; taksi rengi yok |
| Moovit | Transit mavi, çok bilgi | Operasyonel sakinlik; tek glow ailesi |
| Google Maps | Kırmızı pin standard | Özel marker DNA; platform imzası |

### 4.2 Ses / geri bildirim

| Rakip | Onların dili | LeylekTAG V3 farkı |
|-------|--------------|-------------------|
| Generic push | Tek “ding” | Olay-a özel token; A3 ailesi |
| Taksi | Horn / zil | Digital relay; sakin urgent |
| Oyun | Fanfar / coin | Warm resolve; kısa tail |
| iOS system | Tri-tone | Cyan Meridian; multimodal triad |

### 4.3 Mantık ödünç alma (kopyalama değil)

| Marka | Alınan mantık | LeylekTAG uygulaması |
|-------|---------------|---------------------|
| **Apple** | Kısa, tutarlı, cihaz genelinde tek karakter | Triad; boot presence; precision click |
| **Tesla** | Lock confirm, premium snap | `lock.ringClose` + magnetic lock ses |
| **DJI** | Optik-kinetik, “sistem hazır” | Scan flash, relay ingress, glow trail |

**LeylekTAG özü:** Türkiye operasyon platformu — **güven + yolculuk + topluluk**; leylek metaforu; cyan meridian; bilateral remote ack.

---

## 5. Feeling arc — tipik yolculuk

```
Boot          Search        Offer         Match         QR            Journey       Payment
  │              │             │             │             │               │             │
  ▼              ▼             ▼             ▼             ▼               ▼             ▼
Hazır ──→ Sakin ──→ Canlı ──→ Sıcak ──→ Kilit ──→ İlerleme ──→ Mühür
(presence)  (breathe)  (relay)   (resolve)  (lock)    (pulse)      (handshake)
```

Duygu eğrisi: düşük başlangıç → operasyonel yükseliş → kilit anları → sakin kapanış. Casino zirvesi yok.

---

## 6. Kanal zorunluluk matrisi

| Event | Min kanal sayısı | Zorunlu kanallar |
|-------|------------------|------------------|
| Tier A | 2 | Motion + (Sound veya Haptic); ikisi tercih |
| Boot | 2 | Motion + Sound |
| Remote QR | 3 | Motion + Haptic + Sound |
| Search | 1 | Motion only |
| UI tap | 2 | Motion + Haptic |

---

## 7. V2/LSX → V3 mapping

| LSX v1 event ID | V3 event adı | Delta |
|-----------------|--------------|-------|
| `boot.ready` | App Boot | `presence.boot` spec eklendi |
| `driver.offer.new` | Offer Arrived | Orchestration zorunlu |
| `qr.remote.ack` | QR Verified (remote) | T3 standard |
| `match.confirmed` | Match Success | Marker connection line |
| `leylek.open` | Leylek Zeka Opened | `leylek.open` ses spec |

---

## 8. Cross-reference

- Constitution: `BRAND_V3_CONSTITUTION.md`  
- Roadmap: `BRAND_V3_ROADMAP.md`
