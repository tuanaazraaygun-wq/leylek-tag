# Logo ↔ Marker Shared Genom — Production Phase 1

**Version:** 1.0  
**Status:** Analysis only  
**Parent:** `LOGO_MARKER_LINK.md`, `MARKER_DNA.md`, `markers/constitution.md`, `LIGHT_DNA.md`

---

## 1. Temel Soru

**Logo ve marker aynı geometriyi paylaşmalı mı?**

| Cevap | Detay |
|-------|-------|
| **Aynı genom** | Evet — stroke, radius, cyan, ring anim, motion timing, glow kuralları |
| **Aynı siluet** | Hayır — logo = marka arc; marker = role siluet |
| **Aynı path kopyası** | Hayır — ortak **parametreler**, ortak **Lottie ring component** |

---

## 2. Ortak Genom Tablosu

| Parametre | Logo | Marker | Ortak? | Production notu |
|-----------|------|--------|--------|-----------------|
| **Stroke** | 2.5 px @ 512 | 2 px min @ 48 | ✅ Orantılı | SVG `stroke-width` token `--genom-stroke` |
| **Corner radius** | 2–4 px | 2–4 px | ✅ | `--genom-radius` |
| **Meridian Cyan** | `#00D4AA` accent | Glow 15–40% | ✅ Exact hex | QA color picker 0 tolerance |
| **Depth Slate** | Icon ground | Marker gövde | ✅ | `--genom-slate` |
| **Trust White** | Symbol stroke | Edge 85% | ✅ | `--genom-white` |
| **Glow max** | 0.25 boot; 0.50 lock | 0.70 harita cap | ⚠️ Logo daha düşük | Ayrı token scale |
| **Ring anim** | lock.ringClose 320 ms | lock.ringClose 320 ms | ✅ **Aynı** | Shared Lottie layer Phase 3 |
| **Breathe** | Splash hold only | Idle 2 s loop | ⚠️ Aynı amplitude | scale ±2%; opacity ±30% marker |
| **Horizon** | Zorunlu çizgi | Destination dot+stem | ✅ Metafor | Aynı stroke ailesi |
| **Pin teardrop** | Yasak | Yasak | ✅ | Constitution align |
| **Motion easing** | Premium stop | Premium stop | ✅ | Aynı bezier |
| **Light frost** | AI orb edge | — | ⚠️ Logo/AI only | Marker'da frost yok |

---

## 3. Stroke — Ortak mı?

**Evet.** Tek stroke genomu:

```
master_512: 2.5 px
export_48:  2.0 px (min)
export_24:  1.5 px (M1 — simplified)
```

Marker constitution §4: küçük boyut kalın siluet — logo filled tier küçük boyutta marker ile **görsel ağırlık** uyumu.

**Production:** `design-lab/brand-dna/v4/exports/genom.tokens.css` (Phase 3) — logo + marker import.

---

## 4. Radius — Ortak mı?

**Evet.** 2–4 px corner language — UI kartları, marker, logo aynı "keskin ama acımasız" dil.

Oyuncak yuvarlak (8+ px) — **yasak** her iki katmanda.

---

## 5. Glow — Ortak mı?

**Kurallar ortak; opacity cap farklı.**

| Token | Logo | Marker | Ortak pattern |
|-------|------|--------|---------------|
| presence | 0.25 max | 0.15–0.25 idle | Cyan fade 120 ms |
| lock | 0.50 peak | 0.50 peak | 80 ms flash |
| relay | — | 0.30–0.40 | Logo ingress header only |
| journey | warm 0.20 | warm 0.20 | Match |
| ai | 0.35 max | 0.20–0.35 map | Orb vs overlay |

**Production:** Glow = runtime layer; SVG filter embed **yasak** (mevcut logo hatası).

---

## 6. Ring — Ortak mı?

**Evet — kritik multimodal bağ.**

| Özellik | Değer |
|---------|-------|
| Animasyon | stroke-dashoffset 100%→0 |
| Süre | 320 ms |
| Easing | Lock snap |
| Peak | Cyan flash @ 80 ms |
| Ses | A4 qr.success |
| Haptic | lock |

Logo ring path ≠ marker ring path (farklı bounding box) ama **aynı animasyon spec + aynı Lottie expression**.

Phase 3: `shared-ring-close.json` — logo ve marker instance.

---

## 7. Motion — Ortak mı?

| Token | Logo | Marker | Sync |
|-------|------|--------|------|
| presence.pulse | Boot | — | — |
| lock.ringClose | QR overlay | QR state | **Frame sync** |
| relay.ingress | Header | Offer pin | Event sync |
| pulse.journey | breathe subtle | connection line | Event sync |
| waiting.breathe | splash hold | idle marker | Same period 2000 ms |

**Production LSX:** `fireTriad('qr.verified')` — logo channel + marker channel + sonic + haptic.

---

## 8. Light — Ortak mı?

| Öğe | Logo | Marker | Ortak |
|-----|------|--------|-------|
| Cyan semantic | Aktif | Aktif | ✅ |
| Warm resolve | Match overlay | Trust/journey end | ✅ |
| Amber caution | Error | Error | ✅ |
| Frost edge | AI orb | — | Logo/AI |
| Shadow | subtle | drop 2px | Aynı aile rgba |

Marker constitution §10: UI ile aynı karakter — logo light DNA = marker light DNA.

---

## 9. Üretim Pipeline (Phase 3 hedef)

```
genom.tokens (stroke, radius, colors)
        │
        ├── logo-master.svg (wing, horizon, ring, accent)
        ├── marker-car.svg (siluet + ring instance)
        ├── marker-human.svg
        ├── marker-motor.svg
        └── shared/
            ├── ring-close.lottie
            └── breathe-loop.lottie (marker; logo splash optional)
```

---

## 10. Mevcut Production Kopuklukları

| Kopukluk | Logo | Marker spec | Fix Phase |
|----------|------|-------------|-----------|
| Form | Pin vs kuş | Siluet spec | 2–3 |
| Renk | #67E8F9 gradient | #00D4AA | 3 |
| Ring anim | Yok | Spec var | 4 |
| Shared Lottie | Yok | — | 4 |
| Glow filter SVG | Var | Runtime spec | 3 |

---

## 11. QA Checklist (genom birlikte)

- [ ] Hex cyan logo = marker glow source
- [ ] Ring close ±16 ms logo/marker
- [ ] Stroke oranı 512:48 = 2.5:2.0
- [ ] Pin form hiçbir export'ta yok
- [ ] Blind: harita "LeylekTAG" ≥80%

---

**Non-goals:** Marker SVG üretimi Phase 1'de yok — `design-lab/markers/` Phase 2 paralel.
