# LeylekTAG V4 Logo Production — Master Analysis (Phase 1)

**Version:** Production Lab Phase 1.0  
**Status:** Analysis only — kod, asset, commit, production dokunma yok  
**Scope:** `design-lab/brand-dna/v4/logo-production/`  
**Roles:** Chief Brand Architect · Chief Product Designer · Chief Motion Designer · Chief Identity Designer · Chief Apple Human Interface Specialist  
**Parents:** `../logo-master/*`, `brand-dna/v3`, `brand-dna/v4`, `lsx`, `markers`, `sonic`  
**Horizon:** 10 yıl tek master logo (2026–2036)  
**Sonraki:** Phase 2 — gerçek logo eskizleri

---

## Executive Summary

LeylekTAG production logosu bugün **iki ayrı marka** gibi davranıyor: gradient **harita pini** (SVG, splash, favicon) ve **3D metalik tam kuş** (premium PNG, onboarding). İkisi de V4 Meridian genom (`#00D4AA`, flat symbol, lock ring) ile uyumsuz.

Phase 1 production analizi sonucu:

1. **Pin tabanlı logo retire** — uzun vadeli generic risk (Uber/Google ailesi).
2. **Tam kuş illustrasyon master değil** — küçük yüzey ve 10 yıl stil riski.
3. **Statik logo = düz renk**; gradient/glow yalnızca **motion kanallarında** (boot, lock, QR).
4. **Meridian Cyan tek accent** yeterli; yapı renkleri slate/white/void sabit.
5. **Logo ↔ marker shared genom** — stroke, radius, ring, motion, glow kuralları ortak.
6. **Creative Direction A (Meridian Arc)** birincil sketch yönü; B paralel; C yedek.

Detay belgeler: `BOOT_MULTIMODAL_TIMELINE.md`, `SURFACE_BEHAVIOR_MATRIX.md`, `LOGO_MARKER_SHARED_GENOM.md`, `CREATIVE_DIRECTIONS_ABC.md`.

---

## 1. Mevcut Production Logo — Tam Analiz

### 1.1 Asset envanteri (okundu — değiştirilmedi)

| Asset | Konum | Kullanım |
|-------|-------|----------|
| `logo-leylek.svg` | `website/public/` | Pin + kanat + glow filter |
| `leylek-logo-premium.png` | `frontend/assets/images/` | 3D kuş + orbital arc |
| `Logo.tsx` | `frontend/components/` | PNG require |
| `splashscreen_logo.png` | Android drawable | Pin ailesi |
| `icon.png`, `adaptive-icon*.png` | Expo assets | Store / adaptive |
| `feature-graphic.png` | website store | Hero horizontal |
| `hero-horizontal-logo.tsx` | website | cyan + **violet** blur wrapper |

### 1.2 Güçlü yanları

| # | Güç | Hangi asset | Neden işe yarıyor |
|---|-----|-------------|-------------------|
| 1 | **Leylek metaforu** | PNG kuş | Türkiye göç kuşu; rakiplerde yok; hikaye anlatır |
| 2 | **Cyan teknoloji ailesi** | SVG pin | Güven + hareket + dijital enerji yönü doğru |
| 3 | **Kanat çizgisi** | SVG iç path | Zarif ileri okuma; V4 arc'a evrilebilir |
| 4 | **Koyu zemin uyumu** | Pin SVG | Depth Slate / void chrome ile kontrast |
| 5 | **Premium niyet** | PNG metal | "Kalite istiyoruz" iç sinyali |
| 6 | **Orbital arc** | PNG | Lock ring / journey döngüsü öncülü |
| 7 | **İç daire "lens"** | SVG | Ring animasyon zeminı (geçici) |
| 8 | **Cultural recall** | Kuş | Yerel kullanıcıda anında "leylek" |

### 1.3 Zayıf yanları

| # | Zayıflık | Etki |
|---|----------|------|
| 1 | İkili kimlik | Splash ≠ onboarding — marka güveni |
| 2 | Pin formu | Uber/Google/Waze generic |
| 3 | Gradient 3+ renk | 16–29 px blob; print ölür |
| 4 | SVG glow filter | Favicon çamuru |
| 5 | Renk `#67E8F9→#2563EB` | Marker/sonic `#00D4AA` kopuk |
| 6 | 3D skeuomorphic kuş | 2010'lar clip art; raster lock-in |
| 7 | Gaga/bacak/göz | Micro size illegible |
| 8 | Website violet glow | Constitution ihlali; cyberpunk sınırı |
| 9 | Motion/ses bağsız | lock.ringClose geometrisi yok |
| 10 | Asset parçalanması | Tek master yok |

