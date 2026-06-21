# White Theme DNA

**Sprint:** B-3  
**Parent:** `LIGHT_DNA.md`, `BRAND_CONSTITUTION_V4.md`  
**Date:** 2026-06-21

---

## North star

White Theme, dark temanın **negatif fotokopi değildir**. Aynı LHIS karakter:

> Sessiz premium · operasyon ciddiyeti · Meridian cyan nefes · glow restraint

**Test:** Gündüz ekranda kullanıcı "LeylekTAG kokpiti" der — generic beyaz form uygulaması değil.

---

## Core principles

| ID | Kural |
|----|-------|
| W-DNA-01 | **Form korunur** — layout, radius, glass hierarchy aynı |
| W-DNA-02 | **Renk token swap** — hex inversion değil, designed light palette |
| W-DNA-03 | **Glow ×0.7** — light zeminde (`LIGHT_DNA` §10) |
| W-DNA-04 | **Gölge yumuşak** — rgba(0,0,0,0.08–0.12), cyan tint shadow yasak ağır |
| W-DNA-05 | **Metin kontrast** — body ≥4.5:1 WCAG AA |
| W-DNA-06 | **Harita öncelik** — map overlay düşük opacity |
| W-DNA-07 | **Violet yasak** — logo/mark evolution ile uyumlu |
| W-DNA-08 | **Meridian `#00D4AA`** — primary accent (migrate from `#22D3EE`) |
| W-DNA-09 | **Frost edge** — Trust White highlight → Slate 8% edge light mode |
| W-DNA-10 | **Illustration** — role select heroes ayrı light variant veya overlay dim |

---

## Dark vs white — karakter matrisi

| Öğe | Dark (mevcut) | White (hedef) |
|-----|----------------|---------------|
| Zemin | Navy void `#08111F` | Mist `#F4F7FB` + warm gray `#EEF2F7` |
| Derinlik | Vignette koyulaşır | Vignette **açılaşır** (üst parlak) |
| Cam | Koyu rgba fill | Beyaz rgba 72% + blur |
| Metin birincil | `#F5F7FA` 94% | `#0D1117` 92% |
| Metin ikincil | Muted blue-gray | `#475569` |
| Accent | Cyan glow | Cyan **stroke/fill** — glow minimal |
| CTA | Cyan→blue gradient | Aynı gradient — contrast check |
| Hata | `#F87171` | Same hue — light BG test |
| Harita chrome | Koyu panel | Açık panel + ince border |

---

## Yasaklar (white-specific)

- Pure `#FFFFFF` full screen (eye strain)
- Black text `#000000` (too harsh — use `#0D1117`)
- Dark mode shadow opacity on white cards
- Neon outer glow on inputs
- Inverted logo without light variant asset
- Orange/green seeking colors on white (marker evolution retire)

---

## Logo & brand moments

| Yüzey | White behavior |
|-------|----------------|
| Splash | **Dark-only** brand moment (logo evolution) — white theme splash B3+ optional |
| Login | White theme supported |
| Theme choice | Live preview both |
| App icon | Unchanged |

---

## Multimodal (unchanged semantics)

| Katman | White note |
|--------|------------|
| LSX motion | Same durations |
| Sonic | Same — no theme sound |
| Haptic | Theme choice selection → `lsx.haptic.selection` |
| LeylekEye | Iris contrast increase on white FAB |

---

## Relationship to other programs

| Program | Link |
|---------|------|
| Logo evolution | Shared `#00D4AA` genom |
| Marker evolution | `WHITE_THEME_STRATEGY.md` map overlays |
| LIGHT_DNA | Glow registry authority |

---

**Sonraki:** `WHITE_COLOR_TOKEN_SPEC.md`, `WHITE_COMPONENT_SPEC.md`
