# Area 2 — Vector Master Spec

**Phase:** P1-1 — Logo Evolution Full Analysis  
**Mode:** Specification only — **no SVG production in P1**  
**Date:** 2026-06-21  
**Canonical raster:** `frontend/assets/images/leylek-logo-premium.png`

---

## Executive summary

LeylekTAG logo evrimi tek bir **vector master SVG** etrafında toplanmalıdır. Bu belge P2 üretim öncesi gereksinimleri tanımlar. Master, premium kuş + orbital arc siluetinin trace'i olacak; pin SVG ve F1 formu master olamaz.

---

## Mevcut durum

| Durum | Detay |
|-------|-------|
| Production master | Raster PNG only — `leylek-logo-premium.png` |
| Mevcut SVG | `website/public/logo-leylek.svg` — pin ailesi, orphan, master değil |
| Design-lab F1 | `design-lab/brand-dna/v4/exports/svg/f1-meridian-wing-*.svg` — ship red |
| Referans spec | `design-lab/brand-dna/v4/logo-master/LOGO_GEOMETRY.md` |

**Sonuç:** Vector source of truth yok — P0 evolution blocker.

---

## Kullanılan mevcut dosyalar

| Dosya | Rol |
|-------|-----|
| `frontend/assets/images/leylek-logo-premium.png` | Trace referans (primary) |
| `website/public/logo-leylek.svg` | Kanat path / accent dot referans (retire hedefi) |
| `website/public/store/leylektag-icon.png` | M0/M1 wireframe tier referans |
| `design-lab/brand-dna/v4/logo-master/LOGO_GEOMETRY.md` | Numeric hedef |
| `design-lab/brand-dna/v4/logo-master/LOGO_COLOR_SYSTEM.md` | Renk token hedefi |

---

## viewBox

| Parametre | Değer | Gerekçe |
|-----------|-------|---------|
| Primary viewBox | `0 0 512 512` | App icon, favicon, splash symbol |
| Coordinate origin | Merkez optik (256, 256) | Squircle safe zone hesabı |
| Grid base | 8 px | Constitution + marker hizası |
| Pixel alignment | Tam pixel; 0.5 offset yok | Retina keskinlik |
| Aspect variants | 1:1 (symbol) · 16:9 (splash) · 4:1 (horizontal lockup) | Ayrı artboard; aynı anchor |

**Hedef dosya yolu (P2):** `design-lab/brand-dna/v4/logo-evolution/vector-master/leylek-symbol-master-v1.svg`

---

## Layer naming

Zorunlu layer ID'leri (SVG `<g id="...">`):

| Layer ID | İçerik | Tier visibility |
|----------|--------|-----------------|
| `layer.ground` | Void fill (opsiyonel; genelde export dışı) | — |
| `layer.horizon` | Alt operasyon çizgisi | M1+ |
| `layer.lockRing` | Orbital arc stroke | M0+ |
| `layer.wing` | Kanat sweep path | S+ |
| `layer.body` | Gövde + boyun fill/stroke | M+ |
| `layer.neck` | Boyun eğrisi (body alt-path veya ayrı) | L |
| `layer.beak` | Gaga profili | L |
| `layer.leg` | Tek ayak | L only |
| `layer.accent` | Cyan göz dot | M0+ |
| `layer.emboss` | L-tier hafif depth (opsiyonel) | L only |

**Kural:** Export script tier'a göre layer gizler — ayrı dosya çizimi değil, visibility matrisi.

---

## Stroke / fill kuralları

| Öğe | Fill | Stroke | @512 px |
|-----|------|--------|---------|
| Wing arc | none | Trust White `#F5F7FA` | 2.5 px, round cap/join |
| Lock ring | none | Trust White veya Meridian Cyan peak | 2 px |
| Horizon | none | Trust White 80% | 2.5 px |
| Body | Trust White primary | none veya 1.5 px outline (L) | — |
| Accent dot | Meridian Cyan `#00D4AA` | none | 6–8 px diameter |
| Leg / beak detail | Trust White | — | L-tier only |

**Yasak:**

- Stroke > 4 px @ 512
- El çizimi jitter (grid snap zorunlu)
- Çoklu paralel stroke aynı öğede (glow simülasyonu)

---

## Gradient yasağı / izinleri

| Kural ID | Kural |
|----------|-------|
| `grad.idleOff` | Idle logo export'ta gradient yok — flat fill/stroke |
| `grad.motionOnly` | Radial/linear gradient yalnızca motion Lottie/SVG anim layer'da |
| `grad.banPin` | `#67E8F9 → #2563EB` pin gradient ailesi yasak |
| `grad.allowedL` | L-tier splash export'ta **tek** hafif vertical emboss gradient (2 stop max, ΔL≤8%) |
| `grad.filterBan` | `feGaussianBlur` / glow filter master'da yasak |

---

## Dark / light variant

| Variant | Zemin | Form | Kullanım |
|---------|-------|------|----------|
| **dark-primary** | Void `#0D1117` / Splash `#08111F` | Trust White + Meridian accent | App, splash, web dark |
| **light-secondary** | Trust White `#F5F7FA` | Void stroke + Meridian accent | Print, light theme (gelecek) |
| **monochrome** | Transparent | Single color `#F5F7FA` veya `#0D1117` | Watermark, notification |

