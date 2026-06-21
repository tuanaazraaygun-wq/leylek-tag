# EVOLUTION_GUIDELINES.md

**Phase:** P5-L2A — Logo Evolution Analysis  
**Type:** Koruma + geliştirme kuralları (üretim yok)  
**Principle:** Logo Evolution — rebrand değil  
**Date:** 2026-06-21  
**Authority chain:** `BRAND_CONSTITUTION_V4.md` → `LOGO_CONSTITUTION.md` → bu belge

---

## 0. Tanım

**Logo Evolution** = Mevcut LeylekTAG markasının tanınabilir DNA'sını koruyarak formu daha profesyonel, modern, okunabilir, premium, zamansız hale getirmek.

**Değildir:** Yeni kuş çizmek, pin'den tamamen farklı marka, renk paleti devrimi, wordmark değişikliği, rakip kopyası.

---

## 1. Korunması zorunlu unsurlar

### 1.1 Metafor katmanı

| Unsur | Koruma kuralı |
|-------|---------------|
| Leylek / kuş | Soyut (arc) veya literal (F2 tier) — **metafor kaybolmaz** |
| Göç / yol / mesafe | Wing ascend +2° implicit flow |
| Güven / kapanış | Lock ring — orbital arc evrimi |
| Operasyon | Horizon line — dispatch zemin |
| Presence | Cyan accent dot — göz / lock / canlı sistem |

### 1.2 Geometri DNA

| Bölüm | Mevcut kaynak | Evrim kuralı |
|-------|---------------|--------------|
| **Göz / accent dot** | Pin center; kuş göz glow; wireframe dot | Tek accent; r=7 @512; optik +1px yukarı |
| **Kanat** | SVG inner wing; PNG wing recess | Tek wing arc stroke; pin dışına |
| **Orbital arc** | Premium PNG sweep; wireframe oval | Lock ring ellipse; 3D metal **kaldır** |
| **Horizon** | Wireframe icon base line | y=66.7% canvas; stroke 2.5px |
| **Negatif boşluk** | Arc içi; pin üst boşluk | Min %32 canvas |
| **Profil posture** | Premium kuş ileri bakan | Büyük tier'da korunur; küçükte arc taşır |

### 1.3 Renk oranları

| Token | Hex | Rol |
|-------|-----|-----|
| Trust White | `#F5F7FA` | Symbol stroke |
| Void Black | `#0D1117` | Icon/splash ground |
| Meridian Cyan | `#00D4AA` | Accent only — tek vurgu |
| Depth Slate | `#1A2332` | Secondary chrome (logo ground alt) |

**Yasak:** Logo içi gradient, `#67E8F9→#2563EB`, violet hero, AI moru, taksi sarısı.

### 1.4 Tipografi ilişkisi

| Kural | Detay |
|-------|-------|
| Wordmark ayrımı | "Leylek" sakin + "TAG" vurgulu — hiyerarşi korunur |
| Lockup | Symbol sol / wordmark sağ veya alt; 8px grid |
| Bağımlılık | Arc-only tier'da wordmark **yanında** zorunlu (navbar, hero) |
| Font ailesi | Mevcut sans-serif — evrimde font değişikliği **Phase 5 dışı** |

---

## 2. Geliştirilebilir unsurlar (nasıl)

### 2.1 Stroke

| Mevcut | Hedef |
|--------|-------|
| Dolu gradient pin | Stroke-only symbol |
| 3D shaded arc | 2px ring stroke |
| Kanat fill paths | Single bezier stroke 2.5px |

### 2.2 Radius

| Mevcut | Hedef |
|--------|-------|
| Pin keskin teardrop | Round cap horizon |
| Path handle köşeleri | 2–4px implicit radius |
| Squircle clip risk | Wing apex y≥120 @512 safe |

### 2.3 Boşluk

