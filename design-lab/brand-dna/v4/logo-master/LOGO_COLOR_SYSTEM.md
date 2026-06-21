# LeylekTAG Logo Color System

**Version:** Logo Color v1.0  
**Status:** Analysis only  
**Parent:** `LIGHT_DNA.md`, `BRAND_CONSTITUTION_V4.md`, `LOGO_CONSTITUTION.md`

---

## 1. Felsefe

Logo rengi **marka genomunun en görünür taşıyıcısı**. Meridian Cyan tek accent; gradient logo yok. Küçük boyut, print, monochrome ve multimodal (sonic/marker/glow) uyumu zorunlu.

**North Star:** Sessiz premium — renk bağırmaz; cyan **nokta** olarak konuşur.

---

## 2. Core Palette (değişmez)

| Token | Hex | RGB | Logo rolü |
|-------|-----|-----|-----------|
| **Meridian Cyan** | `#00D4AA` | 0, 212, 170 | Accent dot, lock ring peak, boot glow |
| **Trust White** | `#F5F7FA` | 245, 247, 250 | Symbol primary (dark mode) |
| **Depth Slate** | `#1A2332` | 26, 35, 50 | Symbol primary (light mode); icon ground alt |
| **Void Black** | `#0D1117` | 13, 17, 23 | App icon ground primary |
| **Warm Resolve** | `#C8E6D0` | 200, 230, 208 | Match overlay @ ≤40% — logo idle yok |

### 2.1 Mevcut logo vs genom

| Kaynak | Kullanılan renkler | Gap |
|--------|-------------------|-----|
| `logo-leylek.svg` | `#67E8F9`, `#22D3EE`, `#2563EB`, `#0EA5E9` | Tam genom kopukluğu |
| `leylek-logo-premium.png` | Silver + cyan-blue gradient arc | Meridian değil; metal shader |
| Website hero | `cyan-400` + `violet-400` blur | AI moru sınırı; yasak |

**Migration:** Tüm logo yüzeyleri `#00D4AA` ailesine kalibre — hue shift, yeni marka değil.

---

## 3. Renk Modları

### 3.1 Dark (birincil)

| Öğe | Renk | Opacity |
|-----|------|---------|
| Background | Void Black `#0D1117` | 100% |
| Symbol stroke/fill | Trust White `#F5F7FA` | 92–100% |
| Accent | Meridian Cyan `#00D4AA` | 100% |
| Horizon | Trust White | 85% |
| Lock ring idle | Trust White | 60% |
| Lock ring peak | Meridian Cyan | 100% |
| Boot glow | Meridian Cyan | max 25% |

**Kullanım:** App icon, splash, onboarding dark, website hero, CarPlay.

### 3.2 Light

| Öğe | Renk | Opacity |
|-----|------|---------|
| Background | Trust White `#F5F7FA` | 100% |
| Symbol | Depth Slate `#1A2332` | 100% |
| Accent | Meridian Cyan `#00B894`* | 90% |
| Horizon | Depth Slate | 75% |

*Light mode accent: aynı hue, −8% luminance okunurluk için — hex `#00B894` opsiyonel; tercih `#00D4AA` @ 90% opacity.

**Kullanım:** Print light, email header, light widget, kartvizit beyaz zemin.

### 3.3 Monochrome

| Varyant | Symbol | Background | Kullanım |
|---------|--------|------------|----------|
| White on dark | `#FFFFFF` | `#0D1117` | Notification, watermark |
| Black on light | `#1A2332` | `#F5F7FA` | Print, fax, newspaper |
| Single cyan | `#00D4AA` | Transparent | Accent marketing only |
| Reversed | Inverted | Inverted | System adaptive |

**Kural:** Monochrome'da accent dot **siluete birleşir** — ayrı renk yok.

---

## 4. Gradient Politikası

| Durum | İzin |
|-------|------|
| Logo symbol içi gradient | **Yasak** |
| App icon background subtle | Void → Slate **yalnızca zemin**; symbol flat |
| Splash background | Depth gradient zemin — symbol flat |
| Website hero ambient | Cyan 0.05 full bleed — **violet yasak** |
| Marketing lockup | Wordmark flat |

**Mevcut pin gradient** (`#67E8F9` → `#2563EB`) → **retire**.

---

## 5. Glow ve Işık (logo-spesifik)