**Kural:** Aynı geometry; yalnızca fill/stroke token swap — path değişmez.

---

## Export kuralları

| Export | Kaynak | Format | Not |
|--------|--------|--------|-----|
| Tier ladder | Master + layer visibility | PNG @1x, @2x, @3x | 16–1024 px |
| App icon foreground | Tier S, 432×432 safe in 512 | PNG | Android adaptive |
| iOS 1024 | Tier S/L composite | PNG | App Store |
| Favicon | Tier M0 | PNG + ICO | 16, 32, 48 |
| Web SVG symbol | Stroke-only subset | SVG | Navbar compact (opsiyonel P8) |
| Splash | Tier L, 16:9 artboard | PNG | Native + JS |

**Export metadata:** `design-lab/brand-dna/v4/logo-evolution/vector-master/manifest.json` — version, tier, checksum.

---

## Safe area

| Platform | Safe zone | Kural |
|----------|-----------|-------|
| Android adaptive | 66% center (432/512 dp) | Wing apex, gaga ucu safe içinde |
| iOS squircle | ~80% effective | Bacak alt nokta y ≥ 120 @512 |
| Favicon 16 px | 1 px padding min | Dot + arc tamamen görünür |
| Watch (gelecek) | 80% circle | M0 only |

**Optical center:** Matematik (256,256) değil; accent dot + wing peak ağırlığı — **+2% sağa, -1% yukarı** shift.

---

## Optical center

```
Optical anchor @512:
  accent: (262, 248)  — horizon ∩ wing peak (hedef)
  bounding weight: üst-orta üçte bir
  squircle clip test: tüm S-tier path'ler 66% daire içinde
```

---

## Versioning

| Alan | Şema |
|------|------|
| Dosya adı | `leylek-symbol-master-v{MAJOR}.{MINOR}.svg` |
| MAJOR | Anchor geometry değişirse (+ constitution amendment) |
| MINOR | Stroke kalınlık, renk token, tier export tweak |
| manifest | `version`, `canonicalRasterSha256`, `iouScore`, `frozenAt` |
| Git tag | `logo-evolution-vector-v1.0.0` (P2 freeze sonrası) |

**DNA Freeze sonrası:** MAJOR bump stakeholder sign-off gerektirir.

---

## Sorunlar

| ID | Sorun |
|----|-------|
| VEC-01 | Production'da SVG master yok |
| VEC-02 | Pin SVG gradient/filter küçük boyut için uygun değil |
| VEC-03 | İki PNG kopyası (frontend + website) sync garantisi yok |
| VEC-04 | Export pipeline otomasyonu yok |

---

## Marka riski

- Yanlış dosyayı master yapmak (pin, F1) → marka parçalanması veya rebrand algısı.
- Gradient-heavy master → Uber/Google pin karışması riski.

---

## Teknik risk

- Auto-trace artefaktları → manuel path düzeltme süresi.
- Expo prebuild SVG desteği sınırlı → PNG ladder zorunlu.
- Layer export script bakımı.

---

## İleride değişebilecek dosyalar

| Path | Faz |
|------|-----|
| `design-lab/brand-dna/v4/logo-evolution/vector-master/*` | P2 oluşturulur |
| `design-lab/brand-dna/v4/logo-evolution/vector-master/manifest.json` | P2 |
| `design-lab/brand-dna/v4/exports/**` | P4–P5 |
| `website/public/logo-leylek.svg` | P8 retire veya replace |
| `frontend/assets/images/*.png` | P8 swap |

---

## Kesinlikle dokunulmamalı (P1)

- Tüm production SVG/PNG
- F1 master dosyaları (referans; overwrite yok)
- `frontend/app.json` icon path'leri (P8 öncesi)

---

## Önerilen üretim stratejisi

1. P2 Patch 1: `vector-master/` klasörü + bu spec + boş manifest şablonu (design-lab).
2. P2 Patch 2: Manuel trace premium PNG → 512 SVG (design-lab).
3. IoU gate + layer naming doğrulama.
4. Export script (Node/Python) — design-lab only, P4.
5. P8: PNG swap; SVG web opsiyonel.

---

## Rollback planı

| Seviye | Aksiyon |
|--------|---------|
| design-lab SVG | Git revert |
| manifest version | Önceki MINOR'a dön |
| P8 PNG swap | `_backup-pre-evolution/` restore |

---

## QA kriterleri

| Test | Pass |
|------|------|
| viewBox 512×512 | ✅ |
| Layer ID'ler spec ile eşleşir | ✅ |
| Gradient/filter master'da yok | ✅ |
| Squircle safe @ S-tier | ✅ |
| manifest checksum match | ✅ |
| F1 path overlay ≠ master | ✅ |

---

## Production migration sırası

1. Vector master freeze (P2 gate)
2. Tier PNG ladder (P4–P5)
3. QA pass (P7)
4. P8 asset swap — SVG opsiyonel web; PNG zorunlu mobile

---

**İlişkili:** `GEOMETRY_EVOLUTION_ANALYSIS.md`, `SMALL_SIZE_SYSTEM_SPEC.md`