| Mevcut | Hedef |
|--------|-------|
| Dolu kuş siluet | %32 negatif alan |
| Hero violet inset blur | Retire — flat glass veya none |
| Adaptive padding | 12% min symbol pad |

### 2.4 Kontrast

| Mevcut | Hedef |
|--------|-------|
| Glow-bağımlı okuma | Flat white on void |
| Çok mavi ton | White + single cyan |
| `#08111F` drift | `#0D1117` unify |

### 2.5 Denge & optik hizalama

| Mevcut | Hedef |
|--------|-------|
| Kuş arc içinde off-center | Optical center (268,248) +2% sağ |
| 3D arc kalınlık varyasyonu | Uniform ring stroke |
| Wordmark + icon vertical rhythm | Login/splash grid lock |

### 2.6 Küçük boyut okunabilirliği (tier sistemi)

| Tier | px | Görünür katmanlar |
|------|-----|-------------------|
| M0 | ≤20 | Accent dot + 1px horizon; ring **gizli** |
| M1 | 24–29 | Horizon + wing 2-bezier; ring gizli |
| S | 32–47 | Full wing + horizon; ring hairline @48 |
| F | 48+ | Tüm katmanlar |
| L | ≥128 | Wordmark yanında literal tier opsiyonel (F2 hibrit) |

### 2.7 Premium hissi

| Yap | Yapma |
|-----|-------|
| Restraint, mat stroke, precision grid | Neon glow idle |
| Tek malzeme (flat symbol) | Metal shader + gradient pin karışımı |
| Sessiz idle logo | Violet/cyan hero ambient |
| Glow max 0.25 **sadece motion peak** | feGaussianBlur shipped SVG |

### 2.8 Motion uyumu

| Olay | Logo davranışı | Token |
|------|----------------|-------|
| Boot | scale 0.96→1.03→1; glow 0.25 max | `presence.pulse` 550ms |
| QR | Ring stroke close | `lock.ringClose` 320ms |
| Match | Breathe ±2% | `pulse.journey` |
| Idle UI | **Statik** — glow off | — |

### 2.9 Marker uyumu

| Paylaşılan genom | Logo | Marker |
|------------------|------|--------|
| Stroke weight | 2.5px horizon/wing | 2.5px siluet |
| Radius | 2–4px | 2–4px |
| Accent | `#00D4AA` dot | Journey cyan rim |
| Ring timing | 320ms close | Destination lock echo |
| **Kopya yok** | Wing arc | Car/motor/human — pin **taşınmaz** |

---

## 3. F1 Meridian Wing'ten aktarılacak fikirler

| F1 fikri | Aktarım | Gerekçe |
|----------|---------|---------|
| Horizon line | ✅ Evet | Wireframe icon zaten taşıyor; dispatch metaforu |
| Wing arc (SVG kanat evrimi) | ✅ Evet | Pin içi kanat path'in doğal dışarı taşması |
| Lock ring (orbital arc flat) | ✅ Evet | Premium PNG arc'un restraint versiyonu |
| Accent dot @ intersection | ✅ Evet | Mevcut göz/dot korunur |
| Void ground `#0D1117` | ✅ Evet | Splash/login uyumu |
| Meridian `#00D4AA` | ✅ Evet | Genom hizalama |
| Tier ladder M0→F | ✅ Evet | Favicon fix |
| presence.pulse / lock.ringClose | ✅ Evet | Mevcut splash breathe + QR zemin |
| Flat stroke — no gradient | ✅ Evet | Premium via restraint |
| %32 negatif alan | ✅ Evet | Constitution |

---

## 4. F1'den aktarılmaması gerekenler

