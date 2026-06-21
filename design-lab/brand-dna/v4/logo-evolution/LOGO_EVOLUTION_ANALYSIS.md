# LOGO_EVOLUTION_ANALYSIS.md

**Phase:** P5-L2A — LeylekTAG Logo Evolution Analysis  
**Mode:** Read-only — production untouched  
**Date:** 2026-06-21  
**Principle:** Logo Evolution — **rebrand değil**  
**Deliverables:** `LOGO_SURFACE_MAP.md`, `CURRENT_LOGO_STRENGTHS.md`, `CURRENT_LOGO_WEAKNESSES.md`, `EVOLUTION_GUIDELINES.md`, bu belge

---

## Executive summary

LeylekTAG production logosu bugün **üç paralel aile** olarak yaşar: (A) 3D metalik leylek + orbital arc, (B) gradient pin / wireframe arc ikon, (C) yatay wordmark banner. Marka metaforu (leylek, kanat, arc, cyan accent) **güçlü ve tanınır**; form dili **parçalı, küçük boyutta zayıf ve genom-dışı renkler** taşır.

**Evrim yönü (analiz):** Mevcut DNA'yı koruyarak F1 Meridian Wing prensipleriyle **tek master geometry**, tier'lı küçük boyut sistemi ve `#00D4AA` genom hizalaması. Yeni logo tasarımı **bu fazda üretilmedi** — yalnızca analiz.

| Metrik | Mevcut (ort.) | Evrim hedefi |
|--------|---------------|--------------|
| Tanınabilirlik | 7.5/10 | ≥8.5 (aynı marka algısı) |
| 16px okunabilirlik | 3/10 | ≥7/10 (M0 tier) |
| Premium | 6/10 | ≥8.5/10 (restraint) |
| Platform tutarlılık | 4/10 | ≥9/10 (tek aile) |
| 10 yıl dayanıklılık | 5.5/10 | ≥8.5/10 (flat geometry) |

---

## 1. Mevcut logo envanteri (özet)

Tam liste: **`LOGO_SURFACE_MAP.md`**

### Birincil asset'ler

| Asset | Yol | Form |
|-------|-----|------|
| Premium kuş | `frontend/assets/images/leylek-logo-premium.png` | 3D silver stork + glowing blue arc |
| iOS icon | `frontend/assets/ios.premium.logo.png` | Premium kuş türevi |
| Android adaptive | `frontend/assets/images/adaptive-icon-foreground.png` | Wireframe arc + dot |
| Website icon | `website/public/store/leylektag-icon.png` | Wireframe arc + horizon |
| Pin SVG (orphan) | `website/public/logo-leylek.svg` | Gradient map pin + inner wing |
| Hero wordmark | `website/public/store/feature-graphic.png` | Flat stork + "Leylek TAG" + phones |
| Leylek Zeka web | `website/public/store/leylek-logo-premium.png` | Premium kuş |

### Kritik tutarsızlık

- **Splash (JS):** Premium kuş  
- **Native Android splash:** Pin ailesi (`splashscreen_logo.png`)  
- **iOS icon:** Premium kuş  
- **Android adaptive + favicon:** Wireframe arc  
- **Website hero:** Feature graphic (üçüncü dil)

---

## 2. Mevcut logo — 10 kriter puanlaması

**Ölçek:** 0–10 (10 = mükemmel evrim öncesi durum)  
**Konu:** Birincil marka algısı — ağırlıklı **Aile A (premium kuş)** + platformda görünen **Aile B/C** etkisi

| # | Kriter | Puan | Gerekçe |
|---|--------|------|---------|
| 1 | **Tanınabilirlik** | **7.5** | Premium kuş + wordmark ile "LeylekTAG" okunur; arc-only favicon zayıf; pin generic |
| 2 | **Küçük boyut okunabilirliği** | **4.0** | Aşağıda boyut kırılımı |
| 3 | **Premium hissi** | **6.5** | Metal kuş niyet iyi; glow/gradient/violet hero premium'u düşürür |
| 4 | **Güven hissi** | **6.0** | Koyu login/splash güven verir; pin + neon güven değil "startup" |
| 5 | **Dijital görünüm** | **6.0** | Etkileyici büyük boyut; raster/SVG karışık; glow filter dated |
| 6 | **Harita görünürlüğü** | **5.0** | Watermark detaylı; pin logo marker ile karışır; LeylekEye ayrı |
| 7 | **App icon başarısı** | **5.0** | iOS kuş ≠ Android arc; favicon arc; küçük boyut QA fail |
| 8 | **Website header başarısı** | **6.0** | Arc okunur ama leylek zayıf; wordmark navbar'da ayrı değil |
| 9 | **Splash başarısı** | **7.0** | Premium kuş etkileyici; native/JS çift kimlik; breathe iyi |
| 10 | **Uzun yıllar kullanılabilirlik** | **5.5** | Pin fad, 3D skeuo, gradient — 2030+ risk |

