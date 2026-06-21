# LeylekTAG V4 — Creative Directions A / B / C

**Version:** Phase 1 Production Analysis  
**Status:** Sketch yönü önerisi — çizim yok  
**Parent:** `LOGO_PRODUCTION_MASTER_ANALYSIS.md`, `LOGO_CONSTITUTION.md`

---

## Karşılaştırma Özeti

| Kriter | Direction A | Direction B | Direction C |
|--------|-------------|-------------|-------------|
| Form | Meridian Arc | Negative Space Stork | Sealed Ring Mark |
| Kuş | Soyut kanat arc | Negatif alan kuş | Arc only — kuş implicit |
| Horizon | Zorunlu | Zorunlu | Ring = horizon |
| Ring | İnce idle | Opsiyonel | Birincil taşıyıcı |
| Pin | Yok | Yok | Yok |
| Phase 2 öneri | **Birincil sketch** | **Paralel test** | **Yedek** |

---

## Direction A — Meridian Arc

### Tanım

Yatay **meridian horizon** (alt üçte bir) + tek **leylek kanat arc** (sağa/yukarı +2–4°) + **cyan accent dot** kesişimde + ince **lock ring** (idle stroke, QR'da animate).

```
        ╭── wing arc ──╮
   ─────●─────────────●─────  horizon
        ╲   ring     ╱
         ╰──────────╯
```

### Neden seçilir

| Faktör | Değerlendirme |
|--------|---------------|
| Marka ömrü | En yüksek — geometry tabanlı; BMW/Apple restraint |
| Premium hissi | Sessiz precision; bağırmayan cyan nokta |
| Uluslararası algı | Soyut = kültür bağımsız; leylek arc Türkiye hikayesi |
| 16 px | M0 dot + horizon — geçer |
| Motion/ses | A3 horizon + pulse arc; lock ring native |
| Marker genom | Destination stem + arc aynı dil |
| Constitution | Tam uyum — Phase 0 default |

### Neden seçilmez

| Risk | Mitigasyon |
|------|------------|
| "Kuş" okunmayabilir | Kör test ≥80%; negatif alan B ile karşılaştır |
| Çok soyut = generic tech | Accent dot + wordmark LeylekTAG |
| Ring + arc karmaşık @ 16 px | Tier M0 ring gizle |

### Üretim zorluğu

| Alan | Zorluk |
|------|--------|
| SVG | Orta — tek path disiplini |
| Lottie | Orta — ring shared component |
| Print | Kolay — monochrome |
| Adaptive icon | Kolay — squircle safe |
| Sketch | 3 arc angle varyantı |

**Skor:** Önerilen **birincil yön** Phase 2.

---

## Direction B — Negative Space Stork

### Tanım

Horizon + wing arc ile oluşan **negatif alan**ta okunan stilize leylek silueti (FedEx/NBC mantığı). Dış contour minimal; kuş **iç boşlukta**.

```
        ╭──────────────╮
   ─────│  🐦 negatif  │─────  horizon boşluğu = kuş
        ╰──────────────╯
```

### Neden seçilir

| Faktör | Değerlendirme |
|--------|---------------|
| Marka ömrü | Yüksek — clever mark; unutulmaz |
| Premium hissi | Zeka + restraint; luxury wordmark uyumu |
| Uluslararası algı | Negatif alan = design-forward |
| Leylek okunurluğu | Tam kuştan yüksek; arc-only'den yüksek |
| Storytelling | Göç kuşu metaforu görsel olarak net |

### Neden seçilmez

| Risk | Mitigasyon |
|------|------------|
| Küçük boyutta negatif alan kaybolur | Filled fallback tier; M0'da arc-only |
| Sketch karmaşıklığı | 2–3 iterasyon max; over-clever red |
| Monochrome print | Boşluk kaybolabilir — filled variant zorunlu |
| Üretim | İki path state (negatif vs filled) QA |

### Üretim zorluğu

| Alan | Zorluk |
|------|--------|
| SVG | Yüksek — path boolean / compound |
| Lottie | Orta — negatif alan anim zor |
| 16 px | Zor — M0 arc fallback şart |
| Embroidery | Orta — negatif alan zor |

**Skor:** **Paralel sketch** — A ile kör test kazanan seçilir.

---

## Direction C — Sealed Ring Mark

### Tanım

**Kapalı ring** (lock metaforu birincil) içinde minimal kanat arc veya chevron — horizon ring'in alt çapak segmenti. Kuş **implicit**.

```
         ╭─────────╮
         │  arc    │
         ╰────●────╯  ← accent + horizon segment
```

### Neden seçilir

| Faktör | Değerlendirme |
|--------|---------------|
| Lock/QR | En güçlü — ring = marka |
| Trust / güven | Kapalı form = güven %19 |
| Motion | Ring close = boot'ta micro pulse |
| Tesla/Apple | Precision seal mantığı |
| Watch | Ring @ 44 px okunabilir |

### Neden seçilmez

| Risk | Mitigasyon |
|------|------------|
| Leylek metaforu zayıf | Wordmark ağırlık; arc içi zorunlu |
| Generic seal/badge | Uber circle, app badge ailesi |
| Aşırı teknoloji | Tron halka riski — stroke ince tut |
| Horizon metaforu | Ring'e absorbe — A3 sonic bağ zayıf |

### Üretim zorluğu

| Alan | Zorluk |
|------|--------|
| SVG | Kolay |
| Lottie | Kolay — ring native |
| Farklılaşma | Zor — kör test kritik |
| 10 yıl | Orta — seal logolar çok |

**Skor:** **Yedek yön** — A/B fail ise veya lock-first stakeholder talebi.

---

## Yön Seçim Matrisi (Phase 1 öneri)

| Gate | A | B | C |
|------|---|---|---|
| Constitution uyum | ✅ | ✅ | ⚠️ horizon |
| 16 px pass (tasarım) | ✅ | ⚠️ | ✅ |
| Leylek okunurluk | ⚠️ | ✅ | ❌ |
| Lock multimodal | ✅ | ✅ | ✅✅ |
| Uber/pin red team | ✅ | ✅ | ⚠️ |
| Sketch effort | Orta | Yüksek | Düşük |
| **Phase 2 öncelik** | **1** | **2** | **3** |

---

## Phase 2 Sketch Brief (yön bazlı)

### A — 3 sketch

- Ascend 2°, 3°, 4°
- Ring inset 10%, 12%, 14%
- Accent dot vs 4 px line

### B — 2 sketch

- Negatif kuş okuma strong vs subtle
- Filled fallback companion

### C — 1 sketch

- Ring-primary + minimal arc
- Red team vs generic badge

**Kör test:** n≥8, 24 px, yan yana Uber pin, Google pin, Bolt, generic circle app.

---

**Non-goals:** Sketch üretimi Phase 2'de başlar.
