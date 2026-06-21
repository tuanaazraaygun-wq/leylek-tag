# LeylekTAG Marker DNA v3

**Version:** Brand DNA v3.0 — Marker Layer  
**Parent:** Marker Constitution, Marker Lab prompts, LSX Motion Language  
**Scope:** Analysis & specification only

---

## 1. Marker felsefe

Harita marker'ları LeylekTAG'ın **harita yüzündeki imzasıdır**. Uber'in siyah pin'i, Google'ın kırmızı noktası gibi — LeylekTAG marker'ına bakan **“Bu LeylekTAG haritası”** demeli.

| İlke | V3 tanım |
|------|----------|
| Canlı ama sakin | Nefes pulse; agresif bounce yok |
| Premium minimal | Tek siluet + kontrollü glow |
| Güven | Net form; belirsiz blob yok |
| Aile | Araç / yolcu / eşleşme aynı DNA |
| Değil | Taksi sarısı, kurye kırmızısı, oyun power-up |

---

## 2. Paylaşılan marker genomu

Tüm marker türleri şu yapı taşlarını paylaşır:

```
        ┌─────────────────┐
        │   Glow halo     │  ← Meridian Cyan @ 15–25% opacity
        │  ┌───────────┐  │
        │  │  Core     │  │  ← Depth Slate #1A2332 + Trust White edge
        │  │  siluet   │  │
        │  └───────────┘  │
        │   Direction     │  ← Hareket yönü (araç) / baki (yolcu)
        │   indicator     │
        └─────────────────┘
              ▲ anchor (map pin center)
```

### 2.1 Form dili

| Öğe | Spec |
|-----|------|
| Köşe dili | 2–4 px radius (vektör); keskin ama acımasız değil |
| Çizgi kalınlığı | Min 2 px @ 48 px export |
| Siluet | Tek ana blok + en fazla 1 yardımcı form |
| İç detay | Yok (plaka, cam, yüz yok) |
| Anchor | Geometrik merkez veya alt-orta (yolcu) |

### 2.2 Renk sistemi

| Rol | Dark theme | Light theme (gelecek) |
|-----|------------|----------------------|
| Gövde | `#1A2332` | `#2D3748` |
| Kenar / highlight | `#F5F7FA` @ 85% | `#FFFFFF` |
| Aktif glow | `#00D4AA` @ 40% max | `#00B894` |
| Eşleşme / lock | `#00D4AA` ring | Aynı hue, daha düşük opacity |
| Uyarı | `#FFB020` — nadiren | Marker'da minimum |

### 2.3 Glow & pulse (Light DNA marker tarafı)

| Durum | Glow | Pulse | Süre |
|-------|------|-------|------|
| Idle / online | 0.15 opacity halo | breathe 0.4↔0.7, 2 s loop | Tier C |
| Hareket halinde | direction trail | — | Rotasyon ile |
| Teklif / relay | ingress trail cyan | scale 1→1.03→1, 260 ms | Tier A |
| Eşleşme | ring expand + fade | 480 ms once | Tier A |
| QR verified | ring close (stroke) | 320 ms | Tier A |
| Hata | amber edge flash | 180 ms once | Tier B |

**Kural:** Glow asla full opacity; harita okunabilirliğini bozmaz.

---

## 3. Marker türleri — aynı dil, net ayrım

### 3.1 Araç markerı (araba)

| Özellik | Spec |
|---------|------|
| Siluet | Yatay dört tekerlek; geniş gövde |
| Yön | Heading rotation — smooth 120 ms interpolation |
| Boyut | 32 px default; 24 px min zoom-out |
| Canlılık | Hareket halinde hafif glow trail (1 px cyan, fade 400 ms) |
| Güven | Stabil siluet; drift jitter yok |

**Taksi/kurye değil:** Sarı/kırmızı renk yok; emoji araba yok.

---

### 3.2 Motor markerı

| Özellik | Spec |
|---------|------|
| Siluet | İki tekerlek; daha dar, hafif eğik |
| Ayrım | Form birincil — renk kodu tek başına yetmez |
| Boyut | Araba ile aynı bounding box |
| DNA | Aynı glow, kenar, pulse ailesi |

---

### 3.3 Yolcu / insan markerı

| Özellik | Spec |
|---------|------|
| Siluet | Ayakta figür — baş/gövde/bacak oranı net |
| Yön | Baki (rotation yok) veya hafif “bekleme” pulse |
| Anchor | Alt-orta (ayak tabanı) |
| Güven | Tanınabilir insan; stick figure değil, cartoon değil |

---

### 3.4 Eşleşme markerı (match state)

Eşleşme anında haritada **iki marker arası bağ** görünür:

| Öğe | Davranış |
|-----|----------|
| Connection line | Cyan `#00D4AA` @ 30%, 2 px, dashed → solid 480 ms |
| Midpoint badge | Küçük lock icon veya birleşen iki nokta |
| Pulse | Her iki marker eşzamanlı scale breathe |
| Ses/motion | `match.success` + `pulse.journey` ile lockstep |

**Metafor:** Digital relay — iki taraf aynı kanala bağlandı.

---

## 4. Durum → marker davranışı

| Durum | Araç | Yolcu | Eşleşme hattı |
|-------|------|-------|---------------|
| Offline | Opacity 0.4, glow off | — | — |
| Online idle | Breathe glow | Breathe | — |
| Offer pending | Ingress glow trail | — | — |
| Matched | Lock ring once | Lock ring once | Solid line |
| En route | Direction trail | Soft pulse | Solid, fade tail |
| QR verified | Ring close anim | Ring close | Line → check |
| Journey end | Glow release (fade) | Fade | Line dissolve |

---

## 5. Harita zoom kuralları

| Zoom | Davranış |
|------|----------|
| ≤ 14 | Sadece core siluet; glow minimal |
| 15–17 | Tam marker + direction |
| ≥ 18 | Glow + trail detay |

Küçük boyut testi zorunlu: **24, 32, 48 px**.

---

## 6. Sonic / motion / haptic eşleşmesi

| Olay | Marker | Ses | Motion |
|------|--------|-----|--------|
| Offer arrived | Ingress glow on driver pin | offer.* | relay.ingress |
| Match | Ring + connection line | match.success | pulse.journey |
| QR verified | ringClose on both | qr.success | lock.ringClose |
| Journey start | Trail activate | journey.start | pulse.journey |

Marker animasyonu **ses öncesi veya aynı frame** başlar (Tier A).

---

## 7. Anti-patterns (asla)

- Balon / damla pin (Google Maps generic)
- Sarı taksi ikonu
- Kırmızı acil nokta
- 3D gerçekçi araç render
- Aşırı neon Tron çizgisi
- Emoji tabanlı marker
- Sürekli blink (epilepsi / yorgunluk)

---

## 8. Üretim yolu (design-lab only)

1. `design-lab/markers/prompts/` — V3 DNA ile prompt güncelleme (Faz 2)
2. `exports/svg/` + `exports/lottie/` — statik + breathe pulse
3. Boyut matrisi QA
4. Production entegrasyon kararı ayrı PR

**Bu belge:** spec only; PNG/SVG/Lottie üretilmedi.