**Ortalama:** **5.9 / 10**

### 2.1 Küçük boyut kırılımı (Kriter 2)

| Boyut | Premium kuş (A) | Pin SVG (B) | Wireframe (B) | Not |
|-------|-----------------|-------------|---------------|-----|
| **16px** | 2 | 2 | 5 | Favicon — kuş/pin çöküş; arc dot+line en iyi |
| **24px** | 3 | 3 | 6 | Widget — arc tier M1 uygun |
| **32px** | 5 | 4 | 7 | Navbar küçük — arc okunur |
| **48px** | 7 | 5 | 8 | Notification — arc ring hint |
| **64px** | 8 | 5 | 8 | Leylek Zeka tile — kuş iyi |

**Ortalama küçük boyut:** **~5.2/10** (ağırlıklı favicon 16px)

---

## 3. Korunması gereken bölümler

Detay: **`CURRENT_LOGO_STRENGTHS.md`**

| Bölüm | Kaynak | Koruma |
|-------|--------|--------|
| **Göz / accent dot** | Kuş göz glow; pin center; wireframe dot | ✅ Tek cyan presence noktası |
| **Kanat formu** | SVG inner wing; PNG wing line | ✅ Wing arc stroke'a evrilir |
| **Orbital arc** | Premium PNG sweep | ✅ Flat lock ring — 3D kalkar, arc kalır |
| **Kafa / gaga profili** | Premium kuş | ✅ L-tier (≥128px) literal; küçükte arc taşır |
| **Tek ayak duruş** | Premium kuş | ⚠️ Sadece literal tier; F1 arc taşır |
| **Negatif boşluk** | Arc içi boşluk | ✅ %32 hedef |
| **Renk ilişkisi** | Cyan on dark / silver-white form | ✅ Hue → `#00D4AA`; form white stroke |
| **Tipografi** | "Leylek" + "TAG" hiyerarşisi | ✅ Wordmark değişmez |
| **Horizon zemin** | Wireframe icon base | ✅ F1 horizon — pin terk |

---

## 4. Geliştirilebilir bölümler

Detay: **`CURRENT_LOGO_WEAKNESSES.md`**, **`EVOLUTION_GUIDELINES.md`**

| Alan | Mevcut sorun | Evrim |
|------|--------------|-------|
| **Stroke** | Dolu gradient pin; 3D arc | Flat 2–2.5px stroke |
| **Radius** | Pin teardrop keskin | Round caps; 2–4px handles |
| **Boşluk** | Dolu kuş; hero blur padding | %32 negatif; violet retire |
| **Kontrast** | Glow-bağımlı; 4 mavi ton | White on void + tek accent |
| **Denge** | Off-center kuş; 3D arc kalınlık | Optical center +2%; uniform ring |
| **Simetri** | Pin simetrik; kuş profil asimetrik | Tier'a göre abstract/literal |
| **Optik hizalama** | Squircle clip risk | F1 safe zone spec |
| **Küçük boyut** | Raster shrink | M0→F tier ladder |
| **Premium** | Bağıran glow | Restraint; motion-only glow |
| **Motion** | PNG breathe only | Ring close + presence pulse |
| **Marker uyumu** | Pin ≠ marker DNA | Shared stroke; pin retire |

---

## 5. F1 Meridian Wing analizi

**Kaynak:** `design-lab/brand-dna/v4/logo-sketch-lab/FINALIST_01_MERIDIAN_WING.md`, `logo-production-lab/FINALIST_F1_MERIDIAN_WING_ASSET_SPEC.md`, `exports/svg/f1-meridian-wing-icon-1024.svg`

### 5.1 F1 form özeti

```
        ╭── wing arc (+2°) ──╮
   ─────●──────────────────●─────  horizon @ alt ⅓
        ╲    lock ring 12%  ╱
         ╰──────────────────╯
              ○ accent (#00D4AA)
```

- Flat stroke; void ground `#0D1117`  
- Pin yok; tam kuş yok — **arc kanat + ring taşır leylek**  
- Evrim tanınırlığı finalistler arasında **en yüksek** (COMPARISON: 92/100)

### 5.2 Neden website üzerinde başarısız göründü?

