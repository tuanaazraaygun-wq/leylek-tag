# LeylekTAG Logo Geometry — Master Spec (Analysis)

**Version:** Logo Geometry v1.0  
**Status:** Analysis & numeric specification — no SVG production  
**Parent:** `LOGO_CONSTITUTION.md`, `LOGO_DNA.md`, `MARKER_DNA.md`

---

## 1. Coordinate System

| Parametre | Değer |
|-----------|-------|
| Master canvas | 512 × 512 px (symbol) |
| Origin | Merkez (256, 256) |
| Grid base | 8 px |
| Pixel alignment | Tüm anchor noktaları 0.5 px offset yok — tam pixel |
| Aspect variants | 1:1 icon · 16:9 splash · 4:1 horizontal lockup |

---

## 2. Mevcut Geometri — Forensic Analiz

### 2.1 `logo-leylek.svg` (160 × 160 viewBox)

| Öğe | Geometri | Sorun |
|-----|----------|-------|
| Pin gövde | Teardrop: apex (80,24) → base (80,146); max width 88 px | Pin metaforu; aspect 1:1.58 |
| İç daire | cx=80, cy=69, r=29 | Pin iç “lens” — Maps generic |
| Kanat path | Organik bezier; ~60 px genişlik | İyi arc potansiyeli; pin içinde hapsolmuş |
| Cyan dot | r=8.5 @ merkez | Lock noktası olarak evrilebilir |
| Glow filter | blur σ=7 | 16 px'de tüm form erir |

**Oranlar:** Pin yüksekliği / genişlik ≈ 1.58. Kanat merkez pin daire içinde — optik ağırlık orta-üst.

### 2.2 `leylek-logo-premium.png`

| Öğe | Geometri | Sorun |
|-----|----------|-------|
| Kuş siluet | Profil; boyun + gaga + bacak | Favicon illegible |
| Orbital arc | ~270° sweep; alt kalın üst ince | Ring potansiyeli; 3D shading bağımlı |
| Aspect | ~1:1.2 dikey | App icon safe zone risk |
| Negatif alan | Arc içi — iyi | Kuş detayı dolu |

**Sonuç:** İki formun **ortak geometrik DNA yok** — birleştirme zorunlu.

---

## 3. V4 Master Geometry (hedef spec)

### 3.1 Konstrüksiyon şeması

```
Canvas 512×512
┌──────────────────────────────────────┐
│                                      │  ← 15% top margin (breath)
│         ╭── wing arc ──╮             │
│        ╱                ╲            │  ← wing: single stroke 2.5px @512
│   ─────●─────────────────●─────     │  ← horizon @ y=340 (66% — alt üçte bir)
│        ╲    lock ring    ╱           │  ← ring: inset 12% from wing bounds
│         ╰────────────────╯           │
│                                      │  ← 15% bottom margin
└──────────────────────────────────────┘
         ● cyan accent @ (horizon ∩ wing peak)
```

### 3.2 Bileşen parametreleri

| Bileşen | Parametre | Değer @ 512 px |
|---------|-----------|----------------|
| **Horizon** (`geo.horizon`) | Y konumu | y = 340 px (66.7% — alt üçte bir kuralı) |
| | Uzunluk | 68% canvas width (348 px) |
| | Stroke | 2.5 px (scale ile orantılı) |
| | Cap | Round |
| **Wing arc** (`geo.wingArc`) | Stroke | 2.5 px tek sürekli path |
| | Ascend angle | +2° → +4° implicit flow (sağa/yukarı) |
| | Apex | Wing peak x ≈ 62% canvas |
| | Bağlantı | Horizon merkezine tangent veya 8 px gap |
| **Lock ring** (`geo.lockRing`) | Tip | Stroke ring — dolu halka değil |
| | Radius | Wing bounds inset 12% |
| | Stroke | 2 px |
| | Animasyon | stroke-dashoffset 100%→0 |
| **Cyan accent** | Form | 6–8 px daire @ wing-horizon kesişimi |
| | Konum | Optik merkez — matematik merkez değil |

### 3.3 Oran tablosu

| Oran | Hedef | Gerekçe |
|------|-------|---------|
| Symbol width / height | 1:1 | Icon, favicon, watch |
| Horizon / total height | ~8–12% stroke band | Okunurluk |
| Wing arc / horizon width | 0.85–0.95 | Optik denge |
| Negatif alan | ≥30% | Sessizlik ekseni |
| Ring / wing bounds | 0.88 inset | Lock okunur ama baskın değil |
| Accent dot / horizon stroke | 2.5–3× | 16 px'de dot kalır |

---

## 4. Stroke, Radius, Corner

| Parametre | Symbol @ 512 | Marker @ 48 | Kural |
|-----------|--------------|-------------|-------|
| Primary stroke | 2.5 px | 2 px min | Marker ile paylaşımlı |
| Secondary stroke | 2 px (ring) | 1.5 px | Lock only |
| Corner radius | 2–4 px on implicit corners | 2–4 px | `MARKER_DNA.md` §2.1 |
| Stroke join | Round | Round | |
| Stroke cap | Round | Round | |

**Yasak:** Stroke > 4 px @ 512 (kalın = oyun UI). El çizimi jitter — grid snap zorunlu.

---

