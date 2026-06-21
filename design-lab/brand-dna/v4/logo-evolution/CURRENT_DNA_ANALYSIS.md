# LeylekTAG Current Logo DNA Analysis

**Phase:** P1 — Logo Evolution Analysis  
**Mode:** Read-only  
**Date:** 2026-06-21  
**Canonical reference:** `frontend/assets/images/leylek-logo-premium.png`  
**Inventory:** `LOGO_SURFACE_MAP.md`

---

## Executive summary

Production'da **üç logo ailesi** paralel yaşar; kullanıcıların çoğu **Aile A (premium kuş + orbital arc)** ile tanışır (splash, login, Leylek Zeka). Evrim programının DNA referansı **Aile A'dır**. B ve C aileleri, A'nın sadeleştirilmiş veya eski export türevleri olarak birleştirilmelidir — yeni marka olarak kalmamalıdır.

| Aile | Form | Birincil dosya | Kullanıcı yüzeyi |
|------|------|----------------|------------------|
| **A — Premium kuş** | 3D metal profil leylek + orbital arc | `leylek-logo-premium.png` | Splash, login, Zeka, watermark, iOS icon |
| **B — Pin / wireframe** | Gradient pin veya arc+dot | `logo-leylek.svg`, `leylektag-icon.png` | Favicon, navbar, Android splash/adaptive |
| **C — Wordmark banner** | Flat kuş + "Leylek TAG" + mockup | `feature-graphic.png` | Hero, OG image |

---

## 1. Current DNA Analysis — Korunması gereken DNA

### 1.1 Sembolik çekirdek

| DNA öğesi | Mevcut ifade | Neden kritik |
|-----------|--------------|--------------|
| **Leylek hissi** | Profil kuş silueti; tek ayak duruş | Türkiye göç metaforu; rakiplerde yok |
| **Kanat formu** | Kanat kontur oyuk + SVG iç kanat path | İleri hareket / yol okuması |
| **Gövde** | Gümüş-beyaz metal gövde; zarif boyun eğrisi | Premium mobility algısı |
| **Göz / accent** | Parlak cyan nokta — canlı sistem | LHIS / LeylekEye ile aynı presence dili |
| **Orbital arc** | ~270° alt sweep; kalın-alt ince-üst | Güven, kapanış, lock metaforu |
| **Arc / horizon** | Wireframe icon'da taban çizgisi | Operasyon / dispatch zemin |
| **Hareket yönü** | Kuş ileri bakış; kanat sağa-yukarı | Göç + ilerleme |
| **Güven hissi** | Koyu zemin (`#08111F`) + sakin form | Login/splash tonu doğru |
| **Premium hissi** | Metalik işleme niyeti | Kalite sinyali — shader değil niyet korunur |
| **Tanınabilir siluet** | Gaga profili + arc birleşimi | "LeylekTAG kuş uygulaması" algısı oluşmuş |

### 1.2 Geometrik DNA (ölçülebilir)

**Premium kuş (`leylek-logo-premium.png`) — master trace kaynağı:**

| Parametre | Gözlem | Evrim notu |
|-----------|--------|------------|
| Oran | ~1:1.15 kare canvas | Icon 1:1; wordmark lockup ayrı |
| Gaga | En ayırt edici profil okuması | L-tier'da literal korunur |
| Boyun | S-eğrisi, ileri posture | Optical center kalibrasyon |
| Kanat | İç oyuk tek stroke'a indirgenebilir | Wing sweep yönü sabit |
| Bacak | Tek ayak — storytelling | S-tier altında gizlenir |
| Arc | Elips sweep, 3D shading | Flat ring'e evrilir; **form kalır** |
| Negatif alan | Arc içi boşluk ~%28–32 | Constitution ≥%30 hedef |
| Accent dot | Göz merkezi cyan glow | `#00D4AA` genom hedefi |

**Pin SVG (`logo-leylek.svg`) — evrim kaynağı, master değil:**

