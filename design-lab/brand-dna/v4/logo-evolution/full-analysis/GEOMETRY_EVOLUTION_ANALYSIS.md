# Area 1 — Geometry Evolution Analysis

**Phase:** P1-1 — Logo Evolution Full Analysis  
**Mode:** Read-only analysis — no production changes  
**Date:** 2026-06-21  
**Canonical reference:** `frontend/assets/images/leylek-logo-premium.png`  
**Parent:** `LOGO_EVOLUTION_CONSTITUTION.md`, `CURRENT_DNA_ANALYSIS.md`

---

## Executive summary

Mevcut premium kuş logosu evrim için güçlü bir anchor'dır: profil leylek silueti, orbital arc ve cyan accent göz kullanıcıda "LeylekTAG" tanınırlığı oluşturmuştur. Geometri evrimi **yeni kuş çizmek değil**; aynı siluetin optik merkez, oran, negatif alan ve küçük boyut davranışının kalibre edilmesidir. Pin/wireframe formları (Aile B) premium kuş geometrisine trace edilerek birleştirilmelidir — F1 Meridian Wing formu kullanılmaz.

---

## Mevcut durum

| Öğe | Mevcut ifade | Kaynak |
|-----|--------------|--------|
| Leylek silueti | Profil kuş; gaga, boyun, gövde, tek ayak | `leylek-logo-premium.png` |
| Kanat sweep | İç oyuk + dış kontur; sağa-yukarı akış | Premium PNG |
| Göz / cyan dot | Parlak cyan nokta; presence anchor | Premium PNG + `logo-leylek.svg` r=8.5 |
| Orbital arc | ~270° alt sweep; kalın-alt, ince-üst 3D shading | Premium PNG |
| Gövde | Gümüş-beyaz metal işleme niyeti | Premium PNG |
| Boyun | S-eğrisi; ileri posture | Premium PNG |
| Negatif alan | Arc içi ~%28–32; kuş gövdesi dolu | Premium PNG |
| Oranlar | ~1:1.15 dikey canvas; kuş optik off-center | Premium PNG |
| Optik merkez | Matematik merkez ≠ görsel ağırlık (kuş üst-sağ) | Gözlem |
| Küçük boyut | 16–32 px'de blob; arc/göz kaybolur | Production audit |
| Premium hissi | 3D metal shader + glow | Premium PNG |

**Paralel geometri (birleştirilecek, master değil):**

- `logo-leylek.svg` (160×160): pin teardrop + iç kanat bezier — glow filter σ=7
- `leylektag-icon.png`: wireframe arc + horizon + dot — M0/M1 tier mantığına uygun

---

## Kullanılan mevcut dosyalar

| Dosya | Rol |
|-------|-----|
| `frontend/assets/images/leylek-logo-premium.png` | **Canonical geometry trace kaynağı** |
| `frontend/assets/ios.premium.logo.png` | iOS icon — aynı aile, squircle crop |
| `website/public/store/leylek-logo-premium.png` | Web Leylek Zeka primary |
| `website/public/logo-leylek.svg` | Pin geometry referans (orphan) |
| `website/public/store/leylektag-icon.png` | Wireframe tier referans |
| `design-lab/brand-dna/v4/logo-master/LOGO_GEOMETRY.md` | Hedef numeric spec (512 grid) |

---

## Bileşen bazlı analiz

### Leylek silueti

- **Güç:** Gaga profili en ayırt edici okuma; Türkiye leylek metaforu güçlü.
- **Zayıflık:** Profil asimetrik; favicon/app icon safe zone dışına taşan bacak/gaga ucu.
- **Evrim:** L-tier'da tam siluet; S-tier'da bacak gizlenir; M-tier'da gaga sadeleşir.

### Kanat sweep

- **Güç:** İleri hareket okuması; SVG pin iç kanat path trace edilebilir.
- **Zayıflık:** 3D shading küçük boyutta gürültü; pin kanat ≠ premium kanat geometrisi.
- **Evrim:** Tek sürekli stroke path; ascend +2° implicit; `MARKER_DNA` stroke paylaşımı.

### Göz / cyan dot

- **Güç:** LHIS / LeylekEye ile aynı presence dili; lock noktası metaforu.
- **Zayıflık:** `#67E8F9` / `#22D3EE` — genom `#00D4AA` drift.
- **Evrim:** Tek accent dot; M0 tier'da yalnızca dot + arc kalır; renk kalibrasyonu P3.

### Orbital arc

- **Güç:** Güven/kapanış metaforu; QR lock animasyon zemin.
- **Zayıflık:** 3D metal arc küçük boyutta kalın leke; wireframe arc ayrı aile.
- **Evrim:** Flat stroke ring; sweep yönü korunur; dasharray-ready (P6 motion).

### Gövde & boyun

- **Güç:** Premium mobility algısı; zarif S-eğrisi.
- **Zayıflık:** Metal shader flat export'ta kaybolur veya aşırı noise üretir.
- **Evrim:** Trust White `#F5F7FA` flat + hafif emboss (L-tier only).

### Negatif alan

- **Mevcut:** Arc içi iyi; kuş dolu alan baskın.
- **Hedef:** Constitution ≥%30 negatif alan; 8px grid breath margin %15 üst/alt.

### Oranlar & optik merkez

