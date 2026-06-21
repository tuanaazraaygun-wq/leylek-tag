# LeylekTAG Logo ↔ Marker Link

**Version:** Logo Marker Link v1.0  
**Status:** Analysis only  
**Parent:** `MARKER_DNA.md`, `LOGO_CONSTITUTION.md`, `LOGO_GEOMETRY.md`

---

## 1. Temel İlke

Logo ve marker **aynı genomdan türetilir** — kopya değil, **ortak DNA**. Haritada binlerce marker arasında ayrışma marker siluet + cyan breathe ile; logo harita pini **değil**.

```
                    ┌─────────────────────┐
                    │   BRAND GENOM v4    │
                    │ stroke · radius ·   │
                    │ cyan · ring · slate │
                    └──────────┬──────────┘
                               │
              ┌────────────────┴────────────────┐
              ▼                                 ▼
        LOGO (marka imza)              MARKER (harita canlı)
        wing arc + horizon              role siluet + state ring
        lock ring anim                  glow + breathe + trail
```

---

## 2. Ortak Genom Tablosu

| Parametre | Logo | Marker | Paylaşım |
|-----------|------|--------|----------|
| Stroke @ master | 2.5 px @ 512 | 2 px min @ 48 | Orantılı scale |
| Corner radius | 2–4 px | 2–4 px | **Aynı** |
| Meridian Cyan accent | `#00D4AA` dot/ring | Glow 15–40% | **Exact hex** |
| Depth Slate gövde | Icon ground | Marker core | **Aynı** |
| Trust White edge | Symbol stroke | Marker edge 85% | **Aynı** |
| Lock ring anim | `lock.ringClose` 320 ms | `lock.ringClose` 320 ms | **Frame sync** |
| Breathe loop | Idle splash only | Idle marker 2 s | Aynı amplitude ±2% / opacity ±30% |
| Glow max | 0.25 boot; 0.50 lock | 0.70 harita cap | Logo daha düşük |
| Horizon metafor | Yatay çizgi zorunlu | Destination dot+stem | **Aynı dil** |
| Pin teardrop | **Yasak** | **Yasak** (balon pin) | **Aynı yasak** |

---

## 3. Ortak Parçalar (shared components)

### 3.1 Zorunlu ortak

| Bileşen | Logo | Marker | Animasyon |
|---------|------|--------|-----------|
| **Lock ring** | Symbol iç ring | State ring overlay | `lock.ringClose` — aynı stroke path mantığı |
| **Meridian horizon** | Ana çizgi | Destination stem/dot | Statik geometry |
| **Cyan accent** | Dot @ kesişim | Glow halo | pulse sync Tier A |
| **Stroke genom** | Wing arc | Siluet outline | — |

### 3.2 Marker'a özel (logo'da yok)

| Bileşen | Kullanım |
|---------|----------|
| Role siluet (car/motor/human) | Harita okuma |
| Direction rotation | Driver heading |
| Connection line | Journey |
| Cluster badge | Yoğunluk |
| Trust warm ring | Relationship overlay |
| QM dashed ring | Ops comms |

### 3.3 Logo'ya özel (marker'da yok)

| Bileşen | Kullanım |
|---------|----------|
| Wing arc (leylek) | Marka tanıma |
| Wordmark LeylekTAG | Tipografi |
| AI orb expand | Leylek Zeka |
| Boot presence pulse | Splash |
| Check overlay | Payment UI |

---

## 4. Pin İlişkisi — Net Ayrım

| Soru | Cevap |
|------|-------|
| Logo harita pini olmalı mı? | **Hayır** |
| Marker pin olmalı mı? | **Hayır** — `MARKER_DNA.md`: balon pin yasak |
| Destination formu | Horizon dot + vertical stem — minimal |
| Logo ↔ destination | Aynı horizon dili; logo arc, destination dot |

**Mevcut `logo-leylek.svg` pin** → logo layer'dan retire; marker layer'a **taşınmaz**.

---