| Parametre | Gözlem |
|-----------|--------|
| viewBox | 160×160 |
| Pin path | Teardrop — generic konum app |
| İç kanat | Bezier wing — **premium kuş kanadına trace edilebilir** |
| Merkez dot | r=8.5, `#67E8F9` — accent anchor |
| Glow filter | stdDeviation=7 — küçük boyut felç |

**Wireframe icon (`leylektag-icon.png`):**

| Parametre | Gözlem |
|-----------|--------|
| Horizon | Alt çizgi — operasyon metaforu |
| Arc | Hairline ring — lock ring öncülü |
| Dot | Teal accent — göz türevi |
| Dil | Flat stroke — **M0/M1 tier mantığına uygun** |

### 1.3 Renk DNA

| Rol | Mevcut değerler | Evrim |
|-----|-----------------|-------|
| Accent | `#67E8F9`, `#22D3EE`, `#0EA5E9` | → `#00D4AA` (Meridian genom) |
| Form | Silver-white metal, `#F8FDFF` wing | → Trust White `#F5F7FA` |
| Zemin | `#08111F`, `#081827` pin iç | → Void `#0D1117` unify |
| Glow | Cyan blur, SVG filter | Motion-only; idle off |

### 1.4 Tipografi DNA (wordmark)

| Öğe | Mevcut | Koruma |
|-----|--------|--------|
| Hiyerarşi | "Leylek" + "TAG" | ✅ Değişmez |
| TAG vurgusu | Cyan ağırlık | ✅ Korunur; ton kalibrasyonu OK |
| Font | Geometric sans (Inter / sistem) | Evrimde font devrimi yok |
| Lockup | feature-graphic yatay kompozit | Symbol + wordmark ilişkisi korunur |

### 1.5 Companion DNA (logo değil — hizalanmalı)

| Unsur | Dosya | DNA bağlantısı |
|-------|-------|----------------|
| LeylekEye | `LeylekEye.tsx` | Logo göz accent'inin animasyonlu türevi |
| Leylek Zeka | premium PNG + Eye | AI companion — stroke/cyan hizası gerekli |
| Muhabbet illüstrasyon | `leylek-blue.png` | Logo değil; ayrı illustration lane |

---

## 2. Never Change — Kesinlikle değiştirilmemesi gerekenler

### 2.1 Marka algısı

| # | Kural | İhlal sonucu |
|---|-------|--------------|
| 1 | **"Bu LeylekTAG"** tanınırlığı | Rebrand algısı |
| 2 | **Leylek / kuş metaforu** | Generic tech mark |
| 3 | **Profil siluet okuması** (büyük tier) | Yabancı marka |
| 4 | **"Leylek" + "TAG" wordmark** | Ürün adı kaybı |
| 5 | **Güven + premium eksenleri** | Startup / oyun algısı |

### 2.2 Geometri — dokunulmaz çekirdek

| # | Unsur | Not |
|---|-------|-----|
| 1 | Orbital arc / lock ring **varlığı** | Kaldırılamaz |
| 2 | Kanat sweep **yönü** | Ters çevrilemez |
| 3 | İleri bakan **posture** | Ayna alınamaz |
| 4 | Tek cyan **accent nokta** | Çok renkli göz yasak |
| 5 | Gaga profili (L-tier) | Farklı kuş türü yasak |

### 2.3 Karakter

| # | Korunacak | Yasak |
|---|-----------|-------|
| 1 | Sessiz premium | Neon bağırmak |
| 2 | Operasyon ciddiyeti | Oyun mascot |
| 3 | Türkiye yol paylaşımı | Taksi / VIP chauffeur |
| 4 | Teknoloji güveni | Cyberpunk / AI moru |

### 2.4 Hareket yönü

| # | Kural |
|---|-------|
| 1 | Implicit ascend +2° — kanat ve arc |
| 2 | Lock = inward ring close — dışa patlama yok |
| 3 | Boot = nefes — zıplama yok |

### 2.5 Kullanıcı algısı (saha kanıtı)

