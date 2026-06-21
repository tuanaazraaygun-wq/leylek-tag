# Area 9 — Leylek Zeka Logo Analysis

**Phase:** P1-1 — Logo Evolution Full Analysis  
**Mode:** Read-only production scan  
**Date:** 2026-06-21

---

## Executive summary

Leylek Zeka **iki companion mark** kullanıyor: premium kuş PNG (logo) + LeylekEye SVG (göz/AI orb). Web'de premium → wireframe fallback. Evrimde göz/accent **korunur**; iris rengi genom `#00D4AA` ile hizalanır. Logo + Eye ilişkisi netleştirilmeli — dual mark P2 risk.

---

## Mevcut durum

### Mobil

| Bileşen | Mark | Boyut | Aile |
|---------|------|-------|------|
| `LeylekZekaChat.tsx` | premium PNG header | ~32–48 px | A |
| `LeylekZekaWidget.tsx` | premium PNG + LeylekEye overlay | 18–28 px tile | A + göz |
| `LeylekEyeTrigger.tsx` | LeylekEye FAB | 50–66 px | Göz only |
| `TagMatchTransitionOverlay.tsx` | LeylekEye | 66 px | Göz |
| `RatingModal.tsx` | LeylekEye | 49 px | Göz |
| `LeylekAIFloating.tsx` | LeylekEye / orb chrome | varyant | Göz |

### Web

| Bileşen | Mark | Fallback |
|---------|------|----------|
| `leylek-zeka-mark.tsx` | `/store/leylek-logo-premium.png` | `leylektag-icon.png` (B) |
| `site-support-phone-shell.tsx` | LeylekZekaMark tile | — |

### API / routing (logo değil)

- `leylekZekaPath`: `ai/leylekzeka` — `app.json` extra.
- Backend upstream — marka görseli etkilemez.

---

## Kullanılan mevcut dosyalar

| Dosya | Rol |
|-------|-----|
| `frontend/assets/images/leylek-logo-premium.png` | Chat/widget header |
| `frontend/design-system/leylek-eye/LeylekEye.tsx` | AI orb SVG |
| `frontend/components/LeylekZekaWidget.tsx` | Dual mark |
| `frontend/components/LeylekZekaChat.tsx` | Logo avatar |
| `website/public/store/leylek-logo-premium.png` | Web primary |
| `website/components/leylek-zeka-mark.tsx` | Web mark + fallback |
| `design-lab/brand-dna/v4/AI_DNA.md` | AI companion spec |

---

## Göz / AI orb kullanımı

`LeylekEye.tsx`:
- Iris gradient: `#38BDD4` → `#064E60` — genom `#00D4AA` drift.
- Sclera: slate gradient — premium navy uyumlu.
- Motion: `useLeylekEyeMotion` — look, blink, pupil.
- Sizes: HERO 66, ROLE_SELECT 49, VIEW 50.

**Logo göz accent:** Premium PNG cyan dot — static; LeylekEye — animated companion.

---

## Logo ile ilişkisi

| İlişki | Kural |
|--------|-------|
| Accent rengi | Logo dot = Eye iris hue family |
| Form | Eye **ayrı** mark — logo silueti kopyalamaz |
| Boyut | Widget < 32 px: Eye veya M1 logo — ikisi üst üste kalabalık |
| Motion | Eye animasyonlu; logo static (widget'da PNG static) |

**Constitution:** Göz = logo accent türevi; ayrı mascot değil.

---

## Göz korunacak mı?

**Evet.** LeylekEye companion DNA'sı korunur:
- Animasyonlu presence (LHIS).
- Iris cyan kalibrasyonu (renk only).
- Logo evrimi Eye formunu değiştirmez — token hizası yapar.

---

## Motion ilişkisi

| Olay | Logo | LeylekEye |
|------|------|-----------|
| Widget open | Static PNG | Eye focus trigger |
| Match transition | — | Eye hero 66px |
| Pre-match wait orb | PNG tile + hint | Eye FAB map |
| Boot splash | breathe | — |

`design-lab/lsx/LSX_MOTION_LANGUAGE.md` — `presence.pulse` logo; Eye ayrı profil.

---

## White / dark uyumu

| Yüzey | Dark | Light |
|-------|------|-------|
| Widget tile | Navy border + cyan glow | N/A (dark app) |
| Web tile | `bg-[rgba(15,30,52,0.88)]` | Site dark theme |
| Eye chrome | `PREMIUM_NAVY_CARD` | subtle tone |

Eye ve logo dark-primary optimize — light theme gelecekte inverse token.

---

## App içi riskler

| ID | Risk | Severity |
|----|------|----------|
| LZ-01 | Widget dual mark (PNG + Eye) kalabalık | P2 |
| LZ-02 | Web fallback B — A/B flash | P2 |
| LZ-03 | Iris `#38BDD4` ≠ logo `#00D4AA` | P2 |
| LZ-04 | 18 px tile premium PNG detay kaybı | P1 |
| LZ-05 | Map FAB vs Google watermark overlap | P3 (layout) |

---

## Marka riski

- Eye aşırı oyunlaştırılırsa → mascot algısı (yasak).
- Logo Eye'dan koparsa → AI moru/cyberpunk drift.
- Web fallback wireframe → Zeka = farklı marka.

---

## Teknik risk

- `LeylekZekaWidget.tsx` büyük dosya — asset path scatter.
- Lazy `LeylekZekaChat` — logo preload yok.
- Web `onError` fallback — B icon yükler.

---

## İleride değişebilecek dosyalar

| Dosya | Faz | Değişiklik |
|-------|-----|------------|
| `frontend/assets/images/leylek-logo-premium.png` | P8 | M-tier widget |
| `website/public/store/leylek-logo-premium.png` | P8 | Sync |
| `website/components/leylek-zeka-mark.tsx` | P8 | Fallback → M1 tier |
| `frontend/design-system/leylek-eye/LeylekEye.tsx` | P8-2 | Iris token only |
| `frontend/components/LeylekZekaWidget.tsx` | P8 | Asset path only |

---

## Kesinlikle dokunulmamalı (P1)

- LeylekEye animasyon logic / motion profiles
- Zeka API routing
- Widget positioning constants (harita layout)
- Eye companion **formu** (siluet)

---

## Önerilen üretim stratejisi

1. P4: M-tier 64–96 px export — widget header.
2. P8: Widget logo path → M-tier PNG.
3. P8-2: LeylekEye iris → `#00D4AA` token (minimal SVG stop change).
4. P8: Web fallback → M1 `leylektag-icon.png` (evrim sonrası aynı aile).
5. Dual mark policy doc: <28 px Eye-only opsiyonu (P6 UX spec, kod P8+).

---

## Rollback planı

- Restore premium PNG + LeylekEye.tsx.
- Web mark primary/fallback paths revert.

---

## QA kriterleri

| Test | Pass |
|------|------|
| Widget 18/22/28 px | Tanınır |
| Chat header | M-tier net |
| Web tile | Premium loads; fallback same family |
| Eye + logo side by side | Renk uyumu |
| Match overlay 66 px | Eye OK |
| Blind "AI assistant" | LeylekTAG association |

---

## Production migration sırası

1. M-tier logo export (P4)
2. Widget + chat PNG swap (P8)
3. Web `leylek-zeka-mark.tsx` fallback update (P8)
4. LeylekEye iris token (P8-2)
5. Dual mark policy implementation (post-P8 opsiyonel)

---

**İlişkili:** `design-lab/brand-dna/v4/AI_DNA.md`, `WATERMARK_SYSTEM_ANALYSIS.md`