### 1.4 Neden premium **hissediyor** (mevcut)

Mevcut logo **kısmen** premium sinyal verir — yanlış kanallardan:

| Kanal | Premium sinyal | Neden |
|-------|----------------|-------|
| PNG metal kuş | Malzeme kalitesi | Silver highlight, gölgeli form = "işlenmiş" |
| Koyu zemin + cyan | Tech premium | Tesla/Apple dark UI ailesi |
| Orbital arc | Kontrollü enerji | "Sistem çevresinde dönüyor" — DJI orbital mantığı |
| Glow (SVG) | Dijital presence | Canlı sistem — **ama küçük boyutta ucuz** |

**Özet:** Premium niyet var; execution **tutarsız ve trend-bağımlı** (gradient pin + 3D kuş). Gerçek premium = **restraint + tutarlılık + multimodal sync** — constitution eksenleri.

### 1.5 Neden **eski** hissediyor

| Faktör | Dönem | Algı |
|--------|-------|------|
| Harita pin app icon | 2018–2022 | "Startup location app" |
| Cyan-blue gradient | 2020 app store | Fintech/crypto cyan wave |
| 3D metal mascot | 2012–2016 | Skeuomorphic premium clip art |
| feGaussianBlur glow | 2019 SVG trend | Cheap neon |
| Violet + cyan hero | 2024–2026 | AI purple adjacent |
| İkili logo | — | "Henüz brand olgun değil" |

**10 yıl testi:** 2035'te bu kombinasyon "2018–2022 Türkiye mobility startup" olarak okunur — BMW roundel / Apple silhouette gibi **timeless geometry** değil.

---

## 2. Pin Tabanlı Logo — Uzun Vadeli Risk

### 2.1 Yapısal riskler

| Risk | Açıklama |
|------|----------|
| **Generic literacy** | Dünya harita pin = konum; marka adı kaybolur |
| **Commodity ulaşım** | Taksi/ride-share = pin metaforu doygun |
| **Ölçek felci** | Pin tepe 16 px'de kaybolur veya Uber'e benzer |
| **Motion kısıtı** | Teardrop lock ring metaforuna zayıf |
| **Print/embroidery** | Gradient pin tek blob |
| **AR/VR** | Pin = UI chrome; marka silueti değil |

### 2.2 Rakip mantığı kıyası (kopya yok — mantık analizi)

| Marka | Logo mantığı | Uzun ömür nedeni | Pin ile ilişki |
|-------|--------------|-----------------|----------------|
| **Apple** | Siluet restraint; tek form | 40+ yıl aynı apple; boşluk = lüks | Pin **değil** — timeless silhouette |
| **Uber** | Minimal **pin** | Global tutarlılık; tek form | Pin = **onların** imzası — LeylekTAG kopyalarsa ikinci Uber |
| **Tesla** | Stylized T; wordmark | Dark UI + tek harf precision | Pin değil — letterform + context |
| **DJI** | Geometric wordmark + angular mark | Operasyonel precision | Pin değil — industry tool mark |
| **Airbnb** | Belong symbol (heart/location fusion) | Özgün geometry; hikaye | Pin değil — **custom metaphor** |
| **Spotify** | Sound wave circle | Tek renk yeşil + dalga = domain | Pin değil — **abstract domain mark** |