Analiz birleşik değerlendirme — F1 production website'e **henüz ship edilmedi**; başarısızlık **önizleme / hero bağlam / mevcut site hataları** birleşimi:

| # | Neden | Açıklama |
|---|-------|----------|
| 1 | **Arc soyutluğu + wordmark eksikliği** | F1 tek başına "leylek" demez; navbar/hero'da wordmark olmadan generic "tech arc" algısı |
| 2 | **Mevcut hero violet wrapper** | `hero-horizontal-logo.tsx` cyan+violet blur — F1 constitution "violet yasak"; birlikte cyberpunk, premium değil |
| 3 | **feature-graphic bağımlılığı** | Site hero flat kuş + telefon hikâyesine alışkın; F1 icon-only hero zayıf storytelling |
| 4 | **F2 website skoru daha yüksek** | COMPARISON matrisi: Website F1=89, **F2=93** — literal stork hero'da güçlü |
| 5 | **Açık zemin / cam navbar testi** | F1 white stroke + void ground; açık header'da kontrast QA yapılmadan zayıf görünebilir |
| 6 | **Pin/beğenilen kuş ile side-by-side** | Kullanıcı 3D kuş veya pin'e alışkın; arc "soyutlaştı" sanılır — **evrim iletişimi** eksik |
| 7 | **Yanlış tier kullanımı** | F1 full ring @16px favicon'da — ring gizlenmeden deploy edilirse çamur |
| 8 | **Orphan pin SVG karışıklığı** | Website'de hâlâ gradient pin dosyası var; F1 ile pin karıştırılarak değerlendirme |

**Sonuç:** F1 website'de başarısız görünmesi **çoğunlukla bağlam hatası** (wordmark, tier, violet wrapper, hero kompozit) — geometry hatası değil.

### 5.3 Hangi prensipler doğruydu?

| Prensip | Doğruluk |
|---------|----------|
| Kanat arc = mevcut SVG kanat evrimi | ✅ |
| Lock ring = orbital arc restraint | ✅ |
| Horizon = operasyon / dispatch zemin | ✅ |
| Accent dot = göz / presence korunur | ✅ |
| Flat stroke, no gradient | ✅ Favicon + 10yr |
| Void ground + Trust White stroke | ✅ Premium restraint |
| Tier ladder M0→F | ✅ 16px fix |
| Motion: presence 550ms, ring close 320ms | ✅ LSX/LSDS uyumu |
| Marker genom paylaşımı (stroke, cyan) — pin taşınmaz | ✅ |
| "Yenilenmiş not değişmiş" evrim tanınırlığı | ✅ En yüksek finalist |
| F1 app icon / favicon / watch dengesi | ✅ COMPARISON weighted winner |

### 5.4 Hangi prensipler yanlış veya eksik uygulandı?

| Prensip / uygulama | Sorun |
|--------------------|-------|
| Arc-only hero without wordmark | ❌ Website storytelling fail |
| F1 @ website hero = F2 literal | ❌ Yanlış tier — F2 sadece L-tier hibrit |
| Violet ambient + F1 birlikte | ❌ Constitution ihlali |
| Full ring @ favicon | ❌ M0 kuralı atlanırsa fail |
| F1'i pin ile aynı kefede değerlendirme | ❌ Pin retire — karşılaştırma adaletsiz |
| Website skoru F2'ye kaydırma = F1 red | ⚠️ F2 master olmamalı — hibrit only |
| "Arc yeterince leylek" varsayımı | ⚠️ Küçük tier'da wordmark zorunlu |

### 5.5 Mevcut logoya aktarılabilir fikirler

| F1 fikri | Mevcut karşılık | Aktarım |
|----------|-----------------|---------|
| Wing arc stroke | SVG kanat path | Path dışarı taşınır |
| Lock ring | Premium orbital arc | 3D → flat ellipse |
| Horizon line | Wireframe icon base | Pin tabanı → horizon |
| Accent `#00D4AA` | Cyan dot/göz | Hue unify |
| Void `#0D1117` | `#08111F` splash | Background unify |
| Tier M0 favicon | leylektag-icon.png | Resmi ladder uygula |
| Glow off idle | Premium glow always-on | Restraint |
| presence.pulse | SplashScreen breathe | Token hizala |
| lock.ringClose | QR overlay potansiyel | Ring animasyon zemin |
| Single master SVG | 3 PNG ailesi | Pipeline birleştir |

### 5.6 Kesinlikle aktarılmaması gerekenler

