# LeylekTAG Logo DNA v4

**Version:** Brand DNA v4.0 — Logo Layer  
**Scope:** Analysis & specification only — no logo asset production  
**Parent:** BRAND_CONSTITUTION_V4.md, Logo DNA v3

---

## 1. Bugünkü Logo Yeterli mi?

### 1.1 Mevcut durum analizi

Production'da kullanılan logo (`leylek-logo-premium.png`, `website/public/logo-leylek.svg`):

| Özellik | Mevcut | V4 hedef | Gap |
|---------|--------|----------|-----|
| Form | Harita pin + stilize kanat | Geometrik meridian + leylek siluet | Pin metaforu = Maps generic riski |
| Renk | Cyan-mavi gradient (`#67E8F9` → `#2563EB`) | Meridian Cyan `#00D4AA` + Depth Slate | Gradient fazla "app store 2020" |
| Glow | SVG soft glow filter | Kontrollü dijital enerji | Aşırı glow küçük boyutta blur |
| Geometry | Organik, çok path | Tek sürekli stroke + horizon | Master geometry yok |
| Monochrome | Test edilmemiş | Zorunlu varyant | Eksik |
| Motion spec | Yok | Boot/lock animasyon spec | Eksik |
| 10 yıl test | Pin trend riski | Timeless geometry | **Yetersiz** |

### 1.2 Karar

**Bugünkü logo V4 için yeterli değildir.**

**Neden:**
1. **Harita pin formu** Google Maps / konum uygulaması ailesine yakın — "Bu LeylekTAG" yerine "Bu bir konum app'i" riski.
2. **Gradient ağırlığı** küçük boyut (29 px app icon) ve monochrome print'te kaybolur.
3. **Meridian Cyan genom** ile renk uyumsuzluğu — sonic/marker/glow `#00D4AA` kullanır; logo farklı cyan ailesi.
4. **Animasyon potansiyeli** sınırlı — pin formu lock.ringClose metaforuna zayıf bağlanır.
5. **10 yıllık dayanıklılık** — pin + gradient kombinasyonu 2018–2022 app trend'ine ait.

**Ne korunabilir:**
- Leylek kanat metaforu (Türkiye göç kuşu = yol + güven)
- Cyan aile yönü (ton kalibrasyonu gerekli)
- Premium niyet (gradient yerine controlled accent)

---

## 2. 10 Yıl Kullanılabilecek Logo Nasıl Olmalı?

### 2.1 Master geometry

```
                    ╭── kanat arc (tek stroke)
                   ╱
        ──────────●──────────  ← meridian / horizon (A3 metaforu)
                   ╲
                    ╰── implicit leylek body (negative space)
```

| Parametre | Spec |
|-----------|------|
| Canvas | 1:1 (icon); 16:9 (splash); 4:1 (billboard wordmark) |
| Ana mark | Alt-üçte bir (horizon rule) veya merkez (icon) |
| Stroke | 2–3 px @ 512 px master; tek sürekli path tercih |
| Negatif alan | Aktif — %30+ boşluk zorunlu |
| Renk | Trust White `#F5F7FA` on Depth Slate `#1A2332`; accent Meridian Cyan `#00D4AA` |
| Grid | 8 px base; pixel-perfect; el çizimi hissi yok |

### 2.2 Karakter taşıma

| Kavram | Logo ifadesi |
|--------|--------------|
| **Leylek** | Zarif kanat arc — cartoon kuş yok |
| **Yol** | Yatay meridian / horizon çizgisi |
| **Güven** | Simetri, dengeli oran, kapalı form |
| **Hareket** | Sağa/yukarı 2–4° implicit flow |
| **Teknoloji** | Geometrik precision, cyan accent nokta |
| **Kilit** | Ring element — QR/payment lock animasyonu |

---

## 3. Yüzey Matrisi

### 3.1 App Icon