| Durum | Token | Renk | Max opacity | Süre |
|-------|-------|------|-------------|------|
| Boot | `glow.presence` | Meridian Cyan | 0.25 | 120 ms in |
| Lock | `glow.lock` | Meridian Cyan | 0.50 peak | 80 ms |
| Idle | — | — | 0 | — |
| AI orb | `glow.ai` | Cyan + white halo | 0.35 | 300 ms |

**Kural:** Logo idle'da glow **0**. Glow okunurluk için gerekli olamaz.

SVG `feGaussianBlur` filter → **retire**; runtime/CSS glow tercih (production Phase 4).

---

## 6. Malzeme Kombinasyonları

### 6.1 En güçlü kombinasyonlar (sıralı)

| # | Kombinasyon | Güç | Kullanım |
|---|-------------|-----|----------|
| 1 | **Trust White symbol + Void ground + cyan dot** | En yüksek — timeless, small-size, multimodal | App icon, splash, watch |
| 2 | **Depth Slate symbol + Trust White ground + cyan dot** | Print, light UI, kartvizit | Light mode primary |
| 3 | **Monochrome white/black** | Uzaktan, billboard, embroidery | Fiziksel |
| 4 | **Mat emboss single color** | Premium fiziksel dokunuş | Tabela, araç badge |
| 5 | **Metal accent tek nokta cyan** | Lüks ama sessiz | Premium packaging |
| 6 | **Glass frost edge + flat symbol** | AI orb, modal — logo secondary | Leylek Zeka |

### 6.2 Zayıf / yasak kombinasyonlar

| Kombinasyon | Neden |
|-------------|-------|
| Çoklu cyan-mavi gradient symbol | Generic, small fail |
| Neon cyan full opacity + glow | Cyberpunk; premium ihlal |
| 3D metal kuş + gradient pin | İkili kimlik |
| Cyan + violet + blur | Website hero mevcut — retire |
| Gold / silver chrome symbol | VIP chauffeur |
| AI mor gradient | Trend red list |

---

## 7. Cross-Channel Renk Tutarlılığı

| Kanal | Meridian Cyan | Kontrol |
|-------|---------------|---------|
| Logo accent | `#00D4AA` | Master |
| Marker glow | `#00D4AA` | Exact match |
| Sonic (görsel eş) | — | A3 = renk değil ses |
| UI CTA primary | `#00D4AA` | Same hex |
| Widget accent | `#00D4AA` | Material You tint override preserve |
| Push icon | Monochrome | No gradient |

**QA:** Digital color picker ±0 hex tolerance.

---

## 8. Print Spesifikasyonu

| Öğe | Spec |
|-----|------|
| Cyan Pantone eşdeğer | P 7470 C veya 326 C yakın — lab proof zorunlu |
| Black | Process Black veya Rich Black `#1A2332` |
| Min logo | 15 mm symbol height |
| Grayscale | %40–60 gray symbol; gradient yok |
| Emboss | Tek derinlik; cyan baskı opsiyonel spot |
| Araç giydirme | Monochrome + tek spot cyan |

---

## 9. Erişilebilirlik

| Test | Kriter |
|------|--------|
| White symbol on Void | WCAG AAA (large text equiv) |
| Slate on Trust White | WCAG AA minimum |
| Cyan dot on white | 3:1 minimum — dot küçük, decorative exception |
| Reduce Transparency | Glow → 1 px border fallback |
| Color blindness | Form silueti renk olmadan tanınır |

---

## 10. Dark / Light / System

| Context | Logo variant |
|---------|--------------|
| iOS dark | Dark primary |
| iOS light | Light inverted |
| Android Material You | Symbol geometry sabit; cyan preserved |
| `prefers-color-scheme` web | CSS swap stroke tokens |
| OLED | Void Black true black OK |
| E-ink (future) | Monochrome only |

---

## 11. Phase 3 SVG Renk Katmanları

| Layer ID | Fill/Stroke | Varyant |
|----------|-------------|---------|
| `logo.horizon` | white/slate | dark/light |
| `logo.wing` | white/slate | dark/light |
| `logo.ring` | white 60% / cyan peak | animated |
| `logo.accent` | cyan | all color |
| `logo.ground` | void/slate/transparent | context |

**Kural:** Tek SVG; CSS custom properties `--logo-stroke`, `--logo-accent`.

---

**Non-goals:** Renk dosyası, ASE, PNG üretimi yok.