- **Mevcut:** 1:1.15 dikey; kuş +2% sağa optik shift gerekli.
- **Hedef @512:** Horizon y=340 (66.7%); wing apex x≈62%; accent horizon ∩ wing peak.

### Küçük boyut davranışı

| Boyut | Mevcut okuma | Hedef tier |
|-------|--------------|------------|
| 16 px | Blob / glow çamur (pin SVG) | M0: dot + arc |
| 24–32 px | Wireframe okunur; kuş kaybolur | M1/S: sadeleşmiş siluet |
| 48+ px | Premium detay başlar | M/L |

### Premium hissi

- **Korunacak:** Sessiz premium, operasyon ciddiyeti, metal **niyeti** (shader değil).
- **Kaldırılacak:** Ağır 3D metal, SVG feGaussianBlur, çoklu mavi ton.

---

## Sorunlar

| ID | Sorun | Severity |
|----|-------|----------|
| GEO-01 | Üç paralel geometri (kuş / pin / wireframe) — ortak anchor yok | P0 |
| GEO-02 | Tek master vector yok — raster-only trace zor | P0 |
| GEO-03 | Squircle clip — ince bacak/gaga kesimi riski | P1 |
| GEO-04 | Optik merkez kalibre edilmemiş | P1 |
| GEO-05 | Pin glow 16 px'de form eritir | P1 |
| GEO-06 | Negatif alan kuş gövdesinde düşük | P2 |

---

## Marka riski

| Risk | Açıklama | Mitigasyon |
|------|----------|------------|
| Rebrand algısı | Siluet değişirse kullanıcı "başka uygulama" der | IoU ≥85% overlay testi |
| Generic pin | Pin master yapılırsa Maps/Uber karışır | Pin retire; kuş tier türevi |
| F1 scope creep | Meridian Wing formu alınırsa tanınırlık kırılır | `ban.f1Ship` constitution |
| Companion kopukluğu | LeylekEye iris ≠ logo göz rengi | Accent token unify |

---

## Teknik risk

| Risk | Açıklama |
|------|----------|
| Raster trace kalitesi | PNG → SVG manuel/auto trace artefakt |
| Layer karmaşıklığı | Tier export için layer yapısı şart |
| Grid snap | Sub-pixel jitter retina'da blur |
| Animation readiness | Ring dashoffset için stroke-only arc gerekli |

---

## İleride değişebilecek dosyalar (P2–P8)

| Dosya | Faz | Not |
|-------|-----|-----|
| `design-lab/brand-dna/v4/logo-evolution/vector-master/*` | P2 | Yeni design-lab klasörü |
| `design-lab/brand-dna/v4/exports/svg/*` | P2–P5 | Evolution exports |
| `frontend/assets/images/leylek-logo-premium.png` | P8 | Asset swap |
| `website/public/store/leylektag-icon.png` | P8 | Tier M0/M1 swap |

---

## Kesinlikle dokunulmamalı (P1)

| Dosya / alan | Gerekçe |
|--------------|---------|
| Tüm `frontend/`, `website/`, `backend/` production asset'leri | P1 read-only |
| F1 Meridian Wing export'ları | Ship red — referans lab only |
| `Logo.tsx` logic (P1) | P8 cleanup ayrı karar |
| Wordmark "Leylek" + "TAG" hiyerarşisi | Constitution core |

---

## Önerilen üretim stratejisi

1. **P2:** `leylek-logo-premium.png` üzerine optically centered 512×512 grid trace (design-lab only).
2. Wing arc + lock ring + horizon + accent dot layer'ları ayrı isimlendir.
3. Pin SVG kanat path'i referans alınarak premium kuş kanadına **trace** — pin formu alınmaz.
4. Siluet overlay IoU ≥85% gate geçmeden P3'e geçilmez.
5. Tier path prep: M0→L layer visibility matrisi (export P4).

---

## Rollback planı

| Aşama | Rollback |
|-------|----------|
| P2 design-lab trace | Git revert design-lab only; production etkilenmez |
| P8 production swap | Önceki PNG'ler `_backup-pre-evolution/` altında saklanır; manifest path geri alınır |
| Geometry anchor değişikliği | Constitution v2 + stakeholder sign-off gerekir — otomatik rollback yok |

---

## QA kriterleri

| Test | Kriter |
|------|--------|
| Siluet overlay | IoU ≥85% vs premium PNG |
| Gaga profili | L-tier'da blind test ≥85% "leylek" |
| Kanat yönü | Ascend +2°; ayna yok |
| Negatif alan | ≥30% canvas |
| 8px grid | Tüm anchor snap |
| F1 red team | F1 formu overlay'de kullanılmadı |
| Pin red team | Uber/Google pin yan yana karışmama |

---

## Production migration sırası

Geometry doğrudan production'a gitmez. Sıra:

1. P2 — design-lab master SVG + geometry doc
2. P3 — polish layer (renk/emboss)
3. P4 — tier raster ladder (design-lab)
4. P5 — app icon tier S export
5. P7 — geometry QA pass
6. P8 — `leylek-logo-premium.png` ve türevleri swap

---

**İlişkili:** `VECTOR_MASTER_SPEC.md`, `SMALL_SIZE_SYSTEM_SPEC.md`, `DNA_FREEZE_GATE.md`