| Özellik | Spec |
|---------|------|
| Background | Void Black `#0D1117` veya Depth Slate |
| Symbol | Merkez; safe zone %80 |
| iOS/Android adaptive | Form crop-safe; mask test zorunlu |
| Min okunabilirlik | 29 px — siluet tanınır |
| Dark/Light | Dark birincil; light = inverted monochrome |

### 3.2 Website

| Varyant | Kullanım |
|---------|----------|
| Primary | Symbol + wordmark horizontal |
| Hero | Motion symbol only; wordmark ayrı katman |
| Favicon | Symbol only; 16/32/48 px |
| OG image | Symbol + horizon line; minimal text |

### 3.3 Apple Watch

| Varyant | Spec |
|---------|------|
| Complication | Symbol only; 2 renk max (white + cyan dot) |
| App icon | Symbol; no wordmark |
| Notification | Monochrome symbol on system background |

### 3.4 Widget

| Boyut | Spec |
|-------|------|
| Small | Cyan dot + status text; symbol optional |
| Medium | Symbol 24 px + journey status |
| Large | Symbol + map chrome |

### 3.5 Splash

| Özellik | Spec |
|---------|------|
| Ratio | 16:9 veya device-native |
| Animation | T4 Presence — 550 ms total |
| Background | Depth Slate gradient → app chrome |
| Logo position | Alt-üçte bir veya merkez |

### 3.6 Car Sticker / Billboard

| Özellik | Spec |
|---------|------|
| Form | Symbol + wordmark; yüksek kontrast |
| Renk | Monochrome veya cyan accent tek nokta |
| Min size | 50 mm sticker test |
| Uzaktan | Siluet tanınır — detay yok |

### 3.7 Avatar / Social

| Özellik | Spec |
|---------|------|
| Crop | 1:1 symbol center |
| Background | Depth Slate veya brand cyan solid |
| Min | 64 px readable |

### 3.8 Dark Mode / Light Mode

| Mode | Symbol | Background | Accent |
|------|--------|------------|--------|
| Dark (primary) | Trust White | Depth Slate / Void Black | Meridian Cyan |
| Light | Depth Slate | Trust White / `#F5F7FA` | `#00B894` (reduced opacity) |

### 3.9 Monochrome

| Varyant | Kullanım |
|---------|----------|
| White on dark | Primary dark surfaces |
| Black on light | Print, light theme |
| Single cyan | Accent-only marketing |
| Emboss / deboss | Physical touchpoints |
| Glass / metal | Premium packaging, vehicle badge |

### 3.10 Print

| Kural | Spec |
|-------|------|
| Min size | 15 mm symbol height |
| Color | Pantone equivalent of `#00D4AA` + black |
| Grayscale | %40–60 gray symbol; no gradient |

---

## 4. Logo Varyant Ailesi

| Varyant | Kullanım | Form değişimi |
|---------|----------|---------------|
| **Primary** | Splash, marketing | Tam işaret + wordmark |
| **Symbol** | App icon, favicon, watch | Sadece işaret |
| **Monochrome** | Watermark, harita, print | Tek renk siluet |
| **Motion** | Boot, loading | Animasyonlu symbol |
| **Orb** | Leylek Zeka | Symbol + glass air halo |
| **Lock** | QR/payment overlay | Ring element aktif |
| **Micro** | Notification, complication | 16 px simplified |

**Kural:** Tüm varyantlar **aynı anchor geometry** — scale/rotate dışında form değişmez.

---

## 5. Logo Animasyon DNA

### 5.1 Boot sequence (T4 Presence)

```
Frame 0 ms     Logo opacity 0 → 1 (120 ms)
Frame 0 ms     presence.pulse scale 0.96 → 1.0
Frame 40 ms    sonic.presence.boot attack (A3)
Frame 160 ms   Logo scale peak 1.03
Frame 280 ms   Boot sound phase 2 (E4 resolve)
Frame 400 ms   Logo settle scale 1.0
Frame 550 ms   Transition to app chrome
```