## 5. Meridian Form — Birleşik Dil

V4 "Meridian" = yatay referans çizgisi + cyan enerji noktası.

| Yüzey | Meridian ifadesi |
|-------|------------------|
| Logo | Horizon line @ alt üçte bir |
| Destination marker | Cyan dot + slate stem |
| Journey line | Cyan 30% connection |
| Loading sweep | Horizon boyunca meridian sweep |
| Sonic | A3 = zemin pitch = horizon metaforu |

Logo ve destination marker yan yana haritada: **aynı çizgi kalınlığı ailesi** — logo arc üstte, destination dot altta; karışma yok.

---

## 6. Harita Ayırt Edilebilirlik

Binlerce marker testi:

| Faktör | Uber/Google | LeylekTAG |
|--------|-------------|-----------|
| Form | Pin / dot | Slate siluet + role |
| Renk | Siyah/kırmızı | Depth Slate + cyan glow |
| Hareket | Statik/minimal | Breathe 2 s |
| Logo pin | — | Yok — marker karışmaz |
| Cluster | Sayı badge | Dominant state glow |

**Logo haritada:** Watermark opacity 0.10–0.15 monochrome — **marker değil**.

---

## 7. Durum Senkronizasyonu

| Olay | Logo | Marker | Ses |
|------|------|--------|-----|
| Boot | pulse | — | presence.boot |
| Offer | ingress (header) | relay trail | offer.* |
| Match | breathe | connection solid | match.success |
| QR verified | ring close | ring close | qr.success |
| Payment | check | — | payment.confirmed |
| Trust | check micro | trust ring | trust.micro |
| AI suggest | orb (UI) | AI halo map | leylek.open |
| Journey end | fade | dissolve line | journey.end |

---

## 8. Zoom ve Boyut Paritesi

| Zoom | Marker | Logo (harita watermark) |
|------|--------|-------------------------|
| ≤14 | Core siluet | Gizli |
| 15–17 | Full + direction | — |
| ≥18 | Glow detail | — |

Logo app UI'da tam; haritada watermark tier S veya gizli.

---

## 9. AI Overlay

| Öğe | Spec |
|-----|------|
| Map AI halo | Marker overlay — `MARKER_DNA.md` §3.10 |
| AI core | Logo symbol micro (white dot) |
| Orb UI | Logo expand — marker'dan ayrı yüzey |

Robot icon haritada **yasak** — logo core dot.

---

## 10. Üretim Pipeline (Phase 2–3 — analiz)

```
1. Master geometry grid (LOGO_GEOMETRY.md)
2. Export stroke/radius tokens → marker prompt constants
3. Logo SVG paths → Lottie ring layer
4. Marker SVG → aynı ring Lottie component (shared)
5. QA: 24/32/48 px yan yana logo symbol + car marker + destination
```

**Kural:** Tek `design-lab/brand-dna/v4/exports/` master grid — logo ve marker aynı dosyada reference layer (production SVG ayrı).

---

## 11. Mevcut Production Gap

| Alan | Logo | Marker spec |
|------|------|-------------|
| Form | Pin vs kuş | V4 siluet spec hazır |
| Renk | Gradient cyan-blue | `#00D4AA` spec |
| Ring anim | Yok | Spec var |
| Shared Lottie | Yok | Phase 2 hedef |

---

## 12. Anti-Patterns

- Logo = harita pin
- Marker = logo birebir küçültme
- Farklı cyan hex logo vs marker
- Farklı lock ring timing
- Logo glow haritada marker glow ile yarış
- Pin + siluet double marker

---

## 13. QA Checklist

- [ ] Lock ring logo = marker frame ±1
- [ ] Cyan hex exact match
- [ ] Stroke scale oranı korunur
- [ ] Pin form logo'da yok
- [ ] Destination ≠ logo symbol
- [ ] Blind test: marker map "LeylekTAG" ≥80%

---

**Non-goals:** Marker PNG/SVG üretimi bu belgede yok — `design-lab/markers/` Phase 2.