## 5. Simetri ve Optik Denge

| Öğe | Simetri | Optik düzeltme |
|-----|---------|----------------|
| Horizon | Bilateral simetrik | — |
| Wing arc | Asimetrik (ascend) | +2% sağa shift optik merkez |
| Accent dot | Horizon üzerinde | 1 px yukarı optik |
| Wordmark | Symbol altında veya sağında | Symbol optik ağırlık üst-orta |

**Alt-üçte bir kuralı:** Splash ve billboard'ta symbol baseline viewport'un alt %33 bandında — horizon çizgisi viewer'ın “zemin” algısını taşır.

---

## 6. Küçülme Ladder — Okunurluk

| Boyut | Görünür öğeler | Simplification tier |
|-------|----------------|---------------------|
| **16 px** | Cyan dot + horizon hint | Tier M0 micro |
| **20 px** | Dot + kısa horizon | M0 |
| **24 px** | Wing arc başlangıcı | Tier M1 |
| **29 px** | Tam arc (simplified) | M1 |
| **32 px** | Horizon tam + arc | Tier S standard |
| **48 px** | Ring hint | S |
| **64 px** | Ring tam | Tier F full |
| **128 px** | Tüm stroke detay | F |
| **512 px** | Master | F |

### 6.1 Simplification kuralları

| Tier | Ring | Wing | Horizon | Glow |
|------|------|------|---------|------|
| M0 | Gizli | 1 bezier | 1 line | Yok |
| M1 | Gizli | 2 bezier | Tam | Yok |
| S | İnce veya gizli | Tam path | Tam | Yok |
| F | Tam | Tam | Tam | Boot only |

**Kural:** Simplification = path point azaltma; **form metaforu değişmez**.

---

## 7. Yüzey-Spesifik Geometry

### 7.1 App Icon (iOS / Android)

| Parametre | Değer |
|-----------|-------|
| Canvas | 1024 × 1024 export |
| Safe zone | 80% — symbol bounding box |
| Android adaptive | Foreground: symbol only; background: Void Black veya Depth Slate flat |
| iOS mask | Squircle test — wing apex safe zone içinde |
| Padding | 12% minimum |

### 7.2 App Store / Play Store

| Asset | Geometry notu |
|-------|---------------|
| 1024 icon | Tier F symbol; no wordmark |
| Feature graphic | Symbol + wordmark horizontal 4:1 |
| Screenshot badge | Tier S symbol 48 px |

### 7.3 Apple Watch

| Varyant | Geometry |
|---------|----------|
| App icon | Tier M1 @ 44 px logical |
| Complication | Tier M0 — dot + line only |
| Notification | Monochrome Tier M0 |

### 7.4 Widget

| Boyut | Symbol |
|-------|--------|
| Small | M0 veya dot only |
| Medium | S @ 24 px |
| Large | S @ 32 px |

### 7.5 Araç ekranı (CarPlay / Android Auto)

| Kural | Değer |
|-------|-------|
| Form | Monochrome Tier S |
| Renk | White on system dark |
| Motion | Statik — animasyon yok |
| Min | 32 px equivalent |

### 7.6 Favicon

| Dosya | Boyut | Tier |
|-------|-------|------|
| favicon.ico | 16, 32 | M0/M1 |
| icon-192 | 192 | S |
| icon-512 | 512 | F |
| SVG favicon | scalable | S with media query |

---

## 8. Dark / Light Geometry

Geometry **renkten bağımsız** aynı path. Light mode: stroke kalınlığı değişmez; yalnızca fill/stroke token swap (`LOGO_COLOR_SYSTEM.md`).

| Mode | Symbol | Background |
|------|--------|------------|
| Dark | Trust White + cyan accent | Void / Slate |
| Light | Depth Slate + cyan accent | Trust White |

---

## 9. Print ve Fiziksel

| Uygulama | Min symbol height | Geometry notu |
|----------|-------------------|---------------|
| Kartvizit | 8 mm | Monochrome; ring opsiyonel gizli |
| Tişört | 40 mm | Tek renk siluet |
| Araç sticker | 80 mm | Siluet + wordmark ayrı |
| Ofis tabela | 200 mm+ | Horizon tam ölçeklenebilir |
| Emboss | 15 mm+ | Ring derinlik için min 2 mm stroke |

---

## 10. QA Checklist (geometry)

- [ ] 8 px grid snap tüm noktalar
- [ ] 16 px M0 tanınır (internal test n≥5)
- [ ] Squircle mask wing kesmiyor
- [ ] Horizon alt üçte bir bandında
- [ ] Ring stroke animasyonu path üzerinde closed loop
- [ ] Monochrome tek path veya compound path ≤3
- [ ] SVG path count ≤12 @ master
- [ ] Pin teardrop path **yok**

---

## 11. Phase 2 Sketch Lab Girdileri

1. 3 wing arc varyantı — ascend 2°, 3°, 4°
2. Negatif alan kuş (opsiyonel Phase 2B)
3. Ring inset 10% vs 12% vs 14%
4. Accent dot vs accent line segment
5. Kör test: 24 px yan yana Uber pin, Google pin, LeylekTAG

---

**Non-goals:** SVG/PNG üretimi yok. Sayısal spec sketch onayı sonrası kesinleşir (±0.5 px).