| Kanal | Boot |
|-------|------|
| Motion | `presence.pulse` 220 ms |
| Sound | `presence.boot` +40 ms |
| Haptic | Yok |
| Glow | Cyan halo fade in 120 ms, max 0.25 opacity |

### 5.2 Lock animasyonu (QR / payment)

- Ring stroke 100% → 0, 320 ms
- Cyan `#00D4AA` flash @ peak
- Ses: magnetic lock (A4)
- Marker `lock.ringClose` ile **aynı stroke animasyonu**

### 5.3 Logo hareket ettiğinde nasıl davranmalı?

| Hareket türü | Davranış | Easing |
|--------------|----------|--------|
| **Nefes (idle)** | Scale 1.0 ↔ 1.02, opacity 0.92 ↔ 1.0 | 2 s loop, sine-like |
| **Pulse (boot)** | Scale 0.96 → 1.03 → 1.0 | premium stop bezier |
| **Lock (onay)** | Ring inward close + micro scale snap | snap bezier, max 1.06 |
| **Relay (offer)** | İki nokta birleşir → symbol | relay.ingress 260 ms |
| **Dismiss** | Opacity fade + scale 0.98 descend | exit bezier 280 ms |
| **AI expand** | Symbol → orb; glass air halo | 300 ms expand |

**Asla:** Bounce, spin, particle explosion, elastic overshoot (lock hariç max 1.06).

---

## 6. Küçük Boyut & Uzaktan Görünürlük

| Test boyutu | Kriter |
|-------------|--------|
| 16 px | Cyan dot + siluet hint (favicon) |
| 24 px | Kanat arc tanınır |
| 29 px | iOS settings icon — tam symbol |
| 48 px | Horizon line görünür |
| 512 px | Master detail |
| 10 m (billboard) | Siluet only; wordmark ayrı |

**Red team:** Uber pin, Google pin, Waze ghost — yan yana kör test.

---

## 7. Tek Renk vs Çok Renk

| Versiyon | Kullanım | Renk sayısı |
|----------|----------|-------------|
| **Full color** | App, marketing hero | 3 (slate + white + cyan) |
| **Two-color** | Watch, widget | 2 (white + cyan accent) |
| **Monochrome** | Print, watermark, map | 1 |
| **Reversed** | Light theme | 1 (inverted) |

**Kural:** Çok renk versiyonu asla gradient blob değil — flat + accent nokta.

---

## 8. Logo ↔ Diğer DNA Katmanları

| Olay | Logo | Marker | Ses | Motion | AI |
|------|------|--------|-----|--------|-----|
| App boot | pulse | — | presence.boot | presence.pulse | — |
| Match | symbol breathe | connection line | match.success | pulse.journey | — |
| QR verified | ring close | ring close | qr.success | lock.ringClose | — |
| Payment | check overlay | — | payment.confirmed | checkDraw | — |
| Leylek Zeka | orb expand | — | leylek.open | orb expand | eye glow |
| Offer | — | ingress glow | offer.* | relay.ingress | dispatch hint |

---

## 9. Wordmark (LeylekTAG)

| Özellik | Spec |
|---------|------|
| Tipografi | Geometric sans — neutral, premium (Inter, SF Pro, custom geometric) |
| Leylek / TAG | Aynı ağırlık; TAG ayrı renk patlaması yok |
| Kerning | Sıkı ama okunaklı; L-E spacing referans |
| Renk | White primary; cyan sadece accent çizgide (opsiyonel) |
| Min width | 80 px readable |

---

## 10. Üretim Yolu (design-lab only — gelecek)

1. Master SVG 512 px — `design-lab/brand-dna/v4/exports/` (henüz yok)
2. Varyant matrisi QA: 16–512 px
3. Lottie boot 550 ms + lock 320 ms
4. Red team vs mevcut production logo
5. Stakeholder sign-off → asset PR (ayrı onay)

**Non-goals:** Bu belge logo dosyası üretmez; production icon değiştirilmedi.