| Unsur | Neden |
|-------|-------|
| Pin formunun korunması | Generic; evrim hedefi pin retire |
| Arc-only marketing (wordmark'sız) | Tanınırlık + website fail |
| Violet hero wrapper | Constitution yasak — mevcut site bug'ı |
| F2 master olarak ship | Favicon/watch zayıf |
| F3 seal as master | Generic circle icon |
| Gradient / SVG blur filter | Küçük boyut + 10yr fail |
| Leylek metaforunu tamamen silmek | Rebrand olur |
| Marker pin kopyası | Logo ≠ harita marker |
| Idle neon glow | Premium restraint ihlali |
| Ani 3D→abstract swap (iletişimsiz) | "Değişmiş" algısı — aşamalı evrim |

---

## 6. Evrim stratejisi özeti

```
MEVCUT DNA                    EVRİM (F1 prensipleri)
─────────────                 ──────────────────────
Kanat (SVG)          ───────► Wing arc stroke
Orbital arc (PNG)    ───────► Lock ring flat
Cyan dot/göz         ───────► Accent #00D4AA
Premium kuş (L-tier) ───────► Literal tier ≥128px opsiyonel (F2 hibrit)
Pin (SVG)            ───────► RETIRE
3D metal shader      ───────► RETIRE (restraint flat)
Violet hero          ───────► RETIRE
3 icon ailesi        ───────► TEK master + tiers
```

**Mesaj:** *"Aynı LeylekTAG, daha net ve premium."* (F1 FINALIST_01)

---

## 7. F1 vs mevcut — yüzey puan karşılaştırması (projeksiyon)

| Yüzey | Mevcut | F1 (doğru uygulandığında) |
|-------|--------|---------------------------|
| App icon | 5 | 9 |
| Favicon 16px | 3 | 8 |
| Splash | 7 | 9 |
| Login | 7 | 8 |
| Website nav | 6 | 8 (wordmark ile) |
| Website hero | 7* | 8 (lockup + no violet) |
| Watermark | 5 | 7 |
| 10 yıl | 5.5 | 9 |

*Hero görsel etki yüksek, restraint düşük.

---

## 8. Risk register (evrim)

| Risk | Olasılık | Etki | Mitigasyon |
|------|----------|------|------------|
| "Logo değişti" algısı | Orta | Yüksek | Aşamalı rollout; evrim mesajı |
| Android res stale | Yüksek | Orta | prebuild + DPI sync |
| Wordmark unutulması | Orta | Yüksek | Navbar/hero lockup zorunlu |
| F2 hibrit scope creep | Orta | Orta | L-tier only ≥128px |
| LeylekEye stil kopukluğu | Orta | Düşük | Stroke dili hizala — ayrı mark |

---

## 9. Sonraki adımlar (analiz gate — kod yok)

| Adım | Çıktı | Owner |
|------|-------|-------|
| P5-L2B | Stakeholder koruma listesi onayı | Brand |
| P5-L0 | Blind tanınırlık testi | Design |
| P5-L1 | Website favicon/navbar F1 | Eng (Phase 5) |
| P5-L2 | In-app logo surfaces | Eng |
| P5-L4 | App icon unify | Eng + QA |
| P5-L2C | Hero violet retire + lockup | Web |

---

## 10. Belge indeksi

| Belge | İçerik |
|-------|--------|
| `LOGO_SURFACE_MAP.md` | Tüm logo path + yüzey envanteri |
| `CURRENT_LOGO_STRENGTHS.md` | Korunacak DNA |
| `CURRENT_LOGO_WEAKNESSES.md` | Gelişim fırsatları |
| `EVOLUTION_GUIDELINES.md` | Koruma/yasak/QA kuralları |
| `LOGO_EVOLUTION_ANALYSIS.md` | Bu belge — puanlama + F1 |

**Upstream referanslar (design-lab):**

- `logo-master/LOGO_MASTER_ANALYSIS.md`
- `logo-sketch-lab/FINALIST_01_MERIDIAN_WING.md`
- `logo-production-lab/COMPARISON_AND_SHIP_RECOMMENDATION.md`
- `exports/PHASE5_LOGO_MIGRATION_ANALYSIS.md`

---

## Analysis gate

| Check | Status |
|-------|--------|
| Production dosyaları değiştirildi | ❌ HAYIR |
| SVG/PNG export üretildi | ❌ HAYIR |
| Commit / push | ❌ HAYIR |
| Logo surface envanteri | ✅ |
| 10 kriter puanlama | ✅ |
| Koruma / geliştirme listesi | ✅ |
| F1 website analizi | ✅ |
| 5 rapor design-lab altında | ✅ |

---

**P5-L2A tamamlandı.** Sonraki faz: stakeholder sign-off → P5-L1 website (ship onayı sonrası).
