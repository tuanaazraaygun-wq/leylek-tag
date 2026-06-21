# Area 10 — Watermark System Analysis

**Phase:** P1-1 — Logo Evolution Full Analysis  
**Mode:** Read-only production scan  
**Date:** 2026-06-21

---

## Executive summary

Watermark kullanımı **dar ve tutarlı**: yalnızca `MuhabbetWatermark.tsx` production'da premium kuş PNG kullanıyor. Opacity %6; harita/ içerik üstü filigran. Evrimde L-tier → monochrome M-tier export ihtiyacı; opacity kuralları dokümante edilmeli.

---

## Mevcut durum

### Nerelerde kullanılıyor

| Bileşen | Asset | Opacity | Boyut |
|---------|-------|---------|-------|
| `MuhabbetWatermark.tsx` | `leylek-logo-premium.png` | 0.06 (6%) | 72% width, max 320×220 |
| Harita "watermark" (Google) | Google logo | — | LeylekZekaWidget layout notu only |

**Grep sonucu:** Başka production watermark bileşeni yok. Website legal sayfalarında watermark yok.

### MuhabbetWatermark implementasyonu

```typescript
// opacity: 0.06, pointerEvents: none, absoluteFill
source: leylek-logo-premium.png
width: '72%', maxWidth: 320, height: 220
```

Tüketici: Muhabbet (Leylek Teklif Sende) sekmeleri — arka plan filigranı.

---

## Kullanılan mevcut dosyalar

| Dosya | Rol |
|-------|-----|
| `frontend/components/MuhabbetWatermark.tsx` | Tek watermark bileşeni |
| `frontend/assets/images/leylek-logo-premium.png` | Filigran kaynağı |
| `frontend/components/LeylekMuhabbetiHomeTab.tsx` | Muhtemel parent (watermark mount) |

**Not:** `leylek-blue.png` / `leylek-header.png` illüstrasyon — watermark değil.

---

## Opacity kuralları

| Yüzey | Mevcut | Hedef spec |
|-------|--------|------------|
| Muhabbet içerik BG | 0.06 | 0.05–0.08 aralığı |
| Harita overlay | kullanılmıyor | YASAK (okunurluk) |
| Export / screenshot | — | 0.10 max marketing |
| Print | — | 0.15 monochrome (gelecek) |

**Kural:** Watermark asla %10 üstüne çıkmaz — içerik okunurluğu öncelik.

---

## Dark / light davranışı

| Tema | Mevcut | Evrim |
|------|--------|-------|
| Dark (app) | Premium PNG düşük opacity | Monochrome white @ 6% |
| Light | N/A | Void stroke @ 4% (gelecek) |

Premium PNG 3D detay düşük opacity'de **gürültü** (P2) — monochrome export tercih.

---

## Harita üzerinde görünürlük

- Logo watermark haritada **kullanılmıyor** ✅.
- LeylekZekaWidget harita sol alt — Google watermark üstü konumlandırma; Leylek mark değil watermark.
- **Yasak:** Harita tile üstü yüksek opacity logo — marker/UX çakışması.

---

## Legal / website kullanımı

| Yüzey | Watermark | Not |
|-------|-----------|-----|
| Website legal | Yok | Header logo only |
| Backend templates | Header `leylek-logo.png` | Broken image P0 — watermark değil |
| PDF export | Yok | Gelecek spec |

---

## Export ihtiyacı

| Export | Tier | Format | Kullanım |
|--------|------|--------|----------|
| `watermark-muhabbet-dark.png` | L monochrome | PNG alpha | Muhabbet 6% |
| `watermark-muhabbet-light.png` | L mono void | PNG | Gelecek light |
| SVG watermark | stroke-only | SVG | Opsiyonel; PNG tercih RN |

**P4:** design-lab export; P8 production swap opsiyonel (mevcut PNG scale de çalışır).

---

## Sorunlar

| ID | Sorun | Severity |
|----|-------|----------|
| WM-01 | L-tier detay düşük opacity gürültü | P2 |
| WM-02 | Watermark spec dokümante değil | P2 |
| WM-03 | Monochrome varyant yok | P2 |
| WM-04 | Tek bileşen — merkezi token yok | P3 |

---

## Marka riski

- Opacity artışı → "reklam filigranı" algısı.
- Haritada watermark → güven kaybı / okunurluk.

---

## Teknik risk

- Büyük PNG scale → memory (Muhabbet tab).
- `resizeMode: contain` + %72 width — farklı ekranlarda tutarsız optik boyut.

---

## İleride değişebilecek dosyalar

| Dosya | Faz |
|-------|-----|
| `design-lab/.../exports/png/watermark-*` | P4 |
| `frontend/components/MuhabbetWatermark.tsx` | P8 (source path only) |
| `frontend/assets/images/leylek-logo-premium.png` | P8 veya ayrı watermark asset |

---

## Kesinlikle dokunulmamalı (P1)

- Opacity 0.06 değeri (P8 öncesi — UX onayı gerekir)
- `pointerEvents: none` pattern
- Muhabbet layout z-index

---

## Önerilen üretim stratejisi

1. P3: Watermark opacity constitution addendum (0.05–0.08).
2. P4: Monochrome white watermark export @ 512 (design-lab).
3. P8 (opsiyonel): `MuhabbetWatermark` ayrı asset path — `leylek-logo-premium.png` yerine `watermark-muhabbet-dark.png`.
4. Harita watermark **ekleme** — yasak.

---

## Rollback planı

- Revert watermark asset path → premium PNG.
- design-lab exports git revert.

---

## QA kriterleri

| Test | Pass |
|------|------|
| Muhabbet tab | Filigran görünür ama içerik okunur |
| Opacity measure | 5–8% |
| Dark BG | Gürültü yok |
| iPhone SE / tablet | Oran tutarlı |
| Screenshot share | Mark belli, içerik baskın değil |

---

## Production migration sırası

1. Watermark spec freeze (P3)
2. Monochrome export (P4)
3. Opsiyonel asset swap (P8 — düşük öncelik vs icon unification)

---

**İlişkili:** `GEOMETRY_EVOLUTION_ANALYSIS.md`, `VECTOR_MASTER_SPEC.md` (monochrome variant)
