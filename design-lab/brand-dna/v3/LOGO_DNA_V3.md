# LeylekTAG Logo DNA v3

**Version:** Brand DNA v3.0 — Logo Layer  
**Scope:** Analysis & specification only — no logo asset production in this patch

---

## 1. Logo rolü

Logo, LeylekTAG'ın **en kısa marka imzasıdır**. Açılış animasyonu, app icon, harita watermark, bildirim ikonu ve Leylek Zeka orb'u aynı karakter ailesinden türemelidir.

**5 saniyelik test:** Logo animasyonu + boot sesi bitince kullanıcı **“LeylekTAG açıldı”** demeli — jingle hatırlamalı değil, **güven ve hazır olma** hissetmeli.

---

## 2. Karakter taşıma

### 2.1 Birleşen anlamlar

| Kavram | Logo ifadesi | Nasıl |
|--------|--------------|-------|
| **Leylek** | Zarif siluet veya stilize kanat çizgisi | Tek sürekli stroke; cartoon kuş yok |
| **Yol** | Yatay meridian / horizon çizgisi | A3 pitch metaforu — zemin çizgisi |
| **Güven** | Simetri, dengeli oran, kapalı form | Açık uçlu kaos yok |
| **Hareket** | İleri okuma — hafif ascend | Sağa/yukarı 2–4° implicit flow |
| **Teknoloji** | Geometrik precision, cyan accent | Pixel-perfect grid; el çizimi hissi yok |

### 2.2 Oran ve form

| Parametre | Spec |
|-----------|------|
| Canvas | 1:1 (app icon); 16:9 (splash) |
| Ana mark | Merkez veya alt-üçte bir (horizon rule) |
| Stroke | 2–3 px @ 512 px master |
| Negatif alan | Aktif — nefes alanı zorunlu |
| Renk | Trust White on Depth Slate; accent Meridian Cyan |

---

## 3. Yasak karakter aralıkları

| Aşırı uç | Neden yasak | V3 hedef |
|----------|-------------|----------|
| Çocukça | Güven zedelenir | Yetişkin, operasyonel |
| Taksi | Commodity ulaşım | Platform |
| Oyun | Dopamin bağımlılığı | Profesyonel yolculuk |
| Agresif | Alarm hissi | Sakin premium |
| Aşırı lüks | VIP rozeti | Sessiz kalite |
| Generic tech | Unutulabilir | Leylek + meridian özgün |

---

## 4. Logo varyantları (aile)

| Varyant | Kullanım | Fark |
|---------|----------|------|
| **Primary** | Splash, marketing | Tam işaret + wordmark |
| **Symbol** | App icon, favicon | Sadece işaret |
| **Monochrome** | Watermark, harita | Tek renk siluet |
| **Motion** | Boot, loading | Animasyonlu symbol |
| **Orb** | Leylek Zeka | Symbol + glass air halo |

Tüm varyantlar **aynı anchor geometry** — scale/rotate dışında form değişmez.

---

## 5. Açılış animasyonu → ses bağlantısı

### 5.1 Boot sequence (T4 Presence)

```
Frame 0 ms     Logo opacity 0 → 1 begins (120 ms)
Frame 0 ms     presence.pulse scale 0.96 → 1.0
Frame 40 ms    sonic.presence.boot attack (A3)
Frame 160 ms   Logo scale peak 1.03 (pulse)
Frame 280 ms   Boot sound phase 2 (E4 resolve)
Frame 400 ms   Logo settle scale 1.0
Frame 550 ms   Transition to app chrome
```

| Kanal | Boot davranışı |
|-------|----------------|
| **Motion** | `presence.pulse` — 220 ms |
| **Sound** | `presence.boot` — +40 ms delay |
| **Haptic** | Yok |
| **Glow** | Cyan halo fade in 120 ms, max 0.25 opacity |

**Logo ve ses aynı nefes ritminde** — ses logo'dan önce başlamaz (laggy hissiyat).

### 5.2 Lock animasyonu (QR / payment)

Logo symbol'ün **ring elementi** (varsa) marker `lock.ringClose` ile aynı stroke animasyonunu paylaşır:

- Ring stroke 100% → 0, 320 ms
- Cyan `#00D4AA` flash @ peak
- Ses: magnetic lock (A4)

Bu sayede QR onayında kullanıcı **“marka mührü”** hisseder.

---

## 6. Logo ↔ diğer DNA katmanları

| Olay | Logo | Marker | Ses |
|------|------|--------|-----|
| App boot | pulse | — | presence.boot |
| Match | symbol breathe | connection line | match.success |
| QR verified | ring close | ring close | qr.success |
| Payment | check overlay on symbol | — | payment.confirmed |
| Leylek Zeka | orb expand from symbol | — | leylek.open |

---

## 7. App icon ilkeleri

- Dark background `#0D1117` veya Depth Slate
- Symbol merkez; safe zone %80
- iOS/Android adaptive icon — form crop-safe
- Küçük boyutta (29 px) siluet okunur
- Rakip taksi/uber ikonlarına benzerlik **red team** ile kontrol

---

## 8. Wordmark (LeylekTAG)

| Özellik | Spec |
|---------|------|
| Tipografi | Geometric sans — neutral, premium |
| TAG vurgusu | Aynı ağırlık veya hafif lighter — ayrı renk patlaması yok |
| Kerning | Sıkı ama okunaklı |
| Renk | White primary; cyan sadece accent çizgide |

---

## 9. Gelecek üretim notları (Faz 3)

- Master SVG 512 px — `design-lab/brand-dna/v3/exports/` (henüz yok)
- Lottie boot 550 ms
- Ses sync marker: frame 40 boot sound
- A/B: mevcut production logo vs V3 spec karşılaştırması

**Non-goals:** Logo dosyası üretilmedi; production icon değiştirilmedi.