**Ders:** Uzun ömürlü markalar **pin kullanmaz** (Uber istisna — onlar pin'i sahiplendi). LeylekTAG pin kullanırsa Uber/Google **yan panelinde** yaşar. LeylekTAG'in özgün metaforu: **leylek + meridian + lock** — pin değil.

### 2.3 Pin retire kararı (analiz)

Production pin logo **Phase 5'te retire**; Phase 2 sketch'te pin **yasak**. Destination marker'da minimal stem+dot kalır — logo değil.

---

## 3. İlk 200 ms — Duygu Ağırlıkları

Logo (splash boot + icon tap sonrası ilk frame) aşağıdaki duyguları taşımalı. Toplam = %100.

| Duygu | Ağırlık | Logo ifadesi | ms bandı |
|-------|---------|--------------|----------|
| **Trust** | **22%** | Kapalı form; horizon zemin; settle @ 400 ms | 120–550 |
| **Calm** | **18%** | Glow max 0.25; haptic yok; no bounce | 0–550 |
| **Premium** | **15%** | Restraint; premium stop easing; no fanfar | 0–200 |
| **Operation** | **14%** | Meridian precision; grid snap geometry | 80–200 |
| **Precision** | **12%** | Pixel-perfect arc; cyan tek nokta | 40–160 |
| **Technology** | **10%** | Cyan accent; digital glow — not cyber | 40–160 |
| **Safety** | **8%** | Simetri; belirsizlik kapandı @ 200 ms commit | 100–200 |
| **Movement** | **5%** | Ascend arc; pulse 0.96→1.03 — subtle | 0–160 |
| **Human** | **4%** | Leylek metaforu (arc/negatif) — yüz yok | 100+ |
| **—** | **0%** | Excitement, play, urgency visual | — |

### 3.1 Constitution eksenleriyle hizalama

| Logo duygu | Brand eksen |
|------------|-------------|
| Trust 22% | Güven %19 + Safety |
| Calm 18% | Sessizlik %8 + Premium %13 |
| Operation 14% | Operasyon %14 |
| Human 4% | İnsanlık %10 (logo minimal — platform UI taşır) |

### 3.2 Olmamalı (200 ms içinde)

- Panik (flash, strobe)
- Oyun dopamin (bounce, particle)
- Taksi aciliyet (sarı, korna formu)
- Generic ping (tek blob fade)
- Jingle hatırlatma (orchestral swell)

**200 ms hedef cümlesi:** *"Sistem hazır; güvendeyim; bu başka bir uygulama değil."*

---

## 4. Yüzey Davranışları (özet)

Tam matris: `SURFACE_BEHAVIOR_MATRIX.md`.

| Yüzey | Motion | Glow | Tier | Özet |
|-------|--------|------|------|------|
| Tek başına | Statik | Off | F | Sakin imza |
| App açılış | presence 550 ms | 0.25 max | F→motion | T4 multimodal |
| Harita | Statik watermark | Off | M0–S | 0.12 opacity mono |
| Apple Watch | Statik | Off | M0–M1 | En sessiz |
| Widget | Statik | Off | M0–S | Cyan text accent |
| Favicon | Statik | Off | M0 | Dot+horizon |
| Bildirim | Statik mono | Off | M0 | Token-specific ses |
| 16 px | Statik | Off | M0 | Minimal |
| Billboard | Statik | Off | F+wordmark | Siluet |

**Apple HIG prensibi:** Watch ve complication'da logo **asla** boot animasyonu taşımaz — bilgi öncelik.

---

## 5. Kuş — Koruma vs Minimalize vs Soyut

### 5.1 Seçenek karşılaştırması

| Seçenek | Tanım | Avantaj | Dezavantaj |
|---------|-------|---------|------------|
| **Tam kuş koruma** | Gaga, bacak, profil (mevcut PNG) | Kültürel tanınırlık; hikaye net | 16 px fail; 3D trend; raster; constitution `ban.fullBird` |
| **Minimalize kuş** | Tek ayak, gaga hint, az detay | Orta tanınırlık | Hâlâ illustrasyon; stil yenileme zor |
| **Soyutlaştırma** | Kanat arc + horizon (Direction A) | 10 yıl; tüm boyutlar; motion native | "Kuş" kör testte %80 gerekli |
| **Negatif alan kuş** (B) | Boşlukta kuş | Akıllı premium; unutulmaz | 16 px risk; üretim zor |
| **Implicit kuş** (C) | Ring + arc; kuş yok | Lock/trust max | Leylek hikayesi zayıf |

### 5.2 Production kararı (Phase 1)

| Karar | Detay |
|-------|-------|
| Tam kuş **korunmaz** | Master mark değil; marketing one-off retire |
| Minimalize tam kuş **master değil** | Illustration pipeline bağımlılığı |
| **Soyut kanat arc** | Birincil yön (Direction A) |
| **Negatif alan** | Paralel sketch (Direction B) — kör test kazanan |
| Kuş **metafor olarak kalır** | Geometry'de; cartoon olarak değil |

**Analoji:** Apple'ın elma = soyut; Airbnb'in belo = özgün geometry; Uber'in pin = domain sahipliği. LeylekTAG = **leylek arc** (göç, yol, Türkiye).

---

## 6. Gradient Politikası — Production Değerlendirmesi

### 6.1 Statik logoda gradient

| Değerlendirme | Sonuç |
|---------------|-------|
| App icon statik | **Gradient yasak** — flat white/slate + cyan dot |
| SVG master | **Gradient yasak** — `ban` constitution |
| Print | **Gradient yasak** — spot + mono |
| Website navbar | **Flat** |
| Mevcut pin SVG gradient | **Retire** |

### 6.2 Motion sırasında ışık / glow / pulse

| Kanal | Gradient/glow | İzin |
|-------|---------------|------|
| Boot | Cyan glow 0→0.25 | ✅ Tek renk opacity ramp — **gradient değil** |
| Boot | Symbol içi renk geçişi | ❌ |
| QR lock | Cyan flash 0.50 peak | ✅ |
| Match | Warm resolve overlay | ✅ Tek renk %40 |
| Idle UI header | — | ❌ Glow off |
| Loading sweep | Meridian cyan sweep along horizon | ✅ 1 px line animation |
| AI orb | Frost + cyan halo | ✅ Glass air — logo secondary |

### 6.3 Production uygulama modeli

```
STATIK LOGO = 2–3 flat renk (white, slate, cyan accent)
MOTION LAYER = opacity + glow (runtime/Lottie) — multicolor gradient yok
```

**Neden:** Gradient asset pipeline = her boyutta ayrı QA; OLED burn-in algısı; marker/logo hex drift. Motion glow = **semantic light** — trend değil.

**Mevcut hata:** SVG `linearGradient` + `feGaussianBlur` statik dosyada — Phase 3'te **path-only SVG** + runtime glow.

---

## 7. Meridian Cyan ve Yan Renkler

### 7.1 Tek accent yeterli mi?

**Evet** — primary accent için. Yapı (form okuma) ve durum (match warm, error amber) için **yan tokenlar** gerekli — ikinci "marka rengi" değil.

| Token | Hex | Rol | Logo kullanımı |
|-------|-----|-----|----------------|
| Meridian Cyan | `#00D4AA` | Primary accent | Dot, lock peak |
| Trust White | `#F5F7FA` | Highlight / symbol | Dark mode stroke |
| Depth Slate | `#1A2332` | Structure | Light mode symbol; ground alt |
| Void Black | `#0D1117` | Ground | App icon, OLED |
| Warm Resolve | `#C8E6D0` @≤40% | Human moment | Match overlay only |
| Caution Amber | `#FFB020` @≤25% | Error | QR error ring — nadiren |

**Yasak yan renk:** Violet, AI purple, `#67E8F9` boot gradient, taksi sarısı.

### 7.2 Yüzey önerileri

| Yüzey | Background | Symbol | Accent | Not |
|-------|------------|--------|--------|-----|
| **Dark app** | Void `#0D1117` | White 92% | Cyan 100% | Birincil |
| **Light app** | Trust `#F5F7FA` | Slate 100% | Cyan 90% | Print, email |
| **OLED** | Void true black | White | Cyan | Glow min — burn-in |
| **Web dark** | Slate gradient **zemin** | White symbol flat | Cyan CTA ayrı | Hero symbol flat |
| **Web light** | White | Slate | Cyan 90% | Glow ×0.7 |
| **Watch** | System black | White mono | Cyan dot only | 2-color max |
| **Widget iOS** | System | Symbol S | Cyan preserved | Tint override |
| **Widget Android** | Material You | Symbol S | Cyan **force** | `LOCAL_COLOR` pattern Phase 5 |
| **CarPlay** | System | Mono white | — | Statik |
| **Notification** | — | Mono white | — | Gradient yasak |

---

## 8. Logo ↔ Marker — Ortak Genom (özet)

Detay: `LOGO_MARKER_SHARED_GENOM.md`.

| Parametre | Ortak? |
|-----------|--------|
| Stroke | ✅ Orantılı scale |
| Radius | ✅ 2–4 px |
| Glow kuralları | ✅ Pattern; opacity cap farklı |
| Ring anim 320 ms | ✅ Shared Lottie |
| Motion easing | ✅ |
| Light semantic | ✅ Cyan/warm/amber |
| Aynı siluet | ❌ |
| Pin form | ❌ Her ikisinde yasak |

---

## 9. Boot Multimodal Timeline (özet)

Detay: `BOOT_MULTIMODAL_TIMELINE.md`.

| ms | Logo | Ses | Glow | Haptic |
|----|------|-----|------|--------|
| 0 | opacity 0; scale 0.96 | — | off | — |
| 100 | siluet net | A3 body | 0.12 | — |
| 200 | **commit** | gap yakın | 0.20 | — |
| 160 peak | scale 1.03 | gap start | **0.25** | — |
| 350 | scale 1.0 | E4 resolve | 0.12 | — |
| 550 | handoff | tail | off | — |
| 700 | hidden | — | — | — |

---

## 10. Platform Varyantları (özet)

Detay: `SURFACE_BEHAVIOR_MATRIX.md` §12.

| Platform | Varyant ID | Boyut |
|----------|------------|-------|
| App Icon 1024 | `symbol.dark` F | 1024 |
| Adaptive foreground | `symbol.dark` F safe 80% | 432 |
| Adaptive background | void flat | 1080 |
| Splash static | `symbol.dark` S | native |
| Splash motion | `motion.boot` | JS 550 ms |
| Website navbar | `standard` S | 32–48 px |
| Website hero | `motion.boot` / F | reduced-motion |
| Watch icon | `small` M1 | 44 px |
| Watch complication | `micro` M0 | 20 px |
| Widget S/M/L | M0 / S24 / S32 | — |
| Favicon | `micro` M0/M1 | 16–32 |
| PWA 192/512 | `symbol.dark` S/F | maskable |
| Notification | `mono.white` M0 | 24 dp |

---

## 11. Creative Directions — Özet

Detay: `CREATIVE_DIRECTIONS_ABC.md`.

| Yön | Form | Phase 2 öncelik |
|-----|------|-----------------|
| **A — Meridian Arc** | Horizon + wing arc + ring | **1 — birincil** |
| **B — Negative Space** | Boşlukta kuş | **2 — paralel test** |
| **C — Sealed Ring** | Ring birincil | **3 — yedek** |

---

## 12. Rakip Uzun Ömür — Logo Dersleri (özet)

| Marka | Ders | LeylekTAG uygulaması |
|-------|------|----------------------|
| Apple | Restraint + silhouette | Arc + boşluk |
| Uber | Tutarlılık — ama pin onların | Tutarlılık al; pin alma |
| Tesla | Dark + tek accent + lock feel | Void + cyan + ring close |
| DJI | Geometric precision | Grid snap master |
| Airbnb | Özgün metaphor geometry | Leylek arc — pin değil |
| Spotify | Tek renk + abstract domain | Cyan + arc |

---

## 13. 2035 Yüzey Testi

| Yüzey | Mevcut | V4 hedef |
|-------|--------|----------|
| Watch 38 mm | Pin kayıp | M0 pass |
| CarPlay | Gradient blob | Mono pass |
| AR floating mark | Glow bağımlı | Flat siluet |
| Embroidery | Gradient fail | Mono arc |
| Hologram extrude | Pin generic | Stroke extrude |
| E-ink | — | Mono |

---

## 14. Yapılmaması Gerekenler (Production red list)

- Statik gradient logo
- SVG embedded blur filter
- İkili logo konsepti devam
- Pin teardrop master
- Tam kuş illustrasyon master
- Violet / AI mor hero
- Glow-only 16 px favicon
- Boot spinner instead of presence pulse
- Marker = logo pin küçültme
- Seasonal logo variant

---

## 15. Phase 2 Geçiş

| Phase 1 çıktı | Phase 2 giriş |
|---------------|---------------|
| Bu belge + alt belgeler | Sketch brief |
| Direction A/B/C | `sketches/` klasörü |
| `PHASE1_SIGNOFF.md` | Stakeholder gate |
| Genom tokens spec | Sketch grid 8 px |

**Henüz yapılmadı:** SVG, PNG, çizim, asset, production dokunma.

---

## Document Index

| Dosya | İçerik |
|-------|--------|
| `README.md` | Dizin indeksi |
| `BOOT_MULTIMODAL_TIMELINE.md` | 0–700 ms frame |
| `SURFACE_BEHAVIOR_MATRIX.md` | Tüm yüzeyler + varyantlar |
| `LOGO_MARKER_SHARED_GENOM.md` | Logo-marker genom |
| `CREATIVE_DIRECTIONS_ABC.md` | A/B/C tam analiz |
| `PHASE1_SIGNOFF.md` | Gate checklist |
| `../logo-master/*` | Phase 0 referans |

---

**Non-goals:** Kod, commit, asset, sketch, production değişikliği yok.  
**V4 Logo Production (SVG)** — Phase 3; önce Phase 2 sketch + sign-off.
