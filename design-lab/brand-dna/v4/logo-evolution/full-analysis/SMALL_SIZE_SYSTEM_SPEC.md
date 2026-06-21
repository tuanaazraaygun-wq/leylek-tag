# Area 3 — Small Size System Spec (16–1024 px)

**Phase:** P1-1 — Logo Evolution Full Analysis  
**Mode:** Specification only  
**Date:** 2026-06-21  
**Parent:** `LOGO_EVOLUTION_CONSTITUTION.md` §5 Tier System

---

## Executive summary

Tek master geometry'den **tier ladder** ile 16–1024 px arası tüm yüzeyler beslenir. Küçük boyutta detay **sadeleştirilir**, form **değiştirilmez**. Mevcut production'da premium kuş 16 px'de okunmaz; wireframe arc (Aile B) yanlışlıkla daha iyi okunur — bu evrimde B, A'nın M0/M1 türevi olmalıdır.

---

## Mevcut durum

| Boyut bandı | Mevcut asset | Okunabilirlik | Aile |
|-------------|--------------|---------------|------|
| 16 px | `leylektag-icon.png` / `favicon.png` | Arc+dot ⚠️; pin SVG glow çamur | B |
| 24–32 px | `leylektag-icon.png` navbar | Wireframe OK; kuş yok | B |
| 48 px | adaptive foreground | Wireframe | B |
| 64–128 px | premium PNG küçültülmüş | Detay birleşir | A |
| 256–512 px | premium PNG | İyi | A |
| 1024 px | `ios.premium.logo.png` | İyi; squircle clip risk | A |

---

## Kullanılan mevcut dosyalar

| Dosya | Boyut kullanımı |
|-------|-----------------|
| `frontend/assets/images/favicon.png` | Expo web ~32 px |
| `frontend/assets/images/adaptive-icon-foreground.png` | 432 dp safe |
| `website/public/store/leylektag-icon.png` | 16–512 PWA |
| `frontend/assets/images/leylek-logo-premium.png` | Notification (küçük mono risk) |
| `frontend/assets/ios.premium.logo.png` | 1024 App Store |

---

## Tier sistemi (16–1024 px)

