# Finalist F2 — Horizon Stork Gap (S13)

**Sketch ID:** S13  
**Yön:** Direction B — Negative Space  
**Status:** Production sheet — Phase 2 finalist  
**Evrim:** Kanat arc + horizon kırılması → gap'te leylek gövdesi okunur; PNG kuş silueti geometry'ye indirgenir (gaga/bacak yok)

---

## Wireframe (master)

```
        ╭──── wing arc ────╮
   ────               ────   ← horizon iki segment
         ╲  gap=stork ╱
          (negatif boşluk)
```

---

## Evrim tanınırlığı

| Mevcut | F2'de |
|--------|-------|
| PNG kuş profili | Gap negatif alan — aynı hikaye, geometry |
| SVG kanat | Üst arc korunur |
| Pin | Yok |
| Orbital arc | Opsiyonel ince ring **dış** — sketch F2'de ring yok; Phase 3 eklenebilir |

**Beklenen algı:** *"Leylek daha net; logo aynı ailede sadeleşmiş."*

---

## Meridian Cyan bölgeleri

| Bölge | Kullanım | Statik | Motion |
|-------|----------|--------|--------|
| Accent dot | Horizon kesişim veya gap merkezi | Cyan | Boot glow |
| Gap içi | **Cyan yok** — negatif boşluk | — | — |
| Ring (opsiyonel Phase 3) | Dış ince stroke | White idle | Cyan QR peak |
| QR flash | Ring veya arc peak | — | Cyan 0.50 |

**Gradient:** Yok. Gap = boşluk okuma — cyan doldurma **yasak**.

---

## Yüzey değerlendirmesi

| Yüzey | Davranış | Tier | Not |
|-------|----------|------|-----|
| **App Icon** | Gap okunur @ 48+; 1024 tam | F | 29 px simplified |
| **Adaptive Icon** | Filled fallback tier şart küçük için | F + filled M1 | Android mono |
| **Splash** | presence pulse; gap nefes opacity | F→motion | Dramatik ama sakin |
| **Login** | Statik; gap = güven boşluk | S | Premium clever |
| **Harita** | Watermark — gap kaybolur | M0 mono | Arc only watermark |
| **QR** | Ring eklense ringClose; yoksa arc flash | ring opsiyonel | Marker sync |
| **Watch** | M1 simplified — gap hint | M1 | Complication M0 arc |
| **Widget** | S statik | S | Gap @24px zayıf |
| **Website** | Hero — negatif okuma güçlü | F | Büyük boyut showcase |
| **Favicon** | M0 arc + line; gap gizli | M0 | Filled alt tier |
| **AI Orb** | Gap → "eye" abstract | F | Robot yüz yok |

---

## Logo ↔ Marker

| | Logo F2 | Marker |
|---|---------|--------|
| Rol | Marka — leylek hikayesi | Navigasyon siluet |
| Ortak | Horizon stroke; cyan accent; 2–4px radius | Destination stem rhyme |
| Fark | Negatif kuş | Dolu role siluet |
| Aynısı | **Değil** — form dili ortak |

---

## Motion

| Olay | Davranış | Not |
|------|----------|-----|
| **Boot** | Arc scale pulse; gap opacity 0.9↔1.0 subtle | Negatif "nefes" |
| **Match** | Gap warm resolve flash outer | İç gap cyan yok |
| **QR** | Ring (if added) close; else arc inward snap | Phase 3 karar |
| **Payment** | checkDraw symbol üstü | |
| **Trust** | Gap edge warm ring once | |
| **Leylek Zeka** | Gap brightness pulse = think | ai.think visual |
| **Idle** | Statik | |

---

## Sonic uyumu

| Olay | Token | F2 eşleşme |
|------|-------|------------|
| **Boot** | presence.boot | Gap = sonic gap 120ms metafor ★ |
| **QR** | qr.success A4 | Ring yoksa arc snap |
| **Match** | match.success | Warm = gap human moment |
| **Offer** | offer relay | İki horizon segment = iki faz ★ |
| **Payment** | payment.confirmed | Handshake close |

**Uyum puanı:** 9/10 — gap↔sonic gap semantik zengin.

---

## Risk & Phase 3

| Risk | Mitigasyon |
|------|------------|
| 16px gap kayıp | `logo.filled.dark` companion |
| Üretim karmaşık | Compound path QA |
| Ring eksik | Opsiyonel dış ring — F1 merge test |

**Kör test:** F2 leylek okuma vs F1 arc — panel ≥80% LeylekTAG her ikisinde.

---

## Puan özeti (S13)

Fav 7 · Watch 7 · Icon 8 · Marker 9 · Motion 8 · Sonic 9 · 10yr 9 · **Ort 8.3**
