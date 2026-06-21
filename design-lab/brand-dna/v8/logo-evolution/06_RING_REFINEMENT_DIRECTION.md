# 06 — Ring Refinement Direction

**Sprint:** BRAND-LOGO-EVO-1B  
**Mode:** Analysis / design-lab only  
**Date:** 2026-06-21  
**Production:** Untouched — direction only

---

## Executive summary

Production master **`frontend/assets/images/leylek-logo-premium.png`** (Aile A) = **metal leylek silüeti + orbital arc/halka**. Sprint hedefi: **leylek piksel-piksel korunur**; yalnızca **halka katmanı** küçültülür, **glow azaltılır**, malzeme dili **neon → premium cam/metal**e kayar.

Bu bir **rebrand değil** — lock ring metaforu, gap konumu (1–2 o'clock), kuş profili ve `#22D3EE / #2563EB` ailesi korunur.

---

## Mevcut production okuması

### Görsel yapı (master PNG)

| Katman | Mevcut davranış | Sorun (premium hedefe göre) |
|--------|-----------------|------------------------------|
| **Leylek (stork)** | Gümüş-beyaz 3D metal profil; tek ayak; cyan göz noktası | **Korunacak** — tanınabilirlik anchor |
| **Orbital arc / halka** | ~270° açık swoosh; alt kalın, üst ince; sağ üstte gap | **Dominant** — mavi-cyan gradient + güçlü dış glow |
| **Glow / parlama** | Halka dış kenarında neon halo; siyah zeminde bloom | “Ucuz teknoloji / oyun” hissi; küçük boyutta çamur |
| **Malzeme** | Skeuomorphic metal kuş + gradient glow arc | Tek sistem yok; cam/metal tutarlılığı zayıf |

### Backup karşılaştırma

| Dosya | Konum | Not |
|-------|-------|-----|
| Current | `frontend/assets/images/leylek-logo-premium.png` | Production master |
| Pre-B6-2 backup | `frontend/assets/images/_backup-pre-b6-2/leylek-logo-premium.png` | Geri dönüş referansı; ring/kuş kompozisyonu current ile aynı aile |

**1B kuralı:** Backup **overwrite edilmez**; yalnızca diff / golden test referansı.

### Geometry SSOT (v4 constitution — referans)

`design-lab/brand-dna/v4/brand-identity-production/06_LOGO_GEOMETRY_CONSTITUTION.md`:

| Token | Locked @512 | 1B etkisi |
|-------|-------------|-----------|
| Canvas | 512×512 | Değişmez |
| Optical center | (268, 278) | Ring scale pivot |
| `layer.orbitalArc` | Open swoosh path | **Yalnız bu path scale** |
| `stork.silhouette` | Filled profile | **Dokunulmaz** |
| `R.negSpace` | ≥30% boş alan arc içi | Ring küçülünce **izlenen** negatif alan artar (halka daha az baskın) |
| Glow in master SVG | Forbidden blur | PNG export’ta glow **azaltılır**, vector trace’e taşınmaz |

---

## Creative direction — ne değişir / değişmez

### Değişmez (hard lock)

- Leylek silüeti: gaga açısı ±2°, crest, bacak pozu, göz konumu
- Logo kimliği: “premium kuş + orbital arc” — pin/wireframe/crown yok
- Arc tipi: **kapalı daire değil** — açık swoosh, alt ağırlıklı
- Gap: sağ üst (~1–2 o'clock) — gaga nefes alanı
- Zemin rengi tüketicilerde: `#08111F` (splash/login)

### Değişir (ring refinement scope)

| Hedef | Yön |
|-------|-----|
| Halka boyutu | %4 / %6 / %8 **içe scale** adayları (kuş sabit) |
| Glow | Dış bloom −40% ila −60%; kenar falloff sıkı |
| Malzeme | Cam/metal: specular highlight + kontrollü rim light; **neon halo kaldır** |
| Arc kalınlık hissi | Saf scale yerine opsiyonel: alt kalınlık −8% (premium ince rim) — yalnız 6%/8% adaylarında A/B |

---

## Ring küçültme adayları (%4 / %6 / %8)

**Transform kuralı:** Kuş raster katmanı **sabit**. `layer.orbitalArc` (+ glow mask) optical center **(268, 278)** etrafında uniform scale.

| Aday | Scale factor | @512 yaklaşık etki | Premium okuma | Risk |
|------|--------------|-------------------|---------------|------|
| **R4** | **0.96** (−4%) | Arc dış yarıçap ~−10 px | Hafif nefes; en güvenli | Glow hâlâ baskınsa yetersiz kalabilir |
| **R6** | **0.94** (−6%) | ~−15 px | **Önerilen denge** — halka daha “mücevher”, kuş hero | 48 px icon’da arc terminal kalınlığı izle |
| **R8** | **0.92** (−8%) | ~−20 px | En premium / en sakin | Beak–arc mesafesi daralır; adaptive safe zone test şart |

### Seçim mantığı

```
Premium hedef = kuş okunurluğu + halka destek rolü
                ─────────────────────────────────
                Halka görsel ağırlığı ↓  +  glow ↓
```

| Kriter | R4 | R6 | R8 |
|--------|----|----|-----|
| Leylek tanınabilirliği | ✅ | ✅ | ✅ |
| “Ay/halka” hâlâ okunur | ✅✅ | ✅ | ⚠️ küçük ekran |
| Glow azaltma ile birlikte premium | ⚠️ | ✅✅ | ✅ |
| App icon 66% safe (Android) | ✅ | ✅ | ⚠️ test |
| Splash cinematic (168 px kutu) | ✅ | ✅ | ✅ |

**1B tavsiyesi:** Lab’da **R6 + glow −50%** birincil aday; **R4** konservatif ship; **R8** yalnız golden test geçerse.

---

## Glow → cam/metal malzeme hedefi

### Mevcut (production PNG)

- Cyan `#22D3EE` → deep blue `#2563EB` gradient arc
- Geniş Gaussian-style outer glow (siyah zemin üzerinde halo)
- Alt arc “hot spot” — parlak nokta oyun estetiği

### Hedef malzeme stack (export spec)

| Pass | Açıklama | Değer hedefi |
|------|----------|--------------|
| Base arc | Solid gradient fill | 2–3 stop max; `#1E3A5F` → `#0891B2` → `#22D3EE` rim |
| Metal rim | 1 px iç highlight @512 | `#F5F7FA` @ 35% opacity — blur yok |
| Glass depth | İç kenar koyulaştırma | `#08111F` @ 15% inner shadow — **feather ≤2 px** |
| Outer glow | **Azalt** | Max spread 8 px @512 (mevcut ~20+ px tahmini) |
| Kuş | Mevcut metal pass | Değiştirme — yalnız renk dengesi match |

**Yasak:** Violet hero blur, `feGaussianBlur stdDeviation>3` master export, ayrı neon underglow layer.

---

## Yüzey bazlı yön (özet — detay 08)

| Yüzey | Ring refine etkisi | Ek not |
|-------|-------------------|--------|
| **Master PNG** | Birincil export | SSOT güncellemesi ancak release gate sonrası |
| **APK / Expo icon** | `app.json` → aynı PNG | Küçük boyut: glow azaltma **kritik** |
| **iOS icon** | `ios.premium.logo.png` ayrı | Master’dan tier-S türet |
| **Android adaptive** | `adaptive-icon-foreground.png` **farklı aile (B)** | Ring refine master’ı **otomatik düzeltmez** — unify ayrı sprint |
| **Splash native** | `app.json` splash.image | Android drawable pin (B) hâlâ drift — unify gerekli |
| **JS Splash** | PNG + **ekstra** halo anim | Asset glow azalt + `SplashScreen` halo ölçeği ayrı değerlendirme |
| **Login** | 100×100 contain | Ring refine yeterli; ekstra UI glow yok |

---

## Constitution amendment notu

B5.2 `06_LOGO_GEOMETRY_CONSTITUTION.md` master PNG’yi “never replaced” der. **BRAND-LOGO-EVO-1B** controlled amendment:

- **İzinli:** Arc path scale + glow raster pass — kuş silhouette IoU ≥98% vs current
- **İzinsiz:** Gaga/crest/bacak path edit, pin metaforu, tam daire ring

Golden test: `design-lab/brand-dna/v4/logo-restoration/GOLDEN_TEST.md` metodolojisi — alpha mask IoU kuş-only; arc ayrı layer diff.

---

## Çıkış kriterleri (1C implementasyon öncesi)

- [ ] R4/R6/R8 lab PNG’leri side-by-side @512, @168, @48
- [ ] Kuş-only IoU ≥98% vs production master
- [ ] Glow spread ölçümü (px) dokümante
- [ ] Product sign-off: **R6 + glow −50%** veya R4
- [ ] Production overwrite **yok** — 08 plan gate’i geçene kadar