| Tier | Px aralığı | Görünür öğeler | Retire öğeler |
|------|------------|----------------|---------------|
| **M0** | 16–20 | Accent dot + lock ring arc (stroke) | Kuş, gaga, bacak, horizon, emboss |
| **M1** | 24–31 | M0 + horizon hint (1 px çizgi) | Kuş detay |
| **S** | 32–63 | Sadeleşmiş kuş siluet + arc | Bacak, gaga ince detay, emboss |
| **M** | 64–127 | Tam profil; gaga okunur | Bacak (opsiyonel 64'te gizli) |
| **L** | 128–1024 | Full premium; tek ayak; emboss | — |

### Boyut → tier eşlemesi

| Px | Tier | Hedef yüzey |
|----|------|-------------|
| 16 | M0 | Favicon, notification tray |
| 20 | M0 | Android status bar compact |
| 24 | M1 | Widget tile, navbar compact |
| 32 | M1/S | Navbar @2x, tab bar |
| 48 | S | Map marker companion, Android mdpi icon |
| 64 | S/M | Leylek Zeka tile sm |
| 96 | M | Login header compact |
| 128 | M/L | Splash JS küçük ekran |
| 256 | L | Store icon intermediate |
| 512 | L | Master export, PWA 512 |
| 1024 | L | iOS App Store, Play high-res |

---

## Detay matrisi (hangi detay hangi boyutta)

| Detay | 16 | 24 | 32 | 48 | 64 | 96 | 128+ |
|-------|----|----|----|----|----|----|------|
| Accent dot | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Lock ring arc | ✅ stroke | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Horizon line | ❌ | ✅ hint | ✅ | ✅ | ✅ | ✅ | ✅ |
| Kanat sweep | ❌ | ❌ | ✅ sade | ✅ | ✅ | ✅ | ✅ full |
| Gaga profili | ❌ | ❌ | ❌ | ⚠️ hint | ✅ | ✅ | ✅ |
| Boyun eğrisi | ❌ | ❌ | ❌ | ✅ blob | ✅ | ✅ | ✅ |
| Gövde metal | ❌ | ❌ | ❌ | flat | flat | light | L emboss |
| Tek ayak | ❌ | ❌ | ❌ | ❌ | ❌ | ⚠️ | ✅ |
| 3D arc shading | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | flat→light |

---

## Micro icon kuralları (M0)

- Canvas: 16×16 ve 20×20 zorunlu test.
- İçerik: yalnızca arc sweep (~240°) + 2–3 px accent dot.
- Stroke: 1.5 px @16 (scale ile orantılı).
- Arka plan: transparent (favicon) veya Void `#0D1117` (app icon ground ayrı).
- **Yasak:** glow, gradient, iç kanat path, pin teardrop.

---

## Favicon kuralları

| Platform | Boyutlar | Tier | Dosya hedefi (P8) |
|----------|----------|------|-------------------|
| Browser tab | 16, 32 | M0/M1 | `website/public/store/favicon-*.png` |
| PWA | 192, 512 | S/L | `BRANDING_PATHS.icon192/512` |
| Expo web | 48 | S | `frontend/assets/images/favicon.png` |
| ICO bundle | 16+32+48 | M0–S | opsiyonel `favicon.ico` |

**Mevcut sorun:** Tüm favicon yolları `leylektag-icon.png` (B) — app icon (A) ile uyumsuz.

---

## Notification icon kuralları

| Parametre | Mevcut | Hedef |
|-----------|--------|-------|
| Asset | `leylek-logo-premium.png` (A) | Tier M0 monochrome |
| Tint | `#22D3EE` | `#00D4AA` genom |
| Arka plan | Android adaptive mono | Beyaz siluet + tint |
| Boyut | 24×24 dp | M0 export |

**Sorun:** Premium PNG detaylı — küçük mono tray'de blob.

---

## Map marker küçük boyut uyumu

`design-lab/markers/constitution.md` ile hizalama:

| Parametre | Marker @48 | Logo tier S @48 |
|-----------|------------|-----------------|
| Stroke min | 2 px | 2.5 px → 2 px scale |
| Accent | Meridian Cyan | Aynı token |
| Corner radius | 2–4 px | Paylaşımlı dil |
| Negatif alan | ≥30% | ≥30% |

**Kural:** Logo M0/S, harita marker'ı ile **aynı accent + stroke ailesi**; pin formu marker'da da retire hedefi (ayrı program).

**Leylek Zeka FAB @18–28 px:** M1 tier; LeylekEye companion ayrı (göz only).

---

## Sorunlar

| ID | Sorun | Severity |
|----|-------|----------|
| SS-01 | Tier ladder tanımlı değil — tek PNG scale | P0 |
| SS-02 | 16 px premium kuş okunmaz | P1 |
| SS-03 | Favicon (B) ≠ app icon (A) | P0 |
| SS-04 | Notification detay kaybı | P1 |
| SS-05 | Retina ladder manuel | P2 |

---

## Marka riski

- M0'da arc+dot yeterince "leylek" okunmazsa → generic tech dot riski → blind test ≥85%.
- Tier atlama (16 px'e L-tier koymak) → çamur → tanınırlık kaybı.

---

## Teknik risk

- Otomatik scale (Image resize) tier kurallarını ihlal eder — **ayrı export zorunlu**.
- @3x ladder dosya sayısı artışı — manifest ile yönetim.

---

## İleride değişebilecek dosyalar

| Dosya | Faz |
|-------|-----|
| `design-lab/brand-dna/v4/logo-evolution/exports/png/tier-*/` | P4 |
| `frontend/assets/images/favicon.png` | P8 |
| `website/public/store/leylektag-icon.png` | P8 → M0/M1 |
| `frontend/assets/images/leylek-logo-premium.png` | P8 (L-tier) |

---

## Kesinlikle dokunulmamalı (P1)

- Production PNG scale script ile değiştirmek (kalite kaybı)
- Marker production dosyaları (logo evolution kapsamı dışı üretim)

---

## Önerilen üretim stratejisi

1. P4: Master SVG layer visibility → 16, 24, 32, 48, 64, 96, 128, 256, 512, 1024 PNG export (design-lab).
2. Her boyutta red-team: Uber pin, Google pin, generic bird.
3. manifest.json: `size → tier → sha256`.
4. P8: Path mapping tablosu ile production swap.

---

## Rollback planı

- design-lab tier exports: git revert.
- P8: önceki `leylektag-icon.png` backup restore.

---

## QA kriterleri

| Boyut | Pass kriteri |
|-------|--------------|
| 16 px | Dot + arc hint; glow yok; 1 px padding |
| 24 px | Horizon okunur; pin karışmaz |
| 32 px | Kuş siluet başlar; navbar mock pass |
| 48 px | Marker stroke hizası |
| 64 px | Leylek Zeka tile net |
| 1024 px | Squircle simülasyon; bacak kesilmez |

---

## Production migration sırası

1. M0/M1 export + favicon QA (P4)
2. S tier → adaptive + navbar (P5)
3. L tier → splash + premium master (P8)
4. Notification M0 mono (P8, Android plugin)

---

**İlişkili:** `APP_ICON_SYSTEM_SPEC.md`, `LOGO_QA_PLAN.md`