Design-lab karşılaştırması: mevcut kullanıcı premium kuş + arc gördüğünde **LeylekTAG** diyor. Evrim bu algıyı **bozamaz** — yalnızca netleştirir.

---

## 3. Evolution Opportunities — Geliştirilebilecek noktalar

### 3.1 Geometri ve oranlar

| Alan | Mevcut sorun | Evrim fırsatı |
|------|--------------|---------------|
| **Geometri** | Pin ≠ kuş ≠ wireframe | Tek anchor trace; optically centered |
| **Oranlar** | Kuş off-center; arc kalınlık değişken | Golden grid 8px; uniform ring stroke |
| **Stroke** | Dolu gradient pin; 3D arc | Flat 2–2.5px; metal → light emboss |
| **Radius** | Pin teardrop keskin | Round caps; 2–4px handle language |
| **Negatif alan** | Dolu kuş alt tier | %32+ breath space zorunlu |
| **Simetri** | Profil doğal asimetrik | Optical balance +2% shift |

### 3.2 Küçük boyut ve retina

| Alan | Mevcut | Hedef |
|------|--------|-------|
| **16 px okunabilirlik** | Premium kuş blob; pin glow çamur | M0 tier: dot + arc |
| **24–32 px** | Detay birleşir | M1/S tier ladder |
| **Retina** | Raster PNG tek dosya | Vector master + PNG export ladder |
| **Squircle clip** | iOS ince bacak kesimi | Safe zone spec; wing apex y≥120@512 |

### 3.3 Platform davranışları

| Yüzey | Fırsat |
|-------|--------|
| **App icon** | iOS kuş = Android arc → unify tier S |
| **Adaptive icon** | Foreground wireframe → premium kuş sadeleşmiş |
| **Favicon** | leylektag-icon → kuş DNA M0 |
| **Native splash** | Pin flash → kuş tier M (Android res sync) |
| **Notification** | Premium PNG küçük → M0 monochrome |

### 3.4 Multimodal uyum

| Alan | Fırsat |
|------|--------|
| **Motion** | Splash breathe → LSX token hizası |
| **Marker** | Pin retire; stroke/radius/cyan shared genom |
| **Sonic** | Boot peak @ arc tepe — LSDS v2 |
| **LHIS / LeylekEye** | Iris cyan → `#00D4AA` kalibrasyon |
| **QR lock** | Orbital arc → ring close animasyon zemin |

### 3.5 Website ve marketing

| Alan | Fırsat |
|------|--------|
| **Hero** | Violet blur retire; cyan-only ambient |
| **Navbar** | Arc-only → kuş M1 + wordmark |
| **OG image** | feature-graphic güncelle — aynı lockup, refine |
| **Favicon chain** | Tek tier ailesi |

### 3.6 Teknik borç

| Alan | Fırsat |
|------|--------|
| **Master dosya** | Tek SVG source of truth |
| **Orphan assets** | logo-leylek.svg, Logo.tsx, login-brand.png temizlik planı |
| **Duplicate PNG** | website + frontend premium sync |
| **Backend static** | `leylek-logo.png` repo'da yok — migration P8 |

### 3.7 Premium polish (restraint)

| Kaldır | Koru |
|--------|------|
| 3D metal shader | Siluet + hafif depth |
| SVG feGaussianBlur | Flat okunurluk |
| Violet hero | Cyan ambient only |
| 4 mavi ton | Tek accent genom |
| Gradient pin | — |

---

## 4. DNA Freeze checklist (P1 çıkış)

P2'ye geçmeden önce stakeholder onayı:

- [ ] Canonical master = premium kuş + arc onaylandı
- [ ] Never Change listesi imzalandı
- [ ] F1 production ship **red** onaylandı
- [ ] Tier ladder (M0→L) prensip onayı
- [ ] Renk genom `#00D4AA` kalibrasyon onayı
- [ ] Pin master olarak retire onayı

---

**İlişkili belgeler:** `LOGO_EVOLUTION_CONSTITUTION.md`, `PRODUCTION_LOGO_AUDIT.md`, `EVOLUTION_ROADMAP.md`