| F1 unsuru / bağlam | Neden aktarılmamalı |
|--------------------|---------------------|
| Arc-only **navbar without wordmark** | Leylek literal okuması düşer; website header başarısız |
| Violet/cyan hero wrapper (mevcut site hatası + F1 "no violet" kuralı) | Constitution ihlali |
| Pin formunun herhangi bir tier'da kalması | Generic; marker karışması |
| F1'i wordmark olmadan hero tek başına | F2 website skoru daha yüksek — hibrit L-tier gerekir |
| 3D metal shader'in tamamen silinmesi **ani** | Evrim aşamalı; kullanıcı "değişmiş" algısı — "yenilenmiş" hedef |
| F2 gap stork **master** olarak | Favicon/watch zayıf; evrim tanınırlığı riski |
| F3 seal circle **master** | Generic app icon; leylek metaforu en zayıf |
| Glow idle'da açık | Premium = sessizlik |
| Gradient stroke | Print/monochrome ölür |
| LeylekEye'ı logo yerine koymak | Companion mark; master değil |
| Muhabbet illüstrasyon stili (`leylek-blue`) | Logo ailesine karıştırma |

---

## 5. Website özel kuralları

| Kural | Detay |
|-------|-------|
| Navbar | Tier S symbol + "LeylekTAG" text — arc tek başına yetmez |
| Hero | Symbol + wordmark lockup; **violet blur retire** |
| Favicon | F1 M0 tier veya f1/favicon/*.png |
| OG image | feature-graphic ayrı marketing PR — icon stretch yasak |
| Leylek Zeka tile | Flat symbol; premium 3D PNG retire |

---

## 6. Evrim QA checklist (Phase 5+ gate)

- [ ] 16px favicon — dot + horizon okunur
- [ ] 29px iOS settings — tier M1 pass
- [ ] Android squircle — wing apex clip yok
- [ ] iOS icon = Android icon = in-app splash symbol — **aynı aile**
- [ ] Koyu + açık zemin test (navbar light mode varsa)
- [ ] Monochrome / print — stroke survives
- [ ] Blind test: "LeylekTAG mı?" ≥85%
- [ ] Blind test: "Yeni marka mı?" ≤15%
- [ ] Marker yan yana — logo ≠ pin marker
- [ ] Motion boot 550ms — glow ≤0.25
- [ ] Hero — violet yok

---

## 7. Yasak listesi (evrim sırasında)

1. Harita pin master olarak kalması  
2. Logo içi gradient veya shipped SVG blur filter  
3. Violet / AI purple hero ambient  
4. Tam kuş illustrasyon master (F2-only large tier)  
5. İki farklı app icon ailesi (iOS kuş / Android arc)  
6. Wordmark olmadan arc-only marketing hero  
7. Marker pin'den logo kopyası  
8. Neon idle glow  
9. Taksici / oyun / cyberpunk estetik  
10. Rebrand dili — "yeni Leylek", "artık X" messaging  

---

## 8. Önerilen evrim fazları (analiz only)

| Faz | Çıktı | Risk |
|-----|-------|------|
| **P5-L2A** | Bu analiz paketi | Yok — read only |
| **P5-L2B** | Stakeholder sign-off koruma listesi | Düşük |
| **P5-L1** | Website favicon + navbar F1 | Düşük |
| **P5-L2** | In-app premium PNG → F1 raster/SVG | Orta |
| **P5-L4** | App icon unify + prebuild | Yüksek |
| **P5-L2C** | Hero wordmark lockup + violet retire | Orta |
| **P5-L3** | Boot Lottie optional | Düşük |

---

## 9. Karar özeti

**Master evrim yönü:** F1 Meridian Wing geometry — mevcut kanat + arc + dot DNA'sının flat, tier'lı, genom-hizalı ifadesi.

**Hibrit (opsiyonel, L-tier only):** F2 gap stork hint ≥128px website hero — F1 master bozulmaz.

**Retire:** Pin SVG master, 3D metal shader idle, violet hero, çoklu icon ailesi.

---

**İlişkili belgeler:** `LOGO_EVOLUTION_ANALYSIS.md`, `CURRENT_LOGO_STRENGTHS.md`, `CURRENT_LOGO_WEAKNESSES.md`, `LOGO_SURFACE_MAP.md`
